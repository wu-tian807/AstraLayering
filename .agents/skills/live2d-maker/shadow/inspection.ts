import sharp from 'sharp';
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { fileHash } from './input.ts';
import { kraContents, kraLayers, validateMaskStructure } from './delivery.ts';
import { inspectNative, type NativeInspect } from './native.ts';
import { within } from '../shared/raster/run-store.ts';
import type { InputIndex } from './preparation.ts';
import { referencesDirectory } from '../shared/agents/inputs.ts';
import { taskRootOf, toTaskPath } from '../shared/task-paths.ts';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import { textResult, type FunctionTool } from '../shared/codex/function-tools.ts';
import type { SectionKrita } from '../shared/krita/section-krita.ts';

const toolFiles = ['inspection.ts', 'native.ts', 'native_job.py', 'delivery.ts'];
async function signature(document: string, bindings: string, index: string) {
  const hashes = await Promise.all([document, bindings, index, ...toolFiles.map(p => fileURLToPath(new URL(p, import.meta.url)))].map(fileHash));
  return createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
}
async function raster(path: string) { return sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true}); }
export function alphaGain(before: Uint8Array, after: Uint8Array) {
  if (before.length !== after.length) throw new Error('原生检查画布改变');
  let n = 0;
  for (let i = 3; i < before.length; i += 4) if (after[i] > before[i] + 1) n++;
  return n;
}
function label(value: string, width: number) {
  const escaped = value.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
  return Buffer.from(`<svg width="${width}" height="52"><rect width="100%" height="100%" fill="#eaf0f5"/><text x="18" y="34" font-family="DejaVu Sans" font-size="20" fill="#263747">${escaped}</text></svg>`);
}
async function sheet(panels: {path:string;label:string}[], path: string, columns: number) {
  const w = 512, h = 564, rows = Math.ceil(panels.length / columns), tiles = [];
  for (const [i,p] of panels.entries()) {
    const picture = await sharp(p.path).resize({width:w,height:h-52,fit:'contain',background:'#f7f9fb'}).png().toBuffer();
    tiles.push({input:picture,left:(i%columns)*w,top:Math.floor(i/columns)*h+52});
    tiles.push({input:label(p.label,w),left:(i%columns)*w,top:Math.floor(i/columns)*h});
  }
  await sharp({create:{width:w*columns,height:h*rows,channels:4,background:'#f7f9fb'}}).composite(tiles).png().toFile(path);
}

async function inspectionFiles(output: string) {
  const document = join(output,'character-shadowed.kra'), bindingsPath = join(output,'shadows.json');
  const currentIndex = join(referencesDirectory(output), 'inputs.json');
  const indexPath = await readFile(currentIndex).then(
    () => currentIndex, error => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return join(output,'references/inputs.json');
    });
  return { document, bindingsPath, indexPath, receipt: join(output,'inspection.json'), stamp: await signature(document,bindingsPath,indexPath) };
}

// The passed receipt for the saved KRA, shadows.json, inputs and inspection
// code as they are now, with every listed file unchanged; undefined otherwise.
async function currentReceipt(output: string, receipt: string, stamp: string) {
  // Receipt v2 writes task-root paths; v1 paths were relative to this step.
  const root = taskRootOf(dirname(output));
  try {
    const previous = JSON.parse(await readFile(receipt,'utf8'));
    if (previous.passed === true && previous.signature === stamp) {
      // within() below rejects any key that leaves this step.
      const path = (p: string) => previous.version === 2 ? resolve(root, p) : join(output, p);
      const files = Object.entries(previous.fileHashes ?? {});
      const base = await realpath(output);
      if (files.length && (await Promise.all(files.map(async ([p,h]) => { const file = path(p); return within(base,await realpath(file)) && await fileHash(file) === h; }))).every(Boolean)) return previous;
    }
  } catch (e) { if (!(e instanceof SyntaxError) && !['ENOENT','ENOTDIR'].includes((e as NodeJS.ErrnoException).code ?? '')) throw e; }
}

