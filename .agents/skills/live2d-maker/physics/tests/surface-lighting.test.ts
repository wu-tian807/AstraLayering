import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractPartMaps} from '../../shared/character-render/part-maps.js';
import {surfaceLightingMaps} from '../../shared/character-render/surface-lighting.js';

const layer=(id:string,path:string,x:number,y:number,w:number,h:number)=>({id,partId:path,partPath:path,bounds:{x,y,width:w,height:h},rgba:new Uint8ClampedArray(w*h*4).fill(255)});
test('shallow paint layers share the enclosing source field, while raised and unrelated parts keep theirs',()=>{
 const w=40,h=30,base=layer('base','avatar:head/base',0,0,w,h),paint=layer('paint','avatar:head/details/paint',4,4,8,8),raised=layer('raised','avatar:head/details/jewel',16,4,8,8),unrelated=layer('other','outfit:collar/print',28,4,8,8);
 const normal=new Uint8ClampedArray(w*h*4),depth=new Uint8ClampedArray(normal.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(y*w+x)*4;normal.set([128,128,255,255],p);depth.set([100,100,100,255],p);}
 for(const l of [paint,raised,unrelated])for(let y=0;y<8;y++)for(let x=0;x<8;x++){const p=((l.bounds.y+y)*w+l.bounds.x+x)*4;normal.set([160,128,240,255],p);const d=l===raised?200:108;depth.set([d,d,d,255],p);}
 const originalN=normal.slice(),originalD=depth.slice(),layers=[base,paint,raised,unrelated],maps=extractPartMaps(w,h,layers,normal,depth);
 assert.equal(maps.get('paint')!.surfaceOwner,'base');assert.equal(maps.get('raised')!.surfaceOwner,undefined);assert.equal(maps.get('other')!.surfaceOwner,undefined);
 const fields=surfaceLightingMaps(w,h,layers,maps,normal,depth)!;
 const p=(8*w+8)*4;assert.deepEqual([...fields.normal.subarray(p,p+3)],[128,128,255]);assert.equal(fields.depth[p],100);
 for(const x of [20,32]){const q=(8*w+x)*4;assert.deepEqual(fields.normal.subarray(q,q+4),originalN.subarray(q,q+4));assert.equal(fields.depth[q],originalD[q]);}
 assert.deepEqual(normal,originalN);assert.deepEqual(depth,originalD);assert.equal(fields.inherited.length,1);
});
test('projection groups retain source ownership and opaque foreground layers hide inherited details',()=>{
 const w=32,h=24,base=layer('group','',0,0,w,h),paint=layer('paint','avatar:head/detail/paint',8,8,4,4),cover=layer('cover','outfit:mask/base',8,8,4,4);
 delete (base as any).partPath;(base as any).projection={shadows:[{receiverPartIds:['avatar:head/base']}]};
 const normal=new Uint8ClampedArray(w*h*4),depth=new Uint8ClampedArray(normal.length);
 for(let p=0;p<normal.length;p+=4){normal.set([128,128,255,255],p);depth.set([100,100,100,255],p);}
 const layers=[base,paint,cover],maps=extractPartMaps(w,h,layers,normal,depth);
 assert.equal(maps.get('paint')!.surfaceOwner,'group');
 assert.deepEqual(surfaceLightingMaps(w,h,layers,maps,normal,depth)!.normal,normal);
 assert.equal(surfaceLightingMaps(w,h,[cover],new Map([['cover',maps.get('cover')!]]),normal,depth),null);
});
