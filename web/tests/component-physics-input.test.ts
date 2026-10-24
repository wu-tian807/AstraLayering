import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComponentScene } from '../studio/component-physics-model.js';
import { ComponentPhysicsPanel } from '../studio/component-physics-panel.js';
import { componentDefaults } from '../studio/component-physics-schema.js';
import { applyTestInput } from '../studio/physics-test-input.js';

const component = (id:string, x:number) => ({
  id, name:id, kind:'pendant', priority:'primary', enabled:true,
  sourcePartIds:[id], layerRefs:[{uuid:id,contentHash:'a'.repeat(64)}],
  supports:[{id:id+'-root',at:[x,20]}], ...componentDefaults('pendant'),
  authoring:{freeLength:32,pivot:[x,20],contour:[[x,20],[x+4,40],[x,52],[x-4,40]],holes:[]},
});
const scene = () => new ComponentScene({kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:200,height:200}},components:[component('left',40),component('right',140)]});
const panel = (s:any, extra:any={}) => Object.assign(Object.create(ComponentPhysicsPanel.prototype),{
  formal:true,enabled:true,category:'floating',bodies:s.bodies,scope:'all',selected:'left',force:.7,radius:90,sync(){},...extra,
});

test('workbench pulse rotates every free ornament without selecting it, using the same load as review', () => {
  const s=scene(),review=scene(),p=panel(s);
  p.pulse();applyTestInput(review,'tip-impulse',60);
  for(const [id,b] of s.bodies) {
    assert.equal(b.impulses,1);
    assert.equal(b.motion.speed,review.bodies.get(id).motion.speed,'review and live pulse used different torque');
    assert(Math.abs(b.motion.speed)>.4,'pulse landed near the attachment instead of the free end');
  }
  let peak=0;
  for(let step=0;step<120;step++) {
    s.step();
    for(const b of s.bodies.values()) {
      assert(b.stats.valid);assert(b.stats.root<1e-8);
      peak=Math.max(peak,b.stats.travel);
    }
  }
  assert(peak>.5,'a short pendant must visibly respond to a test pulse');
});

test('current-component scope and the physics switch still control the live pulse', () => {
  const s=scene(),p=panel(s,{scope:'current'});
  p.pulse();assert.equal(s.bodies.get('left').impulses,1);assert.equal(s.bodies.get('right').impulses,0);
  p.enabled=false;p.scope='all';p.pulse();assert.equal(s.bodies.get('left').impulses,1);assert.equal(s.bodies.get('right').impulses,0);
});