// Runs the inspection in the section's Krita through its bridge. Rule
// violations come back as `problems` for the agent to fix; only a check that
// cannot run (missing files, invalid structure, Krita failure) throws.
export async function inspectMask(output: string, bridge: string, signal?: AbortSignal, native: NativeInspect = inspectNative) {
  const { document, bindingsPath, indexPath, receipt, stamp } = await inspectionFiles(output);
  const root = taskRootOf(dirname(output)), at = (p: string) => toTaskPath(root, p);
  const previous = await currentReceipt(output, receipt, stamp);
  if (previous) return previous;
  const bindings = JSON.parse(await readFile(bindingsPath,'utf8'));
  if (bindings.version !== 2 || !Array.isArray(bindings.shadows) || !Array.isArray(bindings.excluded)) throw new Error('素材检查需要 shadows.json v2，记录 testOffsets；详见 references/production.md');
  const layers = kraLayers(kraContents(await readFile(document)).xml);
  const index = JSON.parse(await readFile(indexPath,'utf8')) as InputIndex;
  validateMaskStructure(layers, new Map(index.layers.map(l => [l.uuid,{nodetype:l.type,name:l.name,parent:l.parent,...l.maskState}])), new Set(index.parts.map(p => p.id)), bindings);
  const problems: string[] = [];
  for (const r of bindings.shadows) {
    if (!r.testOffsets || !r.notes?.trim()) throw new Error('请记录本部件的像素偏移检查与画法依据：' + r.id);
    for (const [ids, declared] of [[r.casterLayerUuids,[r.casterPartId]], [r.receiverLayerUuids,r.receiverPartIds ?? [r.receiverPartId]]] as [string[],string[]][]) {
      for (const id of ids) {
        const matched = index.layers.find(l => l.uuid === id.replace(/[{}]/g,'').toLowerCase())?.nameMatch;
        if (matched && !declared.some(p => matched === p || matched.startsWith(p + '/'))) problems.push(r.id + '：图层名称已匹配到其他 part，请核对归属：' + id);
      }
    }
  }
  const folder = join(output,'workspace','inspection','native-' + randomUUID());
  const result = await native(document,bindings.shadows,folder,bridge,signal);
  if (!result.success || result.relations.length !== bindings.shadows.length
    || result.relations.some((r,i) => r.id !== bindings.shadows[i].id || JSON.stringify(r.frames.map(f => f.offset)) !== JSON.stringify(bindings.shadows[i].testOffsets))) throw new Error('原生检查结果与声明关系不一致');
  const files: string[] = [], relations = [], warnings: string[] = [];
  const inspectionRoot = await realpath(folder);
  const owned = async (name: string) => {
    const path = join(folder,name);
    if (!within(inspectionRoot, await realpath(path))) throw new Error('原生检查输出超出检查目录');
    files.push(path); return path;
  };
  const base = await raster(await owned('without-shadows.png'));
  const finalPath = await owned('native-final.png'), final = await raster(finalPath);
  if (base.info.width !== result.width || base.info.height !== result.height || final.info.width !== result.width || final.info.height !== result.height) throw new Error('原生检查画布改变');
  if (alphaGain(base.data, final.data)) problems.push('阴影在受影裁切范围外新增 alpha，请检查原生裁切');
  for (const [i,r] of result.relations.entries()) {
    const rawPath = await owned(r.fullPaint), raw = await raster(rawPath), receiverPath = await owned(r.receiver), receiver = await raster(receiverPath);
    const clipBase = await raster(await owned(r.clipBase));
    if (raw.info.width !== receiver.info.width || raw.info.height !== receiver.info.height) throw new Error('阴影与受影采样未配准');
    let painted = 0, overlap = 0;
    for (let p = 3; p < raw.data.length; p += 4) if (raw.data[p]) { painted++; if (receiver.data[p]) overlap++; }
    if (!painted) problems.push(r.id + '：完整影层为空');
    else if (overlap === painted) warnings.push(r.id + '：完整影层没有裁切外像素，请检查是否预裁死或确实适用');
    const panels = [{path:rawPath,label:'Full shadow paint'},{path:receiverPath,label:'Receiver coverage'}];
    for (const frame of r.frames) {
      const path = await owned(frame.file), pixels = await raster(path);
      const clipped = await raster(await owned(frame.clipped));
      if (clipped.info.width !== clipBase.info.width || clipped.info.height !== clipBase.info.height || pixels.info.width !== result.width || pixels.info.height !== result.height) throw new Error('原生检查画布改变');
      if (alphaGain(clipBase.data, clipped.data)) problems.push(`${r.id}：偏移 ${frame.offset.join(', ')} 时隔离组内阴影越过受影裁切`);
      if (alphaGain(base.data,pixels.data)) problems.push(`${r.id}：偏移 ${frame.offset.join(', ')} 时阴影越过原生裁切`);
      panels.push({path,label:'Native offset ' + frame.offset.join(', ')});
    }
    const review = join(output,'inspection',`relation-${String(i).padStart(3,'0')}-review.png`);
    await mkdir(join(output, 'inspection'), { recursive: true });
    await sheet(panels,review,3); files.push(review);
    const own = (name: string) => at(join(folder, name));
    relations.push({...r,fullPaint:own(r.fullPaint),receiver:own(r.receiver),clipBase:own(r.clipBase),
      frames:r.frames.map(f => ({...f,file:own(f.file),clipped:own(f.clipped)})),
      rawAlphaPixels:painted,receiverIntersectionPixels:overlap,outsideReceiverPixels:painted-overlap,review:at(review),nativeDirectory:at(folder)});
  }
  const overview = join(output,'inspection/overview.png');
  await mkdir(join(output,'inspection'),{recursive:true});
  await sheet([{path:join(folder,'without-shadows.png'),label:'Without cast shadows'},{path:finalPath,label:'Native final'}],overview,2); files.push(overview);
  if (await signature(document,bindingsPath,indexPath) !== stamp) throw new Error('检查期间工程变化，请重跑检查');
  const fileHashes = Object.fromEntries(await Promise.all(files.map(async p => [at(p),await fileHash(p)])));
  const report = {version:2,signature:stamp,passed:problems.length === 0,nativeVersion:result.nativeVersion,width:result.width,height:result.height,
    relations,problems,warnings,fileHashes,scope:'Native clipping and declared relative offsets; not physics or deformer animation. Raw intersection is before ancestor masks and final occluders.'};
  await writeFile(receipt,JSON.stringify(report,null,2)+'\n');
  return report;
}

// The agent's inspection tool in the mask section: renders in the section's
// Krita, starting it like the krita tool's run, and returns what to look at.
export function createInspectionTool(output: string, krita: SectionKrita, native: NativeInspect = inspectNative): FunctionTool {
  return {
    ...toolDefinition('inspect_shadow_mask', fileURLToPath(new URL('./tools/', import.meta.url))),
    async execute(_value, signal) {
      await krita.start(signal);
      const report = await inspectMask(output, krita.bridge!, signal, native);
      const root = taskRootOf(dirname(output)), from = (p: string) => resolve(root, p);
      return { ...textResult({ passed: report.passed, problems: report.problems ?? [], warnings: report.warnings ?? [],
        receipt: join(output, 'inspection.json'), overview: join(output, 'inspection/overview.png'),
        relations: report.relations.map((r: { id: string; review: string; nativeDirectory: string; outsideReceiverPixels: number }) => ({
          id: r.id, review: from(r.review), nativeDirectory: from(r.nativeDirectory), outsideReceiverPixels: r.outsideReceiverPixels })) }),
        success: report.passed };
    },
  };
}
