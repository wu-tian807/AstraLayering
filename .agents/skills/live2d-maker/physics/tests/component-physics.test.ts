import { InochiPendulum } from '../../shared/physics-core/vendor/inochi2d/pendulum.js';
import { motionIssues, MotionStepTracker, motionStepBasis } from '../../shared/physics-evidence/physics-motion-review.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ComponentScene } from '../../shared/physics-core/component-physics-model.js';
import { componentDefaults } from '../../shared/physics-core/component-physics-schema.js';
import { resolveComponentBindings } from '../../shared/physics-core/component-physics-binding.js';
import { refineControlGeometry, conditionTriangles, cross, gridControlGeometry } from '../../shared/physics-core/component-physics-geometry.js';
import { applyTestInput } from '../../shared/physics-evidence/physics-test-input.js';
import { projectionField } from '../../shared/character-render/projection-field.js';
import { simulate, traceWindow, validateFindings } from '../evidence.ts';
const component=(kind='strand',extra:any={})=>({id:kind,name:kind,kind,priority:'primary',enabled:true,layerRefs:[{uuid:kind,contentHash:'a'.repeat(64)}],sourcePartIds:[kind],supports:[{id:'root',at:[100,40]}],...componentDefaults(kind),authoring:{freeLength:300,transitionPixels:55,fixedRegions:[[[50,20],[150,20],[150,60],[50,60]]],contour:[[50,20],[150,20],[150,340],[50,340]],centerline:[[100,40],[100,80],[100,140],[100,200],[100,260],[100,320]],widths:[55,55,50,45,35,25],pivot:[100,40],subdivisions:2},...extra});
const config=(components:any[])=>({kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:300,height:400}},components});

test('an omitted pendant output rate preserves the previous physical and displayed motion',()=>{
  const c=component('pendant'),explicit=structuredClone(c);explicit.response.outputFrequencyHz=c.response.frequencyHz;
  const a=new ComponentScene(config([c])),b=new ComponentScene(config([explicit]));
  for(const scene of [a,b])scene.bodies.get('pendant').impulse(110,310,500,0,300);
  for(let n=0;n<240;n++){a.step();b.step();assert.deepEqual(a.bodies.get('pendant').positions,b.bodies.get('pendant').positions);assert.equal(a.bodies.get('pendant').motion.angle,b.bodies.get('pendant').motion.angle);}
});

test('pendant output smoothing reduces release speed without feeding back into the physical bob or widening bounds',()=>{
  const c=component('pendant');c.response.dampingRatio=.8;c.limits.maxAngle=1;
  const slow=structuredClone(c);slow.response.outputFrequencyHz=.4;
  const scenes=[new ComponentScene(config([c])),new ComponentScene(config([slow]))];
  // Hold a real parent offset so both solvers remain active for this comparison;
  // sleeping at different sub-pixel times is a separate runtime behavior.
  for(const scene of scenes)scene.sourcePose.x=1;
  const trackers=scenes.map(s=>new MotionStepTracker(s.config.source.canvas,s.bodies.get('pendant').positions.length));
  for(const scene of scenes)scene.bodies.get('pendant').impulse(110,310,500,0,300);
  for(let n=0;n<960;n++){
    for(const [i,scene]of scenes.entries()){scene.step();const b=scene.bodies.get('pendant');trackers[i].update(b.positions,scene.sourcePose);assert(b.stats.valid);assert(b.stats.angle<=1+1e-5);}
    const [a,b]=scenes.map(s=>s.bodies.get('pendant'));assert.equal(a.motion.angle,b.motion.angle);assert.equal(a.motion.speed,b.motion.speed);
  }
  assert(trackers[1].maxStep<trackers[0].maxStep*.7,'the artwork can ease more slowly while the physical simulation stays identical');
  for(const scene of scenes){assert(scene.bodies.get('pendant').stats.travel<.001);scene.reset();assert.deepEqual(scene.bodies.get('pendant').positions,scene.bodies.get('pendant').rest);}
});

