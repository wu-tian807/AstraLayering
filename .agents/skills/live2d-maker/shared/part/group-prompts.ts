import { stepKnowledge, type KnowledgeValues } from '../knowledge.ts';
import { groupDepth, groupItem, layerItem } from '../step-paths.js';
import type { PartProfile } from './profile.ts';

// Prior knowledge of each part stage: knowledge/<section>/<step>/.
const knowledgeSteps = { initial: 'step08_initial', outline: 'step09_outline', reduction: 'step10_reduce',
  completion: 'step11_completion', completion_boundary_review: 'step11_completion/boundary-review', children: 'step12_children', occlusion: 'step14_occlusion' } as const;
export type PartStage = keyof typeof knowledgeSteps;
export function partKnowledge(profile: Pick<PartProfile, 'id'>, stage: PartStage) {
  return stepKnowledge(profile.id, knowledgeSteps[stage]);
}

// Values every group prompt may use. Task paths are spelled in the prompt
// itself with {uri:}, so only the group's own segments are filled in here.
export function groupValues(id: string, canvas: { width: number; height: number }): KnowledgeValues {
  return { group_id: id, group_dir: groupItem(id), layer_depth: layerItem(groupDepth(id)).slice('depth'.length),
    width: String(canvas.width), height: String(canvas.height) };
}
