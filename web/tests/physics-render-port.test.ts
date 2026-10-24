import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { componentDefaults } from '../studio/component-physics-schema.js';
import { simulate } from '../../.agents/skills/live2d-maker/physics/evidence.ts';
import { renderFrames } from '../../.agents/skills/live2d-maker/physics/render.ts';

for(const kind of ['cloth','strand','transparent-edge'])test(kind+' workflow renderer loads complete recorded mesh states with all surface channels',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'astra-physics-render-'));
  try{
    const source=join(directory,'source'),evidence=join(directory,'evidence');await mkdir(source);
    const component={id:'cloth',name:'cloth',kind:kind==='transparent-edge'?'cloth':kind,enabled:true,priority:'primary',sourcePartIds:['cloth'],layerRefs:[{uuid:'cloth',contentHash:'a'.repeat(64)}],supports:[{id:'root',at:[32,8]}],...componentDefaults('cloth'),authoring:{freeLength:72,fixedRegions:[[[6,8],[58,8],[58,20],[6,20]]],transitionPixels:12,contour:[[6,8],[58,8],[58,88],[6,88]],subdivisions:0,controlGrid:kind==='strand'?undefined:[3,5],centerline:[[32,8],[32,20],[32,40],[32,60],[32,80]],widths:[52,52,52,52,52]}};
    const config={kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:64,height:96}},components:[component]};
    const rgba=new Uint8Array(52*80*4);
    for(let y=0;y<80;y++)for(let x=0;x<52;x++){
      const q=(y*52+x)*4,edge=kind==='transparent-edge'&&(x===0||x===51||y===0||y===79);
      rgba.set(edge?[0,0,0,0]:kind==='transparent-edge'?[255,255,255,255]:[48,128,192,255],q);
    }
    const png=await sharp(rgba,{raw:{width:52,height:80,channels:4}}).png().toBuffer();
    for(const file of ['part-0-original.png','part-0-masked.png'])await writeFile(join(source,file),png);
    await sharp({create:{width:64,height:96,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:png,left:6,top:8}]).png().toFile(join(source,'color.png'));
    for(const[kind,color]of [['normal',{r:128,g:128,b:255,alpha:1}],['depth',{r:180,g:180,b:180,alpha:1}]] as const)await sharp({create:{width:64,height:96,channels:4,background:color}}).png().toFile(join(source,kind+'.png'));
    await writeFile(join(source,'catalog.json'),JSON.stringify({canvas:{width:64,height:96},layers:[{id:'cloth',uuid:'cloth',contentHash:'a'.repeat(64),visible:true,opacity:255,bounds:{x:6,y:8,width:52,height:80},original:'part-0-original.png',masked:'part-0-masked.png'}]}));
    await simulate(config,evidence);
    const requests=[{test:'tip-impulse',steps:[0,72],modes:['color','lit','normal','depth']}];
    if(kind==='cloth')requests.push({test:'support-reverse',steps:[0,192,240],modes:['color','lit']});
    const files=await renderFrames(config,source,evidence,requests);
    assert.equal(files.filter(f=>!f.component).length,kind==='cloth'?14:8);
    const manifest=JSON.parse(await readFile(join(evidence,'manifest.json'),'utf8'));
    assert.equal(manifest.stateRendering,'recorded-complete-mesh-pose-velocity-stats');assert.equal(manifest.coverage.render,'partial');
    assert.equal(manifest.inputState,'recorded-sourcePose-and-airflow');assert.equal(manifest.replayVerification,undefined);
    if(kind==='cloth'){
      const original=await readFile(join(evidence,files[0].path));
      await sharp({create:{width:64,height:96,channels:4,background:{r:160,g:160,b:160,alpha:1}}}).png().toFile(join(source,'depth.png'));
      await renderFrames(config,source,evidence,[{test:'tip-impulse',steps:[72],modes:['color']}]);
      const archives=await readdir(join(evidence,'render-backups'));assert.equal(archives.length,1);
      assert.deepEqual(await readFile(join(evidence,'render-backups',archives[0],files[0].path)),original,'old rendered evidence must remain intact');
      const current=JSON.parse(await readFile(join(evidence,'frames.json'),'utf8'));
      assert(current.every((f:any)=>f.renderHash!==manifest.renderHash),'previous render versions cannot qualify as current evidence');
    }
    if(kind==='transparent-edge'){
      const frame=files.find(f=>f.mode==='color'&&f.step===72&&!f.component),data=await sharp(join(evidence,frame.path)).ensureAlpha().raw().toBuffer();let count=0;
      for(let q=0;q<data.length;q+=4)if(data[q+3]>=16&&data[q+3]<=230){count++;assert(Math.min(data[q],data[q+1],data[q+2])>245,'transparent black texels must not darken a moving white edge');}
      assert(count>0,'the test must actually contain subpixel transparent edges');
    }
  }finally{await rm(directory,{recursive:true,force:true});}
});
