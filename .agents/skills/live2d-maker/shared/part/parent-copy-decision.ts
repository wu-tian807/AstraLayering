import { createHash } from 'node:crypto';
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
  detectorVersion: number;
  parentSha256: string;
  outlineSha256: string;
  maskSha256: string;
};
export const copyHash = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
// This belongs to the outline step, including while its draft is in workspace/.
// SVG publication moves the draft without changing its bytes or this record.
export const copyDecisionPath = (directory: string, id: string) =>
  join(directory, groupStepId(id, 'outline'), 'copy-decision.json');
export const clearCopyDecision = (directory: string, id: string) => rm(copyDecisionPath(directory, id), { force: true });

export async function saveCopyDecision(directory: string, id: string, outline: string,
  parentSha256: string, maskSha256: string, geometry: CopyGeometryDecision) {
  const decision: ParentCopyDecision = { version: 1, kind: 'parentCopy', groupId: id,
    detectorVersion: copyDetectorVersion, parentSha256, outlineSha256: copyHash(outline), maskSha256,
    needsCompletion: geometry.needsCompletion, reason: geometry.reason };
  await writeAtomic(copyDecisionPath(directory, id), JSON.stringify(decision, null, 2) + '\n');
  return decision;
}

// Only a current, group-bound record authorizes skipping stages. Old SVG
// attributes, missing records and interrupted/stale writes are not decisions.
export async function readCopyDecision(directory: string, id: string, outline: Buffer, parent: Buffer): Promise<ParentCopyDecision | undefined> {
  let value: ParentCopyDecision;
  try { value = JSON.parse(await readFile(copyDecisionPath(directory, id), 'utf8')); }
  catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
  if (!value || value.version !== 1 || value.kind !== 'parentCopy' || value.groupId !== id ||
      value.detectorVersion !== copyDetectorVersion || value.parentSha256 !== copyHash(parent) ||
      value.outlineSha256 !== copyHash(outline) || !/^[0-9a-f]{64}$/.test(value.maskSha256) ||
      typeof value.needsCompletion !== 'boolean') return;
  if (value.reason === 'whole-independent-geometry' ? value.needsCompletion !== false
    : !['mask-cuts-parent', 'uncertain-geometry'].includes(value.reason) || value.needsCompletion !== true) return;
  return value;
}
