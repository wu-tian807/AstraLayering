import { lstat, readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { createHash } from 'node:crypto';
import { studioArtifacts } from '../.agents/skills/live2d-maker/shared/studio-artifacts.ts';
import { shadowArtifacts, shadowMode } from '../.agents/skills/live2d-maker/shared/shadow.ts';
import { inspectDraftPreview } from '../.agents/skills/live2d-maker/shadow/preview.ts';
import { safePath } from './files.ts';
import { readStep } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { nineAxisArtifacts, nineAxisStages, type NineAxisStage } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { modelDocument, modelVersion } from '../.agents/skills/live2d-maker/nine-axis/source.ts';

type Selection = { version: number; mode: 'mask' | 'normal-depth'; sourceKraHash: string; sourceColorHash: string };
const previewModes = ['mask', 'normal-depth', 'mixed'] as const;
const { selection: _selection, ...shadowOutputs } = shadowArtifacts;
// Every output the studio may read from a project folder.
export const studioPaths = new Set<string>([...Object.values(studioArtifacts), ...Object.values(shadowOutputs), ...Object.values(nineAxisArtifacts)]);
// Nine-axis layer textures: numbered by draw order, or named by the jaw step's new parts.
export const isStudioPath = (path: string) => studioPaths.has(path)
  || /^nine-axis\/(?:step01_preparation|step04_angles\/model(?:\/(?:left|up|down|merged))?|step06_angle-xy|step07_jaw-line|step08_hair|step09_head-accessories|step10_head-pitch(?:\/(?:up|down))?|step11_head-angle-xy|step12_head-roll)\/layers\/[\w-]+\.png$/.test(path);

export async function studioProject(directory: string, name: string, dir: string, preview?: string | null, nineStage?: string | null) {
  if (preview && !previewModes.includes(preview as any)) throw Error('预览方式必须为 mask、normal-depth 或 mixed');
  if (nineStage && !Object.hasOwn(nineAxisStages, nineStage)) throw Error('九轴阶段必须为 neutral、x、up、down、y、xy、jaw、hair、accessories、headPitch、headCorners 或 headRoll');
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
  const maskAvailable = !!maskSource && !maskStale && all.maskDocument.available && all.bindings.available;
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
  const order: NineAxisStage[] = ['headRoll','headCorners','headPitch','accessories','hair', 'jaw', 'xy', 'y', 'x', 'up', 'down', 'neutral'];
  const stageFile = async (stage: NineAxisStage) => {
    const value = await file(nineAxisStages[stage]);
    if (stage === 'headRoll' && value.available && (await readStep(await safePath(directory, 'nine-axis/step12_head-roll'))).status !== 'completed') return { ...value, available: false };
    if(stage==='headPitch'&&value.available&&(await readStep(await safePath(directory,'nine-axis/step10_head-pitch'))).status!=='completed')return {...value,available:false};
    return value;
  };
  let selectedStage: NineAxisStage = 'neutral', nineAxis = await stageFile('neutral');
  if (nineStage) { selectedStage = nineStage as NineAxisStage; nineAxis = await stageFile(selectedStage); }
  else for (const stage of order) {
    const candidate = await stageFile(stage);
    if (candidate.available) { selectedStage = stage; nineAxis = candidate; break; }
  }
  // Models name their own KRA. A matching PNG is only a display asset.
  let nineAxisDocument = false;
  if (nineAxis.available) {
    // The materials endpoint reports invalid models without hiding the project.
    let model;
    try { model = JSON.parse(await readFile(await safePath(directory, nineAxis.path), 'utf8')); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; model = {}; }
    const source = modelDocument(directory, model);
    if (source) {
      const sourcePath = relative(directory, source).split('\\').join('/');
      if (!isStudioPath(sourcePath) || !sourcePath.endsWith('.kra')) throw Error('九轴来源必须是任务内已知的 KRA 工程');
      const document = await file(sourcePath);
      if (!document.available) throw Error('九轴引用的 KRA 不存在：' + sourcePath);
      files.document = document;
      files.color = await file(sourcePath.replace(/\.kra$/, '.png'));
      nineAxisDocument = true;
      nineAxis = { ...nineAxis, version: await modelVersion(directory, model, nineAxis.version!) };
    }
  }
  return { name, dir, files, nineAxis: { ...nineAxis, stage: selectedStage }, nineAxisDocument, previewMode: mode, previewModes: availableModes, maskStale, mapsStale,
    previewDraft: useDraft, ...(useDraft ? { previewReview: draftRecord!.status, previewReviewReason: draftRecord!.reason } : {}),
    ...(selection ? { shadowMode: selection.mode, shadowStale: stale(selection) } : {}) };
}
