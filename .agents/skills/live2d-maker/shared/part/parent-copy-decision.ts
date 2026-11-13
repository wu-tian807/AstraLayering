import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { groupStepId } from '../step-paths.js';
import { writeAtomic } from './groups.ts';

export const copyDetectorVersion = 1;
export type CopyGeometryDecision = {
  needsCompletion: boolean;
  reason: 'whole-independent-geometry' | 'mask-cuts-parent' | 'uncertain-geometry';
};
export type ParentCopyDecision = CopyGeometryDecision & {
  version: 1;
  kind: 'parentCopy';
  groupId: string;
  detectorVersion?: number;
};
// This belongs to the outline step, including while its draft is in workspace/.
// SVG publication moves the draft without changing its bytes or this record.
export const copyDecisionPath = (directory: string, id: string) =>
  join(directory, groupStepId(id, 'outline'), 'copy-decision.json');
export const clearCopyDecision = (directory: string, id: string) => rm(copyDecisionPath(directory, id), { force: true });

export async function saveCopyDecision(directory: string, id: string, geometry: CopyGeometryDecision) {
  const decision: ParentCopyDecision = { version: 1, kind: 'parentCopy', groupId: id,
    detectorVersion: copyDetectorVersion,
    needsCompletion: geometry.needsCompletion, reason: geometry.reason };
  await writeAtomic(copyDecisionPath(directory, id), JSON.stringify(decision, null, 2) + '\n');
  return decision;
}

// Trust the group's tool decision until an explicit redraw or repair clears it.
// Legacy fingerprints and detector versions are not upstream validity gates.
// Missing, malformed and cross-group records still cannot authorize a skip.
export async function readCopyDecision(directory: string, id: string): Promise<ParentCopyDecision | undefined> {
  let value: ParentCopyDecision;
  try { value = JSON.parse(await readFile(copyDecisionPath(directory, id), 'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!value || value.version !== 1 || value.kind !== 'parentCopy' || value.groupId !== id ||
      typeof value.needsCompletion !== 'boolean') return;
  if (value.reason === 'whole-independent-geometry' ? value.needsCompletion !== false
    : !['mask-cuts-parent', 'uncertain-geometry'].includes(value.reason) || value.needsCompletion !== true) return;
  return { version: 1, kind: 'parentCopy', groupId: id,
    ...(typeof value.detectorVersion === 'number' ? { detectorVersion: value.detectorVersion } : {}),
    needsCompletion: value.needsCompletion, reason: value.reason };
}
