import { lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { studioArtifacts } from '../studio-artifacts.ts';
import { shadowArtifacts, shadowMode } from '../shadow.ts';
import { inspectDraftPreview } from '../../shadow/preview.ts';
import { safePath, jsonFile } from '../artifact-files.ts';

type Selection = { version: number; mode: 'mask' | 'normal-depth'; sourceKraHash: string; sourceColorHash: string };
const previewModes = ['mask', 'normal-depth', 'mixed'] as const;

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
    record(shadowArtifacts.selection), record('shadow/mask/step01/source.json', 'mask'), record('shadow/normal-depth/step01/source.json', 'normal-depth'),
  ]);
  // Each branch keeps its own provenance. A newer route never validates an older one.
  const sourceHashes = await Promise.all([studioArtifacts.document, studioArtifacts.color].map(async path => {
    try { return createHash('sha256').update(await readFile(await safePath(directory, path))).digest('hex'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; return null; }
  }));
  const stale = (r: Selection | undefined) => !!r && (sourceHashes[0] !== r.sourceKraHash || sourceHashes[1] !== r.sourceColorHash);
  const maskSource = maskRecord ?? (selection?.mode === 'mask' ? selection : undefined);
  const mapsSource = mapsRecord ?? (selection?.mode === 'normal-depth' ? selection : undefined);
  const maskStale = stale(maskSource), mapsStale = stale(mapsSource);
  const paths = { ...studioArtifacts, maskDocument: shadowArtifacts.maskDocument, maskColor: shadowArtifacts.maskColor, bindings: shadowArtifacts.bindings,
    physics: 'physics/physics.json', physicsDraft: 'physics/physics.draft.json', draftNormal: shadowArtifacts.draftNormal, draftDepth: shadowArtifacts.draftDepth };
  const all = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await file(path)])));
  const [formalPhysics,draftPhysics]=await Promise.all(['physics/physics.json','physics/physics.draft.json'].map(async path=>{try{return JSON.parse(await readFile(await safePath(directory,path),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return null;}}));
  const physicsDraftStale=!!draftPhysics&&!!formalPhysics&&draftPhysics.review?.baseConfigHash!==formalPhysics.review?.configHash;
  const maskAvailable = !!maskSource && !maskStale && all.maskDocument.available && all.maskColor.available && all.bindings.available;
  const publishedMaps = !mapsStale && (!!mapsSource || !selection) && all.normal.available && all.depth.available;
  let draftRecord;
  if (!mapsSource && !publishedMaps && all.draftNormal.available && all.draftDepth.available) {
    try {
      await safePath(directory, 'shadow/normal-depth/run.json');
      await safePath(directory, 'part-layering/references');
      draftRecord = await inspectDraftPreview(name, dir);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  // Reuse an explicitly frozen physics preview after upstream review rules
  // change. Exact source/color/map hashes still have to match; this is not a
  // shadow-workflow delivery or a way to discover arbitrary loose images.
  let frozenPreview = false;
  if (!draftRecord && !publishedMaps && all.draftNormal.available && all.draftDepth.available) {
    const selectedPhysics = draftPhysics && !physicsDraftStale ? draftPhysics : formalPhysics;
    const frozen = await jsonFile(directory, 'physics/source/surface-inputs.json');
    if (frozen?.version === 1 && frozen.documentHash === sourceHashes[0]
      && selectedPhysics?.source?.documentHash === sourceHashes[0]
      && selectedPhysics?.source?.colorHash === sourceHashes[1]
      && frozen.maps?.normal?.path === shadowArtifacts.draftNormal && frozen.maps?.depth?.path === shadowArtifacts.draftDepth) {
      const hashes = await Promise.all([all.draftNormal.path, all.draftDepth.path].map(async path =>
        createHash('sha256').update(await readFile(await safePath(directory, path))).digest('hex')));
      frozenPreview = hashes[0] === frozen.maps.normal.contentHash && hashes[1] === frozen.maps.depth.contentHash;
      if (frozenPreview) draftRecord = { sourceKraHash: sourceHashes[0], sourceColorHash: sourceHashes[1],
        status: 'frozen-preview-input', reason: '使用与当前源工程、底色及贴图哈希一致的物理预览快照；阴影管线尚未验收。' } as any;
    }
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
    physics: all.physicsDraft.available&&!physicsDraftStale ? all.physicsDraft : all.physics,
    bindings: { ...all.bindings, available: useMask && maskAvailable },
  };
  return { name, dir, files, physicsDraftStale, previewMode: mode, previewModes: availableModes, maskStale, mapsStale,
    previewDraft: useDraft, ...(useDraft ? { previewReview: draftRecord!.status, previewReviewReason: draftRecord!.reason, previewFrozen: frozenPreview } : {}),
    ...(selection ? { shadowMode: selection.mode, shadowStale: stale(selection) } : {}) };
}
