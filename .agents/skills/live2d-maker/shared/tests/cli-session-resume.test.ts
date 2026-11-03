import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCliTask } from '../agents/cli.ts';
import { parseAgentModel } from '../agents/models.ts';
import { recoverableAgentError } from '../codex/agent-runtime.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';

for (const harness of ['claude', 'agv'] as const) test(harness + ': resume preserves schema and artifacts and rejects a silently replaced session', { timeout: 10_000 }, async t => {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'cli-resume-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const executable = join(root, 'cli.mjs'), capture = join(root, 'capture.jsonl');
  await writeFile(executable, `#!${process.execPath}
import {appendFile} from 'node:fs/promises';
const args=process.argv.slice(2), resume=args.indexOf(${JSON.stringify(harness === 'claude' ? '--resume' : '--conversation')});
const id=process.env.TEST_WRONG_SESSION==='true'?'unexpected-session':resume<0?'saved-session':args[resume+1];
let input='';for await(const chunk of process.stdin)input+=chunk;
await appendFile(${JSON.stringify(capture)},JSON.stringify({args,input})+'\\n');
console.log(JSON.stringify(${harness === 'claude'
    ? "{type:'result',session_id:id,result:'done'}"
    : "{event:'result',result:{conversation_id:id,status:'SUCCESS',response:'done'}}"}));
`, { mode: 0o700 });
  const env = { [`${harness}_path`]: executable, CLAUDE_CONFIG_DIR: join(root, 'empty-user') };
  const settings = loadWorkflowEnvironment(env, root), options = { cwd: root, logDirectory: join(root, 'agents') };
  const model = parseAgentModel(harness === 'claude' ? 'claude-sonnet-5-5-high' : 'gemini-4-argon-high', 'test');
  const schema = { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] };
  const task = { name: 'resume', prompt: 'continue saved work', cwd: root, outputSchema: schema };
  const first = await runCliTask(task, model, settings, options, new AbortController().signal);
  await writeFile(join(root, 'keep.kra'), 'saved artifact');
  const second = await runCliTask(task, model, settings, options, new AbortController().signal, first.threadId!);
  assert.equal(second.threadId, first.threadId);
  const records = (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  for (const record of records) assert.deepEqual(JSON.parse(record.args[record.args.indexOf('--json-schema') + 1]), schema);
  const flag = harness === 'claude' ? '--resume' : '--conversation';
  assert.equal(records[1].args[records[1].args.indexOf(flag) + 1], first.threadId);
  if (harness === 'claude') assert.match(records[1].args[records[1].args.indexOf('--disallowedTools') + 1], /ScheduleWakeup.*CronCreate/);
  const wrong = loadWorkflowEnvironment({ ...env, TEST_WRONG_SESSION: 'true' }, root);
  await assert.rejects(runCliTask(task, model, wrong, options, new AbortController().signal, first.threadId!), error => {
    assert.equal(recoverableAgentError(error), 'unavailableSession'); return true;
  });
  assert.equal(await readFile(join(root, 'keep.kra'), 'utf8'), 'saved artifact');
});
