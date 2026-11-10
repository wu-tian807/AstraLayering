import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constrainHeadPoint, followHeadPointer, headPreviewAngles, headSideLimit } from '../head-motion.js';

test('display excludes side lobes while keeping neutral, cardinal and four corner poses', () => {
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) assert.deepEqual(constrainHeadPoint({ x, y }), { x, y });
  for (const y of [-.5, .5]) for (const x of [-1, 1]) assert.deepEqual(constrainHeadPoint({ x, y }), { x: x * .5, y });
  for (let i = 0; i <= 100; i++) {
    const y = -1 + i / 50;
    for (const x of [-2, -.9, .9, 2]) assert.ok(Math.abs(constrainHeadPoint({ x, y }).x) <= headSideLimit(y));
  }
});

test('pointer travel in an excluded region slides along the curve, including horizontal travel', () => {
  for (const side of [-1, 1]) for (const direction of [-1, 1]) {
    const y = direction * .2, start = { x: side * headSideLimit(y), y }, previous = { x: side * .9, y };
    const vertical = followHeadPointer({ x: previous.x, y: y + direction * .02 }, start, previous);
    assert.ok(direction * (vertical.y - y) > 0); assert.equal(Math.abs(vertical.x), headSideLimit(vertical.y));
    const horizontal = followHeadPointer({ x: previous.x + side * .01, y }, start, previous);
    assert.ok(direction * (horizontal.y - y) < 0, 'horizontal push slides toward the nearest axis endpoint along the tangent');
    assert.equal(Math.abs(horizontal.x), headSideLimit(horizontal.y));
  }
  assert.deepEqual(followHeadPointer({ x: .1, y: .1 }, { x: .5, y: .5 }, { x: 1, y: .5 }), { x: .1, y: .1 });
});

test('motion only uses axes present in the latest intermediate model', () => {
  const x = { min: -30, max: 30 }, y = { min: -25, max: 25 };
  assert.deepEqual(headPreviewAngles({ x: 1, y: 1 }, { x, y, plane: true }), { x: 30, y: 25 });
  assert.deepEqual(headPreviewAngles({ x: .5, y: .8 }, { x, y, plane: false }), { x: 0, y: 20 });
  assert.deepEqual(headPreviewAngles({ x: -.8, y: .5 }, { x, y: { min: 0, max: 0 }, plane: false }), { x: -24, y: 0 });
  assert.deepEqual(headPreviewAngles({ x: -.8, y: .5 }, { x: { min: 0, max: 0 }, y: { min: 0, max: 0 }, plane: false }), { x: 0, y: 0 });
});
