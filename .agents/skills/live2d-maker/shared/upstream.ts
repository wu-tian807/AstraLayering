import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { sectionDirectory, type SectionId } from './paths.ts';

export async function requireUpstream(name: string, section: SectionId, entries: { path: string; directory?: boolean }[], root?: string): Promise<string> {
  const directory = sectionDirectory(name, section, root), missing: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.path);
    try {
      const info = await stat(path);
      if (entry.directory ? !info.isDirectory() || !(await readdir(path)).length : !info.isFile() || info.size === 0) missing.push(path);
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') missing.push(path); else throw error; }
  }
  if (missing.length) throw new Error(`缺少上游产物（${section}）\n${missing.join('\n')}`);
  return directory;
}

export async function simplifiedCharacter(name: string, root?: string): Promise<string> {
  const directory = await requireUpstream(name, 'part-layering', [{ path: 'references/simplified-subject.png' }], root);
  return join(directory, 'references/simplified-subject.png');
}
