import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import type { CodexAgents } from './agents.ts';
import { svgHash } from './artifact-facts.ts';
import { assertCompletionPreserves, composeCompletion, completionPaths } from './completion-svg.ts';
import { textResult, type FunctionTool } from './function-tools.ts';
import { readGroupPrompt, readGroupReferences } from './group-prompts.ts';
import { writeAtomic } from './groups.ts';
import { dependenciesMatch, fileDependency } from './completion-inputs.ts';
import type { DrawingContext, GroupContext, SvgArtifact, CompletionCheck } from './layering-types.ts';
import { createSvgPreviewTool, createSvgReadTool, validateGroupSvg, type SvgObservation } from './svg-tools.ts';

const rulesPath = fileURLToPath(new URL('prompts/9-补全操作约定.md', import.meta.url));

// 同级参考只取本层已审查、去重的只读底形，避免依赖并发补全的完成顺序。
export async function readCompletionReferences(groupDirectory: string, context?: GroupContext) {
  return readGroupReferences(groupDirectory, 'completion', context ? async (name, description) => {
    const sibling = context.parent?.groups.find(group => group.id === `${context.parent!.id}/${name}`);
    if (!sibling || sibling.id === context.group.id) throw new Error(`补全参考不是当前节点的其他直属同级：${name}`);
    const reduced = sibling.steps.reduction;
    if (reduced.status !== 'completed' || !reduced.output) throw new Error(`补全同级参考尚未完成整层去重：${sibling.id}`);
    const root = await realpath(context.directory), sourceSvg = await realpath(reduced.output.path);
    const rel = relative(root, sourceSvg);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error('补全同级参考必须位于本次运行目录内');
    const bytes = await readFile(sourceSvg);
    const path = join(root, 'observations', 'completion', context.group.id, 'references', `${name}.png`);
    await writeAtomic(path, await sharp(bytes, { limitInputPixels: 100_000_000 }).png().toBuffer());
    return { path, description, groupId: sibling.id, sourceSvg, sourceHash: svgHash(bytes), sourceStage: 'reduction' };
  } : undefined);
}

