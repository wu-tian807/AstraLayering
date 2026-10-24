import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { zipSync, strToU8 } from 'fflate';
import { runWorkflow, parseRunArguments } from '../run.ts';
import type { NativeInspect } from '../native.ts';
import { loadWorkflowEnvironment } from '../../shared/codex/environment.ts';
import type { AgentRequest } from '../../shared/raster/agent.ts';
import { rasterCodexConfig } from '../../shared/raster/agent.ts';
import { pipelineAgentSteps } from '../../shared/agents/preflight.ts';
import { parseArguments } from '../../workflow/run.ts';
import { runTask } from '../../workflow/runner.ts';
import { readRun, taskStatus } from '../../workflow/state.ts';

const xml = `<DOC><IMAGE width="2" height="2"><layers>
<layer name="Caster" uuid="caster" nodetype="paintlayer" compositeop="normal"/>
<layer name="Receiver group" uuid="group" nodetype="grouplayer" passthrough="0"><layers>
<layer name="Shadow" uuid="shadow" nodetype="paintlayer" colorspacename="RGBA" channelflags="1110" compositeop="normal"/>
<layer name="Face" uuid="face" nodetype="paintlayer" compositeop="normal"/>
</layers></layer></layers></IMAGE></DOC>`;
async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'astra-shadow-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = join(root, 'case'), source = join(task, 'character-assembly/step01');
  const color = await sharp(Buffer.from([180, 160, 140, 255, 180, 160, 140, 128, 180, 160, 140, 0, 180, 160, 140, 255]),
    { raw: { width: 2, height: 2, channels: 4 } }).png().toBuffer();
  const kra = zipSync({ 'maindoc.xml': strToU8(xml), 'mergedimage.png': color });
  await mkdir(source, { recursive: true });
  await writeFile(join(source, 'character-assembled.kra'), kra);
  await writeFile(join(source, 'character-assembled.png'), color);
  for (const id of ['part-layering', 'clothing-part-layering']) {
    const path = join(task, id); await mkdir(join(path, 'references'), { recursive: true });
    await writeFile(join(path, 'groups.json'), JSON.stringify({ groups: [{ id: 'hair' }, { id: 'face' }] }));
    await writeFile(join(path, 'occlusion.json'), '{}');
  }
  await writeFile(join(task, 'part-layering/references/simplified-subject.webp'), color);
  const options = { name: 'case', dir: root, krita: process.execPath };
  const inspectNative: NativeInspect = async (_document, relations, output) => {
    await mkdir(output,{recursive:true});
    await writeFile(join(output,'native-final.png'),color);
    await writeFile(join(output,'without-shadows.png'),color);
    for (const [i,r] of relations.entries()) {
      await writeFile(join(output,`paint-${i}.png`),color); await writeFile(join(output,`receiver-${i}.png`),color);
      for (const [j,_p] of r.testOffsets.entries()) await writeFile(join(output,`offset-${i}-${j}.png`),color);
    }
    return {success:true,width:2,height:2,nativeVersion:'fixture',relations:relations.map((r,i)=>({id:r.id,bounds:[0,0,2,2],fullPaint:`paint-${i}.png`,receiver:`receiver-${i}.png`,clipBase:`receiver-${i}.png`,frames:r.testOffsets.map((offset:number[],j:number)=>({offset,file:`offset-${i}-${j}.png`,clipped:`offset-${i}-${j}.png`}))}))};
  };
  const deps = { inspectNative, environment: loadWorkflowEnvironment({}, root), preflight: async (executable: string) => ({ executable, version: 'fixture' }) };
  const deliver = async (request: AgentRequest) => {
    await request.onEvent({ type: 'thread.started', thread_id: request.threadId ?? (request.step + '-thread') });
    const path = join(request.directory, 'step01');
    if (request.step === 'shadow_mask') {
      await writeFile(join(path, 'character-shadowed.kra'), kra);
      await writeFile(join(path, 'character-shadowed.png'), color);
      await writeFile(join(path, 'face-review.png'), color);
      await writeFile(join(path, 'shadows.json'), JSON.stringify({ version: 2, shadows: [{
        id: 'hair-face', casterPartId: 'character:hair', receiverPartId: 'character:face',
        casterLayerUuids: ['caster'], receiverLayerUuids: ['face'], shadowLayerUuid: 'shadow', clipBaseLayerUuid: 'face',
        follow: 'caster', blendMode: 'normal', testOffsets:[[0,0],[1,0]], notes:'fixture coverage',
      }], excluded: [] }));
    } else {
      await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 128, g: 128, b: 255 } } }).png().toFile(join(path, 'normal.png'));
      await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 180, g: 180, b: 180 } } }).png().toFile(join(path, 'depth.png'));
    }
    await writeFile(join(path, 'report.md'), 'fixture delivery');
    return { status: 'completed' as const, summary: 'fixture complete' };
  };
  return { root, task, source, color, kra, options, deps, deliver };
}
test('默认蒙版；全局保存、透传并仅预检所选分支', async t => {
  assert.equal(parseRunArguments(['--name', 'case']).shadowMode, 'mask');
  assert.throws(() => parseRunArguments(['--name', 'case', '--shadow-mode', 'unknown']));
  const parsed = parseArguments(['--name', 'case', '--shadow-mode', 'normal-depth']);
  assert.ok(parsed.mode !== 'help'); assert.equal(parsed.options.shadowMode, 'normal-depth');
  assert.deepEqual(pipelineAgentSteps('shadow', false, 'mask'), ['shadow_mask']);
  assert.deepEqual(pipelineAgentSteps('shadow', false, 'normal-depth'), ['shadow_maps']);
  const f = await fixture(t);
  assert.equal(f.deps.environment.stepImages.shadow_mask, undefined);
  assert.equal(rasterCodexConfig('shadow_mask').features.image_generation, false);
  assert.equal(rasterCodexConfig('shadow_maps').features.image_generation, true);
  await runTask({ ...f.options, from: 'shadow', to: 'shadow', shadowMode: 'normal-depth' }, {
    ...f.deps, execute: async (id, run) => {
      assert.equal(id, 'shadow'); assert.equal(run.shadowMode, 'normal-depth'); return { summary: 'maps' };
    },
  });
  assert.equal((await readRun(f.task, 'case'))?.shadowMode, 'normal-depth');
  await runTask({ name: 'case', dir: f.root }, { ...f.deps, execute: async (_id, run) => {
    assert.equal(run.shadowMode, 'normal-depth'); return { summary: 'resumed' };
  } });
  assert.equal((await taskStatus(f.options)).pipelines[0].mode, 'normal-depth');
});
test('dry-run 与缺上游不调用模型、不写分支，提示词包含精度与投影规则', async t => {
  const f = await fixture(t);
  for (const mode of ['mask', 'normal-depth'] as const) {
    const prompt = await runWorkflow({ ...f.options, shadowMode: mode, dryRun: true }, { ...f.deps,
      agent: async () => assert.fail('dry run must not call models') });
    assert.ok(prompt.includes(f.source)); assert.match(prompt, mode === 'mask' ? /deformer/ : /白近黑远/);
  }
  await assert.rejects(readFile(join(f.task, 'shadow/selection.json')), { code: 'ENOENT' });
  await rm(join(f.source, 'character-assembled.kra'));
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async () => assert.fail('missing upstream') }), /缺少上游/);
});
test('中断保留同分支 thread；两套产物共存，重跑只检查选择的产物', async t => {
  const f = await fixture(t); let calls = 0;
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    await request.onEvent({ type: 'thread.started', thread_id: 'retained-mask' });
    await writeFile(join(request.directory, 'step01/work.kra'), 'progress'); throw new Error('interrupted');
  } }), /interrupted/);
  await runWorkflow(f.options, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, 'retained-mask'); assert.equal(await readFile(join(request.directory, 'step01/work.kra'), 'utf8'), 'progress');
    calls++; return f.deliver(request);
  } });
  const mask = await readFile(join(f.task, 'shadow/mask/step01/character-shadowed.kra'));
  await runWorkflow({ ...f.options, shadowMode: 'normal-depth' }, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined); assert.equal(request.step, 'shadow_maps'); calls++; return f.deliver(request);
  } });
  assert.equal(calls, 2);
  assert.deepEqual(await readFile(join(f.task, 'shadow/mask/step01/character-shadowed.kra')), mask);
  const normal = await sharp(join(f.task, 'lighting/normal.png')).raw().toBuffer();
  assert.deepEqual([...normal.filter((_value, i) => i % 4 === 3)], [255, 128, 0, 255]);
  await rm(join(f.task, 'shadow/mask/step01/character-shadowed.png'));
  await runWorkflow({ ...f.options, shadowMode: 'normal-depth' }, { ...f.deps, agent: async () => assert.fail('maps retained') });
  // Deleting a recorded delivery retries that step.
  await runWorkflow(f.options, { ...f.deps, agent: async request => { assert.equal(request.threadId, undefined); calls++; return f.deliver(request); } });
  assert.equal(calls, 3);
  await runWorkflow({ ...f.options, shadowMode: 'normal-depth' }, { ...f.deps, agent: async () => assert.fail('maps retained') });
  await rm(join(f.task, 'shadow/mask/step01/report.md'));
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async () => assert.fail('missing completed file') }), /交付缺失/);
  assert.equal(JSON.parse(await readFile(join(f.task, 'shadow/selection.json'), 'utf8')).mode, 'normal-depth');
  assert.deepEqual(await readFile(join(f.source, 'character-assembled.kra')), Buffer.from(f.kra));
});
test('输入变化保留旧分支，新建 thread，只更新本次路线', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: f.deliver });
  await runWorkflow({ ...f.options, shadowMode: 'normal-depth' }, { ...f.deps, agent: f.deliver });
  const previousMaps = await readFile(join(f.task, 'shadow/normal-depth/run.json'));
  await writeFile(join(f.task, 'part-layering/occlusion.json'), '{"changed":true}');
  await runWorkflow(f.options, { ...f.deps, agent: async request => {
    assert.equal(request.threadId, undefined); return f.deliver(request);
  } });
  assert.equal((await readdir(join(f.task, 'shadow'))).filter(name => name.startsWith('mask.previous-')).length, 1);
  assert.deepEqual(await readFile(join(f.task, 'shadow/normal-depth/run.json')), previousMaps);
});
test('法线深度只生成一步；旧调校目录不阻止贴图恢复与发布', async t => {
  const f = await fixture(t);
  const options = { ...f.options, shadowMode: 'normal-depth' as const };
  await runWorkflow(options, { ...f.deps, agent: async request => {
    assert.equal(request.step, 'shadow_maps');
    assert.equal(request.tools?.length ?? 0, 0);
    return f.deliver(request);
  } });
  const output = join(f.task, 'shadow/normal-depth');
  const normal = await readFile(join(output, 'step01/normal.png'));
  await assert.rejects(readFile(join(output, 'step02/light.json')), { code: 'ENOENT' });
  await mkdir(join(output, 'step02'));
  await writeFile(join(output, 'step02/light.json'), '{"settings":{"lightingMix":0}}');
  await rm(join(output, 'step01/source.json'));
  await rm(join(f.task, 'lighting'), { recursive: true });
  await runWorkflow(options, { ...f.deps, agent: async () => assert.fail('completed maps must be reused') });
  assert.deepEqual(await readFile(join(output, 'step01/normal.png')), normal);
  assert.deepEqual(await readFile(join(f.task, 'lighting/normal.png')), normal);
  assert.equal(JSON.parse(await readFile(join(output, 'step01/source.json'), 'utf8')).mode, 'normal-depth');
  const archive = (await readdir(output)).find(path => path.startsWith('lighting.previous-'));
  assert.ok(archive);
  assert.equal(await readFile(join(output, archive, 'light.json'), 'utf8'), '{"settings":{"lightingMix":0}}');
});
test('错误裁切引用与错误尺寸不能标记完成或切换预览方式', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    const result = await f.deliver(request);
    const path = join(request.directory, 'step01/shadows.json'), data = JSON.parse(await readFile(path, 'utf8'));
    data.shadows[0].clipBaseLayerUuid = 'missing'; await writeFile(path, JSON.stringify(data)); return result;
  } }), /裁切/);
  await assert.rejects(readFile(join(f.task, 'shadow/mask/step01/.completed')), { code: 'ENOENT' });
  await assert.rejects(runWorkflow({ ...f.options, shadowMode: 'normal-depth' }, { ...f.deps, agent: async request => {
    const result = await f.deliver(request);
    await sharp({ create: { width: 1, height: 1, channels: 3, background: 'white' } }).png().toFile(join(request.directory, 'step01/depth.png'));
    return result;
  } }), /原尺寸/);
  await assert.rejects(readFile(join(f.task, 'shadow/selection.json')), { code: 'ENOENT' });
});
test('制作中输入变化不把旧贴图绑定到新原画', async t => {
  const f = await fixture(t);
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    const result = await f.deliver(request);
    await writeFile(join(f.task, 'part-layering/occlusion.json'), '{"changed":true}'); return result;
  } }), /制作期间上游输入改变/);
  await assert.rejects(readFile(join(f.task, 'shadow/mask/step01/.completed')), { code: 'ENOENT' });
});
test('一张完整阴影支持多个真实受影 part；未知部件不能登记完成', async t => {
  const f = await fixture(t);
  await runWorkflow(f.options, { ...f.deps, agent: async request => {
    const result = await f.deliver(request);
    const path = join(request.directory, 'step01/shadows.json'), data = JSON.parse(await readFile(path, 'utf8'));
    delete data.shadows[0].receiverPartId;
    data.shadows[0].receiverPartIds = ['character:face', 'character:hair'];
    await writeFile(path, JSON.stringify(data)); return result;
  } });
  await rm(join(f.task, 'shadow/mask/step01/.completed'));
  await assert.rejects(runWorkflow(f.options, { ...f.deps, agent: async request => {
    const result = await f.deliver(request);
    const path = join(request.directory, 'step01/shadows.json'), data = JSON.parse(await readFile(path, 'utf8'));
    delete data.shadows[0].receiverPartId;
    data.shadows[0].receiverPartIds = ['character:face', 'character:missing'];
    await writeFile(path, JSON.stringify(data)); return result;
  } }), /全部受影部件/);
  await assert.rejects(readFile(join(f.task, 'shadow/mask/step01/.completed')), { code: 'ENOENT' });
});

