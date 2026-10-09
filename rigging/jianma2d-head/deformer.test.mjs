import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {boundaryPoint,evaluatePoint,evaluateRoot,weights,poseWeights,clampPose,classify,motionKind,validateRig,layerOpacity} from './deformer.mjs';
import {meshGeometry,orderedLayers} from './renderer.mjs';
const rig=JSON.parse(fs.readFileSync(new URL('./rig.json',import.meta.url)));
const close=(a,b,epsilon=1e-8)=>assert.ok(Math.abs(a-b)<epsilon,`${a} != ${b}`);
const pointClose=(a,b,e)=>a.forEach((v,i)=>close(v,b[i],e));
test('neutral and nine exact keys remain reproducible, with a partition of unity',()=>{
 for(const kind of ['body','skin','fringe','face','faceBare','collar',...Object.keys(rig.features),'earL','earR',...Object.keys(rig.surfaces)])for(const [x,y] of [[400,200],[444,265],[492,320],[355,600]]){
  pointClose(evaluatePoint(x,y,kind,{x:0,y:0,z:0},rig),[x,y]);
  for(const [kx,ky] of rig.keyCoordinates)pointClose(boundaryPoint(x,y,kind,kx,ky,rig),evaluatePoint(x,y,kind,{x:kx*30,y:ky*30,z:0},rig));
 }
 for(let x=-1;x<=1;x+=.1)for(let y=-1;y<=1;y+=.1)close(weights(x,y).reduce((a,b)=>a+b,0),1);
});
test('actual torso boundary is fixed and skin joins its fixed region continuously',()=>{
 for(const [kx,ky] of rig.keyCoordinates)for(const z of [-20,0,20]){
  const p={x:kx*30,y:ky*30,z};
  for(const x of [400,420,444,467,488]){
   pointClose(evaluatePoint(x,rig.neck.fixedY,'skin',p,rig),[x,rig.neck.fixedY]);
   const a=evaluatePoint(x,rig.neck.fixedY-.001,'skin',p,rig);
   pointClose(a,[x,rig.neck.fixedY-.001],.00001);
  }
 }
});
test('front/rear hair roots share the scalp parent at every corner',()=>{
 for(const kind of ['sideL','sideR','rearL','rearR'])for(const [kx,ky] of rig.keyCoordinates)for(const z of [-20,0,20]){
  const [x,y]=rig.surfaces[kind].anchor,p={x:kx*30,y:ky*30,z};
  pointClose(evaluatePoint(x,y,kind,p,rig),evaluatePoint(x,y,'fringe',p,rig));
 }

 const near=boundaryPoint(410,200,'face',1,0,rig),far=boundaryPoint(478,200,'face',1,0,rig);
 assert(near[0]-410>far[0]-478,'far side must compress relative to near side');
 assert.equal(classify('hair_crown',rig),'fringe');assert.equal(classify('forehead_jewel',rig),'forehead');
 assert.equal(classify('fx_hair_front_right_on_face',rig),'shadowFaceR');
 assert.throws(()=>classify('new_unbound_art',rig),/Unbound SVG group/);
});
test('rigid head ornaments preserve straight lines instead of bending with the scalp',()=>{
 for(const kind of ['crown','halo','ornamentL','ornamentR','forehead'])for(const [kx,ky] of rig.keyCoordinates){
  const [x,y]=rig.surfaces[kind].anchor,p={x:kx*30,y:ky*30,z:17};
  const a=evaluatePoint(x-15,y-10,kind,p,rig),b=evaluatePoint(x+15,y+10,kind,p,rig),m=evaluatePoint(x,y,kind,p,rig);
  close((b[0]-a[0])*(m[1]-a[1])-(b[1]-a[1])*(m[0]-a[0]),0,1e-7);
 }
});
test('crossing either center axis is continuous for all authored parts',()=>{
 const eps=.0001;
 for(const kind of ['face','fringe','sideL','rearL','skin',...Object.keys(rig.features)])for(const axis of ['x','y'])for(const other of [-25,0,25]){
  const value=v=>evaluatePoint(420,kind==='skin'?295:215,kind,{x:axis==='x'?v:other,y:axis==='y'?v:other,z:0},rig);
  const a=value(-eps),b=value(0),c=value(eps);
  for(let k=0;k<2;k++)close((b[k]-a[k])/eps,(c[k]-b[k])/eps,.0001);
 }
});
test('sampled visible and full hanging surfaces do not fold at combined parameter extremes',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url)));let minimum=Infinity;
 for(const l of manifest.layers){const [x,y,w,h]=l.box;
  for(let px=x;px<x+w;px+=30)for(let py=y;py<y+h;py+=30)
   for(const ax of [-30,0,30])for(const ay of [-30,0,30])for(const z of [-20,0,20]){
    const p={x:ax,y:ay,z},a=evaluatePoint(px,py,l.kind,p,rig),b=evaluatePoint(px+.1,py,l.kind,p,rig),c=evaluatePoint(px,py+.1,l.kind,p,rig);
    const det=((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/.01;
    minimum=Math.min(minimum,det);assert.ok(Number.isFinite(det)&&det>.10,`${l.kind} fold at ${px},${py} / ${ax},${ay},${z}: ${det}`);
   }
 }
 console.log('Minimum sampled area ratio:',minimum.toFixed(4));
});
test('exact dressed expression source and explicit layer ownership are recorded',()=>{
 const source=JSON.parse(fs.readFileSync(new URL('./source.json',import.meta.url))),manifest=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url)));
 assert.equal(source.base.sourceSha256,'5bce80aa35a0331f34f1905d03886d0a4c2318ab623b8420a5e52561a5a5cae9');
 assert.equal(source.sourceSha256,createHash('sha256').update(fs.readFileSync(new URL('./artwork/character.svg',import.meta.url))).digest('hex'));
 assert.equal(source.sourceSha256,manifest.inputSha256);assert.equal(manifest.sourcePreserved,true);
 assert.equal(source.path,'rigging/jianma2d-head/artwork/character.svg');
 assert(manifest.preparation.some(p=>p.operation==='defer-collar-occlusion-to-draw-order'));
 const face=manifest.layers.find(l=>l.kind==='face');assert(face);
 assert.deepEqual(face.groups,['face_base']);
 for(const [kind,projection] of Object.entries(rig.projections)){
  assert(manifest.layers.some(l=>l.kind===kind),kind+' missing from display cache');
  assert(manifest.layers.some(l=>l.kind===projection.receiver),kind+' has no live receiver');
  assert.equal(motionKind(kind,rig),projection.caster);
 }
 assert(manifest.preparation.some(p=>p.target==='fx_body5_face_on_neck'&&p.operation==='defer-receiver-clip-to-posed-mesh'));
 for(const kind of ['rearL','rearR'])assert(manifest.layers.find(l=>l.kind===kind).box[3]>400);
 for(const l of manifest.layers){
  assert.ok(fs.statSync(new URL(l.file,import.meta.url)).size>0);
  for(const id of l.groups){const role=classify(id,rig);assert(role===l.kind||['face','faceBare'].includes(l.kind)&&['face','collar',...Object.keys(rig.features)].includes(role),id+' leaked into '+l.kind);}
 }
});

