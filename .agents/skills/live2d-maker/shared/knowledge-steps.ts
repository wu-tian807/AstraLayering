// Steps whose prompts and tools come from knowledge/<section>/<step>/agent.json.
// The code decides whether a step has a review; `required` names the tools a
// role cannot deliver without.
export type KnowledgeStep = {
  section: string; step: string;
  required?: readonly string[];
  review?: { required?: readonly string[] };
};

const part = (section: string): KnowledgeStep[] => [
  { section, step: 'step08_initial', required: ['write_groups'] },
  { section, step: 'step09_outline', required: ['write_outline_svg'], review: { required: ['submit_review'] } },
  { section, step: 'step10_reduce', required: ['list_reduction_groups', 'write_reduction_svg', 'submit_reduction'] },
  { section, step: 'step11_completion', required: ['set_completion_paths', 'submit_completion'] },
  { section, step: 'step12_children', required: ['submit_children'] },
  { section, step: 'step14_occlusion', required: ['submit_occlusion'] },
];

export const knowledgeSteps: readonly KnowledgeStep[] = [
  { section: 'raster-layering', step: 'step01', review: {} },
  { section: 'raster-layering', step: 'step02' },
  { section: 'raster-layering', step: 'step03' },
  { section: 'clothing-raster-layering', step: 'step01', review: {} },
  { section: 'clothing-raster-layering', step: 'step02' },
  { section: 'character-assembly', step: 'step01' },
  { section: 'shadow', step: 'step01_mask' },
  { section: 'shadow', step: 'step01_normal-depth' },
  { section: 'nine-axis', step: 'step01_views' },
  { section: 'nine-axis', step: 'step02_angle-x', required: ['krita'] },
  { section: 'nine-axis', step: 'step03_angle-y' },
  { section: 'part-layering', step: 'step03_pose' },
  { section: 'part-layering', step: 'step04_standard' },
  { section: 'part-layering', step: 'step05_simplified' },
  { section: 'part-layering', step: 'step06_base' },
  { section: 'clothing-part-layering', step: 'step01_preparation' },
  ...part('part-layering'),
  ...part('clothing-part-layering'),
];

// Fixed runtime texts in knowledge/shared/prompts/runtime/<name>.md.
export const runtimePrompts = [
  'agent-turn', 'interrupted-task',
  'image-blocked-multiple', 'image-blocked-placeholder', 'image-blocked-single', 'image-blocked-stop',
  'outline-repair-resume', 'raster-repair-resume',
] as const;
