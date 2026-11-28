import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fromTaskPath, taskRootOf, toTaskPath, toTaskPathReal, toTaskPaths } from '../task-paths.ts';

test('任务根按结构取管线目录的父目录；更深的目录不按名字向上猜', () => {
  const root = '/runs/case';
  for (const directory of ['part-layering', 'raster-layering', 'clothing-part-layering', 'shadow'])
    assert.equal(taskRootOf(join(root, directory)), root);
  // A task named after a section still resolves to its own root.
  assert.equal(taskRootOf('/runs/shadow/shadow'), '/runs/shadow');
  // Step and workspace directories are not section directories, and a group may be named after a section:
  // callers below the section directory pass the root explicitly.
  for (const directory of ['raster-layering/step01', 'raster-layering/step01/workspace', 'shadow/step01_mask'])
    assert.equal(taskRootOf(join(root, directory)), join(root, directory));
  assert.equal(taskRootOf('/tmp/other'), '/tmp/other');
});

test('写出任务内用相对任务根的 POSIX 路径，任务外保持绝对；读取宽松且不越出任务根', () => {
  const root = '/runs/case';
  assert.equal(toTaskPath(root, '/runs/case/part-layering/groups.json'), 'part-layering/groups.json');
  assert.equal(toTaskPath(root, '/runs/case'), '.');
  assert.equal(toTaskPath(root, '/runs/case-2/a.png'), '/runs/case-2/a.png');
  assert.equal(toTaskPath(root, '/opt/krita/bin/krita'), '/opt/krita/bin/krita');
  assert.equal(toTaskPath(root, './raster-layering//step01/x.kra'), 'raster-layering/step01/x.kra');
  assert.equal(fromTaskPath(root, 'raster-layering/step01/x.kra'), '/runs/case/raster-layering/step01/x.kra');
  // Older runs persisted absolute paths; they are still accepted as is.
  assert.equal(fromTaskPath(root, '/runs/old/part-layering/groups.json'), '/runs/old/part-layering/groups.json');
  assert.throws(() => fromTaskPath(root, '../other/a.png'), /任务根/);
  assert.deepEqual(toTaskPaths(root, { a: ['/runs/case/x.png', 'y.png', 3], b: '/etc/hosts' }),
    { a: ['x.png', 'y.png', 3], b: '/etc/hosts' });
});

test('经由符号链接到达的任务根同样写成相对路径', async t => {
  const base = await mkdtemp(join(tmpdir(), 'task-paths-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  await mkdir(join(base, 'real/case'), { recursive: true });
  await symlink(join(base, 'real'), join(base, 'link'));
  assert.equal(await toTaskPathReal(join(base, 'link/case'), join(base, 'real/case/input/original.png')), 'input/original.png');
});
