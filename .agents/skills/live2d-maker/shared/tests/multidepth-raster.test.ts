import {deliverRasterStep, isRasterReview} from './raster-delivery.ts';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { runWorkflow } from '../raster/workflow.ts';
import { section as character } from '../../raster-layering/run.ts';
import { section as clothing } from '../../clothing-raster-layering/run.ts';
import { seedUpstream } from './upstream-fixture.ts';
import { splitStructure } from './structure-fixture.ts';
import { type AgentRequest } from '../raster/agent.ts';

test('两套 raster 经受控工具新增分组及 SVG 后，中断与主动重跑保留上游修改', async t => {
  for (const section of [character, clothing]) await t.test(section.id, async t => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'structure-resume-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const source = await seedUpstream('case', section.inputSection, root);
    const output = join(root, 'case', section.id);
    const deps = { runsDirectory: root, steps: [section.steps[0]], preflight: async (executable: string) => ({ executable }) };
    let changed: Record<string, string> = {};
    await assert.rejects(runWorkflow(section, { name: 'case', krita: process.execPath }, { ...deps, agent: async request => {
      await request.onEvent({ type: 'thread.started', thread_id: 'fixed-thread' });
      changed = await splitStructure(source);
      throw new Error('结构保存后中断');
    } }), Error);
    async function deliver(request: AgentRequest) {
      for (const [file, bytes] of Object.entries(changed)) assert.equal(await readFile(join(source, file), 'utf8'), bytes);
      return deliverRasterStep(request, section.steps[0], 'new-thread');
    }
    await runWorkflow(section, { name: 'case', krita: process.execPath }, { ...deps, agent: async request => {
      if (!isRasterReview(request)) assert.equal(request.threadId, 'fixed-thread'); return deliver(request);
    } });
    await rm(join(output, 'step01/.completed'));
    await runWorkflow(section, { name: 'case', krita: process.execPath }, { ...deps, agent: async request => {
      assert.equal(request.threadId, undefined); return deliver(request);
    } });
    for (const [file, bytes] of Object.entries(changed)) assert.equal(await readFile(join(source, file), 'utf8'), bytes);
  });
});
