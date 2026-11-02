import { readFile } from 'node:fs/promises';
import { artifactPath, matchesHash, reportPath, reviewedArtifact, stepDraftPath } from '../.agents/skills/live2d-maker/shared/part/artifact-facts.ts';
import { groupStepId, layerStepId } from '../.agents/skills/live2d-maker/shared/part/part-steps.ts';
import { readStep, type StepStatus } from '../.agents/skills/live2d-maker/shared/step-chain.ts';
import { safePath, webFilePath } from './files.ts';
import { currentAgentCalls, throttled, type AgentCall } from './agent-progress.ts';
import { partStages } from './part-stages.ts';
import { partReviewRounds, partReviewSkip } from './part-review.ts';

export const phases = ['outline', 'review', 'reduction', 'completion', 'completionCheck', 'children'] as const;
type Phase = typeof phases[number];

// Step markers are dotfiles, which the file inventory skips; read them directly.
export async function stepStatus(directory: string, section: string, id: string): Promise<StepStatus> {
  try { return (await readStep(await safePath(directory, `${section}/${id}`))).status; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return 'absent'; throw error; }
}

// These are file observations for display, not a second scheduler or a resume check.
// They follow the run's marker rule: a product counts only in a step marked .running
// or .completed (an unmarked or missing step is rerun from scratch), and a completed
// step whose product is missing is shown failed.
export async function partProgress(directory: string, section: string, groups: any[], files: Set<string>,
  json: (path: string) => Promise<any>, errors: string[], activeSince?: string, failedSince?: string) {
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
    const mark = (phase: Phase, done: boolean, present: boolean, message: string, missing?: string) => {
      if (!done && missing) {
        node.webPhases[phase] = 'failed'; node.webMessages[phase] = '执行失败';
        node.webDetails[phase] = '.completed 存在但缺少交付：' + missing; return;
      }
      node.webPhases[phase] = done ? 'done' : present ? 'available' : 'pending';
      node.webMessages[phase] = done ? '已完成' : present ? '已有产物' : '待执行';
      if (done || present) node.webDetails[phase] = message;
    };
    const marked = (status: StepStatus) => status === 'running' || status === 'completed';
    const outline = await read(path('outline'));
    const reduced = await read(path('reduction'));
    const completed = await read(path('completion'));
    const [prepared, layer, finished, split] = await Promise.all([step(groupStepId(node.id, 'outline')), step(layerStepId(depth)),
      step(groupStepId(node.id, 'completion')), step(groupStepId(node.id, 'children'))]);
    node.webReviewSkip = partReviewSkip(node, prepared, !!outline);
    const { skip: skipped, reason: skipDetail } = node.webReviewSkip;
    mark('outline', !!outline && marked(prepared), marked(prepared) && (!!outline || draft('outline')),
      skipped ? skipDetail : outline ? '已落稿' : '草稿 · 未落稿', prepared === 'completed' && !outline ? path('outline') : undefined);

    const report = await json(webFilePath(reportPath(section, node.id, 'review')));
    const validReport = report?.groupId === node.id && Array.isArray(report.reviews);
    reviewInputs.set(node, { report: validReport ? report : undefined, outline });
    const reviewed = outline && validReport ? reviewedArtifact(outline, path('outline'), report) : undefined;
    const last = validReport ? report.reviews.at(-1) : undefined;
    mark('review', skipped || !!reviewed && prepared === 'completed', skipped || marked(prepared) && !!report, skipped ? skipDetail : reviewed ? reviewed.note ?? '复核通过'
      : last && outline && matchesHash(outline, last.candidateHash)
        ? last.verdict === 'revise' ? '需要返修' : last.verdict === 'blocked' ? '复核受阻' : '记录待确认'
        : '复核记录与当前稿未匹配');

    const reductionDone = !!reduced && layer === 'completed';
    // A group added later (a drawing-stage split) had no outline when its layer was reduced.
    mark('reduction', reductionDone, layer === 'running' && (!!reduced || draft('reduction')),
      reductionDone ? '已落稿 · 本层去重完成' : reduced ? '已有正式稿 · 本层去重未完成' : '草稿 · 未落稿',
      layer === 'completed' && prepared === 'completed' && !reduced ? path('reduction') : undefined);
    const completionDone = !!completed && marked(finished);
    mark('completion', completionDone, finished === 'running' && draft('completion'), completionDone ? '已落稿' : '草稿 · 未落稿',
      finished === 'completed' && !completed ? path('completion') : undefined);
    const check = await json(webFilePath(reportPath(section, node.id, 'completion-check')));
    const checked = !!check && finished === 'completed';
    mark('completionCheck', checked, finished === 'running' && !!check, checked ? '补全检查通过' : '检查记录待确认',
      finished === 'completed' && !check ? webFilePath(reportPath(section, node.id, 'completion-check')) : undefined);
    const childrenDone = split === 'completed';
    mark('children', childrenDone, childrenDone || !!node.groups?.length, childrenDone ? `已分析 · ${node.groups?.length ?? 0} 个直属节点` : '已有分组 · 待重新分析');
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
    node.webReviewRounds = partReviewRounds(node.id, report, outline, calls, !!activeSince, node.webReviewSkip);
  }
  const latest = new Map<string, { call: AgentCall; phase: Phase; targets: any[] }>();
  for (const call of calls) {
    const match = /^(组轮廓绘制|组轮廓返修|组轮廓review|正面遮挡补全|直属结构拆分|同层轮廓去重)-(.+)$/.exec(call.name);
    if (!match) continue;
    const phase: Phase = ({ '组轮廓绘制': 'outline', '组轮廓返修': 'review', '组轮廓review': 'review',
      '正面遮挡补全': 'completion', '直属结构拆分': 'children', '同层轮廓去重': 'reduction' } as const)[match[1]]!;
    const targets = entries.filter(({ node, depth }) => phase === 'reduction' ? String(depth) === match[2] : node.id === match[2]).map(entry => entry.node);
    for (const node of targets) {
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
  return partStages(directory, section, groups, files, json, calls, errors, !!activeSince, step);
}
