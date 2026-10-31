import { lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { studioArtifacts } from '../.agents/skills/live2d-maker/shared/studio-artifacts.ts';
import { shadowArtifacts, shadowMode } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { inspectDraftPreview } from '../.agents/skills/live2d-maker/shadow/preview.ts';
import { safePath } from './files.ts';
import { isNineAxisSource, nineAxisArtifacts } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';

type Selection = { version: number; mode: 'mask' | 'normal-depth'; sourceKraHash: string; sourceColorHash: string };
const previewModes = ['mask', 'normal-depth', 'mixed'] as const;
const { selection: _selection, ...shadowOutputs } = shadowArtifacts;
// Every output the studio may read from a project folder.
export const studioPaths = new Set<string>([...Object.values(studioArtifacts), ...Object.values(shadowOutputs), ...Object.values(nineAxisArtifacts)]);
// Nine-axis layer textures are numbered by draw order.
export const isStudioPath = (path: string) => studioPaths.has(path) || /^nine-axis\/step0(2_angle-x|3_angle-y)\/layers\/\d{3}\.png$/.test(path);

export async function studioProject(directory: string, name: string, dir: string, preview?: string | null) {
  if (preview && !previewModes.includes(preview as any)) throw Error('预览方式必须为 mask、normal-depth 或 mixed');
  async function record(path: string, expectedMode?: Selection['mode']): Promise<Selection | undefined> {
    try {
      const value = JSON.parse(await readFile(await safePath(directory, path), 'utf8'));
      if (value?.version !== 1 || !/^[a-f0-9]{64}$/.test(value.sourceKraHash) || !/^[a-f0-9]{64}$/.test(value.sourceColorHash)) throw Error('无效的阴影交付记录');
      shadowMode(value.mode);
      if (expectedMode && value.mode !== expectedMode) throw Error('阴影交付记录与分支不一致');
      return value;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  async function file(path: string) {
    try {
      const info = await lstat(await safePath(directory, path));
      if (!info.isFile()) throw Error('项目产物不是文件：' + path);
      return { path, available: info.size > 0, version: `${info.mtimeMs}:${info.size}` };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { path, available: false, version: null };
    }
  }
  const [selection, maskRecord, mapsRecord] = await Promise.all([
    record(shadowArtifacts.selection), record('shadow/step01_mask/source.json', 'mask'), record('shadow/step01_normal-depth/source.json', 'normal-depth'),
  ]);
  // Each shadow mode keeps its own provenance. A newer route never validates an older one.
  const sourceHashes = await Promise.all([studioArtifacts.document, studioArtifacts.color].map(async path => {
    try { return createHash('sha256').update(await readFile(await safePath(directory, path))).digest('hex'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return null; }
  }));
  const stale = (r: Selection | undefined) => !!r && (sourceHashes[0] !== r.sourceKraHash || sourceHashes[1] !== r.sourceColorHash);
  const maskSource = maskRecord ?? (selection?.mode === 'mask' ? selection : undefined);
  const mapsSource = mapsRecord ?? (selection?.mode === 'normal-depth' ? selection : undefined);
  const maskStale = stale(maskSource), mapsStale = stale(mapsSource);
  const paths = { ...studioArtifacts, maskDocument: shadowArtifacts.maskDocument, maskColor: shadowArtifacts.maskColor, bindings: shadowArtifacts.bindings,
    draftNormal: shadowArtifacts.draftNormal, draftDepth: shadowArtifacts.draftDepth };
  const all = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await file(path)])));
  const maskAvailable = !!maskSource && !maskStale && all.maskDocument.available && all.maskColor.available && all.bindings.available;
  const publishedMaps = !mapsStale && (!!mapsSource || !selection) && all.normal.available && all.depth.available;
  let draftRecord;
  if (!mapsSource && !publishedMaps && all.draftNormal.available && all.draftDepth.available) {
    try {
      await safePath(directory, 'part-layering/references');
      draftRecord = await inspectDraftPreview(name, dir);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const draftValid = !!draftRecord && !stale(draftRecord);
  const mapsAvailable = publishedMaps || draftValid;
  const availableModes = { mask: maskAvailable, 'normal-depth': mapsAvailable, mixed: maskAvailable && mapsAvailable };
  const mode = preview || (selection?.mode === 'mask' && maskAvailable ? mapsAvailable ? 'mixed' : 'mask' : 'normal-depth');
  if ((mode === 'mask' || mode === 'mixed') && !availableModes[mode]) throw Error(mode === 'mixed' ? '混合预览需要同一组装版本的蒙版和法线／深度产物' : '投影蒙版尚未交付或源工程已变化');
  // Preview modes choose the source document, never unload matching data maps.
  // An explicit mask entry starts with lighting off in the UI; its toggle can
  // enable lighting without replacing the document or its physics resources.
  const useMask = mode !== 'normal-depth', useDraft = !publishedMaps && draftValid;
  const useMaps = publishedMaps || useDraft;
  const normal = useDraft ? all.draftNormal : all.normal, depth = useDraft ? all.draftDepth : all.depth;
  const files = {
    document: useMask ? all.maskDocument : all.document,
    color: useMask ? all.maskColor : all.color,
    normal: { ...normal, available: useMaps && normal.available },
    depth: { ...depth, available: useMaps && depth.available },
    bindings: { ...all.bindings, available: useMask && maskAvailable },
  };
  // The newest editable document wins: a nine-axis KRA made from the chosen
  // document replaces it; layer UUIDs are kept, so shadow bindings still apply.
  const angleY = await file(nineAxisArtifacts.angleYDeformers);
  const nineAxis = angleY.available ? angleY : await file(nineAxisArtifacts.headDeformers);
  let nineAxisDocument = false, nineAxisStale = false;
  let nineSource: unknown;
  try { nineSource = JSON.parse(await readFile(await safePath(directory, nineAxisArtifacts.headSource), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (nineSource !== undefined) {
    if (!isNineAxisSource(nineSource)) throw Error('无效的头部九轴来源记录');
    const source = nineSource;
    const [document, color] = await Promise.all([file(nineAxisArtifacts.headDocument), file(nineAxisArtifacts.headColor)]);
    if (document.available && color.available && source.sourceDocument === files.document.path && source.sourceColor === files.color.path) {
      nineAxisStale = (await Promise.all([files.document.path, files.color.path].map(async path => createHash('sha256').update(await readFile(await safePath(directory, path))).digest('hex'))))
        .some((hash, i) => hash !== [source.sourceKraHash, source.sourceColorHash][i]);
      if (!nineAxisStale) { files.document = document; files.color = color; nineAxisDocument = true; }
    }
  }
  return { name, dir, files, nineAxis, nineAxisDocument, nineAxisStale, previewMode: mode, previewModes: availableModes, maskStale, mapsStale,
    previewDraft: useDraft, ...(useDraft ? { previewReview: draftRecord!.status, previewReviewReason: draftRecord!.reason } : {}),
    ...(selection ? { shadowMode: selection.mode, shadowStale: stale(selection) } : {}) };
}
