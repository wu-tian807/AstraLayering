import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {meshGeometry} from './renderer.mjs';
import {HeadPhysics} from './physics.mjs';
import {inertiaWeights,evaluatePoint,physicsAnchor,fringeWeights} from './deformer.mjs';
const rig=JSON.parse(fs.readFileSync(new URL('./rig.json',import.meta.url)));
const neutral={x:0,y:0,z:0};
const path=t=>({x:30*Math.sin(t*3.2),y:24*Math.sin(t*2.1),z:17*Math.sin(t*4.3)});
test('inertia pins roots with zero slope and keeps the authored output envelope',()=>{
 for(const [kind,s] of Object.entries(rig.physics.strands)){
  assert.deepEqual(inertiaWeights(physicsAnchor(kind,rig)[1],kind,rig),[0,0]);
  assert(inertiaWeights(s.startY+.001,kind,rig).reduce((a,b)=>a+b,0)<1e-7);
  for(let y=s.startY;y<s.endY+100;y+=3){const w=inertiaWeights(y,kind,rig);assert(w.every(v=>v>=0));assert(w[0]+w[1]<=1+1e-12);}
 }
});
test('motion produces lag then converges to an exact held pose',()=>{
 const p=new HeadPhysics(rig),pose={x:30,y:0,z:15};
 for(let i=1;i<=24;i++)p.advance({x:pose.x*i/24,y:0,z:pose.z*i/24},1/60);
 assert(Math.abs(p.outputs.rearL[2])>1,'rear tips should visibly lag');
 let peak=0;
 for(let i=0;i<600;i++){p.advance(pose,1/60);peak=Math.max(peak,Math.abs(p.outputs.ribbonL[2]));}
 assert(peak>1);assert.equal(p.energy,0);
 for(const o of Object.values(p.outputs))assert.deepEqual(o,[0,0,0,0]);
});
test('rapid reversals stay bounded and disable / resume do not kick the portrait',()=>{
 const p=new HeadPhysics(rig);
 for(let i=0;i<400;i++){
  const pose={x:i%12<6?30:-30,y:i%8<4?30:-30,z:i%14<7?20:-20};p.advance(pose,1/60);
  for(const [k,out] of Object.entries(p.outputs))assert(out.every(v=>Number.isFinite(v)&&Math.abs(v)<=rig.physics.strands[k].maxOffset));
 }
 p.enabled=false;assert.equal(p.advance(neutral,1/60),false);assert.equal(p.energy,0);
 p.enabled=true;p.advance(path(1),1);assert.equal(p.energy,0);
});
test('spring response agrees at 30, 60 and 144 display frames per second',()=>{
 const run=fps=>{const p=new HeadPhysics(rig);p.reset(path(0));for(let i=1;i<=fps*2;i++)p.advance(path(i/fps),1/fps);return p.outputs;};
 const reference=run(120);
 for(const fps of [30,60,144])for(const [kind,a] of Object.entries(run(fps)))a.forEach((v,i)=>assert(Math.abs(v-reference[kind][i])<.14,`${kind} ${fps} fps differs by ${v-reference[kind][i]} px`));
});
test('combined posed meshes retain positive area at every allowed inertial bound',()=>{
 const layers=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url))).layers;
 for(const l of layers){const s=rig.physics.strands[l.kind];if(!s)continue;const [x,y,w,h]=l.box;
  for(const sign of [-1,1])for(const p of [{x:30,y:30,z:20},{x:-30,y:-30,z:-20},{x:30,y:-30,z:-20}]){
   const point=(x,y)=>{const q=evaluatePoint(x,y,l.kind,p,rig),b=inertiaWeights(y,l.kind,rig);return [q[0]+sign*s.maxOffset*(b[0]+b[1]),q[1]+sign*s.maxOffset*(b[1]-b[0])];};
   for(let px=x;px<x+w;px+=25)for(let py=y;py<y+h;py+=25){const a=point(px,py),b=point(px+.1,py),c=point(px,py+.1);const det=((b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]))/.01;assert(det>.1,`${l.kind}: ${det}`);}
  }
 }
});

