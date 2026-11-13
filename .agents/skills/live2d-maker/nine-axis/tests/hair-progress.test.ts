import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hairRounds, readHairProgress, completeHairRound, upgradeHairProgress } from '../hair-progress.ts';
import { readStep } from '../../shared/step-chain.ts';

for(let length=0;length<=3;length++)test(`v1 progress with ${length} accepted rounds upgrades without replacing artwork or session`,async t=>{
  const dir=await mkdtemp(join(tmpdir(),'hair-progress-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const oldRounds=hairRounds.slice(0,3),completed=oldRounds.slice(0,length);
  await writeFile(join(dir,'hair-progress.json'),JSON.stringify({version:1,completed,next:[...oldRounds,'done'][length]}));
  await writeFile(join(dir,length===3?'.completed':'.running'),'');
  await writeFile(join(dir,'artwork.kra'),'saved artwork');await writeFile(join(dir,'session.json'),'saved session');
  const expected={version:2,completed,next:hairRounds[length]};
  assert.deepEqual(await readHairProgress(dir),expected);
  await upgradeHairProgress(dir);assert.deepEqual(JSON.parse(await readFile(join(dir,'hair-progress.json'),'utf8')),expected);
  assert.equal((await readStep(dir)).status,'running');
  assert.equal(await readFile(join(dir,'artwork.kra'),'utf8'),'saved artwork');
  assert.equal(await readFile(join(dir,'session.json'),'utf8'),'saved session');
  const bytes=await readFile(join(dir,'hair-progress.json'));await upgradeHairProgress(dir);
  assert.deepEqual(await readFile(join(dir,'hair-progress.json')),bytes);
});

test('migration interrupted after moving the marker resumes the remaining round',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'hair-progress-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'hair-progress.json'),JSON.stringify({version:1,completed:['front','side','back'],next:'done'}));
  await writeFile(join(dir,'.running'),'');await upgradeHairProgress(dir);
  assert.equal((await readHairProgress(dir)).next,'remaining');
  await completeHairRound(dir,'remaining');assert.equal((await readHairProgress(dir)).next,'done');
});

test('invalid progress or contradictory old completion does not get reset or reopened',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'hair-progress-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'.completed'),'');
  for(const value of [{version:2,completed:['front','side','back'],next:'done'},{version:1,completed:['side'],next:'back'}]){
    await writeFile(join(dir,'hair-progress.json'),JSON.stringify(value));
    await assert.rejects(upgradeHairProgress(dir),/进度无效/);assert.equal((await readStep(dir)).status,'completed');
  }
  await writeFile(join(dir,'hair-progress.json'),JSON.stringify({version:1,completed:['front'],next:'side'}));
  await assert.rejects(upgradeHairProgress(dir),/完成标记与旧轮次进度不一致/);
  assert.equal((await readStep(dir)).status,'completed');
});

test('a missing outer marker cannot discard accepted round products during migration',async t=>{
  const dir=await mkdtemp(join(tmpdir(),'hair-progress-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,'hair-progress.json'),JSON.stringify({version:1,completed:['front','side','back'],next:'done'}));
  await writeFile(join(dir,'artwork.kra'),'accepted artwork');
  await assert.rejects(upgradeHairProgress(dir),/步骤标记缺失/);
  assert.equal(await readFile(join(dir,'artwork.kra'),'utf8'),'accepted artwork');
});
