import { readFile, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const defaults = { outline: '5-组轮廓.md', review: '6-轮廓review.md', completion: '9-正面遮挡补全.md', children: '10-直属结构拆分.md' } as const;
export type OutlineStage = keyof typeof defaults;

export async function readGroupPrompt(
  id: string, stage: OutlineStage,
  directory = fileURLToPath(new URL('prompts/', import.meta.url)),
): Promise<{ path: string; text: string; groupDirectory: string }> {
  if (!/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(id)) throw new Error('Invalid group prompt id');
  const groupDirectory = join(directory, 'groups', id);
  let path = join(groupDirectory, `${stage}.md`);
  let text: string;
  try { text = await readFile(path, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    path = join(directory, defaults[stage]);
    text = await readFile(path, 'utf8');
  }
  if (!text.trim()) throw new Error(`组提示词为空：${path}`);
  return { path, text, groupDirectory };
}

export type ReferenceImage = { path: string; description: string };
export type SiblingReference = ReferenceImage & {
  groupId: string; sourceSvg: string; sourceHash: string; sourceStage: 'reduction';
};

// References are explicit for this exact group and stage; no ancestor lookup.
export async function readGroupReferences(
  groupDirectory: string, stage: OutlineStage,
  resolveSibling?: (name: string, description: string) => Promise<SiblingReference>,
): Promise<(ReferenceImage | SiblingReference)[]> {
  const path = join(groupDirectory, `${stage}.references.json`);
  let config: unknown;
  try { config = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  if (!Array.isArray(config) || config.some(item => {
    if (!item || typeof item.description !== 'string' || !item.description.trim()) return true;
    if (typeof item.path === 'string' && item.path.trim()) {
      return Object.keys(item).some(key => !['path', 'description'].includes(key));
    }
    return stage !== 'completion' || typeof item.sibling !== 'string' || !/^[\p{L}\p{N}_-]+$/u.test(item.sibling) ||
      Object.keys(item).some(key => !['sibling', 'description'].includes(key));
  })) {
    throw new Error(`无效 ${stage} 参考清单：${path}`);
  }
  return Promise.all(config.map(async item => {
    if (item.sibling !== undefined) {
      if (!resolveSibling) throw new Error(`补全同级参考需要本次运行上下文：${path}`);
      return resolveSibling(item.sibling, item.description);
    }
    const image = await realpath(resolve(dirname(path), item.path));
    await sharp(image, { limitInputPixels: 100_000_000 }).metadata();
    return { path: image, description: item.description };
  }));
}