test('strand has pinned source pixels, continuous curvature, constrained impulse and decaying residual',()=>{
  const scene=new ComponentScene(config([component()])),b=scene.bodies.get('strand');
  b.impulse(100,310,400,0,160);let peak=0,bent=false;
  for(let step=0;step<960;step++){scene.step();assert(b.stats.valid);assert.equal(b.stats.root,0);assert(Math.hypot(...b.sample([100,55]).map((v:number,i:number)=>v-[100,55][i]))<1e-9,'pinned source pixels inherited motion across a mesh triangle');peak=Math.max(peak,b.stats.travel);if(step===12){const left=b.p[4]-b.pPose[4],tip=b.p.at(-2)-b.pPose.at(-2);bent=Math.abs(left-tip)>.5;}}
  assert(peak>10&&peak<b.maxDistance);assert(bent,'a rigid translation cannot represent a free hair strand');assert(b.stats.travel<.01);
  b.reset();assert.deepEqual(b.positions,b.rest);assert(b.velocity.every((v:number)=>v===0));
  for(let step=0;step<180;step++){if(step%8===0)b.impulse(100,260,1e9,-1e8,500);scene.step();assert(b.stats.valid);assert.equal(b.stats.root,0);assert(b.stats.travel<=b.maxDistance+1e-5);}
});
test('cloth fixed polygon and source holes survive an extreme force',()=>{
  const c=component('cloth');c.authoring.holes=[[[85,180],[85,210],[115,210],[115,180]]];
  const scene=new ComponentScene(config([c])),b=scene.bodies.get('cloth');b.impulse(80,310,1e6,-500,200);
  for(let n=0;n<240;n++){scene.step();assert.equal(b.stats.root,0);assert(b.stats.valid);assert(b.stats.minArea>=c.limits.minAreaRatio-1e-5);}
  assert(b.indices.length>12);
});
test('regular cloth controls accept a point load between controls and settle without moving pinned pixels',()=>{
  const c=component('cloth');c.authoring.controlGrid=[4,8];
  const scene=new ComponentScene(config([c])),b=scene.bodies.get('cloth');
  b.impulse(112,301,300,0,1);assert(b.velocity.some((v:number)=>Math.abs(v)>0),'a small pointer radius must not miss the control field');
  let peak=0;for(let n=0;n<960;n++){scene.step();assert(b.stats.valid);assert.equal(b.stats.root,0);peak=Math.max(peak,b.stats.travel);}
  assert(peak>.1);assert(b.stats.travel<.1);b.reset();assert.equal(b.stats.fallback,false);assert.deepEqual(b.positions,b.rest);
});
test('unlimited cloth retains the solver last-substep velocity through presentation',()=>{
  const c=component('cloth');c.authoring.controlGrid=[4,8];
  Object.assign(c.material,{shearCompliance:.0005,compressionCompliance:.0005,bendCompliance:.0006,shapeCompliance:.00065});
  Object.assign(c.response,{frequencyHz:1.1,dampingRatio:.48});
  const s=new ComponentScene(config([c])),b=s.bodies.get(c.id),dt=1/120;s.airflow={x:.025,y:0};
  let differentFromOuterAverage=false;
  for(let step=0;step<48;step++){
    b.prepare(dt);b.solve();const solved=new Float64Array(b.p),velocity=new Float64Array(b.velocity);
    differentFromOuterAverage ||= velocity.some((v:number,i:number)=>Math.abs(v-(b.p[i]-b.previous[i])/dt)>1e-5);
    b.constrain();assert.equal(b.limited,false);assert.deepEqual(b.p,solved);
    b.finish();
    for(let i=0;i<b.velocity.length;i++){
      if(b.mobility[Math.floor(i/2)])assert.equal(b.velocity[i],velocity[i],'presentation must not replace the free-particle substep velocity');
      else assert(Math.abs(b.velocity[i])<1e-9,'pinned velocity follows the stationary support, allowing coordinate roundoff');
    }
    assert(b.stats.valid);
  }
  assert(differentFromOuterAverage,'this load must exercise distinct end and average velocities');
});
test('cloth safety correction removes blocked motion without injecting rebound or removing parent motion',()=>{
  const c=component('cloth');c.authoring.controlGrid=[4,8];
  const s=new ComponentScene(config([c])),b=s.bodies.get(c.id),dt=1/120;
  s.sourcePose.x=10;b.prepare(dt);b.p.set(b.pPose);
  const free=b.mobility.findIndex((v:number)=>v>.99),q=free*2,parent=10/dt;
  b.velocity.fill(0);b.velocity[q]=parent+12;b.velocity[q+1]=7;
  b.motion.solved.set(b.p);b.motion.solvedStep=true;b.p[q]-=2;
  b.motion.reconcile();
  assert.equal(b.velocity[q],parent,'remove velocity into the blocked direction');
  assert.equal(b.velocity[q+1],7,'retain unblocked tangent motion');
  for(let i=0;i<b.mobility.length;i++)if(!b.mobility[i])assert.equal(b.velocity[i*2],parent);
  // A positional correction aligned with an already allowed velocity must
  // not add energy either, regardless of the correction's size.
  b.motion.solved.set(b.p);b.motion.solvedStep=true;b.p[q+1]+=3;b.motion.reconcile();
  assert.equal(b.velocity[q],parent);assert.equal(b.velocity[q+1],7);
});
test('display shear projects back to cloth controls while preserving pinned pixels and source geometry',()=>{
  const c=component('cloth');c.authoring.controlGrid=[4,8];
  const b=new ComponentScene(config([c])).bodies.get(c.id),source=new Float64Array(b.rest),indices=new Uint32Array(b.indices);
  assert.equal(b.correctDisplayShear(),false);
  for(let i=0;i<b.mobility.length;i++)b.p[i*2]+=(b.pRest[i*2+1]-60)*.65*b.mobility[i];
  b.pin();b.syncMesh();const before=b.inspect();assert(before.shear>c.limits.maxShear);
  for(let pass=0;pass<24;pass++){b.correctDisplayShear();b.pin();b.syncMesh();}
  const after=b.inspect();assert(after.shear<before.shear*.5,'correct the rendered angle through its control Jacobian');
  assert(after.shear<c.limits.maxShear+.2,'the projected angles converge toward the authored bound');
  assert.equal(after.root,0);assert.equal(b.limited,true);assert.deepEqual(b.rest,source);assert.deepEqual(b.indices,indices);
  assert.equal(c.limits.maxShear,18,'the author shear constraint remains in force');
});
test('thin display triangles retain their own control face through refinement',()=>{
  const control={rest:[0,0,100,100,100.00001,100,100,0],indices:[0,1,2,0,3,2]},mesh=refineControlGeometry(control,3);
  for(let i=0;i<mesh.samples.length;i++){const[a,b,c,u,v,w]=mesh.samples[i];assert(Math.abs(u+v+w-1)<1e-12);for(let axis=0;axis<2;axis++)assert(Math.abs(mesh.rest[i*2+axis]-(control.rest[a*2+axis]*u+control.rest[b*2+axis]*v+control.rest[c*2+axis]*w))<1e-10);}
});
test('mesh conditioning preserves source vertices, boundary area and protected diagonals',()=>{
  const a=[0,0],b=[100,0],c=[100,100],d=[0,1],faces=[[a,b,c],[a,c,d]];
  const conditioned=conditionTriangles(faces),area=(triangles:number[][][])=>triangles.reduce((sum,t)=>sum+Math.abs(cross(t[0],t[1],t[2])),0);
  assert.equal(area(conditioned),area(faces));
  assert.deepEqual(new Set(conditioned.flat().map(p=>p.join(','))),new Set(faces.flat().map(p=>p.join(','))));
  assert(conditioned.every(t=>t.includes(b)&&t.includes(d)),'use the better interior diagonal without shifting the outline');
  assert.deepEqual(conditionTriangles(faces,[[a,c]]),faces,'fixed-region and control cuts may not be flipped');
  const concave=[[a,b,[20,10]],[a,[20,10],[0,100]]];assert.deepEqual(conditionTriangles(concave),concave,'an exterior diagonal must never replace a concave interior edge');
});
test('cloth boundary roundoff samples the last control cell without moving the source outline',()=>{
  const contour=[[10.1,20.2],[30.3,20.2],[30.3,70.7],[10.1,70.7]],grid=gridControlGeometry({controlGrid:[4,8],contour},[]);
  for(const p of [[30.3+1e-12,55],[21,70.7+1e-12],[30.3+1e-12,70.7+1e-12],[10.1-1e-12,20.2-1e-12]]){
    const s=grid.sample(p),q=[0,1].map(k=>s.slice(0,3).reduce((sum:number,i:number,n:number)=>sum+grid.rest[i*2+k]*s[n+3],0));
    assert(Math.abs(q[0]-Math.max(10.1,Math.min(30.3,p[0])))<1e-10);
    assert(Math.abs(q[1]-Math.max(20.2,Math.min(70.7,p[1])))<1e-10);
  }
});
test('rigid pendant preserves pair distances rather than stretching into jelly',()=>{
  const scene=new ComponentScene(config([component('pendant')])),b=scene.bodies.get('pendant');b.impulse(100,320,900,400,500);
  for(let n=0;n<180;n++){scene.step();assert(b.stats.valid);for(let i=1;i<b.weights.length;i++)assert(Math.abs(Math.hypot(b.positions[i*2]-b.positions[0],b.positions[i*2+1]-b.positions[1])-Math.hypot(b.rest[i*2]-b.rest[0],b.rest[i*2+1]-b.rest[1]))<1e-8);}
});
test('authored hair bends visibly in a breeze while its pinned pixels and segment lengths stay safe',()=>{
  const c=component();c.authoring.swing={parallel:.8};Object.assign(c.response,{frequencyHz:1.3,dampingRatio:.25,windGain:.5,outputGain:1.7});c.limits.maxTravel=.2;
  const scene=new ComponentScene(config([c])),b=scene.bodies.get(c.id);let peak=0,differential=0;
  for(let n=0;n<720;n++){
    scene.airflow={x:.2*(.6+.3*Math.sin(n/120)),y:0};scene.step();
    assert(b.stats.valid);assert.equal(b.stats.root,0);assert.equal(b.stats.fallback,false);
    peak=Math.max(peak,b.stats.travel);differential=Math.max(differential,Math.abs((b.p[6]-b.pPose[6])-(b.p.at(-2)-b.pPose.at(-2))));
  }
  assert(peak>12,'a normal breeze must produce visible authored deformation');assert(differential>8,'the midsection and tip must bend differently');
  assert.throws(()=>new ComponentScene(config([{...c,response:{...c.response,windGain:Infinity}}])),/风力响应/);
});
test('a rigid ornament extrapolates off-contour attachment points in its rotating frame',()=>{
  const c=component('pendant'),b=new ComponentScene(config([c])).bodies.get(c.id);b.theta=.17;b.syncMesh();
  const points=[[150,360],[151,360],[100,420]],samples=points.map(p=>b.sample(p));
  assert(Math.abs(Math.hypot(samples[1][0]-samples[0][0],samples[1][1]-samples[0][1])-1)<1e-10);
  assert(Math.abs(Math.atan2(samples[1][1]-samples[0][1],samples[1][0]-samples[0][0])-.17)<1e-10);
  for(let i=1;i<points.length;i++)assert(Math.abs(Math.hypot(samples[i][0]-samples[0][0],samples[i][1]-samples[0][1])-Math.hypot(points[i][0]-points[0][0],points[i][1]-points[0][1]))<1e-10);
});
test('moving support is measured against the same-time pose and child stays attached',()=>{
  const parent=component(),child=component('pendant',{supports:[{id:'tail',at:[100,320],componentId:'strand'}]});
  const scene=new ComponentScene(config([parent,child]));
  for(let n=0;n<180;n++){scene.inputs.set('root',{x:Math.sin(n/40)*8,angle:.02});scene.step();const b=scene.bodies.get('strand');assert.equal(b.stats.root,0);assert(b.stats.valid);assert(b.pose[0]!==b.rest[0]||n===0);}
  assert.throws(()=>new ComponentScene(config([component('strand',{supports:[{id:'cycle',at:[100,40],componentId:'strand'}]})])),/环/);
});
test('parent test pose moves artwork and attachments in the same space without reducing per-part input',()=>{
  const a=component(),c=component('cloth');c.authoring.controlGrid=[4,8];c.authoring.freeLength=180;
  const scene=new ComponentScene(config([a,c]));for(let n=1;n<=180;n++){applyTestInput(scene,'support-release',n);scene.step();for(const b of scene.bodies.values())for(let i=0;i<b.weights.length;i++)if(!b.weights[i]){const p=scene.sourcePoint([b.rest[i*2],b.rest[i*2+1]]);assert(Math.hypot(b.positions[i*2]-p[0],b.positions[i*2+1]-p[1])<1e-7);}}
  assert.equal(scene.sourcePose.x,15);assert(scene.sourcePose.x>=c.authoring.freeLength*.05);
  const caster={rest:new Float64Array([100,40,100,320]),positions:new Float64Array([...scene.sourcePoint([100,40]),...scene.sourcePoint([100,320])]),freeLength:280};
  const field=projectionField({x:20,y:200,width:220,height:150},caster,scene);field.update();for(let i=0;i<field.rest.length/2;i++){const p=scene.sourcePoint([field.rest[i*2],field.rest[i*2+1]]);assert(Math.hypot(field.positions[i*2]-p[0],field.positions[i*2+1]-p[1])<1e-8,'parent rotation must not be approximated as caster residual outside the caster');}
});
test('passive parent rotation never counts pinned-point roundoff as hitting a motion limit',()=>{
  const c=component();c.response.inputGain=0;const scene=new ComponentScene(config([c]));
  for(let step=1;step<=180;step++){
    scene.sourcePose={x:step/100,y:0,angle:step/10000};scene.step();const b=scene.bodies.get(c.id);
    assert(b.stats.valid);assert.equal(b.stats.root,0);assert.equal(b.stats.limited,false);assert.equal(b.stats.fallback,false);
  }
});
test('velocity safety limits secondary motion without clipping the commanded attachment velocity',()=>{
  const c=component('cloth');c.authoring.controlGrid=[4,8];
  const s=new ComponentScene(config([c])),b=s.bodies.get(c.id),dt=1/120;
  s.sourcePose={x:10,y:0,angle:0};b.prepare(dt);b.p.set(b.pPose);b.syncMesh();b.finish();
  const cap=b.maxDistance*2*Math.PI*c.response.frequencyHz*2;
  assert(10/dt>cap,'the parent must actually exceed the local speed budget');
  for(let i=0;i<b.mobility.length;i++){assert(Math.abs(b.velocity[i*2]-10/dt)<1e-7);assert(Math.abs(b.velocity[i*2+1])<1e-7);}
  assert.equal(b.stats.root,0);assert(b.stats.valid);
  s.sourcePose={x:20,y:0,angle:0};b.prepare(dt);b.p.set(b.pPose);
  const free=b.mobility.findIndex((v:number)=>v>.99);assert(free>=0);b.p[free*2+1]+=b.maxDistance*1.2;
  b.syncMesh();b.finish();
  assert(Math.hypot(b.velocity[free*2]-10/dt,b.velocity[free*2+1])<=cap+1e-7);
  assert(Math.abs(b.velocity[free*2+1])<1e-7,'the outward clip uses residual velocity, not parent velocity');
});
test('UUID bindings preserve multiple source layers through reorder and clipping islands without guessing ambiguity',()=>{
  const a=component(),b=component('cloth'),c=config([a,b]);
  let result=resolveComponentBindings(c,[{id:'new-order',uuid:'strand',contentHash:'a'.repeat(64)},{id:'other',uuid:'cloth',contentHash:'a'.repeat(64)}]);assert.equal(result.assignments.get('new-order'),'strand');
  result=resolveComponentBindings(c,[{id:'island',uuid:'shadow-group',contentHash:'different',sourceLayers:[{uuid:'strand',contentHash:'a'.repeat(64)}]},{id:'other',uuid:'cloth',contentHash:'a'.repeat(64)}]);assert.equal(result.assignments.get('island'),'strand');
  result=resolveComponentBindings(c,[{id:'island',uuid:'shadow-group',sourceLayers:[{uuid:'strand',contentHash:'a'.repeat(64)},{uuid:'cloth',contentHash:'a'.repeat(64)}]}]);assert.equal(result.assignments.size,0);assert.equal(result.issues.length,2);
  result=resolveComponentBindings(config([a]),[{id:'island',uuid:'shadow-group',composited:true,sourceLayers:[{uuid:'strand',contentHash:'a'.repeat(64)},{uuid:'unbound-static',contentHash:'b'.repeat(64)}]}]);assert.equal(result.assignments.size,0);assert.match(result.issues[0].reason,/未绑定/);
});
test('evidence records exact every-step states and never publishes numerical-only review',async()=>{
  const root=await mkdtemp(join(tmpdir(),'astra-component-test-')),directory=join(root,'evidence');try{
    await mkdir(directory);await writeFile(join(directory,'partial-trace'),'interrupted-diagnostic');
    const c=config([component()]);const manifest=await simulate(c,directory);assert.equal(manifest.runs.length,9);assert.equal(manifest.coverage.render,'pending');
    const partialBackup=(await readdir(join(root,'backups')))[0];assert.equal(await readFile(join(root,'backups',partialBackup,'partial-trace'),'utf8'),'interrupted-diagnostic');
    assert.equal(manifest.runs[0].metrics.motionReview.stepBasis,motionStepBasis);
    const rows=await traceWindow(directory,'tip-impulse',[59,60,61,960]);assert.equal(rows[1].time,.5);assert(rows[0].components.strand.stats.travel<1e-10);assert(rows[2].components.strand.stats.travel>0);assert(rows[2].components.strand.positions.length>0);
    assert.deepEqual((await traceWindow(directory,'tip-impulse',[61]))[0],rows[2]);
    await assert.rejects(validateFindings(c,directory,{configHash:manifest.configHash,evidenceVersion:manifest.version,components:[]}),/渲染/);
    assert.equal((await simulate(c,directory)).createdAt,manifest.createdAt,'unchanged evidence should be reused');
    await writeFile(join(directory,'manifest.json'),JSON.stringify({...manifest,simulationHash:'obsolete-measurement'}));
    await assert.rejects(validateFindings(c,directory,{configHash:manifest.configHash,evidenceVersion:manifest.version,components:[]}),/重新生成证据/);
    const regenerated=await simulate(c,directory);assert.equal(regenerated.simulationHash,manifest.simulationHash);
    assert((await readdir(join(directory,'../backups'))).some(n=>n.startsWith('evidence-')),'old measured evidence must be archived');
  }finally{await rm(root,{recursive:true,force:true});}
});

