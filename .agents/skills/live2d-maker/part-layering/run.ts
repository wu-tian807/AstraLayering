import { runPartSection, type PartSection, type PartInput, type PartAdapters } from '../shared/part/run.ts';
import type { AgentOptions } from '../shared/agents/dispatcher.ts';
import { profile } from './profile.ts';
import { getPreparationDirectory, loadPreparedReferences, preparationRoute, prepareReferences } from './preparation.ts';
import { createPreparationSteps } from './preparation-agents.ts';
export { createPreparationSteps } from './preparation-agents.ts';

export const section: PartSection = {
  profile,
  getPreparationDirectory, loadPreparedReferences, preparationRoute,
  prepare: (input, agents, progress, normalization, range, signal) =>
    prepareReferences(input, createPreparationSteps(agents), progress, normalization, range, signal),
};

export function runPartLayering(input: PartInput, adapters: PartAdapters = {}, options: AgentOptions = {}) {
  return runPartSection(section, input, adapters, options);
}

if (import.meta.main) void import('../workflow/section-cli.ts').then(cli => cli.launchSection('part-layering'));
