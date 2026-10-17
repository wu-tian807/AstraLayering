import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from './agents.ts';
import { writeAtomic } from './groups.ts';
import { textResult, type FunctionTool } from './function-tools.ts';
import type { OutlineReduction, OutlineReductionContext } from './layering-types.ts';
import { createSvgPreviewTool, createSvgReadTool, validateGroupSvg, type SvgObservation } from './svg-tools.ts';

export async function reduceGroupOutlines(context: OutlineReductionContext, agents: Pick<CodexAgents, 'run'>): Promise<OutlineReduction> {
  const reference = resolve(context.directory, context.references.baseSubject);
  const metadata = await sharp(reference).metadata();
  const canvas = { width: metadata.autoOrient.width, height: metadata.autoOrient.height };
  const palette = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#9b5de5', '#fb8500', '#4361ee', '#f15bb5'];
  const merged = join(context.directory, 'observations', 'outline-reduce', String(context.depth), 'merged.draft.svg');
  const parts = await Promise.all(context.entries.map(async (entry, index) => {
    const text = (await readFile((entry.current ?? entry.outline).path)).toString();
    return text.replace(/^[\s\S]*?<svg\b[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      .replace(/\bfill=(['"])(?!none\1).*?\1/g, `fill="${palette[index % palette.length]}"`);
  }));
  await writeAtomic(merged, `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">${parts.map(part => `<g opacity="0.65">${part}</g>`).join('')}</svg>`);
  const observations: SvgObservation[] = [];
  const preview = createSvgPreviewTool({ directory: context.directory, reference, canvas,
    observationDirectory: join(context.directory, 'observations', 'outline-reduce', String(context.depth)),
    observed: entry => observations.push(entry) });
  let submitted: OutlineReduction | undefined;
  const write: FunctionTool = {
    name: 'write_reduction_svg',
    description: '将完整 SVG 写入指定本层组绑定的去重 .draft.svg 并验证。只接受 groupId 和 svg，不接受文件路径；写后须重新预览。源 SVG 不变。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['groupId', 'svg'], properties: {
      groupId: { type: 'string' }, svg: { type: 'string', minLength: 1 },
    } },
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('本层去重已提交');
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['groupId', 'svg'].includes(key))) {
        throw new Error('仅提交 groupId 与 svg，草稿路径由程序绑定');
      }
      const raw = value as { groupId?: unknown; svg?: unknown };
      const entry = context.entries.find(item => item.group.id === raw.groupId);
      if (!entry || typeof raw.svg !== 'string' || !raw.svg.trim() || !entry.outputPath.endsWith('.draft.svg')) {
        throw new Error('须指定本层组及非空 SVG');
      }
      for (let i = observations.length - 1; i >= 0; i--) {
        if (observations[i].source === resolve(entry.outputPath)) observations.splice(i, 1);
      }
      await writeAtomic(entry.outputPath, raw.svg);
      const bytes = await validateGroupSvg(entry.outputPath, entry.group.id, canvas, entry.parent?.steps.completion.output?.path, true);
      return textResult({ path: entry.outputPath, bytes: bytes.length, note: '草稿检查通过，仍须预览自检' });
    },
  };
  const submit: FunctionTool = {
    name: 'submit_reduction',
    description: '提交同层各组的重复对象处理结果。仅列出实际修改的组；其余组由程序原样复制。修改文件必须位于给定的 .draft.svg 路径，提交前须预览自检。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['changed', 'note'], properties: {
      changed: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['groupId', 'path'],
        properties: { groupId: { type: 'string' }, path: { type: 'string' } } } }, note: { type: 'string' },
    } },
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('本层去重已提交');
      const result = value as OutlineReduction;
      if (!result || !Array.isArray(result.changed) || typeof result.note !== 'string') throw new Error('无效去重结果');
      if (!observations.some(entry => entry.source === merged && entry.mode === 'blend')) throw new Error('先查看整层合成 blend');
      const seen = new Set<string>();
      for (const change of result.changed) {
        const entry = context.entries.find(entry => entry.group.id === change.groupId);
        if (!entry || seen.has(change.groupId) || typeof change.path !== 'string' || resolve(change.path) !== entry.outputPath) {
          throw new Error('去重只能提交本层组对应的 .draft.svg，不能重复提交组或修改原轮廓');
        }
        seen.add(change.groupId);
        const parent = entry.parent?.steps.completion.output?.path;
        await validateGroupSvg(change.path, change.groupId, canvas, parent, true);
        if (!observations.some(item => item.source === resolve(change.path) && ['blend', 'edge'].includes(item.mode))) {
          throw new Error(`${change.groupId}: 修改后须用 blend 或 edge 查看`);
        }
      }
      submitted = structuredClone(result);
      return textResult(submitted);
    },
  };
  await agents.run({ name: `同层轮廓去重-${context.depth}`, cwd: context.directory, sandboxMode: 'workspace-write',
    imageGeneration: false, tools: [preview, write, submit, createSvgReadTool(context.directory,
      [merged, ...context.entries.flatMap(entry => [entry.outline.path, entry.current?.path, entry.outputPath, entry.parent?.steps.completion.output?.path])])],
    prompt: `${await readFile(new URL('prompts/8-同层轮廓去重.md', import.meta.url), 'utf8')}\n【本次输入】\n${JSON.stringify({
      depth: context.depth, reference, canvas, mergedPreview: merged,
      groups: context.entries.map(entry => ({ id: entry.group.id, kind: entry.group.kind ?? 'group', note: entry.group.note,
        sourceSvg: (entry.current ?? entry.outline).path, originalOutline: entry.outline.path,
        reusedReduction: !!entry.current, outputDraft: entry.outputPath, parentSvg: entry.parent?.steps.completion.output?.path ?? null })),
    }, null, 2)}\n`,
  });
  if (!submitted) throw new Error('同层去重未通过 submit_reduction 提交');
  return submitted;
}
