import { readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from './agents.ts';
import { artifactPath } from './artifact-facts.ts';
import { textResult, type FunctionTool } from './function-tools.ts';
import { walkGroups } from './groups.ts';
import type { OcclusionContext, StepResult } from './layering-types.ts';
import { mergePartSvgs } from './merge-svg.ts';
import { occlusionPromptPath, occlusionSourceHash, terminalParts, validateOcclusionPlan, type OcclusionPlan } from './occlusion-plan.ts';
import { createSvgPreviewTool, type SvgObservation } from './svg-tools.ts';

export async function planPartOcclusion(context: OcclusionContext, agents: Pick<CodexAgents, 'run'>): Promise<StepResult<OcclusionPlan>> {
  const sourceHash = await occlusionSourceHash(context);
  const prompt = await readFile(occlusionPromptPath, 'utf8');
  if (!prompt.trim()) throw new Error('遮挡层级规划提示词为空');
  const reference = resolve(context.directory, context.references.baseSubject);
  const meta = await sharp(reference).metadata();
  const directory = join(context.directory, 'observations', 'occlusion');
  const previewPath = await realpath(context.preview.path);
  const candidatePath = join(await realpath(context.directory), 'stages', 'occlusion', 'candidate.svg');
  const parts = await Promise.all(terminalParts(context).map(async ({ group, parent }) => ({
    id: group.id, name: group.name, note: group.note, parent: parent?.id,
    full: await realpath(artifactPath(context.directory, group.id, 'completion')),
    outline: await realpath(artifactPath(context.directory, group.id, 'reduction')),
  })));
  const observations: SvgObservation[] = [];
  let candidate: OcclusionPlan | undefined;
  let result: StepResult<OcclusionPlan> | undefined;
  const checked = new Set<string>();
  async function verify() {
    if (await occlusionSourceHash(context) !== sourceHash) throw new Error('层级规划期间输入发生变化，请重新规划');
  }
  function active() { if (result) throw new Error('层级规划已结束'); }
  function saw(path: string, mode: SvgObservation['mode']) { return observations.some(entry => entry.source === path && entry.mode === mode); }
  const propose: FunctionTool = {
    name: 'propose_occlusion', description: '提交从后到前的全部终止 part，生成候选层级预览；修订提案会清除已有逐件检查。level 由程序按数组顺序从 0 分配。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['layers'], properties: {
      layers: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'note'], properties: {
        id: { type: 'string' }, note: { type: 'string', minLength: 1 },
      } } },
    } },
    async execute(value, signal) {
      signal.throwIfAborted(); active(); await verify();
      if (!value || typeof value !== 'object' || !Array.isArray((value as { layers?: unknown }).layers)) throw new Error('需要 layers 数组');
      const rows = (value as { layers: OcclusionPlan['layers'] }).layers;
      const proposal = validateOcclusionPlan({ version: 2, direction: 'back-to-front', sourceHash,
        layers: rows.map((row, level) => ({ ...row, level, check: { passed: true, note: '待逐件检查' } })) }, context, sourceHash);
      if (!saw(previewPath, 'blend')) throw new Error('提案前须查看已有 preview.svg 与原图叠加');
      const leaves = terminalParts(context);
      await mergePartSvgs({ directory: context.directory, outputPath: candidatePath,
        groups: proposal.layers.map(row => leaves.find(entry => entry.group.id === row.id)!.group),
        parts: parts.map(part => ({ groupId: part.id, svg: { path: part.full } })) });
      candidate = proposal;
      checked.clear();
      // 输入 SVG 未变，可复用其观察；新候选须重新查看，所有层级结论须重新检查。
      observations.splice(0, observations.length, ...observations.filter(entry => entry.source !== candidatePath));
      return textResult({ candidate: candidatePath, ids: proposal.layers.map(row => row.id), remainingChecks: parts.length });
    },
  };
  const check: FunctionTool = {
    name: 'check_occlusion_part', description: '看过当前候选叠放预览与该件完整 SVG 的原图叠加后，记录该件整体固定深度的核对依据。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['id', 'note'], properties: { id: { type: 'string' }, note: { type: 'string', minLength: 1 } } },
    async execute(value, signal) {
      signal.throwIfAborted(); active(); await verify();
      const args = value as { id?: string; note?: string } | null;
      const part = parts.find(part => part.id === args?.id);
      if (!part || typeof args?.note !== 'string' || !args.note.trim()) throw new Error('需要本次终止 part ID 与具体检查依据');
      if (!candidate || !saw(candidatePath, 'blend') || !saw(part.full, 'blend')) {
        throw new Error('须先查看当前候选叠加与该完整部件的原图叠加');
      }
      candidate.layers.find(row => row.id === part.id)!.check = { passed: true, note: args.note };
      checked.add(part.id);
      return textResult({ checked: part.id, remaining: parts.filter(part => !checked.has(part.id)).map(part => part.id) });
    },
  };
  const submit: FunctionTool = {
    name: 'submit_occlusion', description: '全部终止 part 已逐件检查后提交完整层级表，由调度器独立保存 occlusion.json。',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
    async execute(_value, signal) {
      signal.throwIfAborted(); active(); await verify();
      if (!candidate || checked.size !== parts.length) throw new Error(`尚有终止 part 未检查：${parts.filter(part => !checked.has(part.id)).map(part => part.id).join(', ')}`);
      result = { status: 'completed', output: validateOcclusionPlan(candidate, context, sourceHash) };
      return textResult({ completed: true, parts: checked.size });
    },
  };
  const problem: FunctionTool = {
    name: 'report_occlusion_problem', description: '无法确认整件固定深度时，说明具体部件与依据，保留待办，不修改树或 SVG。',
    inputSchema: { type: 'object', additionalProperties: false, required: ['message'], properties: { message: { type: 'string', minLength: 1 } } },
    async execute(value, signal) {
      signal.throwIfAborted(); active(); await verify();
      const message = (value as { message?: unknown } | null)?.message;
      if (typeof message !== 'string' || !message.trim()) throw new Error('需要具体部件、位置和矛盾原因');
      result = { status: 'pending', message };
      return textResult({ completed: false, message });
    },
  };
  await agents.run({ name: '最终遮挡层级规划', cwd: context.directory, sandboxMode: 'read-only', imageGeneration: false,
    images: [{ path: reference, description: '本次纯衣服参考，用于确定每个完整衣片的固定前后深度。' }],
    tools: [createSvgPreviewTool({ directory: context.directory, reference,
      canvas: { width: meta.autoOrient.width, height: meta.autoOrient.height }, observationDirectory: directory,
      observed: entry => observations.push(entry) }), propose, check, submit, problem],
    prompt: `${prompt}\n提示词来源：${occlusionPromptPath}\n\n【本次输入】\n${JSON.stringify({
      preview: previewPath, reference, canvas: { width: meta.autoOrient.width, height: meta.autoOrient.height }, parts, groups: walkGroups(context.groups).filter(({ group }) => group.groups.length)
        .map(({ group, parent }) => ({ id: group.id, parent: parent?.id, name: group.name, note: group.note })),
    }, null, 2)}\n`,
  });
  await verify();
  if (!result) throw new Error('层级规划未提交完整表或具体阻断');
  return result;
}
