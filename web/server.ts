import { createServer, type IncomingMessage } from 'node:http';
import { readFile, readdir, mkdir, lstat, rm, writeFile, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extname, resolve, join, isAbsolute, dirname } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { shadowMode } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { referenceUrl } from '../.agents/skills/live2d-maker/shadow/preparation.ts';
import { runsDirectory, pipelineIds, workflowsDirectory } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { acquireTaskLock, configureRun, directoryFor, readRun, saveRun, selectedPipelines, pipelineId, taskStatus, type TaskOptions } from '../.agents/skills/live2d-maker/workflow/state.ts';
import { configAPI } from './config.ts';
import { atomicJSON, artifactExtensions, inside, jsonFile, safePath } from './files.ts';
import { snapshot, summary } from './snapshot.ts';
import { SVGThumbnails } from './svg-thumbnail.ts';
import { KRAPreviews } from './kra-preview.ts';
import { launch } from './worker.ts';
import { validatePhysicsConfig } from './studio/component-physics-schema.js';
import { LayerCompositor } from './layer-compositor.ts';
import { studioProject } from './studio-project.ts';
import { studioPhysicsWorkflow, studioPhysicsArtifact } from './studio-physics-workflow.ts';
import { studioCatalog, studioAsset, studioReviews, saveStudioReview } from './studio.ts';
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
  if (value.from) result.from = pipelineId(value.from);
  if (value.to) result.to = pipelineId(value.to);
  if (result.from || result.to) selectedPipelines(result.from ?? pipelineIds[0], result.to ?? pipelineIds.at(-1)!);
  if (value.physicsProfile !== undefined) { if(!['primary','all'].includes(value.physicsProfile)) throw Error('物理范围无效'); result.physicsProfile=value.physicsProfile; }
  if (value.physicsEnabled !== undefined) { if(typeof value.physicsEnabled!=='boolean') throw Error('物理开关无效'); result.physicsEnabled=value.physicsEnabled; }
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
export async function createWorkbench({ settingsPath = join(root, '.web/settings.json'), defaultDir = runsDirectory,
  start = launch }: { settingsPath?: string; defaultDir?: string; start?: typeof launch } = {}) {
  async function validateDir(path: string) {
    if (typeof path !== 'string' || !isAbsolute(path)) throw new Error('运行目录必须是绝对路径');
    await mkdir(path, { recursive: true });
    const directory = await realpath(path), skill = await realpath(workflowsDirectory);
    if (inside(skill, directory)) throw new Error('运行目录不能位于 skill 内');
    return directory;
  }
  let settings = { directory: await validateDir(defaultDir) };
  try { settings = { directory: await validateDir(JSON.parse(await readFile(settingsPath, 'utf8')).directory) }; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const starts = new Set<string>();
  async function task(name: string, dir = settings.directory) {
    const path = directoryFor({ name, dir });
    if (!(await lstat(path)).isDirectory() || (await lstat(path)).isSymbolicLink()) throw new Error('任务必须是运行目录下的普通文件夹');
    await safePath(dir, name);
    return path;
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
          if (path === '/api/studio/layers/open' || path === '/api/studio/layers/open-project') {
            let document;
            if (path.endsWith('/open-project')) {
              const value = await body(request);
              if (value.dir !== requestDir) { json({ error: '追踪目录已改变，请刷新页面后重试' }, 409); return; }
              const directory = await task(value.name, requestDir);
              const project = await studioProject(directory, value.name, requestDir, value.preview);
              const source = project.files.document;
              if (!source.available || value.path !== source.path || value.version !== source.version) {
                json({ error: '项目工程已变化，请更新项目后重试' }, 409); return;
              }
              // The project already owns this file. Reuse it on the server instead
              // of uploading the browser's downloaded KRA/PSD back to the same host.
              const file = await safePath(directory, source.path);
              async function* bytes() { yield* createReadStream(file); }
              document = await compositor.create(bytes(), extname(source.path).slice(1).toLowerCase());
            } else document = await compositor.create(request, url.searchParams.get('format') ?? '');
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
        if (path === '/api/settings') {
          const next = { directory: await validateDir(value.directory) };
          await atomicJSON(settingsPath, next); settings = next; json(settings); return;
        }
        if(path==='/api/studio/physics') { const directory=await task(value.name); const config=validatePhysicsConfig(value.config); config.review={status:'draft',...(config.review?.baseConfigHash?{baseConfigHash:config.review.baseConfigHash}:{})}; await mkdir(join(directory,'physics'),{recursive:true}); await atomicJSON(join(directory,'physics/physics.draft.json'),config); json({saved:true},201); return; }
        if (path === '/api/studio/review') { json(await saveStudioReview(root, dirname(settingsPath), value), 201); return; }
        const opts = options(value, requestDir), directory = directoryFor(opts);
        if (path === '/api/tasks') {
          const displayName = validateDisplayName(value.displayName ?? '');
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
              const retained = join(directory, 'input/original.' + (meta.format === 'jpeg' ? 'jpg' : meta.format));
              await writeFile(retained, bytes, { flag: 'wx', mode: 0o600 });
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
        if (path === '/api/project-name') {
          await saveProjectDisplayName(directory, value.displayName);
          json({ name: opts.name, displayName: await projectDisplayName(directory, opts.name) }); return;
        }
        if (path === '/api/start') {
          if (starts.has(directory)) { json({ error: '该任务正在启动，请等待启动结果' }, 409); return; }
          starts.add(directory);
          try { json({ pid: await start(opts), name: opts.name }, 202); }
          finally { starts.delete(directory); }
          return;
        }
        if (path === '/api/stop') {
          const run = await readRun(directory, opts.name), worker = await jsonFile(directory, '.web-worker.json');
          const live = await taskStatus(opts);
          if (!live.runnerAlive || !live.lockHeld || !worker || worker.runnerId !== run?.runner?.id) throw new Error('当前没有可由网页停止的运行任务');
          await atomicJSON(join(directory, '.web-cancel.json'), { token: worker.token });
          json({ message: '已请求停止，将保留产物和续跑记录' }); return;
        }
        json({ error: 'Not found' }, 404); return;
      }
      if (path === '/healthz') { json({ status: 'ok', application: 'astra-layering', mode: 'workbench' }); return; }
      if (path === '/api/settings') { json(settings); return; }
      if (path.startsWith('/api/config/')) { json(await configAPI(path, url.searchParams)); return; }
      if (path === '/api/tasks') {
        const entries = (await readdir(requestDir, { withFileTypes: true })).filter(entry => entry.isDirectory() && !entry.name.startsWith('.'));
        const tasks = [];
        for (const entry of entries) {
          try { const directory = await task(entry.name, requestDir); tasks.push(await summary(directory, entry.name, requestDir)); }
          catch (error) { tasks.push({ name: entry.name, status: 'failed', error: String(error) }); }
        }
        json({ directory: requestDir, tasks }); return;
      }
      if (path === '/api/task' || path === '/artifact') {
        if (url.searchParams.get('dir') !== requestDir) { json({ error: '追踪目录已改变，请刷新页面' }, 409); return; }
        const name = url.searchParams.get('name') ?? '', directory = await task(name, requestDir);
        if (path === '/api/task') { json(await snapshot(directory, name, requestDir)); return; }
        const selected = url.searchParams.get('path') ?? '';
        if (!artifactExtensions.test(selected) || selected.split('/').some(part => part.startsWith('.'))) throw new Error('不支持该产物类型');
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
        response.writeHead(200, { 'Content-Type': types[selected.endsWith('.md.tmp') ? '.md' : extname(file).toLowerCase()] });
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
      if (path === '/api/studio/project') {
        if (url.searchParams.get('dir') !== requestDir) { json({ error: '项目目录已改变，请刷新后重新打开' }, 409); return; }
        const name = url.searchParams.get('name') ?? '';
        const directory = await task(name, requestDir);
        const project = await studioProject(directory, name, requestDir, url.searchParams.get('preview'));
        json({ ...project, physicsWorkflow: await studioPhysicsWorkflow(directory, name, requestDir, project.files.physics.available ? project.files.physics.path : undefined), displayName: await projectDisplayName(directory, name) }); return;
      }
      if (path === '/studio-physics-artifact') {
        if (url.searchParams.get('dir') !== requestDir) { json({ error: '项目目录已改变，请刷新页面' }, 409); return; }
        const name = url.searchParams.get('name') || '', directory = await task(name, requestDir);
        const project = await studioProject(directory, name, requestDir);
        const file = await studioPhysicsArtifact(directory, project.files.physics.path, url.searchParams.get('path') || '', url.searchParams.get('hash') || '');
        response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
        response.writeHead(200, { 'Content-Type': file.endsWith('.svg') ? 'image/svg+xml' : 'image/png' });
        createReadStream(file).on('error', () => response.destroy()).pipe(response); return;
      }
      if (path === '/api/studio/samples') { json(await studioCatalog(root)); return; }
      if (path === '/studio-document') {
        if (url.searchParams.get('id') !== 'jianma') throw new Error('未登记的角色文件');
        const file = await safePath(root, 'demos/jianma/assembled/jianma-assembled.kra');
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
        response.end(await readFile(referenceUrl(path.split('/').at(-1)!))); return;
      }
      // Existing browser sessions can still request the former module URLs.
      // Redirect to the owner so its relative imports resolve within the skill.
      const oldModule = path.slice('/studio/'.length);
      if (path.startsWith('/studio/')) {
        const core = ['component-physics-binding.js', 'component-physics-geometry.js', 'component-physics-model.js', 'component-physics-schema.js', 'physics-airflow.js', 'vendor/psd2live/xpbd.js', 'vendor/psd2live/pendulum.js', 'vendor/inochi2d/pendulum.js'];
        const evidence = ['component-physics-worker.js', 'physics-motion-review.js', 'physics-recorded-frame.js', 'physics-test-input.js'];
        const render = ['renderer.js', 'physics-renderer.js', 'surface-lighting.js', 'surface-shadow.js', 'projection-field.js', 'lighting-model.js', 'part-maps.js', 'harmonic-fill.js', 'surface-coverage.js'];
        const owner = core.includes(oldModule) ? 'physics-core' : evidence.includes(oldModule) ? 'physics-evidence' : render.includes(oldModule) ? 'character-render' : null;
        if (owner) { response.writeHead(307, { Location: '../'.repeat(oldModule.split('/').length) + 'shared/' + owner + '/' + oldModule }); response.end(); return; }
      }
      const vendor: Record<string,string> = {
        '/vendor/three.module.js': 'node_modules/three/build/three.module.js',
        '/vendor/three.core.js': 'node_modules/three/build/three.core.js',
        '/vendor/mtoon.js': 'node_modules/@pixiv/three-vrm-materials-mtoon/lib/three-vrm-materials-mtoon.module.js',
        '/vendor/ag-psd.js': 'node_modules/ag-psd/dist/bundle.js',
        '/vendor/fflate.js': 'node_modules/fflate/umd/index.js',
        '/shared/vendor/three.module.js': 'node_modules/three/build/three.module.js',
        '/shared/vendor/three.core.js': 'node_modules/three/build/three.core.js',
      };
      if (vendor[path]) { response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' }); response.end(await readFile(join(root, vendor[path]))); return; }
      if (/^\/shared\/(physics-core|physics-evidence|character-render)\/[a-z-]+\.js$/.test(path)
        || ['/shared/physics-core/vendor/psd2live/xpbd.js', '/shared/physics-core/vendor/psd2live/pendulum.js', '/shared/physics-core/vendor/inochi2d/pendulum.js'].includes(path)) {
        const file = await safePath(join(root, '.agents/skills/live2d-maker/shared'), path.slice('/shared/'.length));
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        response.end(await readFile(file)); return;
      }
      const staticFiles: Record<string, string> = { '/': 'index.html', '/app.js': 'app.js', '/progress.js': 'progress.js', '/report-markdown.js': 'report-markdown.js', '/task-selection.js': 'task-selection.js', '/styles.css': 'styles.css', '/studio': 'studio/index.html', '/studio/app.js': 'studio/app.js', '/studio/styles.css': 'studio/styles.css', '/studio/renderer.js': 'studio/renderer.js', '/studio/lighting-model.js': 'studio/lighting-model.js' };
      for (const name of ['document-loader.js', 'document-worker.js', 'layer-panel.js', 'layer-model.js', 'surface-preview.js', 'surface-worker.js', 'surface-coverage.js', 'part-maps.js', 'harmonic-fill.js', 'projection-model.js', 'projection-panel.js', 'projection-field.js', 'physics-model.js', 'physics-panel.js', 'physics-recipe.js', 'physics-renderer.js', 'physics-cases.js', 'component-physics-binding.js', 'component-physics-geometry.js', 'component-physics-model.js', 'component-physics-schema.js', 'component-physics-panel.js', 'physics-test-input.js', 'physics-airflow.js']) staticFiles['/studio/' + name] = 'studio/' + name;
      for (const name of ['component-physics-selection.js','component-physics-runner.js','component-physics-worker.js','surface-shadow.js','surface-lighting.js','vendor/psd2live/xpbd.js','vendor/psd2live/pendulum.js','vendor/inochi2d/pendulum.js']) staticFiles['/studio/' + name] = 'studio/' + name;
      for (const name of ['physics-workflow-model.js', 'physics-workflow-panel.js', 'physics-recorded-frame.js', 'physics-motion-review.js']) staticFiles['/studio/' + name] = 'studio/' + name;
      if (!staticFiles[path]) { json({ error: 'Not found' }, 404); return; }
      const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
      response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
      response.end(await readFile(join(root, 'web', staticFiles[path])));
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      json({ error: (error as NodeJS.ErrnoException).code === 'EEXIST' ? '任务名已存在，请选择该任务续跑或使用新名称' : (error as Error).message }, 400);
    }
  });
  server.once('close', () => { void compositor.dispose(); });
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
