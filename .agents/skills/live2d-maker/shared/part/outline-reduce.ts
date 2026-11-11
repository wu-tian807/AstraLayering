import { layerStepId } from './part-steps.ts';
import { layerItem } from '../step-paths.js';
import { partKnowledge } from './group-prompts.ts';
import { partStep } from '../agents/models.ts';
import { checkedTurn, missingSubmit } from '../codex/checked-turn.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { partProfile } from './profile.ts';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from '../codex/agents.ts';
import { writeAtomic } from './groups.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import type { OutlineReduction, OutlineReductionContext } from './layering-types.ts';
import { createSvgPreviewTool, createSvgReadTool, observedPath, parentBoundsSource, validateGroupSvg, type SvgObservation } from './svg-tools.ts';
import { fromTaskPath, taskRootOf, toAgentPath } from '../task-paths.ts';
import { editXmlAttributes, svgBody, svgSource } from '../xml.ts';

export async function reduceGroupOutlines(context: OutlineReductionContext, agents: Pick<CodexAgents, 'run'>): Promise<OutlineReduction> {
  const reference = resolve(context.directory, context.references.baseSubject);
  const metadata = await sharp(reference).metadata();
  const canvas = { width: metadata.autoOrient.width, height: metadata.autoOrient.height };
  const palette = ['#ef476f', '#118ab2', '#ffd166', '#06d6a0', '#9b5de5', '#fb8500', '#4361ee', '#f15bb5'];
  const merged = join(context.directory, layerStepId(context.depth), 'workspace', 'merged.draft.svg');
  const parts = await Promise.all(context.entries.map(async (entry, index) => {
    let text = (await readFile(entry.outline.path)).toString();
    for (const node of svgSource(text).elements.reverse()) {
      const fill = node.element.getAttribute('fill');
      if (fill !== null && fill !== 'none') text = editXmlAttributes(text, node, { fill: palette[index % palette.length] });
    }
    return svgBody(text);
  }));
  await writeAtomic(merged, `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">${parts.map(part => `<g opacity="0.65">${part}</g>`).join('')}</svg>`);
  const root = taskRootOf(context.directory), task = (path: string) => toAgentPath(root, path);
  const observations: SvgObservation[] = [];
  const preview = createSvgPreviewTool({ directory: context.directory, reference, canvas,
    observationDirectory: join(context.directory, layerStepId(context.depth), 'workspace'),
    observed: entry => observations.push(entry) });
  // Bound to this depth: the agent gets its groups by parent, without arguments.
  const list: FunctionTool = {
    ...toolDefinition('list_reduction_groups'),
    async execute(_value, signal) {
      signal.throwIfAborted();
      const families = new Map<string | null, unknown[]>();
      for (const entry of context.entries) {
        const parent = entry.parent?.id ?? null, parentSvg = entry.parent?.steps.completion.output?.path;
        if (!families.has(parent)) families.set(parent, []);
        families.get(parent)!.push({ id: entry.group.id, kind: entry.group.kind ?? 'group', note: entry.group.note,
          ...(entry.group.allowOutsideParent ? { allowOutsideParent: true } : {}),
          sourceSvg: await task(entry.outline.path), outputDraft: await task(entry.outputPath),
          parentSvg: parentSvg ? await task(parentSvg) : null });
      }
      return textResult({ parents: [...families].map(([parent, groups]) => ({ parent, groups })) });
    },
  };
  let submitted: OutlineReduction | undefined;
  const write: FunctionTool = {
    ...toolDefinition('write_reduction_svg'),
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('本层去重已提交');
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['groupId', 'svg'].includes(key))) {
        throw new Error('仅提交 groupId 与 svg，草稿路径由程序绑定');
      }
      const raw = value as { groupId?: unknown; svg?: unknown };
      const entry = context.entries.find(item => item.group.id === raw.groupId);
      if (!entry || typeof raw.svg !== 'string' || !raw.svg.trim()) {
        throw new Error('须指定本层组及非空 SVG');
      }
      const observedOutput = await observedPath(entry.outputPath);
      for (let i = observations.length - 1; i >= 0; i--) {
        if (observations[i].source === observedOutput) observations.splice(i, 1);
      }
      await writeAtomic(entry.outputPath, raw.svg);
      const bytes = await validateGroupSvg(entry.outputPath, entry.group.id, canvas, parentBoundsSource(entry.group, entry.parent?.steps.completion.output?.path), true);
      return textResult({ path: await task(entry.outputPath), bytes: bytes.length, note: '草稿检查通过，仍须预览自检' });
    },
  };
  const submit: FunctionTool = {
    ...toolDefinition('submit_reduction'),
    async execute(value, signal) {
      signal.throwIfAborted();
      if (submitted) throw new Error('本层去重已提交');
      const result = value as OutlineReduction;
      if (!result || !Array.isArray(result.changed) || typeof result.note !== 'string') throw new Error('无效去重结果');
      const observedMerged = await observedPath(merged);
      if (!observations.some(entry => entry.source === observedMerged && entry.mode === 'blend')) throw new Error('先查看整层合成 blend');
      const seen = new Set<string>(), changed = [];
      for (const change of result.changed) {
        const entry = context.entries.find(entry => entry.group.id === change.groupId);
        if (!entry || seen.has(change.groupId) || typeof change.path !== 'string') {
          throw new Error('去重须提交本层组及对应 SVG，同一组提交一次');
        }
        seen.add(change.groupId);
        const parent = parentBoundsSource(entry.group, entry.parent?.steps.completion.output?.path);
        const path = fromTaskPath(root, change.path);
        await validateGroupSvg(path, change.groupId, canvas, parent, true);
        const observed = await observedPath(path);
        if (!observations.some(item => item.source === observed && ['blend', 'edge'].includes(item.mode))) {
          throw new Error(`${change.groupId}: 修改后须用 blend 或 edge 查看`);
        }
        changed.push({ ...change, path });
      }
      // Kept absolute for layering; the agent sees task paths.
      submitted = structuredClone({ ...result, changed });
      return textResult({ ...submitted, changed: await Promise.all(changed.map(async change => ({ ...change, path: await task(change.path) }))) });
    },
  };
  const knowledge = partKnowledge(partProfile(context), 'reduction');
  return checkedTurn({ agents, records: join(context.directory, layerStepId(context.depth), 'checks'),
    task: { step: partStep(partProfile(context).id, 'reduce'), name: `同层轮廓去重-${context.depth}`, cwd: context.directory, outputDirectory: join(context.directory, layerStepId(context.depth)),
      tools: knowledge.tools('main', [list, preview, write, submit, createSvgReadTool(context.directory)]),
      // Fixed paths are spelled in the prompt; the groups come from list_reduction_groups.
      prompt: knowledge.render('main', { layer_depth: layerItem(context.depth).slice('depth'.length),
        width: String(canvas.width), height: String(canvas.height) }, { taskRoot: root }) },
    check: () => {
      if (!submitted) throw missingSubmit('submit_reduction', '同层去重未通过 submit_reduction 提交');
      return submitted;
    } });
}
