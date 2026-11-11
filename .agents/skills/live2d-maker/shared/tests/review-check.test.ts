import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { CheckFailure } from '../codex/checked-turn.ts';
import { runAgent, type AgentRequest } from '../raster/agent.ts';
import { checkReport } from '../raster/review.ts';
import { rasterAppServer } from './raster-app-server.ts';

test('a report that is missing, malformed or empty is a check failure with its own code', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'report-check-'));
  await assert.rejects(checkReport(dir, 'review-01.md.tmp', 'review'), error => error instanceof CheckFailure && error.code === 'missing-file');
  await writeFile(join(dir, 'review-01.md.tmp'), '结论：未知\n正文\n');
  await assert.rejects(checkReport(dir, 'review-01.md.tmp', 'review'), error => error instanceof CheckFailure && error.code === 'invalid-output');
  await writeFile(join(dir, 'review-01.md.tmp'), '结论：通过\n');
  await assert.rejects(checkReport(dir, 'review-01.md.tmp', 'review'), error => error instanceof CheckFailure && error.code === 'invalid-output');
  await writeFile(join(dir, 'review-01.md.tmp'), '结论：通过\n检查正文\n');
  await checkReport(dir, 'review-01.md.tmp', 'review');
});

test('a failed report check is repaired in the reviewer thread that wrote it', async (t: TestContext) => {
  const server = await rasterAppServer(t, JSON.stringify({ status: 'completed', summary: '完成' }));
  const request: AgentRequest = { prompt: '写检查报告', directory: server.directory, model: 'gpt-6.1-sol', effort: 'xhigh',
    onEvent: async () => {}, environment: server.environment };
  let verifies = 0;
  const result = await runAgent({ ...request, verify: async () => {
    if (++verifies === 1) throw new CheckFailure('invalid-output', '报告缺少有效结论', { detail: '报告缺少有效结论' });
  } });
  assert.equal(result.status, 'completed');
  assert.equal(verifies, 2);
  const protocol = await server.protocol();
  assert.equal(protocol.filter(message => message.method === 'thread/start').length, 1);
  const prompts = protocol.filter(message => message.method === 'turn/start').map(message => message.params.input[0].text);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /程序核对没有通过（第 1\/2 次返修）/);
  assert.match(prompts[1], /报告缺少有效结论/);
});
