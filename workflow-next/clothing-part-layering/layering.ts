import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { checkSubject, findGroup, groupCompleted, GroupStore, normalizeGroups, setGroupProgress, walkGroups, writeAtomic } from './groups.ts';
import { artifactPath, draftPath, mergeSourceHash, publishSvg, readJson, readReviewReport, readSvg, reductionReportPath, reportPath, restoreFacts, reviewedArtifact, stampedSvg, svgHash } from './artifact-facts.ts';
import { mergePartSvgs } from './merge-svg.ts';
import type { GroupContext, GroupInput, GroupNode, GroupsDocument, GroupSeed, GroupStage, GroupStageOutputs, LayeringResult, LayeringSteps, StepResult, SvgArtifact, SvgMerger } from './layering-types.ts';
import type { PreparationReferences } from './preparation.ts';
import { runWorkflow, validateWorkflowOptions } from './workflow.ts';
import { validateGroupSvg } from './svg-tools.ts';
import { assertCompletionPreserves } from './completion-svg.ts';
import { occlusionPath, occlusionSourceHash, restoreOcclusionPlan, validateOcclusionPlan } from './occlusion-plan.ts';
import { invalidatePendingArtifacts } from './artifact-invalidation.ts';
import { completionInputsPath, completionReferenceGroups, dependenciesMatch } from './completion-inputs.ts';

const labels = { outline: '组轮廓与自检', review: '外轮廓与去噪 review', reduction: '同层轮廓去重',
  completion: '直接遮挡补形', completionCheck: '补形自检', children: '子组分析' };

