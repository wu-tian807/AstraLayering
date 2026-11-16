import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { AgentDispatcher } from '../agents/dispatcher.ts';
import { partStep } from '../agents/models.ts';
import { withAgentSlotReleased } from '../agents/runtime.ts';
import { checkedTurn, missingSubmit } from '../codex/checked-turn.ts';
import { textResult, type FunctionTool } from '../codex/function-tools.ts';
import { toolDefinition } from '../codex/tool-config.ts';
import { fromTaskPath, taskRootOf } from '../task-paths.ts';
import { createBitmapTool } from './bitmap-tool.ts';
import { partKnowledge } from './group-prompts.ts';
import { nodeSeed, writeAtomic } from './groups.ts';
import type { GroupContext } from './layering-types.ts';
import { groupStepId } from './part-steps.ts';
import { partProfile } from './profile.ts';
import { createSvgPreviewTool, createSvgReadTool, observedPath, type SvgObservation } from './svg-tools.ts';

export type BoundaryDecision = { allow: boolean; note: string };
export type BoundaryReview = {
  context: GroupContext;
  candidate: Buffer; source: Buffer; parent: Buffer; reference: Buffer;
  canvas: { width: number; height: number };
  bounds: { outsidePixels: number; outsideBox: number[] | null };
  reason: string;
};
const hash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
function decision(value: unknown): BoundaryDecision | undefined {
  if (!value || typeof value !== 'object') return;
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some(key => key !== 'allow' && key !== 'note') || typeof raw.allow !== 'boolean' || typeof raw.note !== 'string' || !raw.note.trim()) return;
  return { allow: raw.allow, note: raw.note };
}

// A review is tied to immutable snapshots. Neither approval nor rejection grants
// a node-wide permission; identical inputs reuse the recorded one-shot decision.
export async function reviewCompletionBoundary(input: BoundaryReview, agents: Pick<AgentDispatcher, 'run'>, signal?: AbortSignal): Promise<BoundaryDecision> {
  const { context, canvas } = input, profile = partProfile(context);
  const knowledge = partKnowledge(profile, 'completion_boundary_review');
  const snapshots = { candidate: input.candidate, source: input.source, parent: input.parent, reference: input.reference };
  const hashes = Object.fromEntries(Object.entries(snapshots).map(([key, bytes]) => [key, hash(bytes)]));
  const key = hash(JSON.stringify({ version: 1, group: nodeSeed(context.group), parent: context.parent && nodeSeed(context.parent), hashes,
    prompts: await Promise.all(knowledge.files('main').map(async path => hash(await readFile(path)))) }));
  const directory = join(context.directory, groupStepId(context.group.id, 'completion'), 'boundary-reviews', key);
  const record = join(directory, 'decision.json');
  try {
    const cached = JSON.parse(await readFile(record, 'utf8'));
    const value = cached.key === key && cached.version === 1 ? decision(cached.decision) : undefined;
    if (value) return value;
  } catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  signal?.throwIfAborted();
  const paths = { candidate: join(directory, 'candidate.svg'), source: join(directory, 'source.svg'), parent: join(directory, 'parent.svg'), reference: join(directory, 'reference.png') };
  for (const name of Object.keys(snapshots) as (keyof typeof snapshots)[]) await writeAtomic(paths[name], snapshots[name]);
  const [candidateAlpha, parentAlpha] = await Promise.all([input.candidate, input.parent].map(bytes =>
    sharp(bytes).ensureAlpha().extractChannel('alpha').raw().toBuffer()));
  const overlay = Buffer.alloc(canvas.width * canvas.height * 4);
  for (let i = 0; i < candidateAlpha.length; i++) {
    overlay[i * 4] = 240; overlay[i * 4 + 1] = 45; overlay[i * 4 + 2] = 35;
    overlay[i * 4 + 3] = Math.round(Math.max(0, candidateAlpha[i] - parentAlpha[i]) * 0.8);
  }
  const outsideReference = join(directory, 'outside-reference.png');
  const marked = await sharp(input.reference).autoOrient().composite([{ input: overlay,
    raw: { ...canvas, channels: 4 } }]).png().toBuffer();
  await writeAtomic(outsideReference, marked);
  const observations: SvgObservation[] = [];
  const candidatePath = await observedPath(paths.candidate), parentPath = await observedPath(paths.parent);
  let outsideSeen = false, submitted: BoundaryDecision | undefined;
  const bitmap = createBitmapTool(context.directory, join(directory, 'observations'));
  const outside = await realpath(outsideReference);
  const view: FunctionTool = { ...bitmap, async execute(value, signal, toolContext) {
    const result = await bitmap.execute(value, signal, toolContext);
    if (value && typeof value === 'object' && typeof (value as { path?: unknown }).path === 'string') {
      const path = await realpath(fromTaskPath(taskRootOf(context.directory), (value as { path: string }).path));
      if (path === outside) outsideSeen = true;
    }
    return result;
  } };
  async function verify() {
    if (!(await readFile(outsideReference)).equals(marked)) throw new Error('评审快照发生变化，请重新评审');
    for (const name of Object.keys(paths) as (keyof typeof paths)[]) {
      if (hash(await readFile(paths[name])) !== hashes[name]) throw new Error('评审快照发生变化，请重新评审');
    }
  }
  const submit: FunctionTool = { ...toolDefinition('submit_completion_boundary_review'), async execute(value, signal) {
    signal.throwIfAborted();
    if (submitted) throw new Error('越界评审已提交');
    const parsed = decision(value);
    if (!parsed) throw new Error('须提交 allow 与非空 note');
    if (!outsideSeen || !observations.some(o => o.source === candidatePath && o.mode === 'svg') ||
        !observations.some(o => o.source === candidatePath && o.mode === 'blend') ||
        !observations.some(o => o.source === parentPath)) throw new Error('须查看候选独显、默认 blend、父稿和越界标示图');
    await verify(); submitted = parsed;
    return textResult(parsed);
  } };
  const reviewInput = { group: nodeSeed(context.group), parentGroup: context.parent && nodeSeed(context.parent),
    ...paths, outsideReference, canvas, bounds: input.bounds, requestReason: input.reason };
  await writeAtomic(join(directory, 'input.json'), JSON.stringify(reviewInput, null, 2) + '\n');
  const result = await withAgentSlotReleased(signal => checkedTurn({ agents, signal, records: join(directory, 'checks'),
    task: { step: partStep(profile.id, 'completion_boundary_review'), name: `补全越界评审-${context.group.id}`,
      // Keep CLI cwd independent of group depth: CreateProcess rejects long
      // working directories on Windows even when Node can read the snapshots.
      cwd: context.directory, outputDirectory: join(context.directory, 'step11_completion', 'boundary-review', key), shell: false,
      tools: knowledge.tools('main', [createSvgPreviewTool({ directory: context.directory, reference: paths.reference, parent: paths.parent, canvas,
        observationDirectory: join(directory, 'observations'), observed: entry => observations.push(entry) }),
        createSvgReadTool(context.directory), view, submit]),
      prompt: knowledge.render('main', { review_input: JSON.stringify(reviewInput, null, 2) }, { taskRoot: taskRootOf(context.directory) }) },
    check: async () => { await verify(); if (!submitted) throw missingSubmit('submit_completion_boundary_review', '未提交越界评审结论'); return submitted; } }), signal);
  signal?.throwIfAborted();
  await writeAtomic(record, JSON.stringify({ version: 1, key, hashes, decision: result }, null, 2) + '\n');
  return result;
}
