import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { prepareReferences, type PreparationReferences } from '../preparation.ts';
import { createPreparationSteps } from '../run.ts';

// Completes the preparation steps of a task from a transparent original, reusing it
// as every reference, so later steps find complete step records.
export async function seedPreparedReferences(runName: string, root?: string): Promise<PreparationReferences> {
  const temporary = await mkdtemp(join(tmpdir(), 'part-layering-prepared-'));
  try {
    const image = join(temporary, 'original.png');
    const subject = Buffer.from('<svg width="100" height="100"><rect x="20" y="20" width="60" height="60" fill="white"/></svg>');
    await sharp(subject).png().toFile(image);
    const steps = createPreparationSteps({
      async run(task) {
        const reuse = task.tools?.find(tool => tool.name === 'reuse_reference');
        if (!reuse) return { text: JSON.stringify({ needsSimplification: false, reason: 'fixture' }), images: [] };
        const result = await reuse.execute({ reason: 'fixture' }, new AbortController().signal);
        const saved = JSON.parse((result.contentItems[0] as { text: string }).text);
        return { text: JSON.stringify({ savedPath: saved.savedPath, error: null, reason: saved.reason }), images: [] };
      },
    });
    return await prepareReferences({ runName, image, ...(root ? { dir: root } : {}) }, steps);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
