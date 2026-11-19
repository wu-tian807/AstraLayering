import { runCli, runPartSection, type PartSection, type PartInput, type PartAdapters } from '../shared/part/run.ts';
import type { AgentOptions } from '../shared/agents/dispatcher.ts';
import { profile } from './profile.ts';
import { getPreparationDirectory, loadPreparedReferences, prepareReferences } from './preparation.ts';
import { createPreparationSteps } from './preparation-agents.ts';
export { createPreparationSteps } from './preparation-agents.ts';
export { parseRunArguments, readGroupInput, formatLayeringSummary } from '../shared/part/run.ts';

export const section: PartSection = {
  profile,
  imageHelp: '角色图片路径',
  preparationHelp: '--image 首次启动需要。--standard 先判断并按需调整姿态，两种模式均准备透明标准参考。单独运行本 section 时续跑须带与首次相同的 --standard／--no-standard（未传按关闭），总入口续跑沿用任务根记录。',
  getPreparationDirectory, loadPreparedReferences,
  prepare: (input, agents, progress, normalization) => prepareReferences(input, createPreparationSteps(agents), progress, normalization),
};

export function runPartLayering(input: PartInput, adapters: PartAdapters = {}, options: AgentOptions = {}) {
  return runPartSection(section, input, adapters, options);
}

if (import.meta.main) await runCli(section);
