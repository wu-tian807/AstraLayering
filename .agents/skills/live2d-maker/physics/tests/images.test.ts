import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {imageSheet} from '../images.ts';
import {physicsEnvironment} from '../environment.ts';
test('批量看图保留每张图的原尺寸和不透明像素，不缩小皮套或贴图',async()=>{
 const first=await sharp({create:{width:17,height:23,channels:4,background:{r:31,g:97,b:211,alpha:1}}}).png().toBuffer();
 const second=await sharp({create:{width:11,height:19,channels:4,background:{r:191,g:59,b:13,alpha:1}}}).png().toBuffer();
 const original=Buffer.from(first),sheet=await imageSheet([{label:'front',bytes:first},{label:'ear',bytes:second}]);
 assert.equal(sheet.sourcePixelScale,1);assert.deepEqual(sheet.tiles.map(t=>[t.width,t.height]),[[17,23],[11,19]]);
 for(const [i,bytes]of [first,second].entries()){
  const t=sheet.tiles[i],cropped=await sharp(sheet.image).extract({left:t.left,top:t.top,width:t.width,height:t.height}).ensureAlpha().raw().toBuffer();
  assert.deepEqual(cropped,await sharp(bytes).ensureAlpha().raw().toBuffer());
 }
 assert.deepEqual(first,original);await assert.rejects(imageSheet([]),/1–16/);
});
test('物理上下文能力只作用于本管线，保留调用者环境和模型配置',()=>{
 const env={ASTRA_PHYSICS_CODEX_PATH:'/existing/patched-codex',ASTRA_PHYSICS_IMAGE_COMPACT_THRESHOLD:'32',layering_codex_path:'/ordinary/codex'};
 const before={...env},p=physicsEnvironment(env);
 assert.equal(p.codex.codexPathOverride,'/existing/patched-codex');assert.equal(p.imageCompactThreshold,32);assert.deepEqual(env,before);
 assert.throws(()=>physicsEnvironment({...env,ASTRA_PHYSICS_IMAGE_COMPACT_THRESHOLD:'0'}),/正整数/);
});
