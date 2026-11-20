import { parseArgs } from 'node:util';
import { defaultAgentConcurrency } from './agents/runtime.ts';
import { resolveRunsDirectory } from './paths.ts';
import { shadowMode } from './shadow.ts';
import type { StepSelection } from './step-range.ts';

export const sectionRangeHelp = [
  '--from-step <步骤> --to-step <步骤> 选择包含起止步骤的范围。只给起点时执行单步，只给停点时从开头执行。',
  '--max-recursive-counts <非负整数> 限制回到较早步骤的次数。0 允许当前轮完成，停在回环之前。',
].join('\n');

export function parseSectionArguments(args: string[]) {
  const { values } = parseArgs({ args, options: {
    name: { type: 'string' }, dir: { type: 'string' }, knowledge: { type: 'string' },
    image: { type: 'string' }, krita: { type: 'string' }, ffmpeg: { type: 'string' },
    'shadow-mode': { type: 'string' }, standard: { type: 'boolean' }, 'no-standard': { type: 'boolean' },
    'from-step': { type: 'string' }, 'to-step': { type: 'string' }, 'max-recursive-counts': { type: 'string' },
    jobs: { type: 'string', short: 'j' }, agents: { type: 'string', short: 'a' },
    'dry-run': { type: 'boolean' }, 'check-krita': { type: 'boolean' },
    step: { type: 'string' }, continue: { type: 'boolean' }, resume: { type: 'boolean' }, retry: { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  for (const [name, value] of [['--jobs / -j', values.jobs], ['--agents / -a', values.agents]] as const) {
    if (value !== undefined && (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))) {
      throw new Error(`${name} 必须是正整数`);
    }
  }
  if (values.jobs !== undefined && values.agents !== undefined && Number(values.jobs) !== Number(values.agents)) {
    throw new Error('--jobs 和 --agents 是同一 agent 并发上限的别名，不能指定不同值');
  }
  const limit = values['max-recursive-counts'];
  if (limit !== undefined && (!/^\d+$/.test(limit) || !Number.isSafeInteger(Number(limit)))) {
    throw new Error('--max-recursive-counts 必须是非负整数');
  }
  const fromStep = values['from-step'], toStep = values['to-step'];
  if (values.step !== undefined && (fromStep !== undefined || toStep !== undefined)) {
    throw new Error('--step 不能与 --from-step 或 --to-step 同用');
  }
  const actions = (['continue', 'resume', 'retry'] as const).filter(action => values[action]);
  if (actions.length > 1) throw new Error('--continue、--resume、--retry 只能选一个');
  if (actions.length && values['dry-run']) throw new Error('恢复操作不能与 --dry-run 一起使用');
  if (actions.length && (fromStep !== undefined || toStep !== undefined || limit !== undefined)) {
    throw new Error('恢复操作使用 --step 指定目标');
  }
  if (values.standard && values['no-standard']) throw new Error('--standard 与 --no-standard 不能同时使用。');
  if (values.dir !== undefined) resolveRunsDirectory(values.dir);
  const selection: StepSelection | undefined = fromStep !== undefined || toStep !== undefined || limit !== undefined
    ? { fromStep, toStep, maxRecursiveCounts: limit === undefined ? undefined : Number(limit) } : undefined;
  return { ...values, selection, action: actions[0], shadowMode: shadowMode(values['shadow-mode']),
    standard: values['no-standard'] ? false : values.standard,
    agentConcurrency: Number(values.jobs ?? values.agents ?? defaultAgentConcurrency) };
}
