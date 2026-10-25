import {loadWorkflowEnvironment} from '../shared/codex/environment.ts';
export function physicsEnvironment(env:NodeJS.ProcessEnv=process.env) {
  // Host-specific capability settings apply only to this pipeline.
  const scoped={...env};
  if(env.ASTRA_PHYSICS_CODEX_PATH)scoped.layering_codex_path=env.ASTRA_PHYSICS_CODEX_PATH;
  if(env.ASTRA_PHYSICS_IMAGE_COMPACT_THRESHOLD)scoped.layering_image_compact_threshold=env.ASTRA_PHYSICS_IMAGE_COMPACT_THRESHOLD;
  return loadWorkflowEnvironment(scoped);
}
