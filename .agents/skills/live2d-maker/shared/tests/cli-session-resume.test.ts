import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
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

for (const harness of ['claude', 'agv'] as const) test(harness + ': changing native login updates the next turn of the same session', { timeout: 10_000 }, async t => {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'cli-credential-sync-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const native = join(root, 'native'), app = join(native, 'antigravity-cli');
  await mkdir(app, { recursive: true });
  const names = harness === 'claude' ? ['.credentials.json'] : ['oauth_creds.json', 'google_accounts.json', 'antigravity-cli/jetski_state.pbtxt'];
  for (const name of names) await writeFile(join(native, name), 'first:' + name);
  const executable = join(root, 'cli.mjs'), capture = join(root, 'capture.jsonl');
  await writeFile(executable, `#!${process.execPath}
import {appendFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
const args=process.argv.slice(2), flag=${JSON.stringify(harness === 'claude' ? '--resume' : '--conversation')};
const at=args.indexOf(flag), id=at<0?'saved-session':args[at+1];
let input='';for await(const chunk of process.stdin)input+=chunk;
const root=process.env[${JSON.stringify(harness === 'claude' ? 'CLAUDE_CONFIG_DIR' : 'ANTIGRAVITY_GEMINI_DIR')}];
const names=${JSON.stringify(names)}, values=[];
for(const name of names)try{values.push(await readFile(join(root,name),'utf8'));}catch(e){if(e.code==='ENOENT')values.push(null);else throw e;}
await appendFile(${JSON.stringify(capture)},JSON.stringify({id,root,values})+'\\n');
console.log(JSON.stringify(${harness === 'claude' ? "{type:'result',session_id:id,result:'done'}" : "{event:'result',result:{conversation_id:id,status:'SUCCESS',response:'done'}}"}));
`, { mode: 0o700 });
  const env = { [`${harness}_path`]: executable, CLAUDE_CONFIG_DIR: native, ANTIGRAVITY_GEMINI_DIR: native, ANTIGRAVITY_APP_DATA_DIR: app };
  const settings = loadWorkflowEnvironment(env, root), options = { cwd: root, logDirectory: join(root, 'agents') };
  const model = parseAgentModel(harness === 'claude' ? 'claude-sonnet-5-5-high' : 'gemini-4-argon-high', 'test');
  const task = { name: 'resume', prompt: 'continue', cwd: root };
  const first = await runCliTask(task, model, settings, options, new AbortController().signal);
  for (const name of names) await writeFile(join(native, name), 'second:' + name);
  const second = await runCliTask(task, model, settings, options, new AbortController().signal, first.threadId!);
  const beforeRefresh = (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  for (const name of names) await writeFile(join(beforeRefresh[1].root, name), 'refreshed:' + name);
  const third = await runCliTask(task, model, settings, options, new AbortController().signal, second.threadId!);
  await rm(join(native, names[0]));
  const fourth = await runCliTask(task, model, settings, options, new AbortController().signal, third.threadId!);
  const records = (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.ok(records.every(record => record.id === first.threadId && record.root === records[0].root));
  assert.deepEqual(records[0].values, names.map(name => 'first:' + name));
  assert.deepEqual(records[1].values, names.map(name => 'second:' + name));
  assert.deepEqual(records[2].values, names.map(name => 'refreshed:' + name));
  assert.deepEqual(records[3].values, names.map((name, i) => i ? 'refreshed:' + name : null));
  assert.equal(fourth.threadId, first.threadId);
});
