const test = require('node:test');
const assert = require('node:assert/strict');
const geometry = require('../svg-geometry.js');

test('standalone geometry expands source commands and subdivides cubic/closing segments', () => {
  const relative = 'm1 2 3 4 h5 v-2 q1 2 3 4 t4 6 c1 2 3 4 5 6 s7 8 9 10 z';
  assert.equal(geometry.normalizePath(relative, 1), 'M 1 2 L 4 6 L 9 6 L 9 4 Q 10 6 12 8 Q 14 10 16 14 C 17 16 19 18 21 20 C 23 22 28 28 30 30 Z');
  const split = geometry.normalizePath('M0 0C0 4 4 4 4 0Z', 2);
  assert.equal(split, 'M 0 0 C 0 2 1 3 2 3 C 3 3 4 2 4 0 L 2 0 Z');
  assert.deepEqual(geometry.pathData(split), {
    commands: ['M', 'C', 'C', 'L', 'Z'],
    values: [0, 0, 0, 2, 1, 3, 2, 3, 3, 3, 4, 2, 4, 0, 2, 0],
    ends: [2, 8, 14, 16, 16],
  });
  assert.throws(() => geometry.normalizePath('M0 0 A2 2 0 0 0 3 3'), /convert arcs to cubic/);
  assert.throws(() => geometry.pathData('M 0 0 3 3'), /路径命令必须显式写出/);
});