test('制作参考准备、原生检查、指纹复用与损坏重新检查', async t => {
  const f=await fixture(t);let inspections=0;
  const native:NativeInspect=async (...args)=>{inspections++;return f.deps.inspectNative(...args);};
  const deps={...f.deps,inspectNative:native,agent:async(request:AgentRequest)=>{
    const guide=await readFile(join(request.directory,'step01/references/production.md'),'utf8');assert.match(guide,/testOffsets/);
    assert.match(request.prompt,/inspect.ts/);return f.deliver(request);
  }};
  await runWorkflow(f.options,deps);assert.equal(inspections,1);
  await runWorkflow(f.options,deps);assert.equal(inspections,1);
  const output=join(f.task,'shadow/mask/step01');
  const receipt=JSON.parse(await readFile(join(output,'inspection.json'),'utf8'));assert.equal(receipt.passed,true);
  await writeFile(join(output,'inspection/overview.png'),'broken');
  await runWorkflow(f.options,deps);assert.equal(inspections,2);
  const bindings=JSON.parse(await readFile(join(output,'shadows.json'),'utf8'));bindings.shadows[0].notes='new note';
  await writeFile(join(output,'shadows.json'),JSON.stringify(bindings));
  await runWorkflow(f.options,deps);assert.equal(inspections,3);
  await rm(join(output,'inspection/overview.png'));await runWorkflow(f.options,deps);assert.equal(inspections,4);
  // Missing diagnostics in dry-run never launch Krita or write a new receipt.
  await rm(join(output,'inspection/overview.png'));await runWorkflow({...f.options,dryRun:true},deps);assert.equal(inspections,4);
});

test('原生组内越界与空影层不能登记完成',async t=>{
 const f=await fixture(t);
 for(const problem of ['spill','empty']){
  const native:NativeInspect=async(...args)=>{
   const result=await f.deps.inspectNative(...args),output=args[2];
   const relation=result.relations[0];
   const path=join(output,problem==='spill'?relation.frames[0].clipped:relation.fullPaint);
   const {data,info}=await sharp(path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   if(problem==='spill')data[11]=255;else for(let i=3;i<data.length;i+=4)data[i]=0;
   await sharp(data,{raw:info}).png().toFile(path+'.tmp');
   const {rename}=await import('node:fs/promises');await rename(path+'.tmp',path);return result;
  };
  await assert.rejects(runWorkflow(f.options,{...f.deps,inspectNative:native,agent:f.deliver}),problem==='spill'?/裁切/:/为空/);
  await assert.rejects(readFile(join(f.task,'shadow/mask/step01/.completed')),{code:'ENOENT'});
 }
});
