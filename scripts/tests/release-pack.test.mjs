import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { packRelease } from '../release-pack.mjs';

const project = fileURLToPath(new URL('../../', import.meta.url));
const attributes = readFileSync(join(project, '.gitattributes'), 'utf8');
const prefix = 'AstraLayering-v0.1.0/';

function fixture(t, { excludePreviewer = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'astra-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = {
    'package.json': '{"name":"astra-layering-web","version":"0.1.0"}\n',
    'CHANGELOG.md': '## v0.1.0\n',
    '.gitattributes': excludePreviewer ? attributes : attributes.replace('/svg-previewer export-ignore', ''),
    'start-workbench.sh': '#!/bin/sh\n', 'web/server.ts': '// tagged entry point\n',
    '.agents/skills/live2d-maker/SKILL.md': '# Skill\n',
    'demos/pink-doll/run.json': '{"archive":true}\n', 'demos/other/run.json': '{}\n',
    'demos/pink-doll/character-assembly/step01/composite.png': 'tagged preview bytes\n',
    'svg-previewer/part-preview.html': '<!doctype html>\n',
    'web/tests/sample.test.ts': 'web test\n',
    '.agents/skills/live2d-maker/shared/tests/sample.test.ts': 'workflow test\n',
    'scripts/start-workbench.test.mjs': 'launcher test\n',
    'scripts/tests/sample.test.mjs': 'release test\n',
    'scripts/experiments/demo.mjs': 'experiment\n',
    'scripts/start-workbench.mjs': 'launcher\n',
    '.agents/skills/live2d-maker/workflow/run.ts': 'workflow entry\n',
    'archive/old.md': 'history\n', 'rigging/old.md': 'research\n',
    'tutorial/old.md': 'tutorial\n', 'sam_veirfy/old.md': 'experiment\n',
    'LICENSE': 'license\n', 'COPYING': 'copying\n',
  };
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), content);
  }
  const git = (...args) => execFileSync('git', ['-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid',
    '-c', 'commit.gpgsign=false', '-c', `core.hooksPath=${join(root, 'no-hooks')}`, ...args], { cwd: root, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.eol', 'lf');
  git('add', '.'); git('update-index', '--chmod=+x', 'start-workbench.sh');
  git('commit', '-qm', 'release'); git('tag', 'v0.1.0');
  return root;
}

test('the tagged release places Pink Doll in the default .run directory and excludes demos and research', t => {
  const root = fixture(t);
  writeFileSync(join(root, 'web/server.ts'), '// uncommitted change\n');
  mkdirSync(join(root, '.run/private'), { recursive: true });
  writeFileSync(join(root, '.run/private/run.json'), 'local task\n');
  writeFileSync(join(root, 'demos/pink-doll/run.json'), 'uncommitted example\n');
  const result = packRelease({ root, tag: 'v0.1.0' });
  const files = unzipSync(readFileSync(result.output));
  assert.equal(new TextDecoder().decode(files[prefix + 'web/server.ts']), '// tagged entry point\n');
  assert.equal(new TextDecoder().decode(files[prefix + '.run/pink-doll/run.json']), '{"archive":true}\n');
  assert.equal(new TextDecoder().decode(files[prefix + '.run/pink-doll/character-assembly/step01/composite.png']), 'tagged preview bytes\n');
  assert.equal(readFileSync(join(root, '.run/private/run.json'), 'utf8'), 'local task\n');
  assert.equal(readFileSync(join(root, 'demos/pink-doll/run.json'), 'utf8'), 'uncommitted example\n');
  assert.equal(Object.keys(files).some(name => name.startsWith(prefix + '.run/private/')), false);
  assert.ok(files[prefix + '.agents/skills/live2d-maker/SKILL.md']);
  assert.ok(files[prefix + '.agents/skills/live2d-maker/workflow/run.ts']);
  assert.ok(files[prefix + 'scripts/start-workbench.mjs']);
  assert.equal(Object.keys(files).some(name => /(?:\/tests\/|\.test\.mjs$|\/scripts\/experiments\/)/.test(name)), false);
  assert.equal(Object.keys(files).some(name => /^AstraLayering-v0\.1\.0\/(svg-previewer|archive|rigging|tutorial|sam_veirfy)\//.test(name)), false);
  assert.equal(Object.keys(files).some(name => name.startsWith(prefix + 'demos/')), false);
  // Git archive retains the executable bit while moving only the example tree.
  const zip = readFileSync(result.output), central = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let offset = zip.indexOf(central), launcherMode;
  while (offset >= 0 && zip.subarray(offset, offset + 4).equals(central)) {
    const length = zip.readUInt16LE(offset + 28);
    if (zip.subarray(offset + 46, offset + 46 + length).toString() === prefix + 'start-workbench.sh') launcherMode = zip.readUInt32LE(offset + 38) >>> 16;
    offset += 46 + length + zip.readUInt16LE(offset + 30) + zip.readUInt16LE(offset + 32);
  }
  assert.equal(launcherMode & 0o111, 0o111);
});

test('packaging rejects svg-previewer when its archive exclusion is missing', t => {
  const root = fixture(t, { excludePreviewer: false });
  assert.throws(() => packRelease({ root, tag: 'v0.1.0' }), /发布包含有应排除的文件：.*svg-previewer\//);
});

test('packaging succeeds with Node and Git when no unzip command is available', t => {
  const root = fixture(t), emptyPath = join(root, 'empty-bin'); mkdirSync(emptyPath);
  const gitName = process.platform === 'win32' ? 'git.exe' : 'git';
  const gitCommand = (process.env.PATH ?? '').split(delimiter).map(path => join(path, gitName)).find(path => existsSync(path));
  assert.ok(gitCommand, 'Git is required for release packaging');
  const module = new URL('../release-pack.mjs', import.meta.url).href;
  const code = `import { packRelease } from ${JSON.stringify(module)}; console.log(JSON.stringify(packRelease(${JSON.stringify({ root, tag: 'v0.1.0', gitCommand })})));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    cwd: root, env: { ...process.env, PATH: emptyPath }, encoding: 'utf8',
  }));
  assert.ok(result.files > 0);
  assert.ok(unzipSync(readFileSync(result.output))[prefix + '.run/pink-doll/run.json']);
});
