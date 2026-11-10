import { seedUpstream } from './upstream-fixture.ts';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { sectionDirectory, sectionIds } from '../paths.ts';
import { AgentCallError, AgentRuntime, rateLimitedAgentError, retryableAgentError, type AgentRetry } from '../codex/agent-runtime.ts';
import { AgentLog, retryWaitFile } from '../codex/agent-log.ts';
import { recognizeInitialGroups } from '../part/initial-groups.ts';
import { runWorkflow as runRaster } from '../../raster-layering/run.ts';
import { runWorkflow as runClothingRaster } from '../../clothing-raster-layering/run.ts';
import { profile as character } from '../../part-layering/profile.ts';
import { profile as clothing } from '../../clothing-part-layering/profile.ts';
import { fixture } from '../../part-layering/tests/layering-fixture.ts';

test('共享目录保留 part 原有任务名范围，raster 仍执行自己的命名限制', () => {
  for (const name of ['demo 2', '_demo', '.draft', '衣服👕']) {
    for (const id of ['part-layering', 'clothing-part-layering'] as const) {
      assert.equal(sectionDirectory(name, id, '/tmp/runs'), join('/tmp/runs', name, id));
    }
    for (const id of ['raster-layering', 'clothing-raster-layering'] as const) {
      assert.throws(() => sectionDirectory(name, id, '/tmp/runs'), /--name/);
    }
  }
  for (const id of sectionIds) {
    for (const name of ['', '.', '..', '../other', 'a/b', 'a\\b', 'a:b']) {
      assert.throws(() => sectionDirectory(name, id, '/tmp/runs'));
    }
  }
});

test('生图服务的速率限制会重试，单次输入图片上限仍直接报错', async () => {
  const info = { rateLimitExceeded: { httpStatusCode: 429 } };
  for (const message of ['image_generation rate limit exceeded', 'Rate limit exceeded: maximum 10 images per minute']) {
    let attempts = 0;
    const waits: number[] = [];
    assert.equal(await new AgentRuntime(1, async ms => { waits.push(ms); }, () => 1).run(async () => {
      if (++attempts === 1) throw new AgentCallError(message, info);
      return 'continued';
    }), 'continued');
    assert.deepEqual(waits, [5000]);
    assert.equal(attempts, 2);
  }
  for (const message of ['maximum of 50 images', 'Too many images: maximum 50 images per request',
    'Rate limit exceeded: maximum 50 images per request', 'input image count limit exceeded']) {
    assert.equal(retryableAgentError(new AgentCallError(message, info)), false, message);
  }
});

test('每次临时错误都记录等待截止时间供限流等待显示，429 与 5xx、断流只区分原因', async t => {
  const errors = [new AgentCallError('Rate limit exceeded', { rateLimitExceeded: { httpStatusCode: 429 } }),
    new AgentCallError('Too Many Requests', { apiError: { httpStatusCode: 429 } }),
    new AgentCallError('overloaded', { serverOverloaded: { httpStatusCode: 503 } }), new AgentCallError('disconnected', 'responseStreamDisconnected')];
  assert.deepEqual(errors.map(rateLimitedAgentError), [true, true, false, false]);
  const retries: AgentRetry[] = [];
  let attempts = 0;
  assert.equal(await new AgentRuntime(1, async () => {}, () => 1).run(async () => {
    if (attempts < errors.length) throw errors[attempts++];
    return 'done';
  }, { onRetry: retry => { retries.push(retry); } }), 'done');
  assert.deepEqual(retries.map(retry => retry.rateLimited), [true, true, false, false]);

  const root = await mkdtemp(join(tmpdir(), 'rate-limit-wait-')); t.after(() => rm(root, { recursive: true, force: true }));
  const log = await AgentLog.create(join(root, 'agents'), 'call', {});
  const now = new Date('2026-10-28T15:00:00.000Z');
  await AgentLog.retry(log.directory, { attempt: 1, nextAttempt: 2, delayMs: 2500, error: 'Rate limit exceeded', rateLimited: true }, now);
  assert.deepEqual(JSON.parse(await readFile(join(log.directory, retryWaitFile), 'utf8')), { reason: 'rate-limit', attempt: 1, nextAttempt: 2,
    since: '2026-10-28T15:00:00.000Z', until: '2026-10-28T15:00:02.500Z', error: 'Rate limit exceeded' });
  const other = await AgentLog.create(join(root, 'agents'), 'other', {});
  await AgentLog.retry(other.directory, { attempt: 1, nextAttempt: 2, delayMs: 2500, error: 'overloaded', rateLimited: false }, now);
  assert.equal(JSON.parse(await readFile(join(other.directory, retryWaitFile), 'utf8')).reason, 'transient');
});

test('首次分组拒绝 groups 以外的字段，错误参数不能写坏首次分组记录', async t => {
  for (const profile of [character, clothing]) {
    const f = await fixture(t);
    // Clothing preparation always provides the original clothed character.
    const references = profile === clothing ? { ...f.references, originalImage: f.references.baseSubject } : f.references;
    await recognizeInitialGroups({ ...f, profile, references }, { run: async task => {
      const write = task.tools!.find(tool => tool.name === 'write_groups')!;
      const signal = new AbortController().signal;
      const groups = [{ name: 'shape', groups: [], note: '独立实体' }];
      await assert.rejects(write.execute({ subject: 'other', groups }, signal), /只包含组/);
      await assert.rejects(readFile(join(f.directory, 'step08_initial/groups.json')), { code: 'ENOENT' });
      await write.execute({ groups }, signal);
      return { text: 'saved', images: [] };
    } });
    assert.deepEqual(Object.keys(JSON.parse(await readFile(join(f.directory, 'step08_initial/groups.json'), 'utf8'))), ['groups']);
  }
});

test('两套 raster 的缺失输入提示各自指向对应的 part 管线', async t => {
  const root = await mkdtemp(join(tmpdir(), 'section-input-errors-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const empty = join(root, 'empty');
  await mkdir(empty);
  for (const [run, inputId] of [[runRaster, 'part-layering'], [runClothingRaster, 'clothing-part-layering']] as const) {
    const dependencies = { runsDirectory: join(root, 'runs'), preflight: async () => { throw new Error('preflight must not run'); } };
    await assert.rejects(run({ name: 'case' }, dependencies), error => {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes(` ${inputId} --name`));
      assert.ok(error.message.includes(join(dependencies.runsDirectory, 'case', inputId, 'occlusion.json')));
      assert.ok(error.message.includes('手动放置'));
      return true;
    });
  }
});

test('显式传空 Krita 路径报错', async t => {
  const root = await mkdtemp(join(tmpdir(), 'krita-empty-override-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const runsDirectory = join(root, 'runs');
  for (const [run, id] of [[runRaster, 'raster-layering'],
    [runClothingRaster, 'clothing-raster-layering']] as const) {
    await seedUpstream('saved', id === 'raster-layering' ? 'part-layering' : 'clothing-part-layering', runsDirectory);
    for (const krita of ['', '   ']) {
      await assert.rejects(run({ name: 'saved', krita, dryRun: true }, { runsDirectory,
        preflight: async () => { throw new Error('preflight must not run'); },
      }), /必须提供 --krita/);
    }
  }
});