test('authored pitch redistributes facial bands without reversing their order',()=>{
 for(const y of [-30,-15,15,30]){
  const p={x:0,y,z:0};
  const bands=[185,198.5,228,244,270].map(row=>evaluatePoint(444,row,'face',p,rig)[1]);
  for(let i=1;i<bands.length;i++)assert(bands[i]-bands[i-1]>8);
 }
 const distance=y=>evaluatePoint(444,270,'face',{x:0,y,z:0},rig)[1]-evaluatePoint(444,198.5,'face',{x:0,y,z:0},rig)[1];
 assert(distance(-30)<distance(0)&&distance(30)>distance(0));
});
test('editing authored facial endpoints carries skin and features without moving the scalp',()=>{
 const altered=structuredClone(rig);
 for(const pose of Object.values(altered.keyforms.face.poses))for(const q of Object.values(pose)){q[0]+=8;q[1]-=3;}
 for(const pose of Object.values(altered.keyforms.face.contours.poses))for(const curve of Object.values(pose))for(const q of curve){q[0]+=8;q[1]-=3;}
 const p={x:30,y:30,z:0};
 for(const kind of ['face','eyeR','eyeL','browR','browL','nose','mouth']){
  const [x,y]=rig.features[kind]?.anchor||[444,210],a=evaluatePoint(x,y,kind,p,rig),b=evaluatePoint(x,y,kind,p,altered);
  pointClose(b,[a[0]+8,a[1]-3],1e-6);
 }
 pointClose(evaluatePoint(444,151,'fringe',p,altered),evaluatePoint(444,151,'fringe',p,rig));
});
test('connected ornament frame uses one projection and bun stays attached to the scalp',()=>{
 for(const [kx,ky] of rig.keyCoordinates){
  for(const [x,y] of [[370,105],[444,60],[512,123]]){
   const p=boundaryPoint(x,y,'halo',kx,ky,rig);
   pointClose(p,boundaryPoint(x,y,'ornamentL',kx,ky,rig));
   pointClose(p,boundaryPoint(x,y,'ornamentR',kx,ky,rig));
  }
  const [x,y]=rig.surfaces.bun.anchor,a=boundaryPoint(x,y,'bun',kx,ky,rig),b=boundaryPoint(x,y,'fringe',kx,ky,rig),c=boundaryPoint(x,y,'crown',kx,ky,rig);
  pointClose(a,b);assert(Math.hypot(a[0]-c[0],a[1]-c[1])<1.3,'crown/bun attachment gap');
 }
});
test('yaw retains facial volume without dragging the head front beyond the cranium',()=>{
 for(const sign of [-1,1]){
  const nose=boundaryPoint(444,228,'nose',sign,0,rig),chin=boundaryPoint(444,270,'face',sign,0,rig);
  assert((nose[0]-444)*sign>25&&(nose[0]-444)*sign<40);assert((chin[0]-444)*sign>15&&(chin[0]-444)*sign<25);
  assert((nose[0]-chin[0])*sign>8,'nose must project in front of the chin');
  const xs=[390,405,420,444,468,483,498].map(x=>boundaryPoint(x,210,'face',sign,0,rig)[0]);
  for(let i=1;i<xs.length;i++)assert(xs[i]>xs[i-1]+3,'collapsed facial contour');
 }
});
test('volume contract rejects invalid depth rows and unparented features',()=>{
 validateRig(rig);
 for(const name of ['face','scalp','bun']){
  const r=structuredClone(rig);r.volume[name].depth.pop();assert.throws(()=>validateRig(r),/one depth per anatomical row/);
 }
 const r=structuredClone(rig);r.features.eyeR.parent='scalp';assert.throws(()=>validateRig(r),/missing facial attachment/);
});
test('eyes retain useful near/far widths and carry the shared pitch slope',()=>{
 const near=boundaryPoint(429.5,198.5,'eyeR',1,0,rig)[0]-boundaryPoint(409.5,198.5,'eyeR',1,0,rig)[0];
 const far=boundaryPoint(478.5,198.5,'eyeL',1,0,rig)[0]-boundaryPoint(458.5,198.5,'eyeL',1,0,rig)[0];
 assert(near>far&&near/20>.78&&near/20<1.15&&far/20>.50&&far/20<.75);
 for(const y of [-1,1]){
  const left=[409.5,429.5].map(x=>boundaryPoint(x,198.5,'eyeR',0,y,rig));
  const right=[458.5,478.5].map(x=>boundaryPoint(x,198.5,'eyeL',0,y,rig));
  assert((left[1][1]-left[0][1])*y<-.5);
  assert((right[1][1]-right[0][1])*y>.5);
 }
});
test('projected artwork follows its actual source coordinate, then the authored cast offset',()=>{
 for(const [kind,projection] of Object.entries(rig.projections))for(const p of [{x:12,y:-17,z:9},{x:-25,y:22,z:-13}]){
  const [dx,dy]=projection.sourceOffset||[0,0],a=p.z*Math.PI/180;
  const q=evaluatePoint(421-dx,223-dy,projection.caster,p,rig);
  pointClose(evaluatePoint(421,223,kind,p,rig),[q[0]+dx*Math.cos(a)-dy*Math.sin(a),q[1]+dx*Math.sin(a)+dy*Math.cos(a)]);
 }
});
test('neck column follows the cranial base, not the projecting chin; its width stays stable',()=>{
 for(const x of [-30,30]){
  const p={x,y:0,z:0},a=evaluatePoint(418,281,'skin',p,rig),b=evaluatePoint(474,281,'skin',p,rig),n=evaluatePoint(444,264,'skin',p,rig),c=evaluatePoint(444,270,'face',p,rig);
  assert(b[0]-a[0]>52&&b[0]-a[0]<58,'neck flattened');
  assert(Math.abs(n[0]-444)<8,'neck follows the chin tip instead of cranial base');
  assert(Math.abs(c[0]-444)>Math.abs(n[0]-444)*2.5);
 }
});
test('local facial planes stay attached to the skin without putting eye-cage bends in the jaw',()=>{
 for(const p of [{x:30,y:30,z:20},{x:-30,y:-30,z:-20},{x:11,y:-17,z:7}])
  for(const [kind,feature] of Object.entries(rig.features)){
   const f=rig.featureForms[feature.poseFrame||kind],[x,y]=f.anchor;
   pointClose(evaluatePoint(x,y,kind,p,rig),evaluatePoint(x,y,'face',p,rig));
   const a=evaluatePoint(x-8,y-5,kind,p,rig),b=evaluatePoint(x+8,y+5,kind,p,rig);
   pointClose(evaluatePoint(x,y,kind,p,rig),a.map((v,i)=>(v+b[i])/2),1e-6);
   if(kind.startsWith('brow'))pointClose(evaluatePoint(x+3,y-9,kind,p,rig),evaluatePoint(x+3,y-9,feature.poseFrame,p,rig));
  }
});
test('actual raster meshes keep face detail registered and local feature planes affine',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url)));
 const face=meshGeometry(manifest.layers.find(l=>l.kind==='face'),rig);
 const sample=(m,x,y,k)=>{
  const i=Math.floor((x-m.left)/m.step),j=Math.floor((y-m.top)/m.step),u=(x-m.left)/m.step-i,v=(y-m.top)/m.step-j;
  assert(i>=0&&i<m.nx&&j>=0&&j<m.ny);
  const a=j*(m.nx+1)+i,b=a+1,c=a+m.nx+1,d=c+1;
  const ids=u+v<=1?[a,b,c]:[d,c,b],ws=u+v<=1?[1-u-v,u,v]:[u+v-1,1-u,1-v];
  return [0,1].map(axis=>ids.reduce((sum,id,n)=>sum+ws[n]*m.data[id*m.stride+3+k*2+axis],0));
 };
 for(const kind of [...Object.keys(rig.features),'faceDetail']){
  const layer=manifest.layers.find(l=>l.kind===kind),m=meshGeometry(layer,rig),[x,y,w,h]=layer.box;
  for(const [u,v] of [[.23,.37],[.69,.58],[.81,.74]])for(let k=0;k<9;k++){
   const expected=kind==='faceDetail'?sample(face,x+w*u,y+h*v,k):boundaryPoint(x+w*u,y+h*v,kind,...rig.keyCoordinates[k],rig);
   pointClose(sample(m,x+w*u,y+h*v,k),expected,1e-4);
  }
 }
});
test('side volumes and pendants remain behind the face and long front hair without fading ears',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url)));
 const order=orderedLayers(manifest.layers.map(layer=>({layer})),rig),index=group=>order.findIndex(m=>m.layer.groups.includes(group));
 for(const group of rig.occlusion.behindFaceGroups)assert(index(group)<index('face_base'));
 for(const group of rig.occlusion.foregroundGroups)assert(index(group)>index('face_base'));
 assert.equal(new Set(order).size,manifest.layers.length,'occlusion must not duplicate or discard an art layer');
 for(let x=-30;x<=30;x+=3)for(const kind of ['earL','earR'])close(layerOpacity(kind,{x},rig),1);
});
test('collar opening follows the neck partially while its sewn edge stays fixed',()=>{
 for(const [kx,ky] of rig.keyCoordinates)for(const z of [-20,0,20]){
  const p={x:kx*30,y:ky*30,z};
  pointClose(evaluatePoint(410,rig.collar.fixedY,'collar',p,rig),[410,rig.collar.fixedY]);
 }
 const a=evaluatePoint(444,270,'collar',{x:30,y:0,z:0},rig);
 assert(a[0]>444 && a[0]<evaluatePoint(444,270,'skin',{x:30,y:0,z:0},rig)[0]);
});

