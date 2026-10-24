// Cache policy belongs to the workflow; pixel rendering remains skill-owned.
import { renderFingerprint, renderFrames as captureFrames } from '../shared/character-render/render-frames.ts';
import { simulationHash } from '../shared/physics-evidence/store.ts';
import { createFrameRenderer } from './render-cache.ts';
export { renderFingerprint };
export const renderFrames = createFrameRenderer({ render: captureFrames, fingerprint: renderFingerprint, simulationHash });