export class GroupExecutionError extends Error {
  groups: GroupNode[] = [];
  statePath?: string;
  readonly groupId: string;
  readonly stage: GroupStage;
  constructor(groupId: string, stage: GroupStage, cause: unknown) {
    super(`[${groupId}] ${labels[stage]}失败：${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = 'GroupExecutionError';
    this.groupId = groupId;
    this.stage = stage;
  }
}

function proposal(output: { groups: GroupSeed[] }, document: GroupsDocument, allowParts = false): GroupNode[] {
  if (!output || !Array.isArray(output.groups) || 'parts' in output) throw new Error('分组提案必须只包含直属 groups');
  for (const group of output.groups) {
    if (!group || typeof group !== 'object' || 'groups' in group || 'steps' in group || 'parts' in group || 'childrenAnalysis' in group ||
      (!allowParts && group.kind === 'part') || 'type' in group) {
      throw new Error('Agent proposals must contain direct group seeds without children or progress');
    }
  }
  return normalizeGroups(output.groups, new Set(walkGroups(document.groups).map(entry => entry.group.id)));
}

export async function runLayering(input: {
  directory: string; references: PreparationReferences; groups: GroupInput | GroupInput[] | null;
  steps: LayeringSteps; mergeSvg?: SvgMerger; maxDepth?: number;
  progress?: (message: string) => void;
}): Promise<LayeringResult> {
  validateWorkflowOptions(input);
  const directory = resolve(input.directory);
  const store = await GroupStore.open(directory);
  // 即使本次仅恢复已提交事实、没有新工作，也将恢复出来的树落盘。
  await store.update(() => {});
  const report = input.progress ?? (() => {});
  const initial = { directory, references: input.references, store };
  const statePath = join(directory, 'stages');
  let selected: Set<string> | undefined;
  let completedOcclusion: string | undefined;
  const referencesByGroup = new Map(await Promise.all(walkGroups(store.snapshot().groups).map(async ({ group, parent }) =>
    [group.id, await completionReferenceGroups(directory, group.id, parent?.id)] as const)));

  function context(id: string): GroupContext {
    const entry = walkGroups(store.snapshot().groups).find(entry => entry.group.id === id);
    if (!entry) throw new Error(`Unknown group: ${id}`);
    return { ...initial, group: entry.group, parent: entry.parent };
  }
  function scope(): Set<string> | undefined {
    if (!selected) return;
    const result = new Set(selected);
    for (const entry of walkGroups(store.snapshot().groups)) if (entry.parent && result.has(entry.parent.id)) result.add(entry.group.id);
    return result;
  }
  function expandReferences() {
    if (!selected) return;
    let changed: boolean;
    do {
      changed = false;
      const ids = scope()!;
      for (const [id, references] of referencesByGroup) if (!ids.has(id) && references.some(reference => ids.has(reference))) {
        selected.add(id); changed = true;
      }
    } while (changed);
  }
  function artifact(id: string, stage: 'outline' | 'review' | 'reduction' | 'completion'): SvgArtifact {
    const saved = context(id).group.steps[stage];
    if (saved.status !== 'completed' || !saved.output) throw new Error(`${id}.${stage} is not completed`);
    return saved.output;
  }
  async function refresh() {
    const document = store.snapshot();
    await restoreFacts(directory, document);
    await store.update(draft => { draft.groups = document.groups; draft.merge = document.merge; });
  }
  async function execute<S extends GroupStage>(id: string, stage: S, action: () => Promise<StepResult<GroupStageOutputs[S]>>): Promise<boolean> {
    if (context(id).group.steps[stage].status === 'completed') {
      report(`[${id}] ${labels[stage]}：沿用事实结果`);
      return true;
    }
    await store.update(document => setGroupProgress(findGroup(document, id), stage, { status: 'running' }));
    report(`[${id}] ${labels[stage]}：开始`);
    try {
      const result = await action();
      await store.update(document => setGroupProgress(findGroup(document, id), stage, result.status === 'completed'
        ? { status: 'completed', output: result.output } : { status: 'pending', message: result.message }));
      report(`[${id}] ${labels[stage]}：${result.status === 'completed' ? '完成' : result.message}`);
      return result.status === 'completed';
    } catch (error) {
      await store.update(document => setGroupProgress(findGroup(document, id), stage, { status: 'failed', message: String(error) }));
      report(`[${id}] ${labels[stage]}：失败，等待已启动任务收尾：${error instanceof Error ? error.message : String(error)}`);
      throw new GroupExecutionError(id, stage, error);
    }
  }
  async function drawing(id: string, stage: 'outline' | 'completion', action: (draft: string) => Promise<StepResult<SvgArtifact>>) {
    return execute(id, stage, async () => {
      const output = artifactPath(directory, id, stage), draft = draftPath(output);
      const before = stage === 'completion' ? (await readSvg(artifact(id, 'reduction').path))! : undefined;
      await mkdir(dirname(draft), { recursive: true });
      await rm(draft, { force: true });
      const result = await action(draft);
      if (result.status === 'pending') return result;
      if (resolve(directory, result.output.path) !== draft) throw new Error('SVG 步骤只能交付指定的 .draft.svg');
      const meta = await sharp(resolve(directory, input.references.baseSubject)).metadata();
      await validateGroupSvg(draft, id, { width: meta.autoOrient.width, height: meta.autoOrient.height },
        context(id).parent?.steps.completion.output?.path, stage === 'completion');
      const parent = context(id).parent?.steps.completion.output?.path;
      const source = stage === 'completion' ? artifact(id, 'reduction').path : parent;
      if (before) {
        if (!(await readFile(source!)).equals(before)) throw new Error('补全过程修改了原轮廓');
        assertCompletionPreserves(before.toString(), (await readFile(draft)).toString());
      }
      const sourceHash = source ? svgHash((await readSvg(source))!) : undefined;
      if (stage === 'completion') {
        const dependencies = result.output.dependencies ?? [];
        if (!await dependenciesMatch(directory, dependencies)) throw new Error('补全输入已变化，不能发布');
        const marked = Buffer.from((await readSvg(draft))!.toString().replace(/<svg\b[^>]*>/, root =>
          root.replace(/\sdata-completion-inputs=(['"]).*?\1/g, '').replace(/>$/, ' data-completion-inputs="v1">')));
        await writeAtomic(draft, marked);
        // 输入记录先写，正式 SVG 最后发布；中断或记录不匹配不能恢复该补全。
        await writeAtomic(completionInputsPath(directory, id), JSON.stringify({ version: 1, groupId: id,
          beforeHash: sourceHash, afterHash: svgHash(stampedSvg(marked, sourceHash)), dependencies }, null, 2) + '\n');
      }
      await publishSvg(draft, output, sourceHash);
      return { status: 'completed', output: { ...result.output, path: output } };
    });
  }
  async function prepare(id: string) {
    if (!await drawing(id, 'outline', outputPath => input.steps.drawOutline({ ...context(id), outputPath }))) return;
    await execute(id, 'review', async () => {
      const outline = artifact(id, 'outline');
      const path = reportPath(directory, id, 'review');
      const result = await input.steps.reviewOutline({ ...context(id), outline, reportPath: path });
      if (result.status === 'pending') return result;
      if (resolve(result.output.path) !== outline.path) throw new Error('review 只能引用当前组的轮廓 SVG，不能产出新 SVG');
      const verified = reviewedArtifact((await readSvg(outline.path))!, outline.path, await readReviewReport(path, id));
      if (!verified) throw new Error('review 未保存与当前 SVG 对应的完成事实');
      return { status: 'completed', output: verified };
    });
  }
  async function reduce(depth: number, entries: ReturnType<typeof walkGroups>): Promise<boolean> {
    const receipt = await readJson(reductionReportPath(directory, depth));
    if (receipt?.groups?.length === entries.length && entries.every(entry =>
      context(entry.group.id).group.steps.reduction.status === 'completed')) return true;
    report(`第 ${depth} 层轮廓去重：开始`);
    const inputs = await Promise.all(entries.map(async entry => {
      const bytes = (await readSvg(artifact(entry.group.id, 'outline').path))!;
      const output = artifactPath(directory, entry.group.id, 'reduction'), draft = draftPath(output);
      await mkdir(dirname(draft), { recursive: true });
      await rm(draft, { force: true });
      const current = context(entry.group.id).group.steps.reduction.status === 'completed' ? { path: output } : undefined;
      return { ...entry, bytes, output, draft, current, hash: svgHash(bytes) };
    }));
    const result = inputs.length === 1 ? { status: 'completed' as const, output: { changed: [], note: '本层只有一个组，无跨组重复' } }
      : input.steps.reduceOutlines ? await input.steps.reduceOutlines({ ...initial, depth,
        entries: inputs.map(entry => ({ group: context(entry.group.id).group, parent: context(entry.group.id).parent,
          outline: artifact(entry.group.id, 'outline'), current: entry.current, outputPath: entry.draft })) })
        : { status: 'pending' as const, message: '同层轮廓去重：待接入' };
    if (result.status === 'pending') { report(result.message); return false; }
    if (!Array.isArray(result.output.changed)) throw new Error('去重结果必须包含 changed');
    const changes = new Map<string, string>();
    for (const change of result.output.changed) {
      const entry = inputs.find(entry => entry.group.id === change.groupId);
      if (!entry || changes.has(change.groupId) || resolve(change.path) !== entry.draft) throw new Error('去重结果只能引用本层组的指定 .draft.svg');
      changes.set(change.groupId, change.path);
    }
    // 整批检查后再发布；提交记录最后落盘，部分输出不构成完成事实。
    const meta = changes.size ? await sharp(resolve(directory, input.references.baseSubject)).metadata() : undefined;
    for (const entry of inputs) {
      if (!(await readFile(artifact(entry.group.id, 'outline').path)).equals(entry.bytes)) throw new Error('去重修改了原轮廓');
      if (changes.has(entry.group.id)) {
        await validateGroupSvg(entry.draft, entry.group.id, { width: meta!.autoOrient.width, height: meta!.autoOrient.height },
          context(entry.group.id).parent?.steps.completion.output?.path, true);
      }
      else await writeAtomic(entry.draft, entry.current ? await readFile(entry.current.path) : entry.bytes);
    }
    const revised = [];
    for (const entry of inputs) {
      const previous = await readSvg(entry.output);
      if (!previous || !previous.equals((await readSvg(entry.draft))!)) revised.push(entry);
    }
    // 只在某件去重输出确实改变时撤下该输出，让恢复器沿真实引用找到受影响补全。
    // 删除在新输出发布前完成；其他 part 的输出与完成事实保持原样。
    for (const entry of revised) {
      await rm(entry.output, { force: true });
      if (selected && entry.current) selected.add(entry.group.id);
    }
    expandReferences();
    if (revised.length) {
      await refresh();
      await invalidatePendingArtifacts(directory, store, new Set(inputs.map(entry => entry.draft)));
    }
    const groups = [];
    for (const entry of inputs) {
      if (revised.includes(entry)) await publishSvg(entry.draft, entry.output);
      else await rm(entry.draft, { force: true });
      groups.push({ id: entry.group.id, inputHash: entry.hash, outputHash: svgHash((await readSvg(entry.output))!) });
    }
    await writeAtomic(reductionReportPath(directory, depth), JSON.stringify({ depth, groups, note: result.output.note ?? '' }, null, 2) + '\n');
    await refresh();
    report(`第 ${depth} 层轮廓去重：完成`);
    return true;
  }
  async function finish(id: string) {
    if (groupCompleted(context(id).group)) return;
    const reduced = artifact(id, 'reduction');
    const mask = await sharp(await readFile(reduced.path)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
    const empty = !mask.some(value => value >= 128);
    if (!await drawing(id, 'completion', async outputPath => {
      if (empty) { await writeAtomic(outputPath, await readFile(reduced.path)); return { status: 'completed', output: { path: outputPath } }; }
      return input.steps.completeOcclusion({ ...context(id), outputPath, reviewed: reduced });
    })) return;
    if (!await execute(id, 'completionCheck', async () => {
      const after = artifact(id, 'completion');
      const result = empty ? { status: 'completed' as const, output: { passed: true as const, note: '去重后为空组' } }
        : await input.steps.checkCompletion({ ...context(id), before: reduced, after });
      if (result.status === 'completed') {
        if (result.output.passed !== true) throw new Error(`${id}: completion check did not pass`);
        await writeAtomic(reportPath(directory, id, 'completion-check'), JSON.stringify({ groupId: id, ...result.output,
          beforeHash: svgHash((await readSvg(reduced.path))!), afterHash: svgHash((await readSvg(after.path))!) }, null, 2) + '\n');
      }
      return result;
    })) return;
    if (context(id).group.kind === 'part') {
      await store.update(document => setGroupProgress(findGroup(document, id), 'children', { status: 'completed', output: { ids: [] } }));
      return;
    }
    await execute(id, 'children', async () => {
      const completed = artifact(id, 'completion');
      const source = (await readSvg(completed.path))!;
      const result = empty ? { status: 'completed' as const, output: { groups: [] } }
        : await input.steps.splitChildren({ ...context(id), completed });
      if (result.status === 'pending') return result;
      const document = store.snapshot();
      if (!(await readFile(completed.path)).equals(source)) throw new Error('子组分析修改了父组完成 SVG');
      const children = proposal(result.output, document, true);
      if (children.some(child => !child.id.startsWith(`${id}/`) || child.id.slice(id.length + 1).includes('/'))) {
        throw new Error('子组 ID 必须是父组 ID 下的直属路径');
      }
      if (context(id).group.groups.length) throw new Error(`${id}: children are already registered without a matching analysis`);
      await store.update(draft => {
        const group = findGroup(draft, id);
        group.groups = children;
        group.childrenAnalysis = { sourceHash: svgHash(source), ...(result.output.note ? { note: result.output.note } : {}) };
      });
      return { status: 'completed', output: { ids: children.map(child => child.id) } };
    });
  }
  async function batch(entries: ReturnType<typeof walkGroups>, action: (id: string) => Promise<void>) {
    await runWorkflow(null, {
      async initialize() {}, async ready() { return entries.map(entry => ({ ...entry, id: entry.group.id })); },
      runRound: group => action(group.id),
    }, { maxDepth: input.maxDepth });
  }

  try {
    if (input.groups !== null) {
      const requested = normalizeGroups(Array.isArray(input.groups) ? input.groups : [input.groups]);
      if (!requested.length) throw new Error('显式 groups 不能为空；自动流程请使用 null');
      const existing = walkGroups(store.snapshot().groups);
      for (const entry of walkGroups(requested)) {
        const saved = existing.find(item => item.group.id === entry.group.id);
        if (!saved) throw new Error(`指定组尚未登记：${entry.group.id}`);
        if (entry.parent && saved.parent?.id !== entry.parent.id) throw new Error('指定组父子关系与已有分组不符');
      }
      selected = new Set(requested.map(group => group.id));
      const firstDepth = Math.min(...existing.filter(entry => selected!.has(entry.group.id)).map(entry => entry.depth));
      const incompletePrior = existing.filter(entry => entry.depth < firstDepth && !groupCompleted(entry.group));
      if (incompletePrior.length) throw new Error(`指定组的前层尚未全部完成：${incompletePrior.map(entry => entry.group.id).join(', ')}`);
      for (const id of selected) {
        let parent = context(id).parent;
        while (parent) {
          if (!groupCompleted(parent)) throw new Error(`指定组 ${id} 的祖先组尚未完成：${parent.id}`);
          parent = context(parent.id).parent;
        }
      }
      for (const path of [input.references.judgment, input.references.simplifiedSubject, input.references.baseSubject]) {
        if (!(await stat(resolve(directory, path))).isFile()) throw new Error(`显式 groups 缺少前置参考：${path}`);
      }
    } else if (!store.snapshot().groups.length) {
      const result = await input.steps.initialGroups(initial);
      if (result.status === 'completed') await store.update(document => {
        if (!document.groups.length) {
          document.groups = proposal(result.output, document);
          if (!document.groups.length) throw new Error('Initial grouping must contain at least one group');
        }
        if (result.output.subject !== undefined) document.subject = result.output.subject;
        checkSubject(document.subject);
      });
      else report(result.message);
    } else report('首次分组：沿用已有结果');

    // 开始任何新制作前撤下失效正式产物，防止相同输入重建后旧下游再次复活。
    expandReferences();
    await invalidatePendingArtifacts(directory, store);
    for (let depth = 0; depth < (input.maxDepth ?? Infinity); depth++) {
      const entries = walkGroups(store.snapshot().groups).filter(entry => entry.depth === depth);
      if (!entries.length) break;
      const selectedIds = scope();
      const targets = entries.filter(entry => !selectedIds || selectedIds.has(entry.group.id));
      if (!targets.length) continue;
      await batch(targets, prepare);
      if (entries.some(entry => context(entry.group.id).group.steps.review.status !== 'completed')) {
        report(`第 ${depth} 层仍有未完成轮廓，等待本层齐备后去重`);
        break;
      }
      try { if (!await reduce(depth, entries)) break; }
      catch (error) { throw new GroupExecutionError(`第 ${depth} 层`, 'reduction', error); }
      const finishIds = scope();
      const finishTargets = entries.filter(entry => !finishIds || finishIds.has(entry.group.id));
      await batch(finishTargets, finish);
      if (finishTargets.some(entry => !groupCompleted(context(entry.group.id).group))) break;
      // 下一层必须等待整层；显式选择也不会自动派发未选分支。
      if (entries.some(entry => !groupCompleted(context(entry.group.id).group))) {
        report(`第 ${depth} 层还有未完成分支，下一层等待`);
        break;
      }
    }
    const document = store.snapshot();
    if (document.groups.length && walkGroups(document.groups).every(entry => groupCompleted(entry.group)) && document.merge.status !== 'completed') {
      const output = join(directory, 'preview.svg'), draft = draftPath(output);
      await mkdir(dirname(draft), { recursive: true });
      await rm(draft, { force: true });
      report('最终预览合并：开始');
      const result = await (input.mergeSvg ?? mergePartSvgs)({ directory, outputPath: draft, groups: document.groups,
        parts: walkGroups(document.groups).filter(({ group }) => !group.groups.length).map(({ group }) => ({ groupId: group.id, svg: artifact(group.id, 'completion') })) });
      if (result.status === 'completed') {
        if (resolve(result.output.path) !== draft) throw new Error('合并只能交付 preview.draft.svg');
        await publishSvg(draft, output, await mergeSourceHash(directory, document));
        await store.update(draft => { draft.merge = { status: 'completed', output: { path: output } }; });
        report(`最终预览合并：完成 ${output}`);
      } else report(result.message);
    }
    // 独立的最后一步；已有 preview 和各组事实不因层级表缺失而重做。
    const merged = store.snapshot();
    if (merged.merge.status === 'completed') {
      const context = { ...initial, groups: merged.groups, preview: merged.merge.output! };
      if (await restoreOcclusionPlan(context)) {
        completedOcclusion = occlusionPath(directory);
        report('遮挡层级规划：沿用完整且输入一致的独立层级表');
      } else {
        report('遮挡层级规划：开始');
        const sourceHash = await occlusionSourceHash(context);
        const result = input.steps.planOcclusion ? await input.steps.planOcclusion(context)
          : { status: 'pending' as const, message: '遮挡层级规划：待接入' };
        if (result.status === 'completed') {
          if (await occlusionSourceHash(context) !== sourceHash) throw new Error('层级规划期间输入发生变化');
          const plan = validateOcclusionPlan(result.output, context, sourceHash);
          completedOcclusion = occlusionPath(directory);
          await writeAtomic(completedOcclusion, JSON.stringify(plan, null, 2) + '\n');
          report(`遮挡层级规划：完成 ${completedOcclusion}`);
        } else report(`遮挡层级规划：${result.message}`);
      }
    }
  } catch (error) {
    if (error instanceof GroupExecutionError) { error.groups = store.snapshot().groups; error.statePath = statePath; }
    throw error;
  } finally { await input.steps.close?.(); }
  const final = store.snapshot();
  return { status: final.merge.status === 'completed' && completedOcclusion ? 'completed' : 'pending', statePath, groupsPath: store.path,
    ...(completedOcclusion ? { occlusionPath: completedOcclusion } : {}),
    groups: final.groups, ...(final.merge.status === 'completed' ? { output: final.merge.output!.path } : {}) };
}
