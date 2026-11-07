import { access } from 'node:fs/promises';
import { join } from 'node:path';

export const outlineFiles = ['source-face.svg', 'target-face.svg', 'notes.md'] as const;

// Draws the outline once; an outline already delivered is kept as is.
export async function runOutline(directory: string, run: () => Promise<void>) {
  const missing = async () => (await Promise.all(outlineFiles.map(file => access(join(directory, file)).then(() => undefined, () => file)))).filter(Boolean);
  if (!(await missing()).length) return;
  await run();
  const left = await missing();
  if (left.length) throw Error(`描边缺少交付：${left.map(file => join(directory, file!)).join('、')}`);
}
