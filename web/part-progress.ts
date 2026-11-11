import { readFile } from 'node:fs/promises';
import { artifactPath, matchesHash, reportPath, reviewedArtifact, stepDraftPath } from '../.agents/skills/live2d-maker/shared/part/artifact-facts.ts';
import { groupStepId, layerStepId } from '../.agents/skills/live2d-maker/shared/part/part-steps.ts';
import { readStep, type StepStatus } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { safePath, webFilePath } from './files.ts';
import { currentAgentCalls, throttled, type AgentCall } from './agent-progress.ts';
import { partStages } from './part-stages.ts';
import { partReviewRounds, partReviewSkip } from './part-review.ts';
import { executionStatus } from './execution-state.js';
import { statusLabel } from './progress.js';

export const phases = ['outline', 'review', 'reduction', 'completion', 'completionCheck', 'children'] as const;
type Phase = typeof phases[number];

// Step markers are dotfiles, which the file inventory skips; read them directly.
export async function stepStatus(directory: string, section: string, id: string): Promise<StepStatus> {
  try { return (await readStep(await safePath(directory, `${section}/${id}`))).status; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent'; throw error; }
}

// Markers own execution status. Saved artwork and review findings only supply
// previews and details, including when an export omitted intermediate files.
export async function partProgress(directory: string, section: string, groups: any[], files: Set<string>,
  json: (path: string) => Promise<any>, errors: string[], activeSince?: string, failedSince?: string, failed = !!failedSince) {
  const bytes = new Map<string, Promise<Buffer | undefined>>();
  const read = (path: string) => {
    if (!bytes.has(path)) bytes.set(path, (async () => {
      if (!files.has(path)) return;
      try { return await readFile(await safePath(directory, path)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') errors.push(path + ': ' + String(error)); }
    })());
    return bytes.get(path)!;
  };
  const entries: { node: any; depth: number }[] = [];
  const visit = (nodes: any[], depth: number) => nodes.forEach(node => { entries.push({ node, depth }); visit(node.groups ?? [], depth + 1); });
  visit(groups, 0);
  const reviewInputs = new Map<any, { report: any; outline: Buffer | undefined }>();
  const steps = new Map<string, Promise<StepStatus>>();
  const step = (id: string) => {
    if (!steps.has(id)) steps.set(id, stepStatus(directory, section, id).catch(error => { errors.push(`${section}/${id}: ${String(error)}`); return 'absent' as const; }));
    return steps.get(id)!;
  };
  const inspectNode = async ({ node, depth }: typeof entries[number]) => {
    const path = (stage: 'outline' | 'reduction' | 'completion') => webFilePath(artifactPath(section, node.id, stage));
    const draft = (stage: 'outline' | 'reduction' | 'completion') => files.has(webFilePath(stepDraftPath(section, node.id, stage))) || files.has(path(stage).replace(/\.svg$/, '.draft.svg'));
    node.webPhases = Object.fromEntries(phases.map(phase => [phase, 'pending']));
    node.webMessages = {};
    node.webDetails = {};
    node.webHasProducts = {};
    const mark = (phase: Phase, marker: StepStatus, present: boolean, message: string) => {
      node.webPhases[phase] = executionStatus(marker, { active: !!activeSince, failed });
      node.webMessages[phase] = statusLabel(node.webPhases[phase]);
      node.webHasProducts[phase] = marker === 'running' && present;
      if (marker === 'completed' || present) node.webDetails[phase] = message;
    };
    const outline = await read(path('outline'));
    const reduced = await read(path('reduction'));
    const completed = await read(path('completion'));
    const [prepared, layer, finished, split] = await Promise.all([step(groupStepId(node.id, 'outline')), step(layerStepId(depth)),
      step(groupStepId(node.id, 'completion')), step(groupStepId(node.id, 'children'))]);
    node.webReviewSkip = partReviewSkip(node, prepared, !!outline);
    const { skip: skipped, reason: skipDetail } = node.webReviewSkip;
    mark('outline', prepared, !!outline || draft('outline'), skipped ? skipDetail : outline ? '已落稿' : '草稿 · 未落稿');

    const report = await json(webFilePath(reportPath(section, node.id, 'review')));
    const validReport = report?.groupId === node.id && Array.isArray(report.reviews);
    reviewInputs.set(node, { report: validReport ? report : undefined, outline });
    const reviewed = outline && validReport ? reviewedArtifact(outline, path('outline'), report) : undefined;
    const last = validReport ? report.reviews.at(-1) : undefined;
    mark('review', prepared, !!report, skipped ? skipDetail : reviewed ? reviewed.note ?? '复核通过'
      : last && outline && matchesHash(outline, last.candidateHash)
        ? last.verdict === 'revise' ? '需要返修' : last.verdict === 'blocked' ? '复核受阻' : '记录待确认'
        : '复核记录与当前稿未匹配');

    const reductionDone = layer === 'completed';
    // A group added later (a drawing-stage split) had no outline when its layer was reduced.
    mark('reduction', layer, !!reduced || draft('reduction'),
      reductionDone ? '已落稿 · 本层去重完成' : reduced ? '已有正式稿 · 本层去重未完成' : '草稿 · 未落稿');
    mark('completion', finished, !!completed || draft('completion'), completed ? '已落稿' : '草稿 · 未落稿');
    const check = await json(webFilePath(reportPath(section, node.id, 'completion-check')));
    const checked = !!check && finished === 'completed';
    mark('completionCheck', finished, !!check, checked ? '补全检查通过' : '检查记录待确认');
    const childrenDone = split === 'completed';
    mark('children', split, !!node.groups?.length, childrenDone ? `已分析 · ${node.groups?.length ?? 0} 个直属节点` : '已有分组 · 待重新分析');
    if (node.kind === 'part') node.webDetails.children = '终止 part，不再拆分';
  };
  // Each node reads independent evidence; bound parallel reads so a large tree
  // does not serialize the entire preview or flood the filesystem.
  for (let offset = 0; offset < entries.length; offset += 8) {
    await Promise.all(entries.slice(offset, offset + 8).map(inspectNode));
  }

  // request.json is created only after the agent obtains a concurrency slot.
  // A leftover draft or a queued group is not evidence that an agent is drawing.
  const calls = await currentAgentCalls(directory, section, files, errors, activeSince ?? failedSince, !!failedSince);
  for (const { node } of entries) {
    const { report, outline } = reviewInputs.get(node)!;
    node.webReviewRounds = partReviewRounds(node.id, report, outline, calls, !!activeSince, node.webReviewSkip, node.webPhases.review);
  }
  const latest = new Map<string, { call: AgentCall; phase: Phase; targets: any[] }>();
  for (const call of calls) {
    const match = /^(组轮廓绘制|组轮廓返修|组轮廓review|正面遮挡补全|直属结构拆分|同层轮廓去重)-(.+)$/.exec(call.name);
    if (!match) continue;
    const phase: Phase = ({ '组轮廓绘制': 'outline', '组轮廓返修': 'review', '组轮廓review': 'review',
      '正面遮挡补全': 'completion', '直属结构拆分': 'children', '同层轮廓去重': 'reduction' } as const)[match[1]]!;
    const targets = entries.filter(({ node, depth }) => phase === 'reduction' ? String(depth) === match[2] : node.id === match[2]).map(entry => entry.node);
    for (const node of targets) {
      if (node.webPhases[phase] === 'done' || node.webPhases[phase] === 'pending') continue;
      if (node.webReviewSkip.skip && (phase === 'outline' || phase === 'review')) continue;
      const id = `${node.id}:${phase}`;
      latest.set(id, { call, phase, targets: [node] });
    }
  }
  for (const { call, phase, targets } of latest.values()) {
    if (call.failed) {
      for (const node of targets) {
        node.webPhases[phase] = 'failed'; node.webMessages[phase] = '执行失败';
        node.webDetails[phase] = '调用失败，请查看运行记录：' + call.name;
      }
      continue;
    }
    if (!activeSince) continue;
    if (call.finished) continue;
    if (throttled(call)) {
      for (const node of targets) {
        node.webPhases[phase] = 'throttled'; node.webMessages[phase] = '限流等待';
        node.webDetails[phase] = call.retryError!;
      }
      continue;
    }
    for (const node of targets) {
      node.webPhases[phase] = 'running';
      node.webMessages[phase] = '进行中';
      node.webDetails[phase] = call.name.startsWith('组轮廓返修') ? '正在返修草稿'
        : ({ outline: '正在绘制 / 自检', review: '正在复核', reduction: '正在同层去重', completion: '正在补全 / 自检', children: '正在分析直属结构' } as any)[phase];
    }
  }
  return partStages(section, calls, !!activeSince, step, failed);
}
