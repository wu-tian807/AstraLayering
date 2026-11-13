import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readdir, readFile, realpath, rename, rm, utimes, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { Zip, ZipPassThrough, unzipSync } from 'fflate';
import { sectionIds } from '../shared/paths.ts';
import { reportReferences } from '../shared/report-links.js';
import { toTaskPath } from '../shared/task-paths.ts';
import { artifactPath, reportPath } from '../shared/part/artifact-facts.ts';
import { normalizeGroups, walkGroups } from '../shared/part/groups.ts';
import { publishDepthPreview } from '../shared/part/depth-preview.ts';
import { groupStepId, groupDepth, groupSteps, layerStepId } from '../shared/part/part-steps.ts';
import { partSteps } from '../shared/step-paths.js';
import { steps as personSteps } from '../raster-layering/steps.ts';
import { steps as clothingSteps } from '../clothing-raster-layering/steps.ts';
import { steps as assemblySteps } from '../character-assembly/steps.ts';
import { stepsFor } from '../shadow/steps.ts';
import { shadowMode } from '../shared/shadow.ts';
import { acquireTaskLock, directoryFor, readRun, taskStatus, type TaskRun } from './state.ts';

const slash = (path: string) => path.split(sep).join('/');
// The base static route ends at shadow; completed nine-axis artwork is included below.
const exportSectionIds = sectionIds.slice(0, sectionIds.indexOf('shadow') + 1);
const inside = (root: string, path: string) => path === root || path.startsWith(root + sep);
const excluded = (path: string) => path.split(/[\\/]/).some(name =>
  ['workspace', 'agents', 'recovery', 'archive', 'node_modules'].includes(name) || name.startsWith('.'));
// Relative PNG paths named anywhere inside a delivered JSON document.
const pngReferences = (value: unknown): string[] => typeof value === 'string'
  ? (/\.png$/i.test(value) && !isAbsolute(value) && !value.split(/[\\/]/).includes('..') ? [value] : [])
  : Array.isArray(value) ? value.flatMap(pngReferences)
  : value && typeof value === 'object' ? Object.values(value).flatMap(pngReferences) : [];
export const completeRun = (run?: TaskRun) => !!run && run.status === 'completed'
  && exportSectionIds.every(id => run.sections[id]?.status === 'completed')
  && (run.to !== 'nine-axis' || run.sections['nine-axis']?.status === 'completed');

// Completion facts are portable. CLI configuration, model selection and thread
// records stay at the source; an export cannot accidentally resume old sessions.
export function archiveRun(run: TaskRun, nineAxis = false): TaskRun {
  const sections = [...exportSectionIds, ...nineAxis ? ['nine-axis'] : []];
  return { version: 1, archive: true, from: 'part-layering', to: nineAxis ? 'nine-axis' : 'shadow',
    jobs: run.jobs, standard: run.standard, shadowMode: run.shadowMode, status: run.status,
    createdAt: run.createdAt, updatedAt: run.updatedAt,
    sections: Object.fromEntries(Object.entries(run.sections).filter(([id]) => sections.includes(id)).map(([id, value]) => [id,
      { status: value!.status, updatedAt: value!.updatedAt }])) };
}

type Entry = { source?: string; bytes?: Buffer };
export type ExportManifest = { version: 1; format: 'live2d-export'; name: string; status: 'completed'; exportedAt: string;
  files: Record<string, { bytes: number; sha256: string }>; warnings: string[] };

