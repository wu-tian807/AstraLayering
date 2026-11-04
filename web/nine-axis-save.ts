import { lstat, readFile } from 'node:fs/promises';
import { safePath, atomicJSON } from './files.ts';
import { nineAxisDeformerPaths } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { validateHeadNineAxis, nodes, checkWarpGeometry } from '../.agents/skills/live2d-maker/shared/nine-axis-model.js';

const pending = new Map<string, Promise<unknown>>();
const identity = (doc: any) => JSON.stringify({ ...doc, parts: doc.parts.map(strip), deformers: doc.deformers.map(strip) });
function strip({ keyforms, keyformsY, keyformsXY, ...n }: any) { return n; }

export async function saveNineAxis(directory: string, value: any) {
  if (!nineAxisDeformerPaths.has(value.path)) throw Error('只能保存工作台的九轴文件');
  const file = await safePath(directory, value.path), previous = pending.get(file) ?? Promise.resolve();
  const operation = previous.catch(() => {}).then(async () => {
    const info = await lstat(file), version = `${info.mtimeMs}:${info.size}`;
    if (value.version !== version) throw Error('九轴数据已变化，请重新读取后编辑');
    const text = await readFile(file, 'utf8'), old = validateHeadNineAxis(JSON.parse(text)), doc = validateHeadNineAxis(value.document);
    if (identity(old) !== identity(doc)) throw Error('保存仅修改现有变形器关键形，不能替换图层、来源或层级');
    for (const n of nodes(doc)) checkWarpGeometry(n);
    if (await readFile(file, 'utf8') !== text) throw Error('九轴数据在保存期间变化，请重新读取');
    await atomicJSON(file, doc);
    const saved = await lstat(file); return { path: value.path, version: `${saved.mtimeMs}:${saved.size}` };
  });
  pending.set(file, operation);
  try { return await operation; } finally { if (pending.get(file) === operation) pending.delete(file); }
}
