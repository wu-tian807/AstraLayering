import '../../shared/tests/ignore-local-env.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import { bindKraDocument, checkNativeProtection, KraMaterials, KRA_MATERIAL_CACHE_VERSION, nativeMaterialExport, type MaterialExport, type PaintStack } from '../kra-materials.ts';
import { kraContents, kraLayers } from '../../shadow/delivery.ts';
import { SectionKrita } from '../../shared/krita/section-krita.ts';
import { createNineAxisViewTool } from '../view-tool.ts';
import { modelVersion } from '../source.ts';
import type { Built } from '../head.ts';

const faceUuid = '11111111-1111-1111-1111-111111111111', hairUuid = '22222222-2222-2222-2222-222222222222';
const xml = `<DOC><IMAGE><layers><layer uuid="{${hairUuid}}" name="hair/bangs" nodetype="paintlayer" visible="1"/><layer uuid="{${faceUuid}}" name="face/face_base" nodetype="paintlayer" visible="1"/></layers></IMAGE></DOC>`;
export const kraFixture = async (colour: string) => zipSync({ 'maindoc.xml': strToU8(xml), 'mergedimage.png': await sharp({ create: { width: 12, height: 12, channels: 4, background: colour } }).png().toBuffer() });
export const materialFixture = (): Built => ({ doc: { version: 2, kind: 'head-nine-axis', canvas: [20,20],
  source: { document: 'shadow/step01_mask/character-shadowed.kra' }, levels: [{ id: 'face', includes: ['face'] }],
  deformers: [], parts: [{ id: 'face/face_base', uuid: faceUuid, texture: 'layers/face.png', textureBounds: [0,0,12,12],
    level: 'face', bbox: [0,0,12,12], cols: 1, rows: 1, keyforms: { '0': [[0,0],[12,0],[0,12],[12,12]] } }] }, textures: new Map() });
export const fixtureExport: MaterialExport = async (document, directory, rows) => {
  const colour = kraContents(await readFile(document)).merged;
  return Promise.all(rows.map(async row => {
    const bounds = row.bounds ?? [0,0,12,12] as [number,number,number,number];
    await sharp(colour).resize(bounds[2],bounds[3]).png().toFile(join(directory,row.texture));
    return { ...row, bounds };
  }));
};