async function sourceFile(root: string, path: string): Promise<string | undefined> {
  const target = resolve(root, path);
  if (!inside(root, target)) throw new Error('导出文件不在任务目录内：' + path);
  let current = root;
  try {
    for (const name of relative(root, target).split(sep).filter(Boolean)) {
      current = join(current, name);
      if ((await lstat(current)).isSymbolicLink()) throw new Error('导出文件不能经过符号链接：' + path);
    }
    if (!(await lstat(target)).isFile()) return;
    return target;
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}

// Collect formal deliveries from receipts/contracts and their reports. Report
// images are not exported. root is the real task directory. Records may name it through another prefix
// (a symlinked runs root); those aliases map onto root.
export async function exportFiles(root: string, run: TaskRun, aliases: readonly string[] = []): Promise<{ entries: Map<string, Entry>; warnings: string[] }> {
  const entries = new Map<string, Entry>(), files: string[] = [], steps = new Set<string>(), warnings: string[] = [];
  const nineAxis = !!(await sourceFile(root, 'nine-axis/step09_head-accessories/.completed') ?? await sourceFile(root, 'nine-axis/step08_hair/.completed') ?? await sourceFile(root, 'nine-axis/step07_jaw-line/.completed') ?? await sourceFile(root, 'nine-axis/step04_jaw-line/.completed'));
  const selectedSections = [...exportSectionIds, ...nineAxis ? ['nine-axis'] : []];
  const roots = [...new Set(aliases.map(path => resolve(path)))].filter(path => path !== root);
  // Same conversion as toTaskPath, also accepting the aliases; an outside path stays absolute.
  const taskPath = (path: string) => {
    for (const base of [root, ...roots]) { const local = toTaskPath(base, path); if (!isAbsolute(local)) return local; }
    return path;
  };
  async function walk(path = '') {
    for (const item of await readdir(join(root, path), { withFileTypes: true })) {
      const child = slash(join(path, item.name));
      if (item.name === '.completed' && item.isFile()) { files.push(child); steps.add(path); }
      else if (!excluded(child) && !item.isSymbolicLink()) {
        if (item.isDirectory() && (path || ['input', ...selectedSections].includes(item.name))) await walk(child);
        else if (item.isFile()) files.push(child);
      }
    }
  }
  await walk();
  const add = async (path: string, required = false) => {
    path = slash(path);
    if (excluded(path) && !path.endsWith('/.completed') && path !== '.web-project.json') {
      if (required) throw new Error('正式交付仍指向运行文件：' + path);
      return;
    }
    const source = await sourceFile(root, path);
    if (!source) { if (required) throw new Error('完成的任务缺少正式交付：' + path); return; }
    entries.set(path, { source });
  };
  for (const step of steps) {
    const marker = slash(join(step, '.completed'));
    await add(marker, true);
    let receipt: any;
    try { receipt = JSON.parse(await readFile(join(root, marker), 'utf8')); } catch { /* older empty completion marker */ }
    for (const output of Object.keys(receipt?.outputs ?? {})) {
      // Output keys are task-relative with paths: 'task', else relative to the step.
      const path = receipt.paths === 'task' ? resolve(root, output) : resolve(root, step, output);
      if (!inside(root, path)) throw new Error('完成记录的交付越过任务目录：' + marker);
      await add(relative(root, path), true);
    }
  }
  for (const path of files) {
    // Reports and structured checks may be named freely within a completed step.
    if (/\.(md|json)$/i.test(path) && !path.endsWith('/run.json')
      && [...steps].some(step => path.startsWith(step + '/'))) await add(path);
    if (/^input\/original\.(png|jpe?g|webp)$/i.test(path)
      || /^(?:part-layering|clothing-part-layering)\/references\/[^/]+\.(png|jpe?g|webp)$/i.test(path)) await add(path);
  }
  await add('.web-project.json');
  for (const section of ['part-layering', 'clothing-part-layering']) {
    for (const step of [partSteps.initial, partSteps.merge, partSteps.occlusion]) await add(join(section, step, '.completed'), !run.archive);
    for (const path of ['groups.json', 'occlusion.json', 'preview.svg']) await add(join(section, path), true);
    const groups = normalizeGroups(JSON.parse(await readFile(join(root, section, 'groups.json'), 'utf8')).groups);
    for (const { group } of walkGroups(groups)) {
      for (const step of groupSteps) await add(join(section, groupStepId(group.id, step), '.completed'), !run.archive);
      await add(join(section, layerStepId(groupDepth(group.id)), '.completed'), !run.archive);
      for (const stage of ['outline', 'reduction', 'completion'] as const) await add(artifactPath(section, group.id, stage), true);
      for (const kind of ['review', 'completion-check', 'children'] as const) await add(reportPath(section, group.id, kind));
    }
  }
  const definitions = [
    ['raster-layering', personSteps], ['clothing-raster-layering', clothingSteps],
    ['character-assembly', assemblySteps], ['shadow', stepsFor(shadowMode(run.shadowMode))],
  ] as const;
  for (const [section, definitionsForSection] of definitions) {
    for (const step of definitionsForSection) {
      await add(join(section, step.id, '.completed'), !run.archive);
      for (const path of step.requiredFiles) await add(join(section, step.id, path), true);
      for (const pattern of ('previewFiles' in step ? step.previewFiles ?? [] : []) as readonly string[]) {
        const full = slash(join(section, step.id, pattern));
        const matcher = new RegExp('^' + full.split('*').map(piece => piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$');
        for (const path of files.filter(path => matcher.test(path))) await add(path);
      }
    }
  }
  // Keep the deliverables: KRA, JSON, Markdown, SVG and video, each step's
  // character-nine-axis.png preview, and layer textures (layers/*.png, plus any texture a
  // deformers.json names). Check and review images stay out of the export.
  if (nineAxis) for (const path of files) {
    if (!path.startsWith('nine-axis/')) continue;
    if (/\.(?:json|md|kra|svg|mp4)$/i.test(path) || /^nine-axis\/[^/]+\/character-nine-axis\.png$/i.test(path) || /\/layers\/[^/]+\.png$/i.test(path)) await add(path);
    if (/(^|\/)deformers\.json$/i.test(path)) {
      for (const texture of pngReferences(JSON.parse(await readFile(join(root, path), 'utf8')))) {
        await add(slash(join(dirname(path), texture)));
      }
    }
  }
  // Report images are review views, not deliverables: their image syntax is
  // dropped and the prose stays. Other path mentions remain as plain text.
  // Prose and JSON strings may quote the task directory; that prefix is dropped.
  const inTask = (text: string) => { for (const base of [root, ...roots]) text = text.split(base + sep).join(''); return text; };
  // Absolute links and prose mentions into the task (a source KRA, for example)
  // become task-relative; a path outside the task stays as written.
  async function rewriteReport(text: string): Promise<string> {
    for (const ref of reportReferences(text).reverse()) {
      if (text[ref.start] === '!') text = text.slice(0, ref.start) + text.slice(ref.end);
    }
    text = inTask(text);
    return text.replace(/\]\((\/[^)\s]+)\)/g, (link, target: string) => {
      const local = taskPath(target);
      return isAbsolute(local) ? link : '](' + local.split('/').map(encodeURIComponent).join('/') + ')';
    });
  }
  async function rewriteJSON(value: any, path: string, key = ''): Promise<any> {
    if (typeof value === 'string') {
      if (key === 'feedback') return rewriteReport(value);
      return isAbsolute(value) ? taskPath(value) : inTask(value);
    }
    if (Array.isArray(value)) return Promise.all(value.map(item => rewriteJSON(item, path, key)));
    if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value)
      .map(async ([name, item]) => [isAbsolute(name) ? taskPath(name) : inTask(name), await rewriteJSON(item, path, name)])));
    return value;
  }
  for (const [path, entry] of [...entries]) {
    if (!entry.source || !/\.(md|json)$/.test(path) || path.endsWith('/.completed')) continue;
    const original = await readFile(entry.source, 'utf8');
    const text = path.endsWith('.md') ? (await rewriteReport(original)).replace(/\n{2,}$/, '\n')
      : JSON.stringify(await rewriteJSON(JSON.parse(original), path), null, 2) + '\n';
    if (text !== original) entries.set(path, { bytes: Buffer.from(text) });
  }
  entries.set('run.json', { bytes: Buffer.from(JSON.stringify(archiveRun(run, nineAxis), null, 2) + '\n') });
  return { entries, warnings: [...new Set(warnings)] };
}

