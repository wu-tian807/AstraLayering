import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fromTaskPath, taskRootOf, toTaskPath, toTaskPathReal, toTaskPaths } from '../task-paths.ts';
import { linkDirectory } from './link-fixture.ts';

test('任务根按结构取管线目录的父目录；更深的目录不按名字向上猜', () => {
  const runs = resolve(tmpdir(), 'runs'), root = join(runs, 'case');
  for (const directory of ['part-layering', 'raster-layering', 'clothing-part-layering', 'shadow'])
    assert.equal(taskRootOf(join(root, directory)), root);
  // A task named after a section still resolves to its own root.
  assert.equal(taskRootOf(join(runs, 'shadow/shadow')), join(runs, 'shadow'));
  // Step and workspace directories are not section directories, and a group may be named after a section:
  // callers below the section directory pass the root explicitly.
  for (const directory of ['raster-layering/step01', 'raster-layering/step01/workspace', 'shadow/step01_mask'])
    assert.equal(taskRootOf(join(root, directory)), join(root, directory));
  const other = join(runs, 'other');
  assert.equal(taskRootOf(other), other);
});

test('写出任务内用相对任务根的 POSIX 路径，任务外保持绝对；读取宽松且不越出任务根', () => {
  const runs = resolve(tmpdir(), 'runs'), root = join(runs, 'case');
  const sibling = join(runs, 'case-2/a.png'), external = join(tmpdir(), 'tools/krita/bin/krita');
  assert.equal(toTaskPath(root, join(root, 'part-layering/groups.json')), 'part-layering/groups.json');
  assert.equal(toTaskPath(root, root), '.');
  assert.equal(toTaskPath(root, sibling), sibling);
  assert.equal(toTaskPath(root, external), external);
  assert.equal(toTaskPath(root, './raster-layering//step01/x.kra'), 'raster-layering/step01/x.kra');
  assert.equal(fromTaskPath(root, 'raster-layering/step01/x.kra'), join(root, 'raster-layering/step01/x.kra'));
  // Older runs persisted absolute paths; they are still accepted as is.
  const legacy = join(runs, 'old/part-layering/groups.json');
  assert.equal(fromTaskPath(root, legacy), legacy);
  assert.throws(() => fromTaskPath(root, '../other/a.png'), Error);
  assert.deepEqual(toTaskPaths(root, { a: [join(root, 'x.png'), 'y.png', 3], b: external }),
    { a: ['x.png', 'y.png', 3], b: external });
});

test('经由符号链接到达的任务根同样写成相对路径', async t => {
  const base = await mkdtemp(join(tmpdir(), 'task-paths-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  await mkdir(join(base, 'real/case'), { recursive: true });
  await linkDirectory(join(base, 'real'), join(base, 'link'));
  assert.equal(await toTaskPathReal(join(base, 'link/case'), join(base, 'real/case/input/original.png')), 'input/original.png');
});
