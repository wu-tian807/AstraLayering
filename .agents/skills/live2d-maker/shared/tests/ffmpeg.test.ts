import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { checkFFmpeg, ffmpegCandidates, ffmpegEnvironment } from '../ffmpeg.ts';

test('Windows FFmpeg lookup preserves custom paths and finds .exe with case-insensitive Path', () => {
  assert.deepEqual(ffmpegCandidates({ ASTRA_STUDIO_FFMPEG: 'C:\\Tools With Spaces\\ffmpeg.exe', Path: 'D:\\bin' }, 'win32'), ['C:\\Tools With Spaces\\ffmpeg.exe']);
  assert.deepEqual(ffmpegCandidates({ ASTRA_STUDIO_FFMPEG: 'C:/Tools With Spaces/ffmpeg.exe' }, 'win32'), ['C:/Tools With Spaces/ffmpeg.exe']);
  assert.deepEqual(ffmpegCandidates({ Path: 'C:\\bin;D:\\media' }, 'win32'), ['C:\\bin\\ffmpeg.exe', 'D:\\media\\ffmpeg.exe']);
});

test('selected FFmpeg executes with spaces in its path; child tools inherit the path without changing the host', { skip: process.platform === 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'astra ffmpeg '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'ffmpeg');
  await writeFile(executable, '#!/usr/bin/env node\nconsole.log(process.argv.includes("-version") ? "ffmpeg version fixture-1" : process.env.ASTRA_STUDIO_FFMPEG);\n');
  await chmod(executable, 0o755);
  const checked = await checkFFmpeg(executable);
  assert.deepEqual(checked, { executable, version: 'ffmpeg version fixture-1' });
  const originalPath = process.env.PATH;
  const env = ffmpegEnvironment(executable);
  assert.equal(env.PATH.split(delimiter)[0], root);
  assert.equal(env.ASTRA_STUDIO_FFMPEG, executable);
  const result = await promisify(execFile)('ffmpeg', ['--probe'], { env });
  assert.equal(result.stdout.trim(), executable);
  assert.equal(process.env.PATH, originalPath);
  await assert.rejects(checkFFmpeg(root), /版本检查失败/);
  await assert.rejects(checkFFmpeg(process.execPath), /版本检查失败/);
});
