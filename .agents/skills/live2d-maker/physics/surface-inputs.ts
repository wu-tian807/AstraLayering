import { readFile, copyFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { hash, optional, put, type PhysicsInput } from './input.ts';

// A physics review may deliberately use draft lighting maps. Freeze their
// exact provenance instead of silently dropping them when upstream review
// rules change. This snapshot grants no shadow-workflow acceptance.
export async function prepareSurfaceInputs(input: PhysicsInput, source: string, files: any) {
  await mkdir(source, { recursive: true });
  const documentHash = hash(await readFile(input.document));
  const prior = await optional(join(source, 'surface-inputs.json'));
  const size = await sharp(input.color).metadata();
  const maps: any = {};
  for (const kind of ['normal', 'depth'] as const) {
    const available = files[kind]?.available;
    const frozen = prior?.documentHash === documentHash ? prior.maps?.[kind] : undefined;
    const path = available ? files[kind].path : frozen?.path;
    if (!path) { await rm(join(source, kind + '.png'), { force: true }); continue; }
    const bytes = await readFile(join(input.task, path)), contentHash = hash(bytes);
    if (!available && contentHash !== frozen.contentHash) throw Error('物理贴图快照来源已变化：' + kind);
    const meta = await sharp(bytes).metadata();
    if (meta.width !== size.width || meta.height !== size.height) throw Error('物理贴图与源画布尺寸不同：' + kind);
    await copyFile(join(input.task, path), join(source, kind + '.png'));
    maps[kind] = { path, contentHash, upstreamAvailable: !!available, status: available ? 'project-preview-input' : 'frozen-preview-input' };
  }
  const snapshot = { version: 1, documentHash, maps };
  await put(join(source, 'surface-inputs.json'), snapshot);
  return snapshot;
}
