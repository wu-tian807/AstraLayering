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
  preparationHelp: '--image 首次启动需要；--standard 按需调整姿态，关闭时复制原图为 standard.png。续跑沿用已有步骤保存的选项和参考产物。',
  getPreparationDirectory, loadPreparedReferences,
  prepare: (input, agents, progress, normalization, range) => prepareReferences(input, createPreparationSteps(agents), progress, normalization, range),
};

export function runPartLayering(input: PartInput, adapters: PartAdapters = {}, options: AgentOptions = {}) {
  return runPartSection(section, input, adapters, options);
}

if (import.meta.main) await runCli(section);
