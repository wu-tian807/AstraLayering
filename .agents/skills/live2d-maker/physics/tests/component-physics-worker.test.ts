import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentScene } from '../../shared/physics-core/component-physics-model.js';
import { componentDefaults } from '../../shared/physics-core/component-physics-schema.js';
import { advancePhysicsJob, physicsSnapshot } from '../../shared/physics-evidence/component-physics-worker.js';
import { applyTestInput } from '../../shared/physics-evidence/physics-test-input.js';
import { airflowAt } from '../../shared/physics-core/physics-airflow.js';

const rig = () => ({ kind:'astra-component-physics', version:1, solver:'astra-component-physics-1', source:{canvas:{width:300,height:400}}, components:['strand','cloth'].map(kind=>({id:kind,name:kind,kind,priority:'primary',enabled:true,sourcePartIds:[kind],layerRefs:[{uuid:kind,contentHash:'a'.repeat(64)}],supports:[{id:'root',at:[100,40]}],...componentDefaults(kind),authoring:{freeLength:300,transitionPixels:55,fixedRegions:[[[50,20],[150,20],[150,60],[50,60]]],contour:[[50,20],[150,20],[150,340],[50,340]],centerline:[[100,40],[100,80],[100,140],[100,200],[100,260],[100,320]],widths:[55,55,50,45,35,25],subdivisions:1,...(kind==='cloth'?{controlGrid:[4,8]}:{})}})) });

test('worker batches preserve every fixed step, replay, impulses and exact mesh snapshots',()=>{
 for(const playback of ['', 'support-reverse']) {
  const expected=new ComponentScene(rig()),actual=new ComponentScene(rig());
  let elapsed=0,replayStep=0,buffer:ArrayBuffer|undefined;let step=0;
  for(const steps of [1,2,6,3,6,6,6,6,6,6,6,6]) {
   const commands=step===0?[{type:'impulse',id:'cloth',args:[100,310,90,0,100]}]:[];
   for(const c of commands)expected.bodies.get(c.id).impulse(...c.args);
   for(let k=0;k<steps;k++){elapsed+=1/120;if(playback)applyTestInput(expected,playback,++replayStep);else expected.airflow=airflowAt(elapsed,.2,0);expected.step();}
   const clock=advancePhysicsJob(actual,{steps,commands,elapsed:elapsed-steps/120,replayStep:replayStep-(playback?steps:0),playback,breeze:true,strength:.2,direction:0,demo:false});
   assert(Math.abs(clock.elapsed-elapsed)<1e-12);assert.equal(clock.replayStep,replayStep);
   const snap=physicsSnapshot(actual,buffer);if(buffer)assert.equal(snap.buffer,buffer);buffer=snap.buffer;
   assert.equal(snap.clockStep,expected.stepNumber);
   const values=new Float64Array(snap.buffer);
   for(const c of snap.components){const b=expected.bodies.get(c.id);for(const [field,[offset,length]]of Object.entries(c.arrays) as any)for(let i=0;i<length;i++)assert(Math.abs(values[offset+i]-b[field][i])<1e-10);assert.equal(c.stats.valid,b.stats.valid);assert.equal(c.impulses,b.impulses);}
   step+=steps;
  }
  actual.reset();expected.reset();assert.deepEqual(physicsSnapshot(actual).components.map(c=>c.stats),physicsSnapshot(expected).components.map(c=>c.stats));
 }
});
