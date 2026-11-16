import { runCli, runPartSection, type PartSection, type PartInput, type PartAdapters } from '../shared/part/run.ts';
import type { AgentOptions } from '../shared/agents/dispatcher.ts';
import { profile } from './profile.ts';
import { getPreparationDirectory, loadPreparedReferences, prepareReferences, createPreparationSteps } from './preparation.ts';
export { parseRunArguments, readGroupInput, formatLayeringSummary } from '../shared/part/run.ts';

export const section: PartSection = {
  profile,
  imageHelp: '简化穿衣角色图片路径',
  preparationHelp: '按 --name 读取同名 part-layering/references/ 下的 simplified-subject.png、base-subject.png 与 standard.png，生成纯衣服参考；不接受额外 --image。',
  getPreparationDirectory, loadPreparedReferences,
  prepare: (input, agents, progress, normalization) => prepareReferences(input, createPreparationSteps(agents), progress, normalization),
};

export function runClothingPartLayering(input: PartInput, adapters: PartAdapters = {}, options: AgentOptions = {}) {
  return runPartSection(section, input, adapters, options);
}

if (import.meta.main) await runCli(section);
