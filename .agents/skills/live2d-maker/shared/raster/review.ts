import { stepKnowledge } from '../knowledge.ts';
import { CheckFailure, asCheck } from '../codex/checked-turn.ts';
import { readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { StepResult } from './agent.ts';
import { fileInfo } from './run-store.ts';
import type { StepDefinition } from './steps.ts';
import { publishReportAssets } from '../report-assets.ts';
import { nextReviewAction, runReviewSchedule, type ReviewProgress } from '../review-schedule.ts';
import { pendingRepairRound, runRepairContinuation } from '../step-continuation.ts';
import type { PromptRound } from '../prompt-rounds.ts';

const reports = ['review-01.md', 'repair-01.md', 'review-02.md', 'repair-02.md'] as const;
const maxRounds = reports.length / 2;
export type ReviewTask = { kind: 'review' | 'repair'; filename: typeof reports[number]; index: number };

async function verdict(directory: string, filename: string, kind: ReviewTask['kind'], draft = false): Promise<string | undefined> {
  const path = join(directory, filename), info = await fileInfo(path);
  if (!info) return;
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(`报告必须是普通文件：${path}`);
  const [first, ...body] = (await readFile(path, 'utf8')).trim().split(/\r?\n/);
  const value = first?.match(/^结论[：:]\s*(\S+)\s*$/)?.[1];
  const allowed = kind === 'review' ? ['通过', '需要修复', '无法完成检查'] : ['已修复'];
  if (!value || !allowed.includes(value) || !body.join('\n').trim()) {
    if (draft) throw new Error(`报告缺少有效结论或正文：${path}`);
    return;
  }
  return value;
}

// The program check of a report the agent has just written. A failure is repaired
// in that agent's own turn (runAgent), so a reviewer thread stays unsaved.
export async function checkReport(directory: string, filename: string, kind: ReviewTask['kind']): Promise<void> {
  if (!await fileInfo(join(directory, filename))) throw new CheckFailure('missing-file', `缺少完整报告：${filename}`, { detail: `报告 ${filename} 未写出` });
  await asCheck('invalid-output', () => verdict(directory, filename, kind, true));
}

// Only the consecutive prefix of finalized Markdown reports counts. A repair
// report records that the repair finished; the next review judges the result.
async function reviewProgress(directory: string): Promise<ReviewProgress> {
  let progress: ReviewProgress = { completedReviews: 0 };
  for (let round = 1; round <= maxRounds; round++) {
    const index = (round - 1) * 2;
    const review = await verdict(directory, reports[index], 'review');
    if (!review || review === '无法完成检查') return progress;
    if (review === '通过') return { completedReviews: round, verdict: 'pass' };
    const repaired = Boolean(await verdict(directory, reports[index + 1], 'repair'));
    progress = { completedReviews: round, verdict: 'revise', repaired };
    if (!repaired) return progress;
  }
  return progress;
}

function reportTask(kind: ReviewTask['kind'], round: number): ReviewTask {
  const index = (round - 1) * 2 + (kind === 'repair' ? 1 : 0);
  return { kind, filename: reports[index], index };
}

function blockedReview(round: number): never {
  throw new Error(`检查尚未完成：${reportTask('review', round).filename}`);
}

export async function nextReviewTask(directory: string): Promise<ReviewTask | undefined> {
  const action = nextReviewAction(await reviewProgress(directory), maxRounds);
  if (action.kind === 'done') return;
  if (action.kind === 'blocked') return blockedReview(action.round);
  return reportTask(action.kind, action.round);
}

function reviewKnowledge(step: StepDefinition) {
  if (!step.review) throw new Error('步骤未配置 reviewer');
  return stepKnowledge(step.knowledge.section, step.knowledge.step);
}

export async function buildReviewPrompt(step: StepDefinition, task: ReviewTask, round?: PromptRound): Promise<string> {
  // review-NN.md and repair-NN.md share their round; the prompts name the files.
  return reviewKnowledge(step).render(task.kind, { review_round: String(Math.floor(task.index / 2) + 1) }, { round });
}

const repairProgressPath = (directory: string, filename: string) => join(directory, filename.replace(/\.md$/, '.continuation.json'));

export async function previewReviewPrompt(step: StepDefinition, directory: string, task: ReviewTask): Promise<string> {
  const round = task.kind === 'repair'
    ? await pendingRepairRound(repairProgressPath(directory, task.filename), reviewKnowledge(step).rounds('repair'))
    : undefined;
  return buildReviewPrompt(step, task, round);
}

export async function discardReviewReports(directory: string, from = 0): Promise<void> {
  for (const name of reports.slice(from).reverse()) {
    await rm(join(directory, name), { force: true });
    await rm(join(directory, `${name}.tmp`), { force: true });
    if (name.startsWith('repair-')) await rm(repairProgressPath(directory, name), { force: true });
  }
}

type ReviewOptions = {
  step: StepDefinition;
  directory: string;
  signal?: AbortSignal;
  progress?: (message: string) => void;
  invoke: (prompt: string, task: ReviewTask, verify?: () => Promise<void>, continuation?: string) => Promise<StepResult>;
  validate: () => Promise<void>;
};

export async function runReviews(options: ReviewOptions): Promise<void> {
  async function runTask(task: ReviewTask) {
    // Deleting an earlier report invalidates later reports, retaining the artwork.
    await discardReviewReports(options.directory, task.index + 1);
    if (task.kind === 'review') {
      await runReport(task, await buildReviewPrompt(options.step, task));
      return;
    }
    await runRepairContinuation(repairProgressPath(options.directory, task.filename), reviewKnowledge(options.step).rounds('repair'),
      async (round, { first, last }) => {
        const prompt = await buildReviewPrompt(options.step, task, round);
        const continuation = first ? undefined : round.id;
        if (last) await runReport(task, prompt, continuation);
        else {
          const result = await options.invoke(prompt, task, undefined, continuation);
          if (result.status !== 'completed') throw new Error(`本次修复未完成：${result.summary}`);
        }
      }, options.signal);
  }
  async function runReport(task: ReviewTask, prompt: string, continuation?: string) {
    const draft = `${task.filename}.tmp`;
    await rm(join(options.directory, draft), { force: true });
    const result = await options.invoke(prompt, task, () => checkReport(options.directory, draft, task.kind), continuation);
    if (result.status !== 'completed') throw new Error(`本次${task.kind === 'review' ? '检查' : '修复'}未完成：${result.summary}`);
    const conclusion = await verdict(options.directory, draft, task.kind, true);
    if (!conclusion) throw new Error(`缺少完整报告：${draft}`);
    if (conclusion === '无法完成检查') throw new Error(`检查尚未完成：${result.summary}`);
    await options.validate();
    await publishReportAssets(join(options.directory, draft), join(options.directory, 'workspace'));
    options.signal?.throwIfAborted();
    await rename(join(options.directory, draft), join(options.directory, task.filename));
    options.progress?.(`${task.filename}：${conclusion}`);
  }
  const outcome = await runReviewSchedule({
    maxRounds,
    progress: () => reviewProgress(options.directory),
    review: round => runTask(reportTask('review', round)),
    repair: round => runTask(reportTask('repair', round)),
    signal: options.signal,
  });
  if (outcome.kind === 'blocked') blockedReview(outcome.round);
}