test('all eight endpoint drawings are explicit; missing landmarks fail before rendering',()=>{
 validateRig(rig);
 const bad=structuredClone(rig);delete bad.keyforms.scalp.poses['-1,-1'].middleR;
 assert.throws(()=>validateRig(bad),/incomplete endpoint/);
 const face=rig.keyforms.face;
 for(const [key,pose] of Object.entries(face.poses)){
  const [x,y]=key.split(',').map(Number);
  for(const [name,source] of Object.entries(face.landmarks))pointClose(boundaryPoint(...source,'face',x,y,rig),pose[name],1e-5);
 }
 const badFeature=structuredClone(rig);badFeature.featureForms.eyeR.poses['1,1'].xAxis=[-1,0];
 assert.throws(()=>validateRig(badFeature),/invalid local facial form/);
 const badContour=structuredClone(rig);badContour.keyforms.face.contours.poses['1,1'].L[3][0]+=1;
 assert.throws(()=>validateRig(badContour),/Disconnected authored cheek contour/);
 for(const kind of ['earL','earR'])for(const [kx,ky] of rig.keyCoordinates){
  const anchor=rig.surfaces[kind==='earL'?'earringL':'earringR'].anchor;
  pointClose(evaluateRoot(kind==='earL'?'earringL':'earringR',{x:kx*30,y:ky*30,z:0},rig),boundaryPoint(...anchor,kind,kx,ky,rig));
 }
});
test('scalp turn separates the parting from the rounded near-side envelope',()=>{
 for(const kx of [-1,1])for(const ky of [-1,0,1]){
  const side=kx<0?'middleR':'middleL',src=rig.keyforms.scalp.landmarks;
  const edge=boundaryPoint(...src[side],'fringe',kx,ky,rig),part=boundaryPoint(...src.partMid,'fringe',kx,ky,rig);
  assert((edge[0]-part[0])*(-kx)>95,'near-side hair collapsed into a narrow sheet');
 }
});
test('actual facial and scalp display triangles remain oriented through 25 intermediate poses',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('./layers.json',import.meta.url)));
 for(const layer of manifest.layers.filter(l=>['face','fringe','eyeR','eyeL','mouth'].includes(l.kind))){
  const m=meshGeometry(layer,rig),points=new Float64Array(m.data.length/m.stride*2);
  for(const x of [-1,-.5,0,.5,1])for(const y of [-1,-.5,0,.5,1]){
   const w=weights(x,y);
   for(let i=0;i<points.length/2;i++)for(let axis=0;axis<2;axis++){
    let v=0;for(let k=0;k<9;k++)v+=m.data[i*m.stride+3+k*2+axis]*w[k];points[i*2+axis]=v;
   }
   for(let i=0;i<m.indices.length;i+=3){
    const [a,b,c]=m.indices.subarray(i,i+3),ax=points[a*2],ay=points[a*2+1],bx=points[b*2],by=points[b*2+1],cx=points[c*2],cy=points[c*2+1];
    const ratio=((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/(m.step*m.step);
    assert(ratio>.03,`${layer.kind} display fold at ${x},${y}, triangle ${i/3}: ${ratio}`);
   }
  }
 }
});

