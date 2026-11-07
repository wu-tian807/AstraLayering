import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, readFile, writeFile, symlink, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from 'node:crypto';
import { createWorkbench } from "../server.ts";
import { studioArtifacts } from "../../.agents/skills/live2d-maker/shared/studio-artifacts.ts";
import { steps } from "../../.agents/skills/live2d-maker/character-assembly/steps.ts";
import { shadowArtifacts } from '../../.agents/skills/live2d-maker/shared/shadow.ts';
import { nineAxisArtifacts, legacyNineAxisArtifacts } from '../../.agents/skills/live2d-maker/shared/nine-axis.ts';
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
  const completeAngles = async () => {
    for (const group of ['left', 'up', 'down']) {
      await put(`nine-axis/step02_angles/${group}/.completed`, '');
      const path = `nine-axis/step02_angles/${group}/deformers.json`;
      try { await readFile(join(project, path)); } catch { await put(path, '{}'); }
    }
    await put('nine-axis/step02_angles/.completed', '');
  };
  return { root, dir, name, project, base, get, put, completeAngles };
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
  assert.deepEqual([data.nineAxis.path, data.nineAxis.available], [a.angleXDeformers, false]);
  await f.put(a.headDeformers, '{}');
  await f.completeAngles();
  data = (await (await f.get()).json()) as any;
  assert.equal(data.nineAxis.available, true);
  // The deformers and their numbered layer textures read through the studio route.
  await f.put('nine-axis/step02_angles/layers/005.png', 'layer');
  const read = (path: string) => fetch(f.base + '/studio-artifact?' + new URLSearchParams({ folder: f.project, path }));
  assert.equal(await (await read('nine-axis/step02_angles/layers/005.png')).text(), 'layer');
  assert.equal((await read('nine-axis/step02_angles/layers/../source.json')).status, 400);
  await f.put(studioArtifacts.document, 'kra'); await f.put(studioArtifacts.color, 'png');
  await f.put(a.headDocument, 'nine kra'); await f.put(a.headColor, 'nine png');
  data = (await (await f.get()).json()) as any;
  assert.deepEqual([data.files.document.path, data.files.color.path, data.nineAxisDocument], [a.headDocument, a.headColor, true]);
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

test('Nine-axis preview prefers the merge over independent siblings, then corners and jaw', async t => {
  const f = await fixture(t), a = nineAxisArtifacts;
  const order = [a.angleXDeformers, a.headDeformers, a.angleXYDeformers, a.jawLineDeformers];
  for (const path of order) {
    await f.put(path, '{}');
    if (path === a.headDeformers) await f.completeAngles();
    const data = await (await f.get()).json() as any;
    assert.deepEqual([data.nineAxis.path, data.nineAxis.available], [path, true]);
  }
  // Re-saving an earlier step must not make it win over a completed later one.
  await f.put(a.angleUpDeformers, 'newer up');
  assert.equal((await (await f.get()).json() as any).nineAxis.path, a.jawLineDeformers);
  await f.put(a.jawLineDeformers, '');
  assert.equal((await (await f.get()).json() as any).nineAxis.path, a.angleXYDeformers);
  await rm(join(f.project, a.angleXYDeformers));
  assert.equal((await (await f.get()).json() as any).nineAxis.path, a.headDeformers);
  await rm(join(f.project, a.headDeformers));
  assert.equal((await (await f.get()).json() as any).nineAxis.path, a.angleXDeformers);
});

test('Nine-axis links select independent children; Y selects the parent merge', async t => {
  const f = await fixture(t), a = nineAxisArtifacts;
  const stages = { x: a.angleXDeformers, up: a.angleUpDeformers, down: a.angleDownDeformers,
    y: a.headDeformers, xy: a.angleXYDeformers, jaw: a.jawLineDeformers };
  for (const path of new Set(Object.values(stages))) await f.put(path, path);
  await f.completeAngles();
  for (const [nineStage, path] of Object.entries(stages)) {
    const response = await f.get({ nineStage });
    assert.equal(response.status, 200);
    const data = await response.json() as any;
    assert.deepEqual([data.nineAxis.path, data.nineAxis.available], [path, true]);
    assert.equal(await readFile(join(f.project, path), 'utf8'), path, 'Selecting a stage leaves its author document intact');
  }
  await rm(join(f.project, a.angleDownDeformers));
  for (const nineStage of ['down']) {
    const data = await (await f.get({ nineStage })).json() as any;
    assert.deepEqual([data.nineAxis.path, data.nineAxis.available], [a.angleDownDeformers, false], 'Explicit stages never silently fall back to up or jaw');
  }
  assert.equal((await (await f.get({ nineStage: 'up' })).json() as any).nineAxis.available, true);
  await rm(join(f.project, a.headDeformers));
  const missingMerge = await (await f.get({ nineStage: 'y' })).json() as any;
  assert.deepEqual([missingMerge.nineAxis.path, missingMerge.nineAxis.available], [a.headDeformers, false]);
  for (const nineStage of ['invalid', 'toString', '__proto__', 'nine-axis/step04_angle-up/deformers.json']) {
    const response = await f.get({ nineStage });
    assert.equal(response.status, 400);
    assert.match((await response.json() as any).error, /x、up、down、y、xy 或 jaw/);
  }
});

