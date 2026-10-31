import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { checkFaceY } from '../angle-y.ts';

type Point = [number, number];
const ids = ['face/face_base', 'face/eye_left', 'face/ear_right', 'face/ear_left'];
const moved = (points: Point[], dy: number) => points.map(([x, y]) => [x, y + dy] as Point);

// Up lifts each step02 part by 4 px and down lowers it by 3, on step02's lattice.
export async function writeFaceY(directory: string) {
  const x = JSON.parse(await readFile(join(directory, '../step02_angle-x/deformers.json'), 'utf8'));
  const parts = x.parts.map((p: { id: string; keyforms: Record<string, Point[]> }) => ({ id: p.id, keyforms: { '30': moved(p.keyforms['0'], -4), '-30': moved(p.keyforms['0'], 3) } }));
  await writeFile(join(directory, 'face-y.json'), JSON.stringify({ notes: '测试', parts }));
}

test('Y 交付检查：部件须与 step02 一一对应，控制点数沿用其网格', () => {
  const rest: Point[] = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const x = { parameters: [], parts: ids.map(id => ({ id, texture: 'layers/000.png', cols: 1, rows: 1, keyforms: { '0': rest } })) };
  const y = (only = ids, points = rest) => ({ parts: only.map(id => ({ id, keyforms: { '30': points, '-30': points } })) });
  assert.equal(checkFaceY(y(), x).parts.length, 4);
  assert.throws(() => checkFaceY(y(ids.slice(1)), x), /缺少部件 face\/face_base/);
  assert.throws(() => checkFaceY(y([...ids, 'face/nose']), x), /face\/nose/);
  assert.throws(() => checkFaceY(y(ids, rest.slice(1)), x), /关键形 30 需要 4 个/);
  assert.throws(() => checkFaceY({ parts: [...y().parts.slice(1), { ...y().parts[0], opacity: {} }] }, x), /不透明度/);
});
