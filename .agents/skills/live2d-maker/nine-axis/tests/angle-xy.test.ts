import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { checkCornerReferences, corners } from '../angle-xy.ts';
import { fileHash } from '../turn.ts';

test('corner completion retains agent frame choices and rejects a changed reference or trace without refitting',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'astra-corner-references-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await mkdir(join(directory,'frames'));
  const frames:Record<string,any>={},videos:Record<string,any>={};
  for(const [i,corner] of corners.entries()) {
    await writeFile(join(directory,`${corner}.mp4`),`video-${corner}`);
    await sharp({create:{width:16,height:16,channels:4,background:i?'#eee':'#888'}}).png().toFile(join(directory,`${corner}.png`));
    await writeFile(join(directory,'frames',`${corner}.png`),await readFile(join(directory,`${corner}.png`)));
    await writeFile(join(directory,`${corner}-face-trace.json`),JSON.stringify({target:corner}));
    const videoSha256=await fileHash(join(directory,`${corner}.mp4`)),sha256=await fileHash(join(directory,`${corner}.png`));
    frames[corner]={video:`${corner}.mp4`,path:`${corner}.png`,frameIndex:3+i*9,videoSha256,sha256,reason:'Observed matching perspective'};
    videos[corner]={sha256:videoSha256};
    await writeFile(join(directory,`${corner}-fit-report.json`),JSON.stringify({referenceSha256:sha256,traceSha256:await fileHash(join(directory,`${corner}-face-trace.json`))}));
  }
  const save=()=>writeFile(join(directory,'selected-frames.json'),JSON.stringify({version:1,frames}));
  await save();await writeFile(join(directory,'videos.json'),JSON.stringify(videos));
  await checkCornerReferences(directory,16);
  assert.deepEqual(corners.map(c=>frames[c].frameIndex),[3,12]);
  // Native tool paths may be absolute, but must still refer to this step's
  // original selected files. Checking never rewrites selection metadata.
  frames['left-up'].video=join(directory,'left-up.mp4');frames['left-up'].path=join(directory,'left-up.png');await save();
  const absoluteSelection=await readFile(join(directory,'selected-frames.json'));
  await checkCornerReferences(directory,16);
  assert.deepEqual(await readFile(join(directory,'selected-frames.json')),absoluteSelection);
  frames['left-up'].path=join(directory,'..','left-up.png');await save();
  await assert.rejects(checkCornerReferences(directory,16),/缺少本步选帧路径/);
  frames['left-up'].path=join(directory,'left-up.png');await save();
  const reference=await readFile(join(directory,'left-up.png'));
  await sharp({create:{width:16,height:16,channels:4,background:'#f00'}}).png().toFile(join(directory,'left-up.png'));
  frames['left-up'].sha256=await fileHash(join(directory,'left-up.png'));await save();
  await assert.rejects(checkCornerReferences(directory,16),/必须重新拟合/);
  await writeFile(join(directory,'left-up.png'),reference);frames['left-up'].sha256=await fileHash(join(directory,'left-up.png'));await save();
  await writeFile(join(directory,'left-down-face-trace.json'),'{"target":"changed contour"}');
  await assert.rejects(checkCornerReferences(directory,16),/必须重新拟合/);
});