test('Existing model folders keep their legacy preview routes without rewriting files', async t => {
  const f = await fixture(t), a = legacyNineAxisArtifacts;
  for (const path of [a.headDeformers, a.angleUpDeformers, a.angleDownDeformers, a.angleXYDeformers, a.jawLineDeformers]) {
    await f.put(path, path);
    assert.equal((await (await f.get()).json() as any).nineAxis.path, path);
  }
  for (const [nineStage, path] of Object.entries({ x: a.headDeformers, up: a.angleUpDeformers, down: a.angleDownDeformers,
    y: a.angleDownDeformers, xy: a.angleXYDeformers, jaw: a.jawLineDeformers })) {
    const project = await (await f.get({ nineStage })).json() as any;
    assert.deepEqual([project.nineAxis.path, project.nineAxis.layout], [path, 'legacy']);
    assert.equal(await readFile(join(f.project, path), 'utf8'), path);
  }
  // An empty new source group selects the new contract, never an old result.
  await mkdir(join(f.project, 'nine-axis/step02_angles/up'), { recursive: true });
  const project = await (await f.get({ nineStage: 'up' })).json() as any;
  assert.deepEqual([project.nineAxis.path, project.nineAxis.available], [nineAxisArtifacts.angleUpDeformers, false]);
});

test('a retried child blocks stale merged, XY, jaw and KRA previews until parent merge completes again', async t => {
  const f = await fixture(t), a = nineAxisArtifacts;
  for (const path of [a.headDeformers, a.angleXYDeformers, a.jawLineDeformers]) await f.put(path, 'old merged doc');
  await f.completeAngles();
  assert.equal((await (await f.get()).json() as any).nineAxis.path, a.jawLineDeformers);
  await rm(join(f.project, 'nine-axis/step02_angles/up'), { recursive: true });
  await rm(join(f.project, 'nine-axis/step02_angles/.completed'));
  await f.put('nine-axis/step02_angles/.running', '');
  const project = await (await f.get()).json() as any;
  assert.equal(project.nineAxis.path, a.angleXDeformers);
  assert.equal(project.nineAxis.mergeComplete, false);
  for (const nineStage of ['y', 'xy', 'jaw']) assert.equal((await (await f.get({ nineStage })).json() as any).nineAxis.available, false);
  await f.put('nine-axis/step02_angles/up/deformers.json', '{}');
  await f.put('nine-axis/step02_angles/up/.completed', '');
  assert.equal((await (await f.get({ nineStage: 'y' })).json() as any).nineAxis.available, false);
  await rm(join(f.project, 'nine-axis/step02_angles/.running')); await f.put('nine-axis/step02_angles/.completed', '');
  assert.equal((await (await f.get({ nineStage: 'y' })).json() as any).nineAxis.available, true);
});

test('Nested nine-axis artifact whitelist rejects extra nesting, foreign groups and symlinks', async t => {
  const f = await fixture(t);
  const read = (path: string) => fetch(f.base + '/studio-artifact?' + new URLSearchParams({ folder: f.project, path }));
  for (const group of ['neutral', 'left', 'up', 'down', 'merged']) {
    for (const suffix of ['deformers.json', 'layers/part-01.png']) {
      const path = `nine-axis/step02_angles/${group}/${suffix}`;
      await f.put(path, path);
      assert.equal(await (await read(path)).text(), path);
    }
  }
  for (const path of ['nine-axis/step02_angles/unknown/deformers.json', 'nine-axis/step02_angles/up/source.json',
    'nine-axis/step02_angles/up/layers/sub/a.png', 'nine-axis/step02_angles/up/layers/a.jpg',
    'nine-axis/step02_angles/up/layers/../deformers.json', 'nine-axis/step02_angles/left/../up/deformers.json']) {
    assert.equal((await read(path)).status, 400, path);
  }
  await f.put('private.png', 'private');
  await symlink(join(f.project, 'private.png'), join(f.project, 'nine-axis/step02_angles/up/layers/link.png'));
  assert.equal((await read('nine-axis/step02_angles/up/layers/link.png')).status, 400);
  for (const path of [nineAxisArtifacts.turnLeftVideo, nineAxisArtifacts.turnUpVideo, nineAxisArtifacts.turnDownVideo,
    nineAxisArtifacts.turnLeft, nineAxisArtifacts.turnUp, nineAxisArtifacts.turnDown, nineAxisArtifacts.turnRecord]) {
    await f.put(path, path);
    assert.equal(await (await read(path)).text(), path);
  }
});

