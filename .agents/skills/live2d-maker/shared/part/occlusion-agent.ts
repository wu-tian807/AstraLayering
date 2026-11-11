import { partSteps } from '../step-paths.js';
import { partStep } from '../agents/models.ts';
import { checkedTurn, missingSubmit } from '../codex/checked-turn.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { partProfile } from './profile.ts';
import { partKnowledge } from './group-prompts.ts';
import { readFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import type { CodexAgents } from '../codex/agents.ts';
import { artifactPath } from './artifact-facts.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { nodeSeed } from './groups.ts';
import type { OcclusionContext, StepResult } from './layering-types.ts';
import { mergePartSvgs } from './merge-svg.ts';
import { depthRegions, occlusionSourceHash, terminalParts, validateOcclusionPlan, type DepthCheck, type OcclusionPlan } from './occlusion-plan.ts';
import { createSvgPreviewTool, type SvgObservation } from './svg-tools.ts';
import { taskRootOf, toAgentPath } from '../task-paths.ts';

export async function planPartOcclusion(context: OcclusionContext, agents: Pick<CodexAgents, 'run'>): Promise<StepResult<OcclusionPlan>> {
  const profile = partProfile(context);
  const knowledge = partKnowledge(profile, 'occlusion');
  const sourceHash = await occlusionSourceHash(context);
  const reference = resolve(context.directory, context.references.baseSubject);
  const meta = await sharp(reference).metadata();
  const directory = join(context.directory, partSteps.occlusion, 'workspace');
  const previewPath = await realpath(context.preview.path);
  const candidatePath = join(await realpath(context.directory), partSteps.occlusion, 'workspace', 'candidate.svg');
  const parts = await Promise.all(terminalParts(context).map(async ({ group, parent }) => ({
    ...nodeSeed(group), parent: parent?.id,
    full: await realpath(artifactPath(context.directory, group.id, 'completion')),
    outline: await realpath(artifactPath(context.directory, group.id, 'reduction')),
  })));
  const root = taskRootOf(context.directory), task = (path: string) => toAgentPath(root, path);
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
    ...toolDefinition('propose_occlusion'),
    async execute(value, signal) {
      signal.throwIfAborted(); active(); await verify();
      if (!value || typeof value !== 'object' || !Array.isArray((value as { layers?: unknown }).layers)) throw new Error('需要 layers 数组');
      const rows = (value as { layers: OcclusionPlan['layers'] }).layers;
      const proposal = validateOcclusionPlan({ version: 3, direction: 'back-to-front', sourceHash,
        layers: rows.map(row => ({ ...row, check: { passed: true, note: '待逐件检查',
          ...(row.levels ? { regions: row.levels.map(region => ({ level: region.level, note: '待逐区域检查' })) } : {}) } })) }, context, sourceHash);
      if (!saw(previewPath, 'blend')) throw new Error('提案前须查看已有 preview.svg 与原图叠加');
      const leaves = terminalParts(context);
      await mergePartSvgs({ directory: context.directory, outputPath: candidatePath,
        // Text regions cannot be cut into SVG geometry here. Show each whole part once,
        // at its rearmost depth, and explicitly label this preview as approximate.
        groups: [...proposal.layers].sort((a, b) => Math.min(...depthRegions(a).map(r => r.level)) - Math.min(...depthRegions(b).map(r => r.level)))
          .map(row => leaves.find(entry => entry.group.id === row.id)!.group),
        parts: parts.map(part => ({ groupId: part.id, svg: { path: part.full } })) });
      candidate = proposal;
      checked.clear();
      // 输入 SVG 未变，可复用其观察；新候选须重新查看，所有层级结论须重新检查。
      observations.splice(0, observations.length, ...observations.filter(entry => entry.source !== candidatePath));
      return textResult({ candidate: await task(candidatePath), ids: proposal.layers.map(row => row.id), remainingChecks: parts.length,
        multiDepthParts: proposal.layers.filter(row => row.levels).map(row => row.id),
        previewNote: '整件 SVG 仅按各件最靠后的深度叠放；多深度部件未按文本切片，此预览不能证明其实际穿插效果。逐区域对照原图核对，实际拆层在 raster step01 完成。' });
    },
  };
  const check: FunctionTool = {
    ...toolDefinition('check_occlusion_part'),
    async execute(value, signal) {
      signal.throwIfAborted(); active(); await verify();
      const args = value as { id?: string; note?: string; regions?: DepthCheck['regions'] } | null;
      const part = parts.find(part => part.id === args?.id);
      if (!part || typeof args?.note !== 'string' || !args.note.trim()) throw new Error('需要本次终止 part ID 与具体检查依据');
      if (!candidate || !saw(candidatePath, 'blend') || !saw(part.full, 'blend')) {
        throw new Error('须先查看当前候选叠加与该完整部件的原图叠加');
      }
      const next = structuredClone(candidate);
      next.layers.find(row => row.id === part.id)!.check = { passed: true, note: args.note,
        ...(args.regions !== undefined ? { regions: args.regions } : {}) };
      candidate = validateOcclusionPlan(next, context, sourceHash);
      checked.add(part.id);
      return textResult({ checked: part.id, remaining: parts.filter(part => !checked.has(part.id)).map(part => part.id) });
    },
  };
  const submit: FunctionTool = {
    ...toolDefinition('submit_occlusion'),
    async execute(_value, signal) {
      signal.throwIfAborted(); active(); await verify();
      if (!candidate || checked.size !== parts.length) throw new Error(`尚有终止 part 未检查：${parts.filter(part => !checked.has(part.id)).map(part => part.id).join(', ')}`);
      result = { status: 'completed', output: validateOcclusionPlan(candidate, context, sourceHash) };
      return textResult({ completed: true, parts: checked.size });
    },
  };
  const problem: FunctionTool = {
    ...toolDefinition('report_occlusion_problem'),
    async execute(value, signal) {
      signal.throwIfAborted(); active(); await verify();
      const message = (value as { message?: unknown } | null)?.message;
      if (typeof message !== 'string' || !message.trim()) throw new Error('需要具体部件、位置和矛盾原因');
      result = { status: 'pending', message };
      return textResult({ completed: false, message });
    },
  };
  return checkedTurn({ agents, records: join(context.directory, partSteps.occlusion, 'checks'),
    task: { step: partStep(partProfile(context).id, 'occlusion'), name: '最终遮挡层级规划', cwd: context.directory,
      tools: knowledge.tools('main', [createSvgPreviewTool({ directory: context.directory, reference,
        canvas: { width: meta.autoOrient.width, height: meta.autoOrient.height }, observationDirectory: directory,
        observed: entry => observations.push(entry) }), propose, check, submit, problem]),
      // Paths are spelled in the prompt with {uri:}; the agent reads groups.json itself.
      prompt: knowledge.render('main', { width: String(meta.autoOrient.width), height: String(meta.autoOrient.height) }, { taskRoot: root }) },
    check: async () => {
      await verify();
      if (!result) throw missingSubmit('submit_occlusion', '层级规划未提交完整表或具体阻断', '无法完成时用 report_occlusion_problem 说明具体部件、位置和矛盾原因。');
      return result;
    } });
}