test('live subtle-turn range clamps axes without rescaling the authored domain',()=>{
 assert.deepEqual(rig.keyformExtent,{x:30,y:30});
 for(const axis of ['x','y'])assert.deepEqual([rig.parameters[axis].min,rig.parameters[axis].max],[-10,10]);
 assert.deepEqual(clampPose({x:99,y:-99,z:99},rig),{x:10,y:-10,z:20});
 assert.throws(()=>clampPose({x:NaN,y:0,z:0},rig),/Invalid head pose/);
 const weightsAtLimit=poseWeights(clampPose({x:30,y:30,z:0},rig),rig);
 assert.deepEqual(weightsAtLimit,weights(1/3,1/3));
 // Low-level author sampling still interpolates the full endpoint domain.
 for(const kind of ['face','fringe','skin','eyeR','eyeL','mouth','sideL','sideR']){
  const neutral=boundaryPoint(444,230,kind,0,0,rig),endpoint=boundaryPoint(444,230,kind,1,0,rig);
  pointClose(evaluatePoint(444,230,kind,{x:15,y:0,z:0},rig),neutral.map((v,i)=>(v+endpoint[i])/2));
 }
 const bad=structuredClone(rig);bad.parameters.x.max=45;bad.parameters.x.min=-45;
 assert.throws(()=>validateRig(bad),/Invalid head parameter range/);
});