async function writeZip(directory: string, path: string, name: string, paths: string[]) {
  const output = createWriteStream(path, { flags: 'wx' }), done = finished(output);
  void done.catch(() => {});
  const zip = new Zip((error, bytes, final) => {
    if (error) { output.destroy(error); return; }
    output.write(bytes);
    if (final) output.end();
  });
  try {
    for (const path of paths) {
      const entry = new ZipPassThrough(name + '/' + path);
      zip.add(entry);
      for await (const chunk of createReadStream(join(directory, path))) {
        entry.push(chunk, false);
        if (output.writableNeedDrain) await once(output, 'drain');
      }
      entry.push(new Uint8Array(), true);
      if (output.writableNeedDrain) await once(output, 'drain');
    }
    zip.end(); await done;
  } catch (error) { zip.terminate(); output.destroy(); throw error; }
}

// aliases name other directories whose paths belong to this task (for example a
// merged task whose parts were produced in separate runs); they export task-relative.
export async function exportCompletedRun(options: { name: string; dir?: string; output: string; aliases?: string[] }) {
  const source = directoryFor(options), root = await realpath(source), output = resolve(options.output);
  if (await lstat(source).then(info => info.isSymbolicLink())) throw new Error('任务不能是符号链接');
  if (inside(root, output) || inside(output, root)) throw new Error('导出位置不能覆盖或嵌入原任务目录');
  if (await lstat(output).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) throw new Error('导出位置已存在：' + output);
  const state = await taskStatus(options);
  if (state.runnerAlive || state.lockHeld || !completeRun(await readRun(root))) throw new Error('仅能导出全流程已完成且已停止的任务');
  const release = await acquireTaskLock(root);
  let staging: string | undefined;
  try {
    const run = await readRun(root);
    if (!completeRun(run)) throw new Error('任务状态已改变，请刷新后再导出');
    const { entries, warnings } = await exportFiles(root, run!, [source, ...options.aliases ?? []]);
    await mkdir(dirname(output), { recursive: true });
    staging = await mkdtemp(join(dirname(output), '.live2d-export-'));
    const content = join(staging, options.name);
    await mkdir(content);
    for (const [path, entry] of entries) {
      const target = join(content, path);
      await mkdir(dirname(target), { recursive: true });
      if (entry.bytes) await writeFile(target, entry.bytes);
      else {
        const before = await lstat(entry.source!);
        await copyFile(entry.source!, target);
        const after = await lstat(entry.source!);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) throw new Error('产物在导出时改变：' + path);
        await utimes(target, before.atime, before.mtime);
      }
    }
    for (const section of ['part-layering', 'clothing-part-layering']) {
      const directory = join(content, section);
      const document = JSON.parse(await readFile(join(directory, 'groups.json'), 'utf8'));
      await publishDepthPreview(directory, document.groups, JSON.parse(await readFile(join(directory, 'occlusion.json'), 'utf8')));
      entries.set(`${section}/${partSteps.occlusion}/preview.svg`, {});
    }
    // Fill the fixed PNG card from Krita's saved projection, without rendering or
    // modifying the document. KRA remains the authoritative saved artwork.
    for (const [section, steps] of [['raster-layering', personSteps], ['clothing-raster-layering', clothingSteps]] as const) {
      for (const step of steps) {
        if (step.requiredFiles.some(path => path.endsWith('.png'))) continue;
        const path = section + '/' + step.id + '/composite.png';
        if (entries.has(path)) continue;
        const kra = step.requiredFiles.find(path => path.endsWith('.kra'))!;
        const png = unzipSync(await readFile(join(content, section, step.id, kra)), { filter: entry => entry.name === 'mergedimage.png' })['mergedimage.png'];
        if (!png) throw new Error('KRA 缺少已保存的合成预览：' + section + '/' + step.id);
        await writeFile(join(content, path), png); entries.set(path, {});
      }
    }
    const manifest: ExportManifest = { version: 1, format: 'live2d-export', name: options.name, status: 'completed',
      exportedAt: new Date().toISOString(), files: {}, warnings };
    for (const path of [...entries.keys()].sort()) {
      const bytes = await readFile(join(content, path));
      manifest.files[path] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    await writeFile(join(content, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    if (output.toLowerCase().endsWith('.zip')) {
      const archive = join(staging, randomUUID() + '.zip');
      await writeZip(content, archive, options.name, [...entries.keys(), 'manifest.json'].sort());
      await rename(archive, output);
    } else await rename(content, output);
    return { output, files: entries.size + 1, bytes: Object.values(manifest.files).reduce((total, file) => total + file.bytes, 0), warnings };
  } finally {
    if (staging) await rm(staging, { recursive: true, force: true });
    await release();
  }
}
