import { groupStepId } from './part-steps.ts';
import { partStep } from '../agents/models.ts';
import { agentOutcomeError } from '../codex/diagnostics.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { partProfile } from './profile.ts';
import { readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from '../codex/agents.ts';
import { createBitmapTool } from './bitmap-tool.ts';
import { svgHash } from './artifact-facts.ts';
import { assertCompletionPreserves, composeCompletion, completionPaths } from './completion-svg.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { groupValues, partKnowledge } from './group-prompts.ts';
import { writeAtomic } from './groups.ts';
import { dependenciesMatch, fileDependency } from './completion-inputs.ts';
import type { DrawingContext, GroupContext, SvgArtifact, CompletionCheck } from './layering-types.ts';
import { taskRootOf, toAgentPath } from '../task-paths.ts';
import { createSvgPreviewTool, createSvgReadTool, observedPath, parentBoundsSource, validateGroupSvg, type SvgObservation } from './svg-tools.ts';


export async function completeGroupOcclusion(context: DrawingContext & { reviewed: SvgArtifact }, agents: Pick<CodexAgents, 'run'>): Promise<SvgArtifact> {
  const profile = partProfile(context);
  const reference = resolve(context.directory, context.references.baseSubject);
  const meta = await sharp(reference).metadata();
  const canvas = { width: meta.autoOrient.width, height: meta.autoOrient.height };
  const sourcePath = await realpath(context.reviewed.path), source = await readFile(sourcePath);
  const draft = resolve(context.outputPath);
  if (await observedPath(draft) === sourcePath) throw new Error('补全输出与输入 SVG 须使用不同路径，保留原形作为补全基准');
  const parent = context.parent?.steps.completion.output?.path;
  const boundsParent = parentBoundsSource(context.group, parent);
  const knowledge = partKnowledge(profile, 'completion');
  const root = taskRootOf(context.directory), task = (path: string) => toAgentPath(root, path);
  const dependencies = [await fileDependency(root, reference)];
  const observations: SvgObservation[] = [];
  let submitted: SvgArtifact | undefined, submittedHash: string | undefined;
  // A continued step keeps the additions drawn so far when they still sit on the
  // unchanged source; otherwise the draft starts as the source itself.
  const resumed = !!context.resumeDraft && await readFile(draft).then(bytes => {
    try { assertCompletionPreserves(source.toString(), bytes.toString()); return true; } catch { return false; }
  }, () => false);
  if (!resumed) await writeAtomic(draft, source);
  const preview = createSvgPreviewTool({ directory: context.directory, reference, canvas, parent: boundsParent,
    allowGeneratedReference: true,
    observationDirectory: join(context.directory, 'observations', 'completion', context.group.id),
    observed: entry => observations.push(entry) });
  async function verifySource() {
    if (!(await readFile(sourcePath)).equals(source)) throw new Error('补全过程修改了原轮廓');
  }
  const set: FunctionTool = {
    ...toolDefinition('set_completion_paths'),
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('补全已提交');
      if (!value || typeof value !== 'object' || Object.keys(value).some(key => key !== 'paths')) throw new Error('无效补全参数');
      await verifySource();
      const paths = completionPaths((value as { paths: unknown }).paths);
      await writeAtomic(draft, composeCompletion(source.toString(), paths));
      observations.length = 0; // 改过新增形状后，必须重新观察当前候选。
      await validateGroupSvg(draft, context.group.id, canvas, boundsParent, !context.group.hiddenInReference);
      return textResult({ path: await task(draft), additions: paths.length });
    },
  };
  const submit: FunctionTool = {
    ...toolDefinition('submit_completion'),
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('补全已提交');
      const raw = value as { note?: unknown };
      if (!raw || typeof raw.note !== 'string' || !raw.note.trim() || Object.keys(raw).some(key => key !== 'note')) throw new Error('须提交补全依据');
      await verifySource();
      const bytes = await validateGroupSvg(draft, context.group.id, canvas, boundsParent, !context.group.hiddenInReference);
      assertCompletionPreserves(source.toString(), bytes.toString());
      const observedDraft = await observedPath(draft);
      if (!observations.some(entry => entry.source === observedDraft && entry.mode === 'blend' && !entry.reference) ||
          !observations.some(entry => entry.source === observedDraft && entry.mode === 'svg')) throw new Error('须预览当前补全草稿与人物/衣服参考图的默认 blend 和 SVG 独显');
      const original = await realpath(reference);
      const referenceViews = observations.filter(entry => entry.source === observedDraft && entry.reference && entry.reference !== original);
      // How a generated image is compared is the prompt's rule: same-pose images
      // are edge-checked whole, turned views only by region. Every image that was
      // compared is recorded so a later change to it is caught.
      if (referenceViews.length) {
        const shapeReferences = new Map(referenceViews.map(entry => [entry.reference!, entry]));
        const checkedDependencies = [];
        for (const entry of shapeReferences.values()) {
          const dependency = await fileDependency(root, entry.reference!);
          if (dependency.hash !== entry.referenceHash) throw new Error('生成参考图在预览后被修改，请重新查看');
          checkedDependencies.push(dependency);
        }
        for (const dependency of checkedDependencies) if (!dependencies.some(item => item.path === dependency.path)) dependencies.push(dependency);
      }
      submitted = { path: draft, note: raw.note };
      submittedHash = svgHash(bytes);
      return textResult({ ...submitted, path: await task(draft) });
    },
  };
  const response = await agents.run({ step: partStep(partProfile(context).id, 'completion'), name: `正面遮挡补全-${context.group.id}`, cwd: context.directory, outputDirectory: join(context.directory, groupStepId(context.group.id, 'completion')), imageGeneration: true,
    tools: knowledge.tools('main', [preview, set, submit, createSvgReadTool(context.directory),
      createBitmapTool(context.directory, join(context.directory, 'observations', 'completion', context.group.id, 'bitmaps'))]), prompt: knowledge.render('main', {
      ...groupValues(context.group.id, canvas),
    }, { taskRoot: root, group: context.group.id }) });
  if (!submitted) throw agentOutcomeError('补全未通过 submit_completion 提交', response);
  await verifySource();
  if (svgHash(await readFile(draft)) !== submittedHash) throw agentOutcomeError('补全提交后草稿被修改', response);
  if (!await dependenciesMatch(root, dependencies)) throw agentOutcomeError('补全过程参考输入发生变化', response);
  return { ...submitted, dependencies };
}

export async function checkGroupCompletion(context: GroupContext & { before: SvgArtifact; after: SvgArtifact }): Promise<CompletionCheck> {
  const [before, after, meta] = await Promise.all([readFile(context.before.path), readFile(context.after.path),
    sharp(resolve(context.directory, context.references.baseSubject)).metadata()]);
  const count = assertCompletionPreserves(before.toString(), after.toString());
  await validateGroupSvg(context.after.path, context.group.id, { width: meta.autoOrient.width, height: meta.autoOrient.height },
    undefined, !context.group.hiddenInReference);
  return { passed: true, note: `程序核对：原 SVG 正文保留，${count} 条新增闭合路径位于原形下方；补形视觉自检在提交前完成。` };
}
