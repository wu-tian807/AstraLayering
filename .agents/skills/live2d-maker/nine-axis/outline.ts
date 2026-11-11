import { access } from 'node:fs/promises';
import { join } from 'node:path';

export const outlineFiles = ['source-face.svg', 'target-face.svg', 'notes.md'] as const;

export async function checkOutlineFiles(directory: string) {
  const left = (await Promise.all(outlineFiles.map(file => access(join(directory, file)).then(() => undefined, () => file)))).filter(Boolean);
  if (left.length) throw Error(`描边缺少交付：${left.map(file => join(directory, file!)).join('、')}`);
}

// Draws the outline once; an outline already delivered is kept as is.
export async function runOutline(directory: string, run: () => Promise<void>) {
  if (await checkOutlineFiles(directory).then(() => true, () => false)) return;
  await run();
  await checkOutlineFiles(directory);
}