test('fringe sway is local to the front locks, fixes the parting, and follows their cast shadows',()=>{
 for(const y of [100,125,160,218,270]){
  assert.deepEqual(fringeWeights(444,y,['hair_crown'],rig),[0,0,0,0]);
  assert.deepEqual(fringeWeights(400,y,['face_base'],rig),[0,0,0,0]);
  assert.deepEqual(fringeWeights(400,y,['forehead_jewel'],rig),[0,0,0,0]);
  assert.deepEqual(fringeWeights(400,y,['hair_bun'],rig),[0,0,0,0]);
 }
 for(const x of [395,410,478,493]){
  assert.deepEqual(fringeWeights(x,125,['hair_crown'],rig),[0,0,0,0]);
  assert.deepEqual(fringeWeights(x,310,['hair_front_left'],rig),[0,0,0,0]);
  for(const side of ['right','left'])assert.deepEqual(fringeWeights(x,205,['hair_front_'+side],rig),fringeWeights(x,205,['fx_hair_front_'+side+'_on_face'],rig));
 }
 assert(fringeWeights(395,218,['hair_crown'],rig)[1]>.9);
 assert(fringeWeights(493,218,['hair_crown'],rig)[3]>.9);
});
test('small live turns visibly excite the fringe then settle without autonomous idle motion',()=>{
 const p=new HeadPhysics(rig);let pose={...neutral},peak=0,stoppedPeak=0;
 const alpha=1-Math.exp(-13/60);
 for(let i=0;i<50;i++){
  const limit=rig.parameters.x.max,target=i<20?limit:i<40?-limit:limit;
  pose.x+=(target-pose.x)*alpha;p.advance(pose,1/60);
  peak=Math.max(peak,Math.abs(p.outputs.fringeR[2]),Math.abs(p.outputs.fringeL[2]));
 }
 for(let i=0;i<180;i++){
  p.advance(pose,1/60);if(i<12)stoppedPeak=Math.max(stoppedPeak,Math.abs(p.outputs.fringeR[2]));
 }
 assert(peak>1&&peak<=2.8);assert(stoppedPeak>.005);assert.deepEqual(p.outputs.fringeR,[0,0,0,0]);assert.deepEqual(p.outputs.fringeL,[0,0,0,0]);
});
test('actual fringe meshes remain oriented with both existing hair inertia and independent left/right bounds',()=>{
 const layers=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url))).layers;
 for(const layer of layers.filter(l=>l.groups.some(g=>rig.physics.fringe.groups.includes(g)))){
  const m=meshGeometry(layer,rig),points=new Float64Array(m.data.length/m.stride*2),s=rig.physics.strands[layer.kind];
  for(const pose of [{x:-15,y:-15,z:-20},{x:15,y:-15,z:20},{x:-15,y:15,z:20},{x:15,y:15,z:-20}]){
   const base=[];for(let j=0;j<=m.ny;j++)for(let i=0;i<=m.nx;i++)base.push(evaluatePoint(m.left+i*m.step,m.top+j*m.step,layer.kind,pose,rig));
   for(const signR of [-1,1])for(const signL of [-1,1])for(const signY of [-1,1]){
    for(let i=0;i<base.length;i++)for(let axis=0;axis<2;axis++){
     const k=i*m.stride,w=m.data[k+22]+m.data[k+23],wr=m.data[k+24]+m.data[k+25],wl=m.data[k+26]+m.data[k+27];
     points[i*2+axis]=base[i][axis]+w*(s?.maxOffset||0)*(axis?signY:signR)+(wr*signR+wl*signL)*2.8*(axis?.4*signY:1);
    }
    for(let i=0;i<m.indices.length;i+=3){
     const [a,b,c]=m.indices.subarray(i,i+3),ax=points[a*2],ay=points[a*2+1],bx=points[b*2],by=points[b*2+1],cx=points[c*2],cy=points[c*2+1];
     const ratio=((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/(m.step*m.step);assert(ratio>.1,`${layer.kind} fringe fold: ${ratio}`);
    }
   }
  }
 }
});