export async function completeGroupOcclusion(context: DrawingContext & { reviewed: SvgArtifact }, agents: Pick<CodexAgents, 'run'>): Promise<SvgArtifact> {
  const reference = resolve(context.directory, context.references.baseSubject);
  const meta = await sharp(reference).metadata();
  const canvas = { width: meta.autoOrient.width, height: meta.autoOrient.height };
  const sourcePath = await realpath(context.reviewed.path), source = await readFile(sourcePath);
  const draft = resolve(context.outputPath);
  const root = await realpath(context.directory), rel = relative(root, draft);
  if (!draft.endsWith('.draft.svg') || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel) || draft === sourcePath) {
    throw new Error('补全只写本次运行内指定的 .draft.svg');
  }
  const parent = context.parent?.steps.completion.output?.path;
  const prompt = await readGroupPrompt(context.group.id, 'completion');
  const rules = await readFile(rulesPath, 'utf8');
  if (!rules.trim()) throw new Error(`补全操作约定提示词为空：${rulesPath}`);
  const references = await readCompletionReferences(prompt.groupDirectory, context);
  const dependencies = await Promise.all([fileDependency(context.directory, reference),
    ...references.map(ref => 'sourceSvg' in ref ? fileDependency(context.directory, ref.sourceSvg,
      { groupId: ref.groupId, stage: 'reduction' }) : fileDependency(context.directory, ref.path))]);
  const observations: SvgObservation[] = [];
  let submitted: SvgArtifact | undefined, submittedHash: string | undefined;
  await writeAtomic(draft, source);
  const preview = createSvgPreviewTool({ directory: context.directory, reference, canvas, parent,
    observationDirectory: join(context.directory, 'observations', 'completion', context.group.id),
    observed: entry => observations.push(entry) });
  async function verifySource() {
    if (!(await readFile(sourcePath)).equals(source)) throw new Error('补全过程修改了原轮廓');
  }
  const set: FunctionTool = {
    name: 'set_completion_paths', description: '设置完整的新增路径列表，可重复调用修正新增部分。程序始终从只读原 SVG 合成草稿，把新增闭合色块放在原形下面；不会改已有形状。无须补全时用空数组。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['paths'], properties: {
      paths: { type: 'array', maxItems: 256, items: { type: 'object', additionalProperties: false, required: ['d'], properties: {
        d: { type: 'string' }, fillRule: { type: 'string', enum: ['nonzero', 'evenodd'] },
      } } },
    } },
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('补全已提交');
      if (!value || typeof value !== 'object' || Object.keys(value).some(key => key !== 'paths')) throw new Error('无效补全参数');
      await verifySource();
      const paths = completionPaths((value as { paths: unknown }).paths);
      await writeAtomic(draft, composeCompletion(source.toString(), paths));
      observations.length = 0; // 改过新增形状后，必须重新观察当前候选。
      await validateGroupSvg(draft, context.group.id, canvas, parent, true);
      return textResult({ path: draft, additions: paths.length });
    },
  };
  const submit: FunctionTool = {
    name: 'submit_completion', description: '预览当前草稿后提交正面遮挡补全。说明每处被谁遮住、延续依据，或为何不需补全；程序验证原 SVG 保留和父范围。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['note'], properties: { note: { type: 'string', minLength: 1 } } },
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('补全已提交');
      const raw = value as { note?: unknown };
      if (!raw || typeof raw.note !== 'string' || !raw.note.trim() || Object.keys(raw).some(key => key !== 'note')) throw new Error('须提交补全依据');
      await verifySource();
      const bytes = await validateGroupSvg(draft, context.group.id, canvas, parent, true);
      assertCompletionPreserves(source.toString(), bytes.toString());
      if (!observations.some(entry => entry.source === draft && entry.mode === 'blend') ||
          !observations.some(entry => entry.source === draft && entry.mode === 'svg')) throw new Error('须预览当前补全草稿的 blend 和独显');
      submitted = { path: draft, note: raw.note };
      submittedHash = svgHash(bytes);
      return textResult(submitted);
    },
  };
  await agents.run({ name: `正面遮挡补全-${context.group.id}`, cwd: context.directory, sandboxMode: 'read-only', imageGeneration: false,
    images: [{ path: reference, description: '纯衣服参考；只补当前衣片被遮住的轮廓，不填入人体或相邻衣片。' }, ...references.map(({ path, description }) => ({ path, description }))],
    tools: [preview, set, submit, createSvgReadTool(context.directory,
      [sourcePath, parent, draft, ...references.map(ref => 'sourceSvg' in ref ? ref.sourceSvg : undefined)])], prompt: `${prompt.text}\n提示词来源：${prompt.path}\n\n【本次输入】\n${JSON.stringify({
      group: { id: context.group.id, kind: context.group.kind ?? 'group', name: context.group.name, note: context.group.note, metadata: context.group.metadata },
      reference, additionalReferences: references, canvas, sourceSvg: sourcePath, outputDraft: draft, parentSvg: parent ?? null,
    }, null, 2)}\n\n【固定范围与操作约定】\n${rules}\n固定约定提示词来源：${rulesPath}\n` });
  if (!submitted) throw new Error('补全未通过 submit_completion 提交');
  await verifySource();
  if (svgHash(await readFile(draft)) !== submittedHash) throw new Error('补全提交后草稿被修改');
  if (!await dependenciesMatch(context.directory, dependencies)) throw new Error('补全过程参考输入发生变化');
  return { ...submitted, dependencies };
}

export async function checkGroupCompletion(context: GroupContext & { before: SvgArtifact; after: SvgArtifact }): Promise<CompletionCheck> {
  const [before, after, meta] = await Promise.all([readFile(context.before.path), readFile(context.after.path),
    sharp(resolve(context.directory, context.references.baseSubject)).metadata()]);
  const count = assertCompletionPreserves(before.toString(), after.toString());
  await validateGroupSvg(context.after.path, context.group.id, { width: meta.autoOrient.width, height: meta.autoOrient.height },
    context.parent?.steps.completion.output?.path, true);
  return { passed: true, note: `程序核对：原 SVG 正文保留，${count} 条新增闭合路径位于原形下方；补形视觉自检在提交前完成。` };
}
