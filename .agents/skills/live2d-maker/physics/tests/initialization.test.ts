import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeMotionParameters,initializeConfigParameters} from '../../shared/physics-core/motion-presets.js';
import {compareMotionTarget} from '../motion-targets.ts';
import {matchingReferenceComponents,validateReferenceCoverage} from '../reference.ts';
const component=(id='front')=>({id,enabled:true,kind:'strand',sourcePartIds:['character:hair/side_hair_left'],layerRefs:[{uuid:id,contentHash:'pixels'}],supports:[{id:'root',at:[20,10]}],authoring:{freeLength:180,fixedRegions:[[[0,0],[40,0],[40,15]]],centerline:[[20,10],[20,40],[20,190]],widths:[20,20,10]},limits:{maxAngle:15,maxTravel:.13},response:{frequencyHz:.9,dampingRatio:.24,inputGain:.65},material:{}});
test('局部参数初始化保留已有认可组件；空映射无副作用，未知 ID 拒绝',()=>{
 const config={components:[component('accepted'),component('new')]},before=structuredClone(config);
 const next=initializeConfigParameters(config,{new:'front-hair'});
 assert.deepEqual(next.components[0],before.components[0]);assert.equal(next.components[1].response.inputGain,2);
 assert.deepEqual(config,before);assert.deepEqual(initializeConfigParameters(config,{}),before);
 assert.throws(()=>initializeConfigParameters(config,{missing:'front-hair'}),/未知初始化组件/);
 assert.equal(initializeConfigParameters(config).components[0].response.inputGain,2);
});
test('长度相关初始参数不修改原绑定、固定区或最大约束',()=>{
 const c=component(),original=structuredClone(c),next=initializeMotionParameters(c);
 assert.deepEqual(c,original);assert.deepEqual(next.limits,c.limits);assert.deepEqual(next.authoring.fixedRegions,c.authoring.fixedRegions);
 assert.equal(next.response.outputGain,3.2);assert.equal(next.response.inputGain,2);
 const longer=component();longer.authoring.freeLength=360;assert(initializeMotionParameters(longer).response.frequencyHz<next.response.frequencyHz);
});
test('静止或缩水的候选不能凭平滑度通过认可运动目标',()=>{
 const c=component(),reference={peak:17,samples:[{travel:0},{travel:17},{travel:8},{travel:0}]};
 assert.deepEqual(compareMotionTarget(c,reference,c,reference).issues,[]);
 const weak={peak:5,samples:[{travel:0},{travel:5},{travel:1},{travel:0}]};
 assert(compareMotionTarget(c,weak,c,reference).issues.includes('reference-amplitude'));
 assert(compareMotionTarget(c,weak,c,reference).issues.includes('reference-activity'));
 const cropped=component();cropped.authoring.freeLength=80;assert(compareMotionTarget(cropped,reference,c,reference).issues.includes('reference-free-region'));
});
test('参考身份要求 UUID、像素及来源，不按名字匹配；漏做已有活动部件会被拒收',()=>{
 const c=component(),reference={config:{components:[c]}},catalog={layers:[{uuid:c.id,contentHash:'pixels',partPath:c.sourcePartIds[0]}]};
 assert.equal(matchingReferenceComponents(reference,catalog).length,1);
 assert.throws(()=>validateReferenceCoverage({parts:[{id:c.sourcePartIds[0],decision:'defer'}]},reference,catalog),/遗漏参考/);
 catalog.layers[0].contentHash='changed';assert.equal(matchingReferenceComponents(reference,catalog).length,0);
});
test('不复制参考的已测异常，但仍拒绝缩短同源自由段',()=>{
 const c=component(),reference={peak:17,samples:[{travel:0},{travel:17}],referenceAssemblyIssues:['persistent-limit']};
 const comparison=compareMotionTarget(c,{peak:12,samples:[{travel:0},{travel:12}]},c,reference);
 assert.equal(comparison.usable,false);assert.equal(comparison.reason,'reference-motion-issues');assert.deepEqual(comparison.issues,[]);
 const shorter=component();shorter.authoring.freeLength=80;
 assert(compareMotionTarget(shorter,{peak:12,samples:[]},c,reference).issues.includes('reference-free-region'));
});
