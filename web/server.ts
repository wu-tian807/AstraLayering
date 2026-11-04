import { createServer, type IncomingMessage } from 'node:http';
import { readFile, readdir, mkdir, mkdtemp, lstat, rm, writeFile, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, extname, resolve, join, isAbsolute, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { shadowMode } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { referencePath } from '../.agents/skills/live2d-maker/shadow/preparation.ts';
import { encodePng } from '../.agents/skills/live2d-maker/shared/png.ts';
import { runsDirectory, sectionIds, workflowsDirectory } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { acquireTaskLock, configureRun, directoryFor, readRun, saveRun, selectedSections, sectionId, taskStatus, type TaskOptions } from '../.agents/skills/live2d-maker/workflow/state.ts';
import { convertLayout } from '../.agents/skills/live2d-maker/workflow/layout.ts';
import { applyTaskAction } from '../.agents/skills/live2d-maker/workflow/step-actions.ts';
import { configAPI, configRaw } from './config.ts';
import { createEnvironmentConfig, EnvironmentConflict } from './environment-config.ts';
import { atomicJSON, agentRecord, artifactExtensions, browse, inside, jsonFile, safePath } from './files.ts';
import { createKritaScan } from './krita-scan.ts';
import { snapshot, summary } from './snapshot.ts';
import { SVGThumbnails } from './svg-thumbnail.ts';
import { KRAPreviews } from './kra-preview.ts';
import { launch } from './worker.ts';
import { requestTaskStop } from '../.agents/skills/live2d-maker/workflow/control.ts';
import { KritaUnavailable, preflightKrita, workflowKrita, type KritaCheck } from '../.agents/skills/live2d-maker/workflow/krita.ts';
import { MissingDependencyError } from '../.agents/skills/live2d-maker/shared/missing-dependency.ts';
import { checkKnowledge, defaultKnowledgeDirectory } from '../.agents/skills/live2d-maker/shared/knowledge.ts';
import { exportCompletedRun } from '../.agents/skills/live2d-maker/workflow/export.ts';
import { LayerCompositor } from './layer-compositor.ts';
import { isStudioPath, studioProject } from './studio-project.ts';
import { studioCatalog, studioAsset, studioReviews, saveStudioReview } from './studio.ts';
import { createUpdateCheck } from './update-check.ts';
import { installedVersion } from '../.agents/skills/live2d-maker/shared/version.ts';
import { projectDisplayName, saveProjectDisplayName, validateDisplayName } from './project-metadata.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const maxBytes = 32 * 1024 * 1024;
async function body(request: IncomingMessage) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new Error('请求必须使用 application/json');
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('上传图片最大 20 MB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function options(value: any, dir: string): TaskOptions {
  const result: TaskOptions = { name: value.name, dir };
  directoryFor(result);
  for (const key of ['krita', 'image'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'string') throw new Error(key + ' 必须是路径');
      if (value[key].trim()) result[key] = value[key].trim();
    }
  }
  if (value.from) result.from = sectionId(value.from);
  if (value.to) result.to = sectionId(value.to);
  if (result.from || result.to) selectedSections(result.from ?? sectionIds[0], result.to ?? sectionIds.at(-1)!);
  if (value.shadowMode !== undefined) result.shadowMode = shadowMode(value.shadowMode);
  if (value.standard !== undefined) {
    if (typeof value.standard !== 'boolean') throw new Error('standard 必须是布尔值');
    result.standard = value.standard;
  }
  if (value.jobs !== undefined) {
    if (!Number.isSafeInteger(value.jobs) || value.jobs < 1) throw new Error('jobs 必须是正整数');
    result.jobs = value.jobs;
  }
  return result;
}
// Global web settings: the run directory, the Krita used by every start, and the
// knowledge directory recorded by new tasks (absent: the skill's own knowledge/).
type Settings = { directory: string; krita?: string; knowledge?: string };
export async function createWorkbench({ settingsPath = join(root, '.web/settings.json'), defaultDir = runsDirectory,
  start = launch, environment = createEnvironmentConfig(), kritaCheck = workflowKrita,
  preflight = (options: TaskOptions) => preflightKrita(options, kritaCheck), kritaScan = createKritaScan(),
  updates = createUpdateCheck({ cachePath: join(dirname(settingsPath), 'update-check.json') }) }: {
  settingsPath?: string; defaultDir?: string; start?: typeof launch; environment?: ReturnType<typeof createEnvironmentConfig>;
  kritaCheck?: KritaCheck; preflight?: (options: TaskOptions) => Promise<unknown>; kritaScan?: ReturnType<typeof createKritaScan>;
  updates?: ReturnType<typeof createUpdateCheck> } = {}) {
  async function validateDir(path: string) {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('运行目录必须是绝对路径');
    await mkdir(path, { recursive: true });
    const directory = await realpath(path), skill = await realpath(workflowsDirectory);
    if (inside(skill, directory)) throw new Error('运行目录不能位于 skill 内');
    return directory;
  }
  async function validateKrita(path: string) {
    if (!isAbsolute(path)) throw new Error('Krita 路径必须是绝对路径');
    // A missing Xvfb is not the path's fault; the run reports it.
    try { await kritaCheck(path); } catch (error) { if (!(error instanceof MissingDependencyError)) throw error; }
    return resolve(path);
  }
  async function validateKnowledge(path: string) {
    if (!isAbsolute(path)) throw new Error('先验知识目录必须是绝对路径');
    const directory = await realpath(path).catch(() => { throw new Error('先验知识目录不存在：' + path); });
    checkKnowledge(directory);
    return directory;
  }
  // An empty string clears an optional field; an absent one keeps it.
  async function validateSettings(value: any, previous?: Settings): Promise<Settings> {
    const next: Settings = { directory: await validateDir(value.directory) };
    for (const [key, validate] of [['krita', validateKrita], ['knowledge', validateKnowledge]] as const) {
      const given = value[key];
      if (given === undefined) { if (previous?.[key]) next[key] = previous[key]; continue; }
      if (typeof given !== 'string') throw new Error(key + ' 必须是路径');
      if (given.trim()) next[key] = await validate(given.trim());
    }
    return next;
  }
  const defaults = { directory: await validateDir(defaultDir), knowledge: defaultKnowledgeDirectory };
  let settings: Settings = { directory: defaults.directory };
  try {
    // Recorded Krita and knowledge are checked again when a task starts.
    const saved = JSON.parse(await readFile(settingsPath, 'utf8'));
    settings = { directory: await validateDir(saved.directory),
      ...(typeof saved.krita === 'string' && saved.krita ? { krita: saved.krita } : {}),
      ...(typeof saved.knowledge === 'string' && saved.knowledge ? { knowledge: saved.knowledge } : {}) };
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const kritaRefused = (error: KritaUnavailable) =>
    ({ error: error.reason + '\n请在「全局设置」中选择可用的 Krita 可执行文件。', krita: { path: error.path ?? null } });
  const starts = new Set<string>();
  async function task(name: string, dir = settings.directory) {
    const path = directoryFor({ name, dir });
    if (!(await lstat(path)).isDirectory() || (await lstat(path)).isSymbolicLink()) throw new Error('任务必须是运行目录下的普通文件夹');
    await safePath(dir, name);
    return path;
  }
  // The studio opens a whole task folder: one under the run directory, or one imported from
  // elsewhere on the server, which must be a task (it has run.json).
  async function studioFolder(folder: string) {
    if (!isAbsolute(folder)) throw new Error('项目文件夹必须是绝对路径');
    const info = await lstat(resolve(folder)).catch(() => { throw new Error('项目文件夹不存在：' + folder); });
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('请选择项目文件夹（不能是文件或符号链接）');
    const directory = await realpath(folder), name = basename(directory), dir = dirname(directory);
    if (dir === settings.directory) { await task(name, dir); return { directory, name, dir }; }
    directoryFor({ name, dir });
    // Only marks it as a task; the studio reads fixed outputs, whatever the run's layout version.
    if (!(await lstat(join(directory, 'run.json')).catch(() => undefined))?.isFile()) throw new Error('不是 AstraLayering 任务文件夹（缺少 run.json）：' + directory);
    return { directory, name, dir };
  }
  // The studio lists task folders (with run.json) under a base folder the browser chose,
  // or under the run directory by default. A base that is gone answers 404, so the
  // browser drops its stored choice and falls back to the default.
  async function studioProjects(base: string | null) {
    const folder = base || settings.directory;
    if (!isAbsolute(folder)) throw new Error('基准文件夹必须是绝对路径');
    const info = await lstat(resolve(folder)).catch(() => undefined);
    if (!info?.isDirectory() || info.isSymbolicLink()) return;
    const directory = await realpath(folder), projects = [];
    for (const entry of (await readdir(directory, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))) {
      const project = join(directory, entry.name);
      if (!(await lstat(join(project, 'run.json')).catch(() => undefined))?.isFile()) continue;
      projects.push({ name: entry.name, folder: project, displayName: await projectDisplayName(project, entry.name).catch(() => entry.name) });
    }
    return { directory, default: settings.directory, projects };
  }
  const compositor = new LayerCompositor(root);
  const thumbnails = new SVGThumbnails();
  const kraPreviews = new KRAPreviews();
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost'), path = url.pathname;
    const requestDir = settings.directory;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const json = (value: unknown, status = 200) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); };
    try {
      if (request.method !== 'GET' && request.method !== 'POST') { json({ error: 'Method not allowed' }, 405); return; }
      if (request.method === 'POST') {
        // Same-origin browser operations; deployment access scope is owned by the host.
        const origin = request.headers.origin;
        if ((origin && new URL(origin).host !== request.headers.host) || request.headers['sec-fetch-site'] === 'cross-site') {
          json({ error: '不接受跨站运行操作' }, 403); return;
        }
        if (path.startsWith('/api/studio/layers/')) {
          if (path === '/api/studio/layers/open') {
            const document = await compositor.create(request, url.searchParams.get('format') ?? '');
            if (response.destroyed) { await compositor.closeDocument(document.session); return; }
            response.once('close', () => {
              if (!response.writableFinished) void compositor.closeDocument(document.session).catch(() => {});
            });
            json(document, 201); return;
          }
          const value = await body(request);
          if (path.endsWith('/edit')) json(await compositor.edit(value));
          else if (path.endsWith('/surfaces')) json(await compositor.surfaces(value));
          else if (path.endsWith('/export')) json(await compositor.export(value));
          else if (path.endsWith('/close')) json(await compositor.closeDocument(value.session));
          else json({ error: 'Not found' }, 404);
          return;
        }
        const value = await body(request);
        if (value.dir !== requestDir) { json({ error: '追踪目录已改变，请刷新页面后重试' }, 409); return; }
        if (path === '/api/config/environment' || path === '/api/config/environment/preview') {
          try { json(await (path.endsWith('/preview') ? environment.preview(value) : environment.save(value))); }
          catch (error) { if (error instanceof EnvironmentConflict) json({ error: error.message }, 409); else throw error; }
          return;
        }
        if (path === '/api/settings') {
          const next = await validateSettings(value, settings);
          await atomicJSON(settingsPath, next); settings = next; json({ ...settings, defaults }); return;
        }
        if (path === '/api/krita-scan') {
          if (value.action === 'start') json(kritaScan.start());
          else if (value.action === 'stop') json(kritaScan.stop());
          else json({ error: '未知的扫描操作' }, 400);
          return;
        }
        if (path === '/api/studio/review') { json(await saveStudioReview(root, dirname(settingsPath), value), 201); return; }
        const opts = options(value, requestDir), directory = directoryFor(opts);
        // Starts use the global Krita; a task records it, and the knowledge directory, when created.
        if (!opts.krita && settings.krita) opts.krita = settings.krita;
        if (path === '/api/tasks') {
          const displayName = validateDisplayName(value.displayName ?? '');
          if (settings.knowledge) opts.knowledge = settings.knowledge;
          // A route with Krita steps is refused before anything is created.
          try { await preflight(opts); }
          catch (error) { if (error instanceof KritaUnavailable) { json(kritaRefused(error), 409); return; } throw error; }
          // Exclusive creation prevents changing the original of an existing named task.
          await mkdir(directory);
          let committed = false;
          try {
            if (value.upload) {
              if (typeof value.upload !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.upload)) throw new Error('无效的图片数据');
              const bytes = Buffer.from(value.upload, 'base64');
              if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('上传图片最大 20 MB');
              const image = sharp(bytes, { limitInputPixels: 40_000_000 });
              const meta = await image.metadata();
              if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages ?? 1) > 1) throw new Error('请选择单张 PNG、JPG 或 WebP 图片');
              await image.resize(1, 1).raw().toBuffer();
              await mkdir(join(directory, 'input'));
              await writeFile(join(directory, 'input/original.png'), await encodePng(bytes), { flag: 'wx', mode: 0o600 });
              delete opts.image;
            } else {
              if (!opts.image) throw new Error('新任务需要一张输入参考图');
              const image = sharp(resolve(directory, opts.image), { limitInputPixels: 40_000_000 });
              const meta = await image.metadata();
              if (!['png', 'jpeg', 'webp'].includes(meta.format) || (meta.pages ?? 1) > 1) throw new Error('请选择单张 PNG、JPG 或 WebP 图片');
              await image.resize(1, 1).raw().toBuffer();
            }
            const release = await acquireTaskLock(directory);
            try {
              await saveRun(directory, await configureRun(opts, directory));
              await saveProjectDisplayName(directory, displayName);
              committed = true;
            }
            finally { await release(); }
            json({ name: opts.name, directory }, 201);
          } finally { if (!committed) await rm(directory, { recursive: true, force: true }); }
          return;
        }
        await task(opts.name, requestDir);
        if (path === '/api/convert-layout') { json(await convertLayout(directory)); return; }
        if (['/api/start', '/api/task-action', '/api/stop'].includes(path) && (await readRun(directory))?.archive) {
          json({ error: '这是成果归档；请在原运行目录继续制作。' }, 409); return;
        }
        if (path === '/api/project-name') {
          await saveProjectDisplayName(directory, value.displayName);
          json({ name: opts.name, displayName: await projectDisplayName(directory, opts.name) }); return;
        }
        if (path === '/api/start' || path === '/api/task-action') {
          // The same commands as pnpm start: plain start / continue, or --continue / --resume / --retry
          // for every step still marked .running (task-action). One step is acted on from the CLI.
          if (starts.has(directory)) { json({ error: '该任务正在启动，请等待启动结果' }, 409); return; }
          starts.add(directory);
          try {
            // Krita is checked before an action changes any step.
            try { await preflight(opts); }
            catch (error) {
              if (!(error instanceof KritaUnavailable)) throw error;
              json(kritaRefused(error), 409); return;
            }
            const message = path === '/api/task-action' ? await applyTaskAction({ name: opts.name, dir: opts.dir, action: value.action }) : undefined;
            json({ ...(message === undefined ? {} : { message }), pid: await start(opts), name: opts.name }, 202);
          } finally { starts.delete(directory); }
          return;
        }
        if (path === '/api/stop') {
          await requestTaskStop(opts);
          json({ message: '已请求停止，将保留产物和续跑记录' }); return;
        }
        json({ error: 'Not found' }, 404); return;
      }
      if (path === '/healthz') { json({ status: 'ok', application: 'astra-layering', mode: 'workbench', version: (await installedVersion()).label }); return; }
      if (path === '/api/version') { json(await updates()); return; }
      if (path === '/api/settings') { json({ ...settings, defaults }); return; }
      if (path === '/api/fs') { json(await browse(url.searchParams.get('path'), url.searchParams.get('kind') === 'file' ? 'file' : 'dir')); return; }
      if (path === '/api/krita-scan') { json(kritaScan.state()); return; }
      if (path === '/api/config/environment') { json(await environment.read()); return; }
      if (path === '/api/config/raw') { await configRaw(url.searchParams, settings.knowledge ?? defaults.knowledge, request, response); return; }
      if (path.startsWith('/api/config/')) { json(await configAPI(path, url.searchParams, settings.knowledge ?? defaults.knowledge)); return; }
      if (path === '/api/tasks') {
        const entries = (await readdir(requestDir, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));
        const tasks = [];
        for (const entry of entries) {
          try { const directory = await task(entry.name, requestDir); tasks.push(await summary(directory, entry.name, requestDir)); }
          catch (error) { tasks.push({ name: entry.name, status: 'failed', error: String(error) }); }
        }
        json({ directory: requestDir, tasks }); return;
      }
      if (path === '/api/task' || path === '/artifact' || path === '/api/export') {
        if (url.searchParams.get('dir') !== requestDir) { json({ error: '追踪目录已改变，请刷新页面' }, 409); return; }
        const name = url.searchParams.get('name') ?? '', directory = await task(name, requestDir);
        if (path === '/api/task') { json(await snapshot(directory, name, requestDir)); return; }
        if (path === '/api/export') {
          const temporary = await mkdtemp(join(tmpdir(), 'live2d-download-'));
          const archive = join(temporary, name + '.zip');
          try { await exportCompletedRun({ name, dir: requestDir, output: archive }); }
          catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
          response.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': (await lstat(archive)).size,
            'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(name + '.zip') });
          response.once('close', () => { void rm(temporary, { recursive: true, force: true }); });
          createReadStream(archive).on('error', () => response.destroy()).pipe(response); return;
        }
        const selected = url.searchParams.get('path') ?? '';
        if (!artifactExtensions.test(selected) || selected.split('/').some(part => part.startsWith('.'))) throw new Error('不支持该产物类型');
        if (agentRecord(selected)) throw new Error('agent 记录不对网页开放');
        const file = await safePath(directory, selected);
        const info = await lstat(file);
        if (!info.isFile()) throw new Error('产物不是文件');
        if (url.searchParams.get('preview') === 'kra' && extname(file).toLowerCase() === '.kra') {
          const image = await kraPreviews.get(file, `${info.mtimeMs}:${info.ctimeMs}:${info.size}:${info.ino}`, url.searchParams.get('fit') === 'content');
          response.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
          response.end(image); return;
        }
        if (url.searchParams.get('preview') === 'content' && extname(file).toLowerCase() === '.svg') {
          const image = await thumbnails.get(file, `${info.mtimeMs}:${info.ctimeMs}:${info.size}:${info.ino}`);
          if (image) {
            response.writeHead(200, { 'Content-Type': 'image/png' });
            response.end(image); return;
          }
        }
        const types: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.md': 'text/plain; charset=utf-8', '.kra': 'application/octet-stream', '.psd': 'application/octet-stream' };
        // SVG may be authored by an agent. Keep it inert even when opened in a new tab.
        response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        response.writeHead(200, { 'Content-Type': types[selected.endsWith('.md.tmp') ? '.md' : extname(file).toLowerCase()]
          || (/\.(py|[cm]?js|ts|txt)$/i.test(file) ? 'text/plain; charset=utf-8' : 'application/octet-stream') });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/api/studio/layers') { json({ available: compositor.available, engine: 'Krita' }); return; }
      if (path === '/studio-surface-asset') {
        const file = await compositor.surfaceAsset(url.searchParams.get('session') ?? '', Number(url.searchParams.get('revision')), url.searchParams.get('file') ?? '');
        await lstat(file);
        response.writeHead(200, { 'Content-Type': 'image/png' });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/studio-layer-asset') {
        const kind = url.searchParams.get('kind') ?? 'png';
        if (!['png', 'kra'].includes(kind)) throw Error('无效的图层产物');
        const file = await compositor.asset(url.searchParams.get('session') ?? '', Number(url.searchParams.get('revision')), kind);
        await lstat(file);
        if (kind === 'kra') response.setHeader('Content-Disposition', 'attachment; filename="character-edited.kra"');
        response.writeHead(200, { 'Content-Type': kind === 'png' ? 'image/png' : 'application/octet-stream' });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/api/studio/project' || path === '/studio-artifact') {
        const { directory, name, dir } = await studioFolder(url.searchParams.get('folder') ?? '');
        if (path === '/api/studio/project') {
          json({ ...await studioProject(directory, name, dir, url.searchParams.get('preview')), folder: directory, displayName: await projectDisplayName(directory, name),
            inDirectory: dir === settings.directory }); return;
        }
        // Only the studio's fixed outputs are readable, wherever the folder is.
        const selected = url.searchParams.get('path') ?? '';
        if (!isStudioPath(selected)) throw new Error('工作台只读取角色组装、光照、投影与九轴产物');
        const file = await safePath(directory, selected);
        if (!(await lstat(file)).isFile()) throw new Error('产物不是文件');
        response.writeHead(200, { 'Content-Type': extname(file).toLowerCase() === '.png' ? 'image/png' : extname(file).toLowerCase() === '.json' ? 'application/json' : 'application/octet-stream' });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/api/studio/projects') {
        const list = await studioProjects(url.searchParams.get('dir'));
        if (!list) { json({ error: '基准文件夹不存在或不是文件夹：' + url.searchParams.get('dir'), missing: true }, 404); return; }
        json(list); return;
      }
      if (path === '/api/studio/samples') { json(await studioCatalog(root)); return; }
      if (path === '/studio-document') {
        if (url.searchParams.get('id') !== 'jianma') throw new Error('未登记的角色文件');
        const file = await safePath(root, 'demos/jianma/shadow/step01_mask/character-shadowed.kra');
        response.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/api/studio/reviews') { json(await studioReviews(root, dirname(settingsPath), url.searchParams.get('sample') ?? '')); return; }
      if (path === '/studio-asset') {
        const file = await studioAsset(root, url.searchParams.get('sample') ?? '', url.searchParams.get('kind') ?? '');
        response.writeHead(200, { 'Content-Type': 'image/png' });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/shadow-reference/skirt.png' || path === '/shadow-reference/hair.png') {
        response.writeHead(200, { 'Content-Type': 'image/png' });
        response.end(await readFile(referencePath(path.split('/').at(-1)!))); return;
      }
      const vendor: Record<string,string> = {
        '/vendor/three.module.js': 'node_modules/three/build/three.module.js',
        '/vendor/three.core.js': 'node_modules/three/build/three.core.js',
        '/vendor/mtoon.js': 'node_modules/@pixiv/three-vrm-materials-mtoon/lib/three-vrm-materials-mtoon.module.js',
        '/vendor/ag-psd.js': 'node_modules/ag-psd/dist/bundle.js',
        '/vendor/fflate.js': 'node_modules/fflate/umd/index.js',
      };
      if (vendor[path]) { response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); response.end(await readFile(join(root, vendor[path]))); return; }
      const staticFiles: Record<string, string> = { '/': 'index.html', '/app.js': 'app.js', '/process-files.js': 'process-files.js', '/progress.js': 'progress.js', '/report-markdown.js': 'report-markdown.js', '/task-selection.js': 'task-selection.js', '/dom-morph.js': 'dom-morph.js', '/env-editor.js': 'env-editor.js', '/settings-dialog.js': 'settings-dialog.js', '/server-picker.js': 'server-picker.js', '/styles.css': 'styles.css', '/studio': 'studio/index.html', '/studio/app.js': 'studio/app.js', '/studio/styles.css': 'studio/styles.css', '/studio/renderer.js': 'studio/renderer.js', '/studio/lighting-model.js': 'studio/lighting-model.js' };
      staticFiles['/report-links.js'] = '../.agents/skills/live2d-maker/shared/report-links.js';
      staticFiles['/step-paths.js'] = '../.agents/skills/live2d-maker/shared/step-paths.js';
      for (const name of ['nine-axis-model.js', 'nine-axis-render.js']) staticFiles['/studio/' + name] = '../.agents/skills/live2d-maker/shared/' + name;
      for (const name of ['document-loader.js', 'document-worker.js', 'layer-panel.js', 'layer-model.js', 'surface-preview.js', 'surface-worker.js', 'surface-coverage.js', 'part-maps.js', 'harmonic-fill.js', 'projection-model.js', 'projection-panel.js', 'physics-model.js', 'physics-panel.js', 'physics-recipe.js', 'physics-renderer.js', 'physics-cases.js', 'nine-axis-panel.js']) staticFiles['/studio/' + name] = 'studio/' + name;
      if (!staticFiles[path]) { json({ error: 'Not found' }, 404); return; }
      const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
      response.end(await readFile(join(root, 'web', staticFiles[path])));
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      json({ error: (error as NodeJS.ErrnoException).code === 'EEXIST' ? '任务名已存在，请选择该任务续跑或使用新名称' : (error as Error).message }, 400);
    }
  });
  server.once('close', () => { void compositor.dispose(); kritaScan.stop(); });
  return Object.assign(server, { disposeLayers: () => compositor.dispose() });
}
if (import.meta.main) {
  const { values } = parseArgs({ options: { port: { type: 'string', default: '4387' } } });
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port must be between 1 and 65535');
  const server = await createWorkbench();
  server.listen(port, '127.0.0.1', () => console.log(`AstraLayering workbench: http://127.0.0.1:${port}`));
  const shutdown = async () => {
    server.close(); server.closeAllConnections();
    await server.disposeLayers();
    process.exit(0);
  };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
