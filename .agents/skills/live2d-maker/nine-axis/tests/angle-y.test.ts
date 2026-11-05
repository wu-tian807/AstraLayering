import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContinuationEditTool } from '../continuation-edit-tool.ts';
import { startContinuation, checkContinuation, buildContinuation } from '../continuation.ts';
import { mirrorDocument } from '../head.ts';
import { editNineAxis } from '../../shared/nine-axis-edit.js';
import { evaluatePoints } from '../../shared/nine-axis-model.js';
import { checkAxisSource } from '../axis-groups.ts';
const box = [0,0,10,10], rest = [[0,0],[10,0],[0,10],[10,10]];
const part = (id:string):any=>({id,level:'face',group:'test',texture:'layers/a.png',textureBounds:box,bbox:box,cols:1,rows:1,keyforms:{'0':structuredClone(rest),'-30':structuredClone(rest),'30':structuredClone(rest)}});
const fixture=():any=>({version:2,kind:'head-nine-axis',axis:5,canvas:[20,20],source:{document:'source.kra',sha256:'x'},levels:[{id:'face',includes:['face']}],parameters:[{id:'ParamAngleX',keys:[-30,0,30]},{id:'ParamAngleY',keys:[0]}],deformers:[],parts:[part('a'),part('b'),part('neck')]});
const signal=new AbortController().signal;
const result=(r:any)=>JSON.parse(r.contentItems[0].text);
test('independent pitch rejects changed shared clipping before saving; source completion also rejects clip and role changes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'astra-pitch-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const neutral = join(root, 'neutral'); await mkdir(join(neutral, 'layers'), { recursive: true });
  await writeFile(join(neutral, 'deformers.json'), JSON.stringify(fixture()));
  await writeFile(join(neutral, 'layers/a.png'), 'original pixels');
  for (const stage of ['up', 'down'] as const) {
    const output = join(root, stage), tool = createContinuationEditTool(output, neutral, stage);
    await tool.execute({}, signal);
    const path = join(output, `face-${stage}.json`), before = await readFile(path);
    await assert.rejects(tool.execute({ operations: [{ action: 'clip', id: 'a', by: ['b'] }] }, signal), /a：不能替换共享原图层的 clip/);
    assert.deepEqual(await readFile(path), before, 'rejected clip must not replace the author');
    const built = await buildContinuation(output, neutral, stage);
    await checkAxisSource(neutral, built);
    for (const [field, value] of [['clip', { by: ['b'] }], ['role', 'mask']] as const) {
      const changed = { ...built, doc: structuredClone(built.doc) };
      Object.assign(changed.doc.parts[0], { [field]: value });
      await assert.rejects(checkAxisSource(neutral, changed), new RegExp('原图层的 ' + field));
    }
    await tool.execute({ operations: [{ action: 'create_warp', id: 'chosen', targets: ['a', 'b'] },
      { action: 'transform', id: 'chosen', y: stage === 'up' ? 25 : -25, translate: [1, 2] }] }, signal);
    await checkAxisSource(neutral, await buildContinuation(output, neutral, stage));
  }
});
test('Y parent movement and local correction preserve X and fixed neck; newly defined warps inherit all keys',()=>{
  const upstream=fixture(), y=startContinuation(upstream,'hash','up');
  const doc=editNineAxis(y,[{action:'create_warp',id:'author-group',targets:['a','b']},{action:'create_warp',id:'local',parent:'author-group',targets:['a']},{action:'transform',id:'author-group',y:25,translate:[3,2]},{action:'transform',id:'local',y:25,translate:[1,0]}]);
  checkContinuation(doc,upstream,'hash','up');
  assert.deepEqual([...evaluatePoints(doc,doc.parts[0],0,25)].slice(0,2),[4,2]);
  assert.deepEqual([...evaluatePoints(doc,doc.parts[1],0,25)].slice(0,2),[3,2]);
  for(const p of doc.parts)assert.deepEqual([...evaluatePoints(doc,p,-30,0)],rest.flat());
  assert.deepEqual([...evaluatePoints(doc,doc.parts[2],-30,25)],rest.flat());
  assert.deepEqual(Object.keys(doc.deformers[1].keyformsY!).sort(),['25']);
  const changed=editNineAxis(doc,[{action:'transform',id:'a',x:-30,translate:[1,0]}]);
  assert.throws(()=>checkContinuation(changed,upstream,'hash','up'),/不能改动已制作的轴/);
  assert.throws(()=>checkContinuation(doc,upstream,'changed','up'),/上游已变化/);
});
test('corners mirror composed hierarchies with artist-defined node pairs',()=>{
  const upstream=fixture(); upstream.parts=upstream.parts.filter((p:any)=>p.id!=='neck');
  const up=startContinuation(upstream,'x','up'), y=startContinuation(up,'up','down'), xy=startContinuation(y,'y','xy');
  const doc=editNineAxis(xy,[{action:'create_warp',id:'custom-far',targets:['a']},{action:'create_warp',id:'custom-near',targets:['b']},{action:'mirror_pair',targets:['custom-far','custom-near']},{action:'mirror_pair',targets:['a','b']},{action:'transform',id:'custom-far',x:-30,y:25,translate:[3,1]},{action:'transform',id:'a',x:-30,y:25,translate:[1,0]},{action:'transform',id:'custom-near',x:-30,y:25,translate:[2,0]}]);
  checkContinuation(doc,y,'y','xy');
  assert.deepEqual(Object.keys(doc.deformers[0].keyformsXY!).sort(),['-30,-25','-30,25','30,-25','30,25']);
  const mirrored=mirrorDocument(doc,5,'keyformsXY');
  assert.deepEqual([...evaluatePoints(mirrored,mirrored.parts[1],30,25)].slice(0,2),[-4,1]);
  assert.deepEqual([...evaluatePoints(mirrored,mirrored.parts[0],30,25)].slice(0,2),[-2,0]);
  const removed=editNineAxis(doc,[{action:'remove_warp',id:'custom-near'}]);
  assert.equal(removed.deformers[0].mirror,undefined);
});
test('continuation tool initializes and writes source atomically, rejects stale revisions and missing completed jaw mask',async t=>{
  const root=await mkdtemp(join(tmpdir(),'astra-continuation-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const x=join(root,'x'),y=join(root,'y');await mkdir(join(x,'layers'),{recursive:true});
  await writeFile(join(x,'deformers.json'),JSON.stringify(fixture()));await writeFile(join(x,'layers/a.png'),'png');
  const tool=createContinuationEditTool(y,x,'up'), first=result(await tool.execute({},signal));
  await tool.execute({revision:first.revision,operations:[{action:'create_warp',id:'group',targets:['a','b']},{action:'transform',id:'group',y:25,translate:[2,0]}]},signal);
  const saved=await readFile(join(y,'face-up.json'),'utf8');
  await assert.rejects(tool.execute({revision:first.revision,notes:'stale'},signal),/revision/);
  await assert.rejects(tool.execute({operations:[{action:'transform',id:'a',x:-30,translate:[2,0]}]},signal),/up 阶段只编辑/);
  assert.equal(await readFile(join(y,'face-up.json'),'utf8'),saved);
  const ybuilt=await buildContinuation(y,x,'up');await writeFile(join(y,'deformers.json'),JSON.stringify(ybuilt.doc));await mkdir(join(y,'layers'));await writeFile(join(y,'layers/a.png'),'png');
  const down=join(root,'down');await createContinuationEditTool(down,y,'down').execute({},signal);
  const downbuilt=await buildContinuation(down,y,'down');await writeFile(join(down,'deformers.json'),JSON.stringify(downbuilt.doc));await mkdir(join(down,'layers'));await writeFile(join(down,'layers/a.png'),'png');
  const xy=join(root,'xy');await createContinuationEditTool(xy,down,'xy').execute({},signal);
  const xybuilt=await buildContinuation(xy,down,'xy');await writeFile(join(xy,'deformers.json'),JSON.stringify(xybuilt.doc));await mkdir(join(xy,'layers'));await writeFile(join(xy,'layers/a.png'),'png');
  const jaw=join(root,'jaw');await createContinuationEditTool(jaw,xy,'jaw').execute({},signal);
  await assert.rejects(buildContinuation(jaw,xy,'jaw'),/没有蒙版/);
  await writeFile(join(x,'deformers.json'),JSON.stringify({...fixture(),notes:'new upstream'}));
  await assert.rejects(tool.execute({},signal),/上游已变化/);
});

 test('down is independent of up key edits and protects the completed up pose and fixed neck',()=>{
  const x=fixture(),up=startContinuation(x,'x','up');
  const madeUp=editNineAxis(up,[{action:'create_warp',id:'face-group',targets:['a','b']},{action:'transform',id:'face-group',y:25,translate:[2,-1]}]) as typeof up;
  checkContinuation(madeUp,x,'x','up');
  const down=startContinuation(madeUp,'up','down');
  const madeDown=editNineAxis(down,[{action:'transform',id:'face-group',y:-25,translate:[-1,3]}]) as typeof down;
  checkContinuation(madeDown,madeUp,'up','down');
  for(const p of madeDown.parts)assert.deepEqual([...evaluatePoints(madeDown,p,0,25)],[...evaluatePoints(madeUp,madeUp.parts.find(q=>q.id===p.id)!,0,25)]);
  assert.throws(()=>checkContinuation(editNineAxis(madeDown,[{action:'transform',id:'a',y:25,translate:[1,0]}]),madeUp,'up','down'),/不能改动已制作的轴/);
  assert.throws(()=>checkContinuation(editNineAxis(madeDown,[{action:'transform',id:'neck',y:-25,translate:[0,1]}]),madeUp,'up','down'),/脖子不能跟随转头移动/);
});
