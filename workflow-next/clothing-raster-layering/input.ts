import { cp, mkdir, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

export type PartLayeringInput = { directory: string; parts: string };

export const snapshotEntries = ['parts', 'references', 'groups.json', 'occlusion.json', 'preview.svg'] as const;

export async function snapshotInput(input: PartLayeringInput, destination: string): Promise<void> {
  await mkdir(destination);
  for (const entry of snapshotEntries) {
    const source = join(input.directory, entry);
    try { await stat(source); }
    catch (error) {
      if (entry !== 'parts' && (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    // Dereference links so the saved input survives removal of the source directory.
    await cp(source, join(destination, entry), { recursive: true, dereference: true, force: false, errorOnExist: true });
  }
}

export async function resolvePartInput(value: string): Promise<PartLayeringInput> {
  const supplied = resolve(value);
  if (!(await stat(supplied)).isDirectory()) throw new Error('--input 必须是 clothing-part-layering 运行目录或其中的 parts/ 目录。');
  // Prefer a run root containing parts/; also accept a direct path to parts/.
  let directory = supplied;
  let hasParts = false;
  try { hasParts = (await stat(join(supplied, 'parts'))).isDirectory(); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (!hasParts && basename(supplied) === 'parts') directory = dirname(supplied);
  const parts = join(directory, 'parts');
  try {
    if (!(await stat(parts)).isDirectory()) throw new Error('不是目录');
  } catch (error) {
    throw new Error(`输入缺少 parts/ 产物目录：${parts}。请传入已完成的 clothing-part-layering 运行目录（例如 .run/test）。`, { cause: error });
  }
  return { directory: await realpath(directory), parts: await realpath(parts) };
}