test('Studio reads textures only from the explicit X, up, down, corners and jaw layer directories', async t => {
  const f = await fixture(t), a = nineAxisArtifacts;
  const read = (path: string) => fetch(f.base + '/studio-artifact?' + new URLSearchParams({ folder: f.project, path }));
  for (const path of [a.headDeformers, a.angleXDeformers, a.angleUpDeformers, a.angleDownDeformers, a.angleXYDeformers, a.jawLineDeformers]) {
    await f.put(path, 'deformers');
    assert.equal(await (await read(path)).text(), 'deformers');
    for (const name of ['005', 'jaw_line', 'eye-left']) {
      const texture = path.replace('deformers.json', `layers/${name}.png`);
      await f.put(texture, texture);
      assert.equal(await (await read(texture)).text(), texture);
    }
  }
  for (const path of ['nine-axis/step05_angle-y/layers/005.png', 'nine-axis/step03_angle-x/layers/005.png',
    'nine-axis/step08_jaw-line/layers/jaw_line.png', 'nine-axis/step03_video-y/layers/005.png',
    'nine-axis/step09_private/layers/005.png', 'nine-axis/step04_angle-up/private.png',
    'nine-axis/step05_angle-down/layers/nested/005.png', 'nine-axis/step04_angle-up/layers/005.jpg',
    'nine-axis/step04_angle-up/source.json', 'nine-axis/step05_angle-down/notes.md', 'private.png']) {
    await f.put(path, 'private');
    assert.equal((await read(path)).status, 400, path);
  }
  assert.equal((await read('nine-axis/step04_angle-up/layers/../source.json')).status, 400);
});

test('Studio saves up and down keyforms independently while retaining X, earlier Y poses and save guards', async t => {
  const f = await fixture(t), a = nineAxisArtifacts;
  const rest = [[0, 0], [10, 0], [0, 10], [10, 10]];
  const save = (value: any) => fetch(f.base + '/api/studio/nine-axis/save', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder: f.project, ...value }),
  });
  for (const [nineStage, path, yKeys, y] of [
    ['up', a.angleUpDeformers, [0, 25], 25], ['down', a.angleDownDeformers, [-25, 0, 25], -25],
  ] as const) {
    const doc = { version: 2, kind: 'head-nine-axis', levels: [{ id: 'face', includes: ['face'] }], deformers: [],
      parameters: [{ id: 'ParamAngleX', keys: [-30, 0, 30] }, { id: 'ParamAngleY', keys: [...yKeys] }],
      parts: [{ id: 'face', level: 'face', texture: 'layers/005.png', textureBounds: [0, 0, 10, 10], bbox: [0, 0, 10, 10], cols: 1, rows: 1,
        keyforms: { '-30': rest.map(([x, y]) => [x - 2, y]), '0': rest, '30': rest.map(([x, y]) => [x + 2, y]) },
        keyformsY: Object.fromEntries(yKeys.map(key => [String(key), rest.map(([x, y]) => [x, y - key / 5])])) }] };
    await f.put(path, JSON.stringify(doc));
    const before = await (await f.get({ nineStage })).json() as any;
    const edited = structuredClone(doc);
    edited.parts[0].keyformsY[String(y)] = rest.map(([x, py]) => [x + 1, py - y / 5]);
    const response = await save({ path, version: before.nineAxis.version, document: edited });
    assert.equal(response.status, 200);
    const saved = await response.json() as any;
    assert.equal(saved.path, path);
    assert.deepEqual(JSON.parse(await readFile(join(f.project, path), 'utf8')), edited);
    assert.deepEqual(edited.parts[0].keyforms, doc.parts[0].keyforms, 'Y edits retain every X endpoint');
    if (nineStage === 'down') assert.deepEqual(edited.parts[0].keyformsY['25'], doc.parts[0].keyformsY['25'], 'Down edits retain up');
    const stale = await save({ path, version: before.nineAxis.version, document: doc });
    assert.equal(stale.status, 400);
    assert.match((await stale.json() as any).error, /已变化/);
    const changed = structuredClone(edited); changed.parts[0].texture = 'layers/other.png';
    const rejected = await save({ path, version: saved.version, document: changed });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json() as any).error, /不能替换图层/);
    assert.deepEqual(JSON.parse(await readFile(join(f.project, path), 'utf8')), edited);
  }
  for (const path of ['nine-axis/step05_angle-y/deformers.json', 'nine-axis/step04_angle-up/source.json',
    'nine-axis/step05_angle-down/other.json', 'nine-axis/step09_private/deformers.json', 'run.json']) {
    await f.put(path, 'private');
    const response = await save({ path, version: 'anything', document: {} });
    assert.equal(response.status, 400);
    assert.match((await response.json() as any).error, /只能保存工作台的九轴文件/);
    assert.equal(await readFile(join(f.project, path), 'utf8'), 'private');
  }
});
