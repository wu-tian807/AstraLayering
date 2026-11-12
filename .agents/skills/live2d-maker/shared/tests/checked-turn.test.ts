import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CheckFailure, checkedTurn, missingSubmit } from '../codex/checked-turn.ts';
import { runtimePrompts } from '../knowledge-steps.ts';
import { runtimePrompt } from '../knowledge.ts';

const task = { step: 'x', name: 'x', prompt: 'do', cwd: '.', outputDirectory: '.' } as never;
const agentsFor = (prompts: string[], logDirectory?: () => Promise<string>) => ({
  async run(t: { prompt: string }) { prompts.push(t.prompt); return { text: '', images: [], logDirectory: await logDirectory?.() }; },
}) as never;

test('a failed check is fed back to the same agent and then passes', async () => {
  const prompts: string[] = [];
  let calls = 0;
  const value = await checkedTurn({ agents: agentsFor(prompts), task, check: () => { if (++calls < 3) throw missingSubmit('submit_x', '未提交'); return 'ok'; } });
  assert.equal(value, 'ok');
  assert.equal(prompts.length, 3);
  assert.match(prompts[1], /submit_x/);
});

test('three failures end the step with a user hint and keep the session', async () => {
  const prompts: string[] = [];
  const error = await checkedTurn({ agents: agentsFor(prompts), task, check: () => { throw missingSubmit('submit_x', '未提交'); } }).catch(e => e);
  assert.equal(prompts.length, 3);
  assert.match(error.message, /已返修 \d+ 次仍未通过.*继续仍接回同一会话/);
  assert.doesNotMatch(prompts.join('\n'), /恢复|新建会话/);
});

test('source text mentioning content_filter does not stop the repair rounds', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'check-'));
  await writeFile(join(dir, 'events.jsonl'), '{"text":"reason: content_filter"}\n');
  const prompts: string[] = [];
  const error = await checkedTurn({ agents: agentsFor(prompts, async () => dir), task, check: () => { throw missingSubmit('submit_x', '未提交'); } }).catch(e => e);
  assert.equal(prompts.length, 3);
  assert.match(error.message, /已返修 \d+ 次仍未通过/);
  assert.doesNotMatch(error.message, /内容过滤/);
});

test('other errors propagate unchanged', async () => {
  const boom = new Error('boom');
  await assert.rejects(checkedTurn({ agents: agentsFor([]), task, check: () => { throw boom; } }), boom);
});

test('check prompts are registered knowledge', () => {
  for (const name of ['check-repair', 'checks/missing-submit', 'checks/invalid-output', 'checks/missing-file', 'checks/bad-result'])
    assert.ok((runtimePrompts as readonly string[]).includes(name), name);
  assert.match(runtimePrompt('checks/invalid-output', { detail: 'D' }), /D/);
  void CheckFailure; void mkdir; void readFile;
});
