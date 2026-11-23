import { profile } from '../profile.ts';
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import sharp from 'sharp';
import { writeAtomic } from '../../shared/part/groups.ts';
export { shape, workingSteps, workingMerger, seedInitialGroups } from '../../part-layering/tests/layering-fixture.ts';

export async function fixture(t: TestContext) {
  // The task layout of a real run, so the prompt's task paths resolve.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'part-layering-bfs-'))), directory = join(root, 'clothing-part-layering');
  t.after(() => rm(root, { recursive: true, force: true }));
  const references = { directory: join(directory, 'references'), judgment: join(directory, 'references/judgment.json'),
    simplifiedSubject: join(directory, 'references/simplified-subject.png'), baseSubject: join(directory, 'references/clothing.png') };
  await mkdir(references.directory, { recursive: true });
  await writeAtomic(references.judgment, '{"needsSimplification":false}');
  const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffffff' } }).png().toBuffer();
  await writeAtomic(references.baseSubject, png);
  await writeAtomic(references.simplifiedSubject, png);
  return { profile, directory, references };
}
