import { createHash } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const preparationHash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
export const fileHash = async (path: string): Promise<string> => preparationHash(await readFile(path));

// The person preparation mode is the output of the preparation options step.
// Tasks not yet converted still carry it in references/options.json or preparation.json.
export const preparationOptionsPath = (references: string) => join(dirname(references), 'preparation/step02/options.json');
export async function readPreparationOptions(directory: string): Promise<boolean | undefined> {
  for (const path of [preparationOptionsPath(directory), join(directory, 'options.json'), join(directory, 'preparation.json')]) {
    let text: string;
    try { text = await readFile(path, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
    const standard = (JSON.parse(text) as { standard?: unknown })?.standard;
    if (typeof standard !== 'boolean') throw new Error(`无效的 preparation 选项：${path}`);
    return standard;
  }
}

// Only the current part pipeline owns these files. Raster/assembly markers and threads are untouched.
export async function clearPreparedParts(directory: string): Promise<void> {
  for (const entry of ['groups.json', 'parts', 'stages', 'observations', 'preview.svg', 'occlusion.json']) {
    await rm(join(directory, entry), { recursive: true, force: true });
  }
}
