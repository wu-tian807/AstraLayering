import { lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { studioArtifacts } from '../.agents/skills/live2d-maker/shared/studio-artifacts.ts';
import { shadowArtifacts, shadowMode } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { inspectDraftPreview } from '../.agents/skills/live2d-maker/shadow/preview.ts';
import { safePath } from './files.ts';
import { readStep } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { nineAxisArtifacts, legacyNineAxisArtifacts, nineAxisStages, type NineAxisStage } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';

type Selection = { version: number; mode: 'mask' | 'normal-depth'; sourceKraHash: string; sourceColorHash: string };
const previewModes = ['mask', 'normal-depth', 'mixed'] as const;
const { selection: _selection, ...shadowOutputs } = shadowArtifacts;
// Every output the studio may read from a project folder.
export const studioPaths = new Set<string>([...Object.values(studioArtifacts), ...Object.values(shadowOutputs), ...Object.values(nineAxisArtifacts), ...Object.values(legacyNineAxisArtifacts)]);
// Nine-axis layer textures: numbered by draw order, or named by the jaw step's new parts.
export const isStudioPath = (path: string) => studioPaths.has(path)
  || /^nine-axis\/(?:step02_angles(?:\/(?:neutral|left|up|down|merged))?|step03_angle-xy|step04_jaw-line|step02_angle-x|step04_angle-up|step05_angle-down|step06_angle-xy|step07_jaw-line)\/layers\/[\w-]+\.png$/.test(path);

export async function studioProject(directory: string, name: string, dir: string, preview?: string | null, nineStage?: string | null) {
  if (preview && !previewModes.includes(preview as any)) throw Error('预览方式必须为 mask、normal-depth 或 mixed');
  if (nineStage && !Object.hasOwn(nineAxisStages, nineStage)) throw Error('九轴阶段必须为 x、up、down、y、xy 或 jaw');
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
  // A nested folder selects the new contract even while a requested child or
  // the merge is missing. Old model folders retain their original stage routes.
  const hasDirectory = async (path: string) => {
    try { return (await lstat(await safePath(directory, path))).isDirectory(); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  };
  const nested = await hasDirectory('nine-axis/step02_angles') || !await hasDirectory('nine-axis/step02_angle-x');
  const artifacts = nested ? nineAxisArtifacts : legacyNineAxisArtifacts;
  const stages = nested ? nineAxisStages : { x: legacyNineAxisArtifacts.headDeformers,
    up: legacyNineAxisArtifacts.angleUpDeformers, down: legacyNineAxisArtifacts.angleDownDeformers, y: legacyNineAxisArtifacts.angleDownDeformers,
    xy: legacyNineAxisArtifacts.angleXYDeformers, jaw: legacyNineAxisArtifacts.jawLineDeformers };
  const order: NineAxisStage[] = nested ? ['jaw', 'xy', 'y', 'x', 'up', 'down'] : ['jaw', 'xy', 'down', 'up', 'x'];
  const mergeComplete = !nested || (await Promise.all(['', '/left', '/up', '/down'].map(async suffix => {
    try {
      const path = `nine-axis/step02_angles${suffix}`;
      return (await readStep(await safePath(directory, path))).status === 'completed' && (await file(path + '/deformers.json')).available;
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }))).every(Boolean);
  const stageFile = async (stage: NineAxisStage) => {
    const value = await file(stages[stage]);
    return nested && ['y', 'xy', 'jaw'].includes(stage) && !mergeComplete ? { ...value, available: false } : value;
  };
  let selectedStage: NineAxisStage = 'x', nineAxis = await stageFile('x');
  if (nineStage) { selectedStage = nineStage as NineAxisStage; nineAxis = await stageFile(selectedStage); }
  else for (const stage of order) {
    const candidate = await stageFile(stage);
    if (candidate.available) { selectedStage = stage; nineAxis = candidate; break; }
  }
  // The nine-axis steps work on their own copy of the KRA; once merged, the workbench opens that copy.
  let nineAxisDocument = false;
  const useJaw = nested && selectedStage === 'jaw' && nineAxis.available;
  let [document, color] = await Promise.all([file(useJaw ? nineAxisArtifacts.jawLineDocument : artifacts.headDocument), file(useJaw ? nineAxisArtifacts.jawLineColor : artifacts.headColor)]);
  if (useJaw && (!document.available || !color.available)) [document, color] = await Promise.all([file(artifacts.headDocument), file(artifacts.headColor)]);
  if (mergeComplete && document.available && color.available) { files.document = document; files.color = color; nineAxisDocument = true; }
  return { name, dir, files, nineAxis: { ...nineAxis, stage: selectedStage, layout: nested ? 'nested' : 'legacy', mergeComplete }, nineAxisDocument, previewMode: mode, previewModes: availableModes, maskStale, mapsStale,
    previewDraft: useDraft, ...(useDraft ? { previewReview: draftRecord!.status, previewReviewReason: draftRecord!.reason } : {}),
    ...(selection ? { shadowMode: selection.mode, shadowStale: stale(selection) } : {}) };
}
