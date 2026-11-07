import { access, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type OutlineRole = 'main' | 'review' | 'repair';
// Runs one agent turn in the given role; main and repair share the outline thread,
// review is a fresh session.
export type OutlineAgent = (role: OutlineRole) => Promise<void>;

export const outlineFiles = ['source-face.svg', 'target-face.svg', 'notes.md'] as const;
const reviewVerdicts = ['通过', '需要修复', '无法完成检查'], repairVerdicts = ['已修复', '仍有问题'];

async function conclusion(path: string, allowed: string[]): Promise<string | undefined> {
  let text: string;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
  const [first, ...body] = text.trim().split(/\r?\n/);
  const value = first?.match(/^结论[：:]\s*(\S+)\s*$/)?.[1];
  if (!value || !allowed.includes(value) || !body.join('\n').trim()) throw Error(`报告缺少有效结论或正文：${path}`);
  return value;
}

// The agent writes <report>.tmp; only a finished conclusion becomes the report.
async function report(directory: string, name: string, allowed: string[], run: () => Promise<void>, unfinished: string) {
  const draft = join(directory, `${name}.tmp`);
  await rm(draft, { force: true });
  await run();
  const value = await conclusion(draft, allowed);
  if (!value) throw Error(`缺少完整报告：${draft}`);
  if (value === unfinished) throw Error(`${name}：${value}，见 ${draft}`);
  await rename(draft, join(directory, name));
  return value;
}

// The visible outline is drawn, reviewed once in a fresh session and, when the
// review asks for it, repaired once in the drawing thread. There is no second review.
export async function runOutline(directory: string, run: OutlineAgent, progress: (message: string) => void = () => {}) {
  let review = await conclusion(join(directory, 'review-01.md'), reviewVerdicts);
  if (!review) {
    await rm(join(directory, 'repair-01.md'), { force: true });
    if (!await access(join(directory, '.drawn')).then(() => true, () => false)) {
      await run('main');
      for (const file of outlineFiles) await access(join(directory, file)).catch(() => { throw Error(`描边缺少交付：${join(directory, file)}`); });
      await writeFile(join(directory, '.drawn'), '');
    }
    review = await report(directory, 'review-01.md', reviewVerdicts, () => run('review'), '无法完成检查');
    progress(`描边 review-01.md：${review}`);
  }
  if (review === '通过') return;
  if (await conclusion(join(directory, 'repair-01.md'), repairVerdicts)) return;
  progress(`描边 repair-01.md：${await report(directory, 'repair-01.md', repairVerdicts, () => run('repair'), '仍有问题')}`);
}
