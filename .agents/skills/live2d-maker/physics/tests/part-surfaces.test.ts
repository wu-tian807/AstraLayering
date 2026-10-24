import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractPartMaps, type LayerPixels } from '../../shared/character-render/part-maps.js';
import { buildMapSurface } from '../../shared/character-render/surface-coverage.js';
function layer(id:string,w:number,h:number,alpha:(x:number,y:number)=>number):LayerPixels {
  const rgba=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)rgba[(y*w+x)*4+3]=alpha(x,y);
  return{id,partId:id,bounds:{x:0,y:0,width:w,height:h},rgba};
}
test('part-owned samples reconstruct large hidden slopes without taking the foreground depth',()=>{
  for(const span of [64,128,256]){
    const w=span+24,h=w,cloth=layer('cloth',w,h,()=>255),hand=layer('hand',w,h,(x,y)=>x>=12&&x<span+12&&y>=12&&y<span+12?255:0);
    const normal=new Uint8ClampedArray(w*h*4),depth=new Uint8ClampedArray(normal.length);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4,front=hand.rgba[p+3];normal.set(front?[235,30,160,255]:[128,128,255,255],p);depth[p]=front?220:Math.round(30+160*x/(w-1));}
    const m=extractPartMaps(w,h,[cloth,hand],normal,depth,[buildMapSurface([hand])]).get('cloth')!;
    for(let y=12;y<span+12;y++)for(let x=12;x<span+12;x++){const p=(y*w+x)*4;assert(Math.abs(m.data[p+3]-Math.round(30+160*x/(w-1)))<=1);assert.deepEqual([...m.data.subarray(p,p+3)],[128,128,255]);assert.equal(m.confidence[p/4],0);}
    assert.equal(m.confidence[0],255);
  }
});
test('source masks and intentional finger gaps preserve receiver samples; topology is explicit',()=>{
  const foreground=layer('fingers',9,9,(x,y)=>x>=2&&x<=6&&y>=2&&y<=6&&(x===2||x===6||y===2||y===6)?255:0);
  const ordinary=buildMapSurface([foreground]),contour=buildMapSurface([foreground],{fillInterior:true});
  const at=(s:typeof ordinary,x:number,y:number)=>s.coverage[(y-s.bounds.y)*s.bounds.width+x-s.bounds.x];
  assert.equal(at(ordinary,4,4),0);assert.equal(at(contour,4,4),255);assert.equal(at(contour,1,1),0);
  const cut=layer('cut',9,9,()=>255);cut.maskedRgba=layer('mask',9,9,(x,y)=>x===4&&y===4?0:255).rgba;
  assert.equal(at(buildMapSurface([cut],{fillInterior:true,paddingPixels:2}),4,4),0);
});
