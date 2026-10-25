import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentPhysicsLiveRunner } from '../studio/component-physics-panel.js';
import { ComponentScene } from '../studio/component-physics-model.js';
import { componentDefaults } from '../studio/component-physics-schema.js';
import { advancePhysicsJob, physicsSnapshot } from '../studio/component-physics-worker.js';

const rig = () => ({kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:200,height:350}},components:[{id:'hair',name:'hair',kind:'strand',priority:'primary',enabled:true,sourcePartIds:['hair'],layerRefs:[{uuid:'hair',contentHash:'a'.repeat(64)}],supports:[{id:'root',at:[100,40]}],...componentDefaults('strand'),authoring:{freeLength:280,transitionPixels:30,fixedRegions:[[[60,20],[140,20],[140,60],[60,60]]],contour:[[60,20],[140,20],[140,320],[60,320]],centerline:[[100,40],[100,100],[100,220],[100,320]],widths:[40,40,35,25],subdivisions:1}}]});

function setup(t: any) {
  class Worker {
    onmessage: any; jobs: any[] = []; scene: any; terminated = false;
    postMessage(job: any) {
      if(job.type==='init') { this.scene=new ComponentScene(job.config);this.onmessage({data:{type:'ready'}}); }
      else if(job.type==='reset') this.scene.reset();
      else this.jobs.push(job);
    }
    flush() {
      const job=this.jobs.shift();assert(job);
      this.onmessage({data:{type:'frame',epoch:job.epoch,manual:job.manual,...advancePhysicsJob(this.scene,job),...physicsSnapshot(this.scene,job.buffer)}});
    }
    terminate() { this.terminated=true; }
  }
  const prior={Worker:globalThis.Worker,raf:globalThis.requestAnimationFrame,cancel:globalThis.cancelAnimationFrame};
  const frames=new Map<number,FrameRequestCallback>();let frameId=0;
  (globalThis as any).Worker=Worker;
  globalThis.requestAnimationFrame=callback=>{frames.set(++frameId,callback);return frameId;};
  globalThis.cancelAnimationFrame=id=>{frames.delete(id);};
  const config=rig(),scene=new ComponentScene(config),panel:any={config,scene,bodies:scene.bodies,enabled:true,paused:false,elapsed:0,replayStep:0,playback:'',breeze:true,breezeStrength:.2,breezeDirection:0,renders:[] as number[],render(){this.renders.push(this.scene.stepNumber);},sync(){},changed(){},error(message:string){throw Error(message);}};
  const runner=new ComponentPhysicsLiveRunner(panel),worker=runner.worker as any;
  worker.onmessage({data:{type:'boot'}});
  t.after(()=>{runner.dispose();(globalThis as any).Worker=prior.Worker;globalThis.requestAnimationFrame=prior.raf;globalThis.cancelAnimationFrame=prior.cancel;});
  return {runner,worker,panel,frames,paint(){const pending=[...frames.values()];frames.clear();for(const callback of pending)callback(16);}};
}

test('live jobs publish intermediate exact poses and drain demand without another animation frame',t=>{
  const {runner,worker,panel}=setup(t),expected=new ComponentScene(rig());
  panel.bodies.get('hair').impulse(100,300,90,0,100);
  expected.bodies.get('hair').impulse(100,300,90,0,100);
  assert(runner.advance(6,false));assert.equal(worker.jobs.length,1);
  for(let i=0;i<3;i++) {
    assert.equal(worker.jobs[0].steps,2);
    worker.flush();
    advancePhysicsJob(expected,{steps:2,elapsed:i/60,replayStep:0,playback:'',breeze:true,strength:.2,direction:0});
    assert.deepEqual(panel.bodies.get('hair').positions,expected.bodies.get('hair').positions);
    assert.equal(panel.scene.stepNumber,(i+1)*2);
  }
  assert.equal(worker.jobs.length,0);assert.equal(runner.pendingSteps,0);
  assert.equal(panel.bodies.get('hair').impulses,1);
});

test('multiple Worker replies keep exact poses but present the latest pose once per display frame',t=>{
  const {runner,worker,panel,frames,paint}=setup(t);
  runner.advance(6,false);worker.flush();worker.flush();worker.flush();
  assert.equal(panel.scene.stepNumber,6);assert.equal(frames.size,1);
  assert.deepEqual(panel.renders,[],'Worker completion must not draw outside the display frame');
  paint();assert.deepEqual(panel.renders,[6]);assert.equal(frames.size,0);
  runner.advance(2,false);worker.flush();paint();assert.deepEqual(panel.renders,[6,8]);
});

test('manual stepping presents immediately and reset or disposal cancels queued presentation',t=>{
  const {runner,worker,panel,frames,paint}=setup(t);
  runner.advance(2,false);worker.flush();assert.equal(frames.size,1);
  runner.advance(2,true);worker.flush();assert.deepEqual(panel.renders,[4]);assert.equal(frames.size,0);
  runner.advance(2,false);worker.flush();panel.scene.reset();paint();assert.deepEqual(panel.renders,[4]);
  runner.advance(2,false);worker.flush();assert.equal(frames.size,1);
  runner.dispose();paint();assert.equal(frames.size,0);assert.deepEqual(panel.renders,[4]);
});

test('pause retains the visible pose and pending demand; reset discards old demand and snapshots',t=>{
  const {runner,worker,panel}=setup(t);
  runner.advance(6,false);worker.flush();
  const before=new Float64Array(panel.bodies.get('hair').positions);
  panel.paused=true;worker.flush();
  assert.deepEqual(panel.bodies.get('hair').positions,before);assert.equal(worker.jobs.length,0);
  assert.equal(runner.pendingSteps,2);
  panel.paused=false;runner.advance(0,false);worker.flush();assert.equal(panel.scene.stepNumber,6);
  runner.advance(6,false);panel.scene.reset();worker.flush();
  assert.equal(panel.scene.stepNumber,0);assert.equal(runner.pendingSteps,0);
  assert.equal(worker.jobs.length,0);
  panel.enabled=false;assert.equal(runner.advance(6,false),false);
});
