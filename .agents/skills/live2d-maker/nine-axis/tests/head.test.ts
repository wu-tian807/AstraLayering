import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { checkFaceLeft, mirrorKeyform, pairId, stepTexture, type Part } from '../head.ts';

const grid = (x0: number, y0: number, x1: number, y1: number, shift = (x: number, y: number): [number, number] => [x, y]) =>
  [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => shift(x, y));
const part = (id: string, bbox: [number, number, number, number], shift: (x: number, y: number) => [number, number]): Part => ({
  id, group: 'eyes_brows', texture: 'layers/000.png', textureBounds: [0, 0, 1, 1], bbox, cols: 1, rows: 1,
  keyforms: { '0': grid(...bbox), '-30': grid(...bbox, shift) } });

// Face base, an eye and an ear pair over a 200-wide canvas with the face axis at 100;
// the ears sit under the face, and the far (right) ear turns behind it at −30.
export async function writeFaceLeft(directory: string) {
  await mkdir(join(directory, 'layers'), { recursive: true });
  const opaque = (width: number, height: number) => sharp({ create: { width, height, channels: 4, background: '#fff' } }).png();
  await opaque(1, 1).toFile(join(directory, 'layers/000.png'));
  await opaque(80, 50).toFile(join(directory, 'layers/001.png'));
  const base = { ...part('face/face_base', [60, 60, 140, 110], (x, y) => [x - 10, y]), texture: 'layers/001.png', textureBounds: [60, 60, 80, 50] };
  const parts = [base, part('face/eye_left', [110, 70, 130, 80], (x, y) => [x - 5, y]),
    part('face/ear_right', [50, 70, 60, 90], (x, y) => [x + 14, y]), part('face/ear_left', [140, 70, 150, 90], (x, y) => [x - 6, y])];
  await writeFile(join(directory, 'face-left.json'), JSON.stringify({ axis: 100, notes: '测试', parts }));
}

test('左右配对只换整词 left/right', () => {
  assert.equal(pairId('face/eye_left/iris'), 'face/eye_right/iris');
  assert.equal(pairId('face/ear_right'), 'face/ear_left');
  assert.equal(pairId('face/mouth'), 'face/mouth');
  assert.equal(pairId('face/leftover'), 'face/leftover');
});

test('+30 取配对图层的 −30 关于中轴的镜像', () => {
  const left = part('face/eye_left', [110, 70, 130, 80], (x, y) => [x - 5, y + 1]);
  const right = part('face/eye_right', [70, 70, 90, 80], (x, y) => [x + 3, y]);
  // The right eye turning right moves like the left eye turning left, mirrored.
  assert.deepEqual(mirrorKeyform(right, left, 100), [[75, 71], [95, 71], [75, 81], [95, 81]]);
  // A centred part without a pair mirrors its own field.
  const nose = part('face/nose', [90, 80, 110, 90], (x, y) => [x - 4, y]);
  assert.deepEqual(mirrorKeyform(nose, nose, 100), [[94, 80], [114, 80], [94, 90], [114, 90]]);
});

test('交付检查：缺 face_base 或控制点数不对时报错', () => {
  const base = part('face/face_base', [60, 60, 140, 110], (x, y) => [x, y]);
  assert.throws(() => checkFaceLeft({ axis: 100, parts: [part('face/nose', [90, 80, 110, 90], (x, y) => [x, y])] }, [200, 400]), /face_base/);
  assert.throws(() => checkFaceLeft({ axis: 100, parts: [{ ...base, keyforms: { '0': base.keyforms['0'], '-30': [] } }] }, [200, 400]), /-30/);
  assert.throws(() => checkFaceLeft({ axis: 300, parts: [base] }, [200, 400]), /axis/);
  // Hiding goes through occlusion, not fading.
  assert.throws(() => checkFaceLeft({ axis: 100, parts: [{ ...base, opacity: { '-30': 0 } }] }, [200, 400]), /不透明度/);
  const ear = part('face/ear_right', [50, 70, 60, 90], (x, y) => [x, y]);
  assert.throws(() => checkFaceLeft({ axis: 100, parts: [ear, base] }, [200, 400]), /ear_right.*之下/);
  assert.equal(checkFaceLeft({ axis: 100, parts: [base, ear] }, [200, 400]).parts.length, 2);
  assert.equal(checkFaceLeft({ axis: 100, parts: [base] }, [200, 400]).parts.length, 1);
});

test('贴图接受 agent 写的绝对路径，存为本步 layers/ 相对路径', () => {
  const task = '/runs/doll', step = '/runs/doll/nine-axis/step02_angle-x';
  assert.equal(stepTexture(step, task, 'face/nose', `${step}/layers/003.png`), 'layers/003.png');
  assert.equal(stepTexture(step, task, 'face/nose', 'nine-axis/step02_angle-x/layers/003.png'), 'layers/003.png');
  assert.equal(stepTexture(step, task, 'face/nose', 'layers/003.png'), 'layers/003.png');
  assert.throws(() => stepTexture(step, task, 'face/nose', '/elsewhere/layers/003.png'), /本步 layers/);
  assert.throws(() => stepTexture(step, task, 'face/nose', `${step}/workspace/003.png`), /本步 layers/);
});
