import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const tree = source.slice(source.indexOf('function configTree()'), source.indexOf('function configPage()'));
// Paths are relative to the knowledge directory, as /api/config/files lists them.
const files = [
  'shared/prompts/nano-solid-background.md',
  'shared/tools/submit_review/description.md',
  'shared/tools/inspect_layers/description.md',
  'shadow/prompts/mask.md',
  'shadow/tools/inspect_shadow_mask/description.md',
  'head-nine-axis/prompts/face-contour.md',
  'head-nine-axis/tools/edit_nine_axis/description.md',
  'head-nine-axis/tools/view_nine_axis/description.md',
  'head-nine-axis/step08_hair/prompts/前发制作.md',
  'part-layering/prompts/groups/prompt.md',
  'part-layering/prompts/groups/face/prompt.md',
  'part-layering/prompts/groups/face/eye_left/prompt.md',
  'part-layering/step08_initial/agent.json',
  'part-layering/references/pose.png',
  'README.md',
];
function render(file: string, configFilter = '', configFolders = new Map<string, boolean>()): string {
  return runInNewContext(tree + '\nconfigTree();', {
    configFiles: files,
    state: { file, configFilter, configFolders },
    icon: () => '',
    esc: (value: string) => value,
    mediaKind: (path: string) => /\.png$/.test(path) ? 'image' : 'text',
  });
}

test('every knowledge file is listed, media included', () => {
  const html = render('README.md');
  for (const file of files) assert.ok(html.includes(`data-config-file="${file}"`), file);
});

// The opening tag of the folder holding `path`.
const folder = (html: string, path: string) => html.match(new RegExp(`<details class="config-(?:folder|family)" data-config-folder="${path}"[^>]*>`))?.[0] ?? '';

test('tools are folders holding their description', () => {
  const html = render('README.md');
  // shadow/tools holds one tool, so the two share a row; shared/tools holds two.
  assert.match(html, /<span>tools \/ inspect_shadow_mask<\/span>/);
  assert.match(html, /<span>tools<\/span>[\s\S]*<span>submit_review<\/span>/);
});

test('head-only prompts and tools belong to the head nine-axis family, distinct from common priors', () => {
  const selected = 'head-nine-axis/tools/edit_nine_axis/description.md', html = render(selected);
  const head = html.indexOf('data-config-folder="head-nine-axis"'), shared = html.indexOf('data-config-folder="shared"');
  assert.ok(head >= 0 && shared > head); assert.match(html, /头部九轴/);
  for (const file of files.filter(file => file.startsWith('head-nine-axis/'))) {
    const row = html.indexOf(`data-config-file="${file}"`);
    assert.ok(row > head && row < shared, file);
  }
  assert.match(folder(html, 'head-nine-axis'), / open>$/);
  const search = render(selected, 'edit_nine_axis');
  assert.match(search, /头部九轴/); assert.doesNotMatch(search, /公共先验/);
});

test('same-named prompts sit in their own nested folders; a folder with one folder shares its row', () => {
  const html = render('part-layering/prompts/groups/face/eye_left/prompt.md');
  // prompts holds only groups: one row.
  assert.match(html, /<span>prompts \/ groups<\/span>/);
  assert.ok(html.indexOf('data-config-folder="part-layering/prompts/groups/face"') < html.indexOf('data-config-folder="part-layering/prompts/groups/face/eye_left"'));
  // Every folder around the selected file is open, the others are not.
  for (const path of ['part-layering', 'part-layering/prompts/groups', 'part-layering/prompts/groups/face', 'part-layering/prompts/groups/face/eye_left'])
    assert.match(folder(html, path), / open>$/, path);
  assert.doesNotMatch(folder(html, 'shared/tools/submit_review'), / open>$/);
  assert.match(folder(html, '.'), /data-config-folder="\."/);
  assert.match(html, /其他文件/);
});

test('a folder the user opened or closed keeps that state; a search opens everything', () => {
  const selected = 'part-layering/prompts/groups/face/eye_left/prompt.md';
  const html = render(selected, '', new Map([['part-layering/prompts/groups/face', false], ['shared/tools/submit_review', true]]));
  assert.doesNotMatch(folder(html, 'part-layering/prompts/groups/face'), / open>$/);
  assert.match(folder(html, 'shared/tools/submit_review'), / open>$/);
  const searched = render(selected, 'mask', new Map([['shadow/tools/inspect_shadow_mask', false]]));
  assert.match(folder(searched, 'shadow/tools/inspect_shadow_mask'), / open>$/);
  assert.ok(!searched.includes('data-config-file="README.md"'));
});