test('step review removes whole-character motion but preserves physical ancestor jumps',()=>{
  const canvas={width:1000,height:2000},tracker=new MotionStepTracker(canvas,4);
  const source=[480,170,495,190];
  const world=(points:number[],pose:any)=>points.flatMap((_,i)=>i%2?[]:[
    canvas.width/2+Math.cos(pose.angle)*(points[i]-canvas.width/2)-Math.sin(pose.angle)*(points[i+1]-canvas.height/2)+pose.x,
    canvas.height/2+Math.sin(pose.angle)*(points[i]-canvas.width/2)+Math.cos(pose.angle)*(points[i+1]-canvas.height/2)+pose.y]);
  const start={x:0,y:0,angle:0},moved={x:20,y:-10,angle:.05};
  const positions=new Float64Array(world(source,start));tracker.update(positions,start);
  positions.set(world(source,moved));tracker.update(positions,moved);
  assert(tracker.maxWorldStep>2);assert(tracker.maxStep<1e-10);
  const c=component('pendant');c.authoring.freeLength=20;c.limits.maxTravel=.1;
  const metric={invalid:0,root:0,fallback:0,limited:0,peak:1,final:0,maxStep:tracker.maxStep,recovery:{passed:true}};
  assert.deepEqual(motionIssues('support-release',c,metric),[]);
  // This could be inherited from a physical parent; it is not prescribed by
  // sourcePose and therefore must still fail the continuity gate.
  positions.set(world(source.map((v,i)=>v+(i%2?0:5)),moved));tracker.update(positions,moved);
  assert(Math.abs(tracker.maxStep-5)<1e-10);
  assert(motionIssues('support-release',c,{...metric,maxStep:tracker.maxStep}).includes('discontinuous-motion'));
});


