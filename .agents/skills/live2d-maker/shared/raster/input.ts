import { join } from 'node:path';
import { requireUpstream, simplifiedCharacter } from '../upstream.ts';

export type PartLayeringInput = { directory: string; parts: string; originalCharacter?: string };
export const partReferenceFile = (section: 'part-layering' | 'clothing-part-layering') =>
  section === 'part-layering' ? 'references/base-subject.png' : 'references/clothing.png';

export function isPartLayeringInput(value: unknown): value is PartLayeringInput {
  const input = value as PartLayeringInput | null;
  return !!input && typeof input.directory === 'string' && typeof input.parts === 'string';
}

export async function resolvePartInput(name: string, section: 'part-layering' | 'clothing-part-layering', root?: string): Promise<PartLayeringInput> {
  const directory = await requireUpstream(name, section, [
    { path: 'parts', directory: true }, { path: 'groups.json' }, { path: 'occlusion.json' },
    { path: partReferenceFile(section) },
  ], root);
  return { directory, parts: join(directory, 'parts'), ...(section === 'clothing-part-layering'
    ? { originalCharacter: await simplifiedCharacter(name, root) } : {}) };
}
