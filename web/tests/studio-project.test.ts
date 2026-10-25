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
import sharp from 'sharp';
import { inputFingerprint, resolveShadowInput } from '../../.agents/skills/live2d-maker/shadow/input.ts';
import { stepsFor } from '../../.agents/skills/live2d-maker/shadow/steps.ts';

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
        new URLSearchParams({ name, dir, ...override }),
    );
  const put = async (path: string, value: string | Uint8Array = "fixture") => {
    const file = join(project, path);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, value);
  };
  return { root, dir, name, project, get, put };
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
test("Project preview rejects stale directories, escaping names and symlinked outputs", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.get({ dir: f.root })).status, 409);
  assert.equal((await f.get({ name: "../outside" })).status, 400);
  await mkdir(join(f.project, "lighting"));
  const outside = join(f.root, "private.png");
  await writeFile(outside, "private");
  await symlink(outside, join(f.project, studioArtifacts.normal));
  assert.equal((await f.get()).status, 400);
});
test('Native project opening rejects a stale source and never accepts an arbitrary file path', async t => {
  const f = await fixture(t);
  await f.put(studioArtifacts.document);
  const preview = await f.get(), project = await preview.json() as any;
  const post = (overrides: Record<string, unknown>) => fetch(new URL('/api/studio/layers/open-project', preview.url), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: f.name, dir: f.dir, preview: project.previewMode,
      path: project.files.document.path, version: project.files.document.version, ...overrides }),
  });
  assert.equal((await post({ dir: f.root })).status, 409);
  assert.equal((await post({ path: '../private.kra' })).status, 409);
  assert.equal((await post({ name: '../outside' })).status, 400);
  assert.equal((await post({ preview: 'mixed' })).status, 400);
  await f.put(studioArtifacts.document, 'new revision');
  const stale = await post({});
  assert.equal(stale.status, 409);
  assert.match((await stale.json() as any).error, /工程已变化/);
  const file = join(f.project, studioArtifacts.document);
  await rm(file);
  await f.put('../private.kra');
  await symlink(join(f.dir, 'private.kra'), file);
  assert.equal((await post({})).status, 400);
});
test('physics drafts persist under their reviewed parent and cannot mask a newer delivery',async t=>{
  const f=await fixture(t),formal={kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:300,height:400}},components:[],review:{status:'accepted',configHash:'revision-a'}};
  await f.put('physics/physics.json',JSON.stringify(formal));
  const initial=await f.get(),base=new URL(initial.url).origin;
  const response=await fetch(base+'/api/studio/physics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.name,dir:f.dir,config:{...formal,review:{status:'draft',baseConfigHash:'revision-a'}}})});assert.equal(response.status,201);
  let data=await(await f.get()).json() as any;assert.equal(data.files.physics.path,'physics/physics.draft.json');assert.equal(data.physicsDraftStale,false);
  await f.put('physics/physics.json',JSON.stringify({...formal,review:{status:'accepted',configHash:'revision-b'}}));
  data=await(await f.get()).json() as any;assert.equal(data.physicsDraftStale,true);assert.equal(data.files.physics.path,'physics/physics.json');
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
test('Explicit mixed preview requires matching branch provenance and preserves production selection', async t => {
  const f = await fixture(t), hash = (value: string) => createHash('sha256').update(value).digest('hex');
  await f.put(studioArtifacts.document, 'source'); await f.put(studioArtifacts.color, 'color');
  for (const path of [studioArtifacts.normal, studioArtifacts.depth, shadowArtifacts.maskDocument, shadowArtifacts.maskColor, shadowArtifacts.bindings]) await f.put(path);
  const record = { version: 1, mode: 'mask', sourceKraHash: hash('source'), sourceColorHash: hash('color') };
  await f.put('shadow/mask/step01/source.json', JSON.stringify(record));
  await f.put(shadowArtifacts.selection, JSON.stringify(record));
  // Loose maps from an old run are never silently mixed into the current mask.
  assert.equal((await f.get({ preview: 'mixed' })).status, 400);
  await f.put('shadow/normal-depth/step01/source.json', JSON.stringify({ ...record, mode: 'normal-depth' }));
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
  // Only the new maps branch matches the updated source. The mask remains stale.
  await f.put(studioArtifacts.color, 'new color');
  await f.put('shadow/normal-depth/step01/source.json', JSON.stringify({ ...record, mode: 'normal-depth', sourceColorHash: hash('new color') }));
  await f.put(shadowArtifacts.selection, JSON.stringify({ ...record, mode: 'normal-depth', sourceColorHash: hash('new color') }));
  data = await (await f.get()).json() as any;
  assert.equal(data.maskStale, true); assert.equal(data.mapsStale, false);
  assert.equal(data.previewModes.mixed, false); assert.equal(data.files.normal.available, true);
  assert.equal((await f.get({ preview: 'mixed' })).status, 400);
});
test('Unified studio discovers pending maps, ignores legacy light files and prefers formal delivery', async t => {
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
  const input = await resolveShadowInput(f.name, f.dir, 'normal-depth');
  await f.put('shadow/normal-depth/run.json', JSON.stringify({ inputFingerprint: await inputFingerprint(input, 'normal-depth', stepsFor('normal-depth')[0].prompt) }));
  await f.put('shadow/normal-depth/step02/light.json', '{"settings":{"lightingMix":0}}');
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
  await f.put('shadow/normal-depth/step01/.completed', '');
  assert.equal((await (await f.get()).json() as any).previewReview, 'awaiting-publication');
  await f.put(shadowArtifacts.selection, JSON.stringify(record));
  await f.put(shadowArtifacts.draftNormal, 'changed');
  assert.equal((await f.get({ preview: 'mixed' })).status, 400);
  await f.put(shadowArtifacts.draftNormal, normal);
  await f.put(studioArtifacts.color, 'changed color');
  data = await (await f.get({ preview: 'normal-depth' })).json() as any;
  assert.equal(data.files.normal.available, false);
  await f.put(studioArtifacts.color, color);
  for (const path of [studioArtifacts.normal, studioArtifacts.depth]) await f.put(path);
  await f.put('shadow/normal-depth/step01/source.json', JSON.stringify({ ...record, mode: 'normal-depth' }));
  data = await (await f.get({ preview: 'mixed' })).json() as any;
  assert.equal(data.previewDraft, false); assert.equal(data.files.normal.path, studioArtifacts.normal);
});

test('frozen physics preview keeps exact maps across review-rule changes without accepting a shadow delivery', async t => {
  const f = await fixture(t), hash = (v: string) => createHash('sha256').update(v).digest('hex');
  await f.put(studioArtifacts.document, 'source'); await f.put(studioArtifacts.color, 'color');
  await f.put(shadowArtifacts.draftNormal, 'normal'); await f.put(shadowArtifacts.draftDepth, 'depth');
  await f.put('physics/physics.json', JSON.stringify({ source: { documentHash: hash('source'), colorHash: hash('color') }, components: [] }));
  await f.put('physics/source/surface-inputs.json', JSON.stringify({ version: 1, documentHash: hash('source'), maps: {
    normal: { path: shadowArtifacts.draftNormal, contentHash: hash('normal') },
    depth: { path: shadowArtifacts.draftDepth, contentHash: hash('depth') },
  } }));
  let data = await (await f.get()).json() as any;
  assert.equal(data.files.normal.available, true); assert.equal(data.files.depth.available, true);
  assert.equal(data.previewReview, 'frozen-preview-input'); assert.equal(data.previewFrozen, true);
  assert.equal(data.shadowMode, undefined);
  await f.put(shadowArtifacts.draftNormal, 'changed');
  data = await (await f.get()).json() as any;
  assert.equal(data.files.normal.available, false); assert.equal(data.files.depth.available, false);
  await f.put(shadowArtifacts.draftNormal, 'normal'); await f.put(studioArtifacts.color, 'changed');
  data = await (await f.get()).json() as any;
  assert.equal(data.files.normal.available, false);
});
