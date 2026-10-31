import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, writeFile, symlink, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from 'node:crypto';
import { createWorkbench } from "../server.ts";
import { studioArtifacts } from "../../.agents/skills/live2d-maker/shared/studio-artifacts.ts";
import { steps } from "../../.agents/skills/live2d-maker/character-assembly/steps.ts";
import { shadowArtifacts } from '../../.agents/skills/live2d-maker/shared/shadow.ts';
import { nineAxisArtifacts } from '../../.agents/skills/live2d-maker/shared/nine-axis.ts';
import sharp from 'sharp';

async function fixture(t: any) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "astra-project-"))),
    dir = join(root, "runs"),
    name = "角色",
    project = join(dir, name);
  await mkdir(project, { recursive: true });
  const server = await createWorkbench({
    defaultDir: dir,
    settingsPath: join(root, "settings.json"),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  });
  const base = "http://127.0.0.1:" + (server.address() as any).port;
  const get = (override = {}) =>
    fetch(
      base +
        "/api/studio/project?" +
        new URLSearchParams({ folder: project, ...override }),
    );
  const put = async (path: string, value: string | Uint8Array = "fixture") => {
    const file = join(project, path);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, value);
  };
  return { root, dir, name, project, base, get, put };
}
test("Project preview reads only the fixed assembly and lighting outputs; absent maps are pending", async (t) => {
  const f = await fixture(t);
  await f.put("backups/character-assembled.kra");
  await f.put("normal.png");
  await f.put("raster-layering/step01/depth.png");
  let data = (await (await f.get()).json()) as any;
  assert.equal(data.files.document.available, false);
  assert.equal(data.files.normal.available, false);
  assert.equal(data.files.depth.available, false);
  await f.put(studioArtifacts.document);
  await f.put(studioArtifacts.color);
  data = (await (await f.get()).json()) as any;
  assert.equal(data.files.document.path, studioArtifacts.document);
  assert.equal(data.files.document.available, true);
  assert.equal(data.files.normal.available, false);
  await f.put(studioArtifacts.normal, "normal");
  await f.put(studioArtifacts.depth, "depth");
  data = (await (await f.get()).json()) as any;
  assert.equal(data.files.normal.available, true);
  assert.equal(data.files.depth.available, true);
  const version = data.files.normal.version;
  await f.put(studioArtifacts.normal, "updated normal");
  assert.notEqual(
    ((await (await f.get()).json()) as any).files.normal.version,
    version,
  );
  await f.put(studioArtifacts.normal, "");
  assert.equal(
    ((await (await f.get()).json()) as any).files.normal.available,
    false,
  );
  assert.ok(
    steps[0].requiredFiles.includes(basename(studioArtifacts.document) as any),
  );
  assert.ok(
    steps[0].requiredFiles.includes(basename(studioArtifacts.color) as any),
  );
  assert.ok(
    studioArtifacts.document.startsWith(
      "character-assembly/" + steps[0].id + "/",
    ),
  );
});
test("Project preview rejects relative and symlinked folders, non-tasks outside the run directory and symlinked outputs", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.get({ folder: "runs/角色" })).status, 400);
  await symlink(f.project, join(f.root, "alias"));
  assert.equal((await f.get({ folder: join(f.root, "alias") })).status, 400);
  const plain = join(f.root, "elsewhere", "plain");
  await mkdir(plain, { recursive: true });
  assert.match(((await (await f.get({ folder: plain })).json()) as any).error, /run\.json/);
  await mkdir(join(f.project, "lighting"));
  const outside = join(f.root, "private.png");
  await writeFile(outside, "private");
  await symlink(outside, join(f.project, studioArtifacts.normal));
  assert.equal((await f.get()).status, 400);
});
test('Two shadow routes coexist: last complete selection chooses its document and pauses stale maps', async t => {
  const f = await fixture(t), hash = (value: string) => createHash('sha256').update(value).digest('hex');
  await f.put(studioArtifacts.document, 'source'); await f.put(studioArtifacts.color, 'color');
  await f.put(studioArtifacts.normal); await f.put(studioArtifacts.depth);
  await f.put(shadowArtifacts.maskDocument); await f.put(shadowArtifacts.maskColor);
  await f.put(shadowArtifacts.bindings);
  const selection = { version: 1, mode: 'mask', sourceKraHash: hash('source'), sourceColorHash: hash('color') };
  await f.put(shadowArtifacts.selection, JSON.stringify(selection));
  let data = await (await f.get()).json() as any;
  assert.equal(data.shadowMode, 'mask'); assert.equal(data.files.document.path, shadowArtifacts.maskDocument);
  assert.equal(data.files.normal.available, false); assert.equal(data.files.depth.available, false);
  await f.put(shadowArtifacts.selection, JSON.stringify({ ...selection, mode: 'normal-depth' }));
  data = await (await f.get()).json() as any;
  assert.equal(data.files.document.path, studioArtifacts.document); assert.equal(data.files.normal.available, true);
  await f.put(studioArtifacts.document, 'changed');
  data = await (await f.get()).json() as any;
  assert.equal(data.shadowStale, true); assert.equal(data.files.normal.available, false);
});
test('Explicit mixed preview requires matching mode provenance and preserves production selection', async t => {
  const f = await fixture(t), hash = (value: string) => createHash('sha256').update(value).digest('hex');
  await f.put(studioArtifacts.document, 'source'); await f.put(studioArtifacts.color, 'color');
  for (const path of [studioArtifacts.normal, studioArtifacts.depth, shadowArtifacts.maskDocument, shadowArtifacts.maskColor, shadowArtifacts.bindings]) await f.put(path);
  const record = { version: 1, mode: 'mask', sourceKraHash: hash('source'), sourceColorHash: hash('color') };
  await f.put('shadow/step01_mask/source.json', JSON.stringify(record));
  await f.put(shadowArtifacts.selection, JSON.stringify(record));
  // Loose maps from an old run are never silently mixed into the current mask.
  assert.equal((await f.get({ preview: 'mixed' })).status, 400);
  await f.put('shadow/step01_normal-depth/source.json', JSON.stringify({ ...record, mode: 'normal-depth' }));
  let data = await (await f.get({ preview: 'mixed' })).json() as any;
  assert.equal(data.shadowMode, 'mask'); assert.equal(data.previewMode, 'mixed');
  const unified = await (await f.get()).json() as any;
  assert.equal(unified.previewMode, 'mixed');
  assert.deepEqual(unified.files, data.files);
  const maskEntry = await (await f.get({ preview: 'mask' })).json() as any;
  assert.equal(maskEntry.files.document.path, shadowArtifacts.maskDocument);
  assert.equal(maskEntry.files.normal.available, true);
  assert.equal(maskEntry.files.depth.available, true);
  assert.equal(data.files.document.path, shadowArtifacts.maskDocument);
  assert.equal(data.files.bindings.available, true); assert.equal(data.files.normal.available, true);
  data = await (await f.get({ preview: 'normal-depth' })).json() as any;
  assert.equal(data.files.document.path, studioArtifacts.document); assert.equal(data.files.bindings.available, false);
  assert.equal((await f.get({ preview: '../private' })).status, 400);
  // Only the new maps match the updated source. The mask remains stale.
  await f.put(studioArtifacts.color, 'new color');
  await f.put('shadow/step01_normal-depth/source.json', JSON.stringify({ ...record, mode: 'normal-depth', sourceColorHash: hash('new color') }));
  await f.put(shadowArtifacts.selection, JSON.stringify({ ...record, mode: 'normal-depth', sourceColorHash: hash('new color') }));
  data = await (await f.get()).json() as any;
  assert.equal(data.maskStale, true); assert.equal(data.mapsStale, false);
  assert.equal(data.previewModes.mixed, false); assert.equal(data.files.normal.available, true);
  assert.equal((await f.get({ preview: 'mixed' })).status, 400);
});
test('Unified studio discovers pending maps and prefers formal delivery', async t => {
  const f = await fixture(t), hash = (v: string | Uint8Array) => createHash('sha256').update(v).digest('hex');
  const color = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#cbaa99' } }).png().toBuffer();
  const normal = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 128, g: 128, b: 255 } } }).png().toBuffer();
  const depth = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#999999' } }).png().toBuffer();
  await f.put(studioArtifacts.document, 'source'); await f.put(studioArtifacts.color, color);
  await f.put('part-layering/references/simplified-subject.png', color);
  for (const path of [shadowArtifacts.maskDocument, shadowArtifacts.maskColor, shadowArtifacts.bindings]) await f.put(path);
  const record = { version: 1, mode: 'mask', sourceKraHash: hash('source'), sourceColorHash: hash(color) };
  await f.put(shadowArtifacts.selection, JSON.stringify(record));
  await f.put(shadowArtifacts.draftNormal, normal); await f.put(shadowArtifacts.draftDepth, depth);
  for (const section of ['part-layering', 'clothing-part-layering']) {
    await f.put(section + '/groups.json', '{"groups":[]}'); await f.put(section + '/occlusion.json', '{"layers":[]}');
  }
  const maps = '';
  await f.put('character-assembly/step01/.completed', '');
  await f.put('shadow/run.json', '{}'); await f.put('shadow/step01_normal-depth/.running', maps);
  let data = await (await f.get()).json() as any;
  assert.equal(data.previewMode, 'mixed'); assert.equal(data.previewDraft, true); assert.equal(data.files.normal.available, true);
  data = await (await f.get({ preview: 'mixed' })).json() as any;
  assert.equal(data.previewDraft, true); assert.equal(data.shadowMode, 'mask');
  assert.equal(data.previewReview, 'draft-awaiting-visual-review'); assert.equal(data.files.normal.path, shadowArtifacts.draftNormal);
  assert.equal(Object.hasOwn(data, 'lightSettings'), false);
  assert.equal(Object.hasOwn(data, 'lightStale'), false);
  assert.equal(data.files.document.path, shadowArtifacts.maskDocument);
  await rm(join(f.project, shadowArtifacts.selection));
  data = await (await f.get()).json() as any;
  assert.equal(data.previewDraft, true); assert.equal(data.files.normal.available, true);
  await rm(join(f.project, 'shadow/step01_normal-depth/.running')); await f.put('shadow/step01_normal-depth/.completed', maps);
  assert.equal((await (await f.get()).json() as any).previewReview, 'awaiting-publication');
  await f.put(shadowArtifacts.selection, JSON.stringify(record));
  await f.put(shadowArtifacts.draftNormal, 'changed');
  assert.equal((await f.get({ preview: 'mixed' })).status, 400);
  await f.put(shadowArtifacts.draftNormal, normal);
  for (const path of [studioArtifacts.normal, studioArtifacts.depth]) await f.put(path);
  await f.put('shadow/step01_normal-depth/source.json', JSON.stringify({ ...record, mode: 'normal-depth' }));
  data = await (await f.get({ preview: 'mixed' })).json() as any;
  assert.equal(data.previewDraft, false); assert.equal(data.files.normal.path, studioArtifacts.normal);
});
test('Project reports the head nine-axis document and prefers its KRA while the source is unchanged', async (t) => {
  const f = await fixture(t), a = nineAxisArtifacts;
  let data = (await (await f.get()).json()) as any;
  assert.deepEqual([data.nineAxis.path, data.nineAxis.available], [a.headDeformers, false]);
  await f.put(a.headDeformers, '{}');
  data = (await (await f.get()).json()) as any;
  assert.equal(data.nineAxis.available, true);
  // The deformers and their numbered layer textures read through the studio route.
  await f.put('nine-axis/step02_head/layers/005.png', 'layer');
  const read = (path: string) => fetch(f.base + '/studio-artifact?' + new URLSearchParams({ folder: f.project, path }));
  assert.equal(await (await read('nine-axis/step02_head/layers/005.png')).text(), 'layer');
  assert.equal((await read('nine-axis/step02_head/layers/../source.json')).status, 400);
  await f.put(studioArtifacts.document, 'kra'); await f.put(studioArtifacts.color, 'png');
  await f.put(a.headDocument, 'nine kra'); await f.put(a.headColor, 'nine png');
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  await f.put(a.headSource, JSON.stringify({ version: 1, sourceDocument: studioArtifacts.document, sourceColor: studioArtifacts.color, sourceKraHash: hash('kra'), sourceColorHash: hash('png'), updatedAt: 'x' }));
  data = (await (await f.get()).json()) as any;
  assert.deepEqual([data.files.document.path, data.files.color.path, data.nineAxisDocument], [a.headDocument, a.headColor, true]);
  // A changed source KRA falls back to it and marks the nine-axis KRA stale.
  await f.put(studioArtifacts.document, 'kra 2');
  data = (await (await f.get()).json()) as any;
  assert.deepEqual([data.files.document.path, data.nineAxisDocument, data.nineAxisStale], [studioArtifacts.document, false, true]);
});
test('An imported task folder outside the run directory opens; only studio outputs are readable', async t => {
  const f = await fixture(t), folder = join(f.root, 'elsewhere', 'imported');
  await mkdir(join(folder, 'character-assembly/step01'), { recursive: true });
  await writeFile(join(folder, 'run.json'), JSON.stringify({ version: 1, sections: {}, jobs: 1, status: 'completed', from: 'part-layering', to: 'shadow' }));
  await writeFile(join(folder, studioArtifacts.document), 'document');
  await writeFile(join(folder, studioArtifacts.color), 'color');
  await writeFile(join(folder, 'run.md'), 'private');
  const response = await f.get({ folder });
  assert.equal(response.status, 200);
  const data = await response.json() as any;
  assert.equal(data.folder, folder); assert.equal(data.name, 'imported'); assert.equal(data.inDirectory, false);
  assert.equal(data.files.document.available, true);
  const read = (path: string) => fetch(f.base + '/studio-artifact?' + new URLSearchParams({ folder, path }));
  assert.equal(await (await read(studioArtifacts.document)).text(), 'document');
  for (const path of ['run.json', 'run.md', '../imported/run.json']) assert.equal((await read(path)).status, 400);
  const listed = await (await f.get()).json() as any;
  assert.equal(listed.inDirectory, true);
});
test('The project list reads task folders under a chosen base folder, the run directory by default', async t => {
  const f = await fixture(t), base = join(f.root, 'elsewhere');
  await mkdir(join(base, 'task'), { recursive: true }); await mkdir(join(base, 'notes'));
  await mkdir(join(base, '.hidden')); await writeFile(join(base, '.hidden', 'run.json'), '{}');
  await writeFile(join(base, 'task', 'run.json'), '{}');
  await writeFile(join(f.project, 'run.json'), '{}');
  const list = (dir?: string) => fetch(f.base + '/api/studio/projects?' + new URLSearchParams(dir ? { dir } : {}));
  const fallback = await (await list()).json() as any;
  assert.equal(fallback.directory, f.dir); assert.equal(fallback.default, f.dir);
  assert.deepEqual(fallback.projects.map((project: any) => project.folder), [f.project]);
  const chosen = await (await list(base)).json() as any;
  assert.equal(chosen.directory, base);
  assert.deepEqual(chosen.projects, [{ name: 'task', folder: join(base, 'task'), displayName: 'task' }]);
  const missing = await list(join(f.root, 'gone'));
  assert.equal(missing.status, 404); assert.equal((await missing.json() as any).missing, true);
  assert.equal((await list('relative')).status, 400);
});