test('preparation UUID identities survive arbitrary native layer names and model aliases',async t=>{
  const root=await mkdtemp(join(tmpdir(),'nine-native-identity-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'nine-axis/step08_hair'),kra=join(root,'shadow/step01_mask/character-shadowed.kra');
  await mkdir(directory,{recursive:true});await mkdir(join(kra,'..'),{recursive:true});
  await mkdir(join(root,'nine-axis/step01_preparation'),{recursive:true});
  await writeFile(join(root,'nine-axis/step01_preparation/head_parts_manifest.json'),JSON.stringify({
    parts:[{uuid:faceUuid,id:'face/face_base',partId:'character:face/face_base',scope:'face'}],
    referenceLayers:[{uuid:hairUuid,id:'hair/bangs',partId:'character:hair/bangs',scope:'hair'}],
  }));
  await writeFile(kra,zipSync({'maindoc.xml':strToU8(xml.replace('hair/bangs','renamed in Krita').replace('face/face_base','another display label')),'mergedimage.png':await sharp({create:{width:12,height:12,channels:4,background:'#f00'}}).png().toBuffer()}));
  const input=materialFixture().doc,part={...structuredClone(input.parts[0]),id:'arbitrary paint alias',uuid:hairUuid,level:'accessory' as const,partId:'character:head_accessories/fake'};
  input.parts.push(part);
  const bound=await bindKraDocument(root,input);
  assert.equal(bound.parts[1].partId,'character:hair/bangs');assert.equal(bound.parts[1].level,'hair');
  assert.equal(bound.parts[0].partId,'character:face/face_base');
  assert.equal(input.parts[1].partId,'character:head_accessories/fake','binding normalizes a clone');
});

test('KRA is authoritative: stale PNG is ignored, saved KRA invalidates the shared cache with unchanged JSON', async t => {
  const root=await mkdtemp(join(tmpdir(),'nine-kra-materials-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'nine-axis/step04_angles/model/left'), kra=join(root,'shadow/step01_mask/character-shadowed.kra');
  await mkdir(join(directory,'layers'),{recursive:true}); await mkdir(join(kra,'..'),{recursive:true});
  await writeFile(kra,await kraFixture('#f00')); await writeFile(join(directory,'layers/face.png'),'stale PNG that must never be read');
  let exports=0;
  const materials=new KraMaterials(async (...args)=>{exports++;return fixtureExport(...args);});
  const input=materialFixture(), original=structuredClone(input.doc);
  const first=await materials.resolve(root,directory,input), version=await modelVersion(root,input.doc,'json-version');
  const pixels=await sharp(first.textures.get('layers/face.png')!).raw().toBuffer();
  assert.deepEqual([...pixels.subarray(0,4)],[255,0,0,255]);
  assert.equal(first.doc.parts.at(-1)!.uuid,hairUuid,'KRA front hair remains above the deformed face');
  assert.equal(first.doc.parts.at(-1)!.id,'__kra__/'+hairUuid);
  assert.equal(first.doc.parts.at(-1)!.keyforms['0'][0][0],0,'unbound artwork remains static');
  await materials.resolve(root,directory,input); assert.equal(exports,1,'same KRA/bindings reuse export');
  await writeFile(kra,await kraFixture('#0f0'));
  const next=await materials.resolve(root,directory,input);
  assert.notEqual(next.sourceRevision,first.sourceRevision);
  assert.notEqual(await modelVersion(root,input.doc,'json-version'),version);
  assert.deepEqual([...(await sharp(next.textures.get('layers/face.png')!).raw().toBuffer()).subarray(0,4)],[0,255,0,255]);
  assert.equal(exports,2); assert.deepEqual(input.doc,original,'hydration must not rewrite author data');
  assert.equal(await readFile(join(directory,'layers/face.png'),'utf8'),'stale PNG that must never be read');
});

test('jaw owns the edited KRA and retains geometry provenance; missing UUID never falls back to a PNG', async t => {
  const root=await mkdtemp(join(tmpdir(),'nine-kra-jaw-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'nine-axis/step07_jaw-line'); await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'character-nine-axis.kra'),await kraFixture('#f00'));
  const materials=new KraMaterials(fixtureExport), input=materialFixture();
  await assert.rejects(materials.resolve(root,directory,input), { code: 'ENOENT' });
  const source = {document:'nine-axis/step07_jaw-line/character-nine-axis.kra',geometryDocument:input.doc.source!.document};
  input.doc.source = source;
  const result=await materials.resolve(root,directory,input,undefined,false);
  assert.deepEqual(result.doc.source,source);
  assert.equal(result.doc.parts.length,1,'delivery exports do not persist static preview context');
  input.doc.parts[0].uuid='missing';
  await assert.rejects(materials.resolve(root,directory,input),/没有有效的 KRA 图层 UUID/);
});

test('saved KRA order reaches the shared stack without rewriting arrays, including same-UUID slices', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-studio-foreground-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const directory = join(root, 'nine-axis/step08_hair');
  const input = materialFixture(), kra = join(root, input.doc.source!.document);
  const bodyUuid = '33333333-3333-3333-3333-333333333333';
  const backUuid = '44444444-4444-4444-4444-444444444444';
  const paint = (id: string, name: string) => `<layer uuid="{${id}}" name="${name}" nodetype="paintlayer" visible="1"/>`;
  const front = paint(hairUuid, 'hair/front_long_hair'), face = paint(faceUuid, 'face/face_base');
  const body = paint(bodyUuid, 'dress_bodice'), back = paint(backUuid, 'hair/back_hair');
  await mkdir(directory, { recursive: true });
  await mkdir(join(kra, '..'), { recursive: true });
  const merged = kraContents(await kraFixture('#f00')).merged;
  const saveOrder = (content: string) => writeFile(kra, zipSync({
    'maindoc.xml': strToU8(`<DOC><IMAGE><layers>${content}</layers></IMAGE></DOC>`), 'mergedimage.png': merged }));
  await saveOrder(front + face + body + back);
  const head = input.doc.parts[0];
  input.doc.parts = [
    { ...structuredClone(head), id: 'hair/back_hair', uuid: backUuid, texture: 'layers/back.png', level: 'hair' },
    { ...structuredClone(head), id: 'hair/front_long_hair', uuid: hairUuid, texture: 'layers/front.png', level: 'hair' },
    { ...structuredClone(head), id: 'hair/front_long_hair/a', uuid: hairUuid, texture: 'layers/front.png', level: 'hair' },
    { ...structuredClone(head), id: 'neck', uuid: undefined, material: 'transparent', texture: undefined },
    head,
  ];
  input.doc.levels.push({ id: 'hair', includes: ['face', 'hair'] });

  const materials = new KraMaterials(fixtureExport);
  const built = await materials.resolve(root, directory, input, undefined, 'studio');
  assert.deepEqual(built.paintStack!.map(layer => layer.id), [backUuid, bodyUuid, faceUuid, hairUuid]);
  const frontSlot = built.paintStack!.at(-1)!;
  assert.ok('parts' in frontSlot);
  assert.deepEqual(frontSlot.parts, ['hair/front_long_hair', 'hair/front_long_hair/a']);
  assert.ok(built.doc.parts.some(part => part.id === 'neck'));
  assert.ok(built.paintStack!.every(layer => !('parts' in layer) || !layer.parts.includes('neck')));
  assert.deepEqual(built.doc.parts.map(part => part.id), input.doc.parts.map(part => part.id));
  await saveOrder(body + back + front + face);
  const next = await materials.resolve(root, directory, input, undefined, 'studio');
  const preview = await materials.resolve(root, directory, input);
  assert.notEqual(next.sourceRevision, built.sourceRevision);
  assert.deepEqual(next.paintStack!.map(layer => layer.id), [faceUuid, hairUuid, backUuid, bodyUuid]);
  assert.deepEqual(preview.paintStack!.map(layer => layer.id), [faceUuid, hairUuid, backUuid]);
  await saveOrder(body + back + front.replace('visible="1"', 'visible="0"') + face);
  const hidden = await materials.resolve(root, directory, input);
  assert.equal(hidden.paintStack!.find(layer => layer.id === hairUuid)?.visible, false);
  assert.ok(hidden.doc.parts.some(part => part.uuid === hairUuid), 'a hidden KRA layer still binds its geometry');
});

test('KRA protection allows an owned layer to move across fixed layers, preserving fixed paint and order', () => {
  const built = materialFixture(), digests = { face: 'f', hair: 'h', body: 'b' };
  const before = { ...built, nativeProtection: { order: ['face', 'hair', 'body'], digests } };
  const after = (order: string[], paints = digests) => ({ ...built, nativeProtection: { order, digests: paints } });
  const editable = new Set(['hair']);
  assert.doesNotThrow(() => checkNativeProtection(before, after(['hair', 'face', 'body'], { ...digests, hair: 'new' }), editable));
  assert.throws(() => checkNativeProtection(before, after(['body', 'face', 'hair']), editable), /相对顺序/);
  assert.throws(() => checkNativeProtection(before, after(['face', 'hair', 'body'], { ...digests, body: 'new' }), editable), /原始像素/);
});

test('exports never reuse a cache from the old ancestor-projection contract', async t => {
  const root = await mkdtemp(join(tmpdir(), 'nine-cache-revision-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = materialFixture(), kra = join(root, input.doc.source!.document);
  const bytes = Buffer.from(await kraFixture('#f00'));
  await mkdir(join(kra, '..'), { recursive: true });
  await writeFile(kra, bytes);
  const sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const cacheRoot = join(root, '.cache/nine-axis-materials');
  let calls = 0;
  const materials = new KraMaterials(async (document, dir, rows, shadows) => {
    calls++;
    const previous = join(cacheRoot, sha(JSON.stringify({ version: KRA_MATERIAL_CACHE_VERSION - 1, revision: sha(bytes), rows, shadows })));
    await mkdir(previous, { recursive: true });
    const stale = await fixtureExport(document, previous, rows, shadows);
    await writeFile(join(previous, 'materials.json'), JSON.stringify(stale));
    return fixtureExport(document, dir, rows, shadows);
  });
  const first = await materials.resolve(root, root, input, undefined, false);
  await rm(join(first.textures.get('layers/face.png')!, '..'), { recursive: true, force: true });
  await materials.resolve(root, root, input, undefined, false);
  assert.equal(calls, 2);
});

test('native KRA leaves and masks composite like Krita mergedimage', async t => {
  const executable = process.env.ASTRA_TEST_KRITA;
  if (!executable) { t.skip('set ASTRA_TEST_KRITA to run the native exporter'); return; }
  const root = await mkdtemp(join(tmpdir(), 'nine-native-composition-'));
  t.after(() => rm(root, { recursive: true, force: true, maxRetries: 3 }));
  const file = join(root, 'fixture.kra'), bytes = await readFile(new URL('./fixtures/paint-stack.kra', import.meta.url));
  await writeFile(file, bytes);
  const reference = kraContents(bytes), layers = kraLayers(reference.xml);
  const byName = new Map([...layers].map(([id, layer]) => [layer.name, id]));
  const part = (id: string, name: string, x: number, w: number) => ({
    ...structuredClone(materialFixture().doc.parts[0]), id, uuid: byName.get(name), texture: undefined,
    textureBounds: [x, 2, w, 12], bbox: [x, 2, x + w, 14], keyforms: { '0': [[x, 2], [x + w, 2], [x, 14], [x + w, 14]] },
  });
  const input = materialFixture();
  input.doc.canvas = [32, 16]; input.doc.source = { document: 'fixture.kra' };
  input.doc.levels.push({ id: 'hair', includes: ['face', 'hair'] });
  input.doc.parts = [part('face/face_base', 'face/face_base', 1, 6), part('hair/bangs-b', 'hair/bangs', 12, 5),
    part('face/cheek', 'face/cheek', 4, 3), part('hair/bangs-a', 'hair/bangs', 8, 6)];
  const krita = new SectionKrita({ section: join(root, 'native'), krita: executable });
  await krita.reserve();
  try {
    const materials = new KraMaterials(nativeMaterialExport(async () => krita));
    const built = await materials.resolve(root, root, input, undefined, 'studio', true);
    const signal = new AbortController().signal, options = { crop: [0, 0, 32, 16], level: 'hair' };
    const view = async (paintStack: PaintStack) => {
      const tool = createNineAxisViewTool(root, join(root, 'observations'), async () => ({ ...built, paintStack }));
      const result = await tool.execute(options, signal);
      const item = result.contentItems[0];
      assert.ok(item.type === 'inputText');
      return sharp(JSON.parse(item.text).savedPath).removeAlpha().raw().toBuffer();
    };
    const [actual, checker, expected] = await Promise.all([
      view(built.paintStack!), view([]), sharp(reference.merged).ensureAlpha().raw().toBuffer(),
    ]);
    for (const x of [2, 5, 9, 12, 13, 16, 21, 24, 28, 30]) {
      const i = 8 * 32 + x, alpha = expected[i * 4 + 3] / 255;
      for (let c = 0; c < 3; c++) {
        const rendered = actual[i * 3 + c], native = expected[i * 4 + c] * alpha + checker[i * 3 + c] * (1 - alpha);
        assert.ok(Math.abs(rendered - native) <= 2, `x=${x} channel=${c}: ${rendered} vs Krita ${native}`);
      }
    }
  } finally { await krita.release(); }
});

test('fixed face branches cannot rebind KRA layers while preserving stale PNGs', async t => {
  const { checkContinuation, startContinuation }=await import('../continuation.ts');
  const { angleScale }=await import('../angles.ts');
  const upstream=materialFixture().doc as any;
  upstream.axis=6;
  for(const part of upstream.parts)part.keyforms={...part.keyforms,'-30':structuredClone(part.keyforms['0']),'30':structuredClone(part.keyforms['0'])};
  upstream.parameters=[{id:'ParamAngleX',min:-30,max:30,keys:[-30,0,30]},{id:'ParamAngleY',keys:[0]}];
  const author=startContinuation(upstream,'up'); author.parts[0].uuid=hairUuid;
  assert.throws(()=>checkContinuation(author,upstream,'up',angleScale()),/不能替换上游 KRA 图层绑定/);
});

test('existing hair keyforms and parents survive KRA hydration instead of becoming static references', async t => {
  const root=await mkdtemp(join(tmpdir(),'nine-kra-existing-hair-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const stage=join(root,'nine-axis/step08_hair'),kra=join(root,'shadow/step01_mask/character-shadowed.kra');
  await mkdir(stage,{recursive:true});await mkdir(join(kra,'..'),{recursive:true});await writeFile(kra,await kraFixture('#f00'));
  const input=materialFixture(),part=structuredClone(input.doc.parts[0]);
  part.id='hair/bangs';delete part.uuid;part.level='hair';part.parent='hair-root';
  part.texture='layers/bangs.png';part.keyforms['-30']=part.keyforms['0'].map(([x,y])=>[x-5,y]);
  input.doc.parts.push(part);
  input.doc.deformers.push({id:'hair-root',level:'hair',cols:1,rows:1,bbox:[0,0,12,12],keyforms:{'0':structuredClone(part.keyforms['0']),'-30':part.keyforms['0'].map(([x,y])=>[x-2,y])}});
  input.doc.levels.push({id:'hair',includes:['face','hair']});
  const result=await new KraMaterials(fixtureExport).resolve(root,stage,input);
  const resolved=result.doc.parts.find(p=>p.id==='hair/bangs')!;
  assert.deepEqual(resolved.keyforms,part.keyforms);assert.equal(resolved.parent,'hair-root');assert.deepEqual(result.doc.deformers,input.doc.deformers);
  assert.equal(resolved.uuid,hairUuid);assert.equal(result.doc.parts.filter(p=>p.uuid===hairUuid).length,1);
  assert.ok(!result.doc.parts.some(p=>p.id==='__kra__/'+hairUuid));
});

test('a native UUID model re-renders after deleting its entire derived cache without stage PNGs',async t=>{
  const root=await mkdtemp(join(tmpdir(),'nine-uuid-only-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=materialFixture();delete input.doc.parts[0].texture;
  const directory=join(root,'nine-axis/step04_angles/model/left'),kra=join(root,input.doc.source!.document);
  await mkdir(directory,{recursive:true});await mkdir(join(kra,'..'),{recursive:true});await writeFile(kra,await kraFixture('#f00'));
  const materials=new KraMaterials(fixtureExport);
  const render=async()=>{const built=await materials.resolve(root,directory,input,undefined,false);return sharp(built.textures.get(built.doc.parts[0].texture!)!).ensureAlpha().raw().toBuffer();};
  const first=await render();await rm(join(root,'.cache'),{recursive:true});
  assert.deepEqual(await render(),first);assert.equal(input.doc.parts[0].texture,undefined);
});

test('edited artwork may use a new UUID while immutable axis sources keep their original binding',async t=>{
  const root=await mkdtemp(join(tmpdir(),'nine-source-uuid-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const input=materialFixture(),original=structuredClone(input.doc),fresh='33333333-3333-3333-3333-333333333333';
  original.source={document:'original.kra'};
  input.doc.source={document:'nine-axis/step07_jaw-line/character-nine-axis.kra',geometryDocument:'original.kra'};
  input.doc.parts[0].uuid=fresh;
  input.doc.axisSources=['x','up','down'].map(axis=>({axis:axis as any,doc:structuredClone(original)}));
  const directory=join(root,'nine-axis/step07_jaw-line');await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'character-nine-axis.kra'),zipSync({'maindoc.xml':strToU8(xml.replaceAll(faceUuid,fresh)),'mergedimage.png':kraContents(await kraFixture('#f00')).merged}));
  const built=await new KraMaterials(fixtureExport).resolve(root,directory,input,undefined,false);
  assert.equal(built.doc.parts[0].uuid,fresh);
  assert.ok(built.doc.axisSources!.every(axis=>axis.doc.parts[0].uuid===faceUuid));
});
