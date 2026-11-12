import '../../shared/tests/ignore-local-env.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync, strToU8 } from 'fflate';
import sharp from 'sharp';
import { KraMaterials, type MaterialExport } from '../kra-materials.ts';
import { kraContents } from '../../shadow/delivery.ts';
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

test('KRA is authoritative: stale PNG is ignored, saved KRA invalidates the shared cache with unchanged JSON', async t => {
  const root=await mkdtemp(join(tmpdir(),'nine-kra-materials-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'nine-axis/step04_angles/model/left'), kra=join(root,'shadow/step01_mask/character-shadowed.kra');
  await mkdir(join(directory,'layers'),{recursive:true}); await mkdir(join(kra,'..'),{recursive:true});
  await writeFile(kra,await kraFixture('#f00')); await writeFile(join(directory,'layers/face.png'),'stale PNG that must never be read');
  let exports=0;
  const materials=new KraMaterials(async (...args)=>{exports++;return fixtureExport(...args);});
  const input=materialFixture(), original=structuredClone(input.doc);
  const first=await materials.resolve(root,directory,input), version=await modelVersion(root,directory,input.doc,'json-version');
  const pixels=await sharp(first.textures.get('layers/face.png')!).raw().toBuffer();
  assert.deepEqual([...pixels.subarray(0,4)],[255,0,0,255]);
  assert.equal(first.doc.parts.at(-1)!.uuid,hairUuid,'KRA front hair remains above the deformed face');
  assert.equal(first.doc.parts.at(-1)!.id,'__kra__/'+hairUuid);
  assert.equal(first.doc.parts.at(-1)!.keyforms['0'][0][0],0,'unbound artwork remains static');
  await materials.resolve(root,directory,input); assert.equal(exports,1,'same KRA/bindings reuse export');
  await writeFile(kra,await kraFixture('#0f0'));
  const next=await materials.resolve(root,directory,input);
  assert.notEqual(next.sourceRevision,first.sourceRevision);
  assert.notEqual(await modelVersion(root,directory,input.doc,'json-version'),version);
  assert.deepEqual([...(await sharp(next.textures.get('layers/face.png')!).raw().toBuffer()).subarray(0,4)],[0,255,0,255]);
  assert.equal(exports,2); assert.deepEqual(input.doc,original,'hydration must not rewrite author data');
  assert.equal(await readFile(join(directory,'layers/face.png'),'utf8'),'stale PNG that must never be read');
});

test('jaw owns the edited KRA and retains geometry provenance; missing UUID never falls back to a PNG', async t => {
  const root=await mkdtemp(join(tmpdir(),'nine-kra-jaw-')); t.after(()=>rm(root,{recursive:true,force:true}));
  const directory=join(root,'nine-axis/step07_jaw-line'); await mkdir(directory,{recursive:true});
  await writeFile(join(directory,'character-nine-axis.kra'),await kraFixture('#f00'));
  const materials=new KraMaterials(fixtureExport), input=materialFixture();
  const result=await materials.resolve(root,directory,input,undefined,false);
  assert.deepEqual(result.doc.source,{document:'nine-axis/step07_jaw-line/character-nine-axis.kra',geometryDocument:input.doc.source!.document});
  assert.equal(result.doc.parts.length,1,'delivery exports do not persist static preview context');
  input.doc.parts[0].uuid='missing';
  await assert.rejects(materials.resolve(root,directory,input),/没有有效的 KRA 图层 UUID/);
});

test('fixed face branches cannot rebind KRA layers while preserving stale PNGs', async t => {
  const { checkContinuation, startContinuation }=await import('../continuation.ts');
  const { angleScale }=await import('../angles.ts');
  const upstream=materialFixture().doc as any;
  upstream.axis=6;
  for(const part of upstream.parts)part.keyforms={...part.keyforms,'-30':structuredClone(part.keyforms['0']),'30':structuredClone(part.keyforms['0'])};
  upstream.parameters=[{id:'ParamAngleX',min:-30,max:30,keys:[-30,0,30]},{id:'ParamAngleY',keys:[0]}];
  const author=startContinuation(upstream,'original','up'); author.parts[0].uuid=hairUuid;
  assert.throws(()=>checkContinuation(author,upstream,'original','up',angleScale()),/不能替换上游 KRA 图层绑定/);
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