test('Inochi nonlinear pendulum matches the small-angle period and preserves amplitude without damping',()=>{
  const body:any={freeLength:100,component:{authoring:{pivot:[0,0]},response:{frequencyHz:1,dampingRatio:0}},scene:{airflow:{x:0}},target:()=>[0,0]};
  const p=new InochiPendulum(body);p.angle=.02;const h=1/240;let minimum=Infinity,maximum=-Infinity,firstCrossing=0;
  for(let n=1;n<=240;n++){p.step(h);minimum=Math.min(minimum,p.angle);maximum=Math.max(maximum,p.angle);if(!firstCrossing&&p.angle<0)firstCrossing=n*h;}
  assert(Math.abs(firstCrossing-.25)<.005);assert(Math.abs(p.angle-.02)<1e-6);assert(minimum<-.01999&&maximum>.01999);
});
test('pendant world output converts to the attachment frame without accepting artwork state',()=>{
  let frame=.2;
  const body:any={freeLength:100,component:{authoring:{pivot:[0,0]},response:{frequencyHz:1,dampingRatio:0,inputGain:1}},scene:{airflow:{x:0}},target:([x,y]:number[])=>[Math.cos(frame)*x-Math.sin(frame)*y,Math.sin(frame)*x+Math.cos(frame)*y]};
  const p=new InochiPendulum(body),h=1/120;
  for(let n=0;n<60;n++){
    frame=.2+n*.001;p.step(h);
    assert(Math.abs(body.theta+frame-p.angle)<1e-10,'parent rotation must not be added a second time');
    const worldAngle=p.angle,worldSpeed=p.speed;body.theta=.03;body.angularVelocity=.7;
    assert.equal(p.angle,worldAngle);assert.equal(p.speed,worldSpeed);
  }
  p.reset();assert.equal(p.frameAngle,0);
});
test('short rigid parent drives a long rigid child continuously without feeding limits into the bob',()=>{
  const parent=component('pendant',{id:'mount',layerRefs:[{uuid:'mount',contentHash:'a'.repeat(64)}],supports:[{id:'head',at:[100,40]}]});
  parent.authoring.freeLength=20;parent.authoring.contour=[[90,40],[110,40],[110,60],[90,60]];parent.limits.maxAngle=2;
  const child=component('pendant',{id:'tail',layerRefs:[{uuid:'tail',contentHash:'a'.repeat(64)}],supports:[{id:'mount-tip',at:[100,60],componentId:'mount'}]});
  child.authoring.pivot=[100,60];child.authoring.contour=[[90,60],[110,60],[110,340],[90,340]];
  const scene=new ComponentScene(config([parent,child])),tracker=new MotionStepTracker(scene.config.source.canvas,scene.bodies.get('tail').positions.length);let independent=false;
  for(let step=0;step<=960;step++){
    if(step){applyTestInput(scene,'support-reverse',step);scene.step();}
    for(const b of scene.bodies.values()){assert(b.stats.valid);assert.equal(b.stats.root,0);assert(b.stats.travel<=b.maxDistance+1e-5);independent ||= Math.abs(b.motion.angle-b.theta-b.motion.frameAngle)>1e-6;}
    tracker.update(scene.bodies.get('tail').positions,scene.sourcePose);
  }
  assert(tracker.maxStep<2,'bounded output must not transmit a hard-stop jump to the child');
  assert(independent,'output mapping must retain independent physics');
  scene.reset();assert.equal(scene.bodies.get('mount').displayTheta,0);
});
test('pendant parent input gain scales inertia without detaching the artwork or carrying state through reset',()=>{
  const sample=(gain:number)=>{
    let pivot=[0,0];const body:any={freeLength:100,component:{authoring:{pivot:[0,0]},response:{frequencyHz:1,dampingRatio:.3,inputGain:gain}},scene:{airflow:{x:0}},target:()=>pivot};
    const p=new InochiPendulum(body);p.step(1/120);pivot=[10,0];p.step(1/120);
    assert.deepEqual(body.pivot,pivot);const angle=p.angle;p.reset();assert.equal(p.lastPivot,null);return angle;
  };
  assert.equal(sample(0),0);assert(Math.abs(sample(.1))<Math.abs(sample(1))*.11);
  const c=component('pendant');c.response.inputGain=0;const scene=new ComponentScene(config([c]));
  for(let step=1;step<=180;step++){scene.sourcePose={x:step/10,y:0,angle:0};scene.step();const b=scene.bodies.get(c.id);assert(b.stats.valid);assert.equal(b.theta,0);assert(b.positions.every((v:number,i:number)=>Math.abs(v-b.pose[i])<1e-8));}
});
test('bounded pendant output still reports sustained saturation for motion review',()=>{
  const c=component('pendant');c.authoring.freeLength=20;c.authoring.contour=[[90,40],[110,40],[110,60],[90,60]];c.limits.maxAngle=2;
  const scene=new ComponentScene(config([c])),b=scene.bodies.get(c.id);scene.airflow.x=2;let limited=0;
  for(let step=0;step<360;step++){scene.step();assert(b.stats.valid);assert(b.stats.travel<=b.maxDistance+1e-5);limited+=+b.stats.limited;}
  assert(limited>120,'a long plateau at the bound must not disappear from diagnostics');
});
test('parent inertia tuning keeps direct impulses and attachment motion independent',()=>{
 const original=component('pendant'),gentle=structuredClone(original);gentle.response.parentGain=.1;
 const a=new ComponentScene(config([original])),b=new ComponentScene(config([gentle]));
 for(const s of [a,b])s.bodies.get('pendant').impulse(100,300,50,0,300);
 assert.equal(a.bodies.get('pendant').motion.speed,b.bodies.get('pendant').motion.speed,'direct pointer force must retain inputGain');
 for(const s of [a,b])s.step();
 for(const s of [a,b]){s.sourcePose.x=10;s.step();assert.deepEqual(s.bodies.get('pendant').pivot,[110,40]);assert(s.bodies.get('pendant').stats.valid);}
 assert(Math.abs(b.bodies.get('pendant').motion.angle)<Math.abs(a.bodies.get('pendant').motion.angle));
});
test('small ornament residual gain retains its parent pose and independent physical state',()=>{
 const original=component('pendant'),small=structuredClone(original);small.response.outputGain=.2;
 const a=new ComponentScene(config([original])),b=new ComponentScene(config([small]));
 for(const s of [a,b]){s.sourcePose.x=1;s.bodies.get('pendant').impulse(100,300,50,0,300);}
 let difference=false;
 for(let step=0;step<240;step++){
  a.step();b.step();const first=a.bodies.get('pendant'),second=b.bodies.get('pendant');
  assert.equal(first.motion.angle,second.motion.angle);assert.equal(first.motion.speed,second.motion.speed);assert.deepEqual(first.pivot,second.pivot);
  assert(first.stats.valid&&second.stats.valid);difference ||= first.stats.travel>second.stats.travel*1.5;
 }
 assert(difference,'local residual should be smaller without suppressing the parent pose');
});
test('inherited inertia budget retains gentle response and limits fast input without detaching the pivot',()=>{
 const measure=(distance:number,limit?:number)=>{
  let pivot=[0,0];const body:any={freeLength:100,component:{authoring:{pivot:[0,0]},response:{frequencyHz:1,dampingRatio:.3,inputGain:1,parentVelocityLimit:limit}},scene:{airflow:{x:0}},target:()=>pivot};
  const p=new InochiPendulum(body);p.step(1/120);pivot=[distance,0];p.step(1/120);assert.deepEqual(body.pivot,pivot);return p.angle;
 };
 assert(Math.abs(measure(.01,2)/measure(.01)-1)<.0001,'gentle inherited motion keeps its original gain');
 assert(Math.abs(measure(10,2))<Math.abs(measure(10))*.2,'a fast input saturates smoothly');
 const c=component('pendant');c.response.parentVelocityLimit=2;const scene=new ComponentScene(config([c]));scene.sourcePose.x=10;scene.bodies.get(c.id).impulse(100,300,50,0,300);scene.step();assert(scene.bodies.get(c.id).stats.valid);
 c.response.parentVelocityLimit=0;assert.throws(()=>new ComponentScene(config([c])),/惯性限速/);
});
test('motion review rejects invisible response, repeated retreat, jumps and non-decaying motion',()=>{
  const c=component(),good={invalid:0,root:0,fallback:0,limited:0,peak:8,final:.01,maxStep:.3,recovery:{passed:true}};
  assert.deepEqual(motionIssues('light-brush',c,good),[]);
  assert(motionIssues('light-brush',c,{...good,peak:0}).includes('weak-response'));
  assert(motionIssues('support-release',c,{...good,fallback:500}).includes('persistent-retreat'));
  assert(motionIssues('tip-impulse',c,{...good,maxStep:20}).includes('discontinuous-motion'));
  assert(motionIssues('tip-impulse',c,{...good,final:7,recovery:{passed:false}}).includes('unsettled'));
});
