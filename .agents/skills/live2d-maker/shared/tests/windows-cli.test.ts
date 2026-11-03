import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import spawn from 'cross-spawn';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { checkAgentCli } from '../agents/preflight.ts';
import { runCliTask } from '../agents/cli.ts';
import { parseAgentModel } from '../agents/models.ts';
import { stopCliProcess } from '../agents/process.ts';

test('Windows cmd CLI supports preflight and preserves workflow arguments', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cli space '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = join(root, 'fake cli.cmd'), script = join(root, 'fake cli.mjs');
  await writeFile(cli, '@echo off\r\n"' + process.execPath + '" "%~dp0fake cli.mjs" %*\r\n');
  await writeFile(script, `import {writeFile} from 'node:fs/promises';
if(process.argv.includes('--version')) { console.log('fake 1.2.3'); process.exit(0); }
let input=''; for await(const chunk of process.stdin) input += chunk;
await writeFile(process.env.TEST_CAPTURE,JSON.stringify({args:process.argv.slice(2),input}));
console.log(JSON.stringify({type:'result',session_id:'fixture',result:'done'}));`);
  const settings = loadWorkflowEnvironment({ claude_path: cli, TEST_CAPTURE: join(root, 'capture.json') }, root);
  assert.match(await checkAgentCli(settings, 'claude'), /1\.2\.3/);
  const result = await runCliTask({ name: 'fixture', cwd: root, prompt: '测试 & 内容' },
    parseAgentModel('claude-sonnet-5-5-high', 'test'), settings,
    { cwd: root, logDirectory: join(root, 'agents') }, new AbortController().signal);
  assert.equal(result.text, 'done');
  const workflowCapture = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
  assert.ok(workflowCapture.input.includes('测试 & 内容'));
  assert.ok(workflowCapture.args.includes('--mcp-config'));
  const values = ['space and 中文', '"quoted"', 'a&b|c', '%PATH%', 'trailing\\'];
  const child = spawn(cli, values, { env: { ...process.env, TEST_CAPTURE: join(root, 'capture.json') }, stdio: ['pipe', 'pipe', 'pipe'] });
  child.stdin!.end('payload');
  const [status] = await once(child, 'close');
  assert.equal(status, 0);
  const captured = JSON.parse(await readFile(join(root, 'capture.json'), 'utf8'));
  assert.deepEqual(captured.args, values);
  assert.equal(captured.input, 'payload');
});

test('Windows cancellation terminates the cmd launcher and its child', { skip: process.platform !== 'win32' }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cli-stop-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = join(root, 'wait.cmd'), script = join(root, 'wait.mjs');
  await writeFile(cli, '@echo off\r\n"' + process.execPath + '" "%~dp0wait.mjs"\r\n');
  await writeFile(script, "console.log(process.pid);setInterval(()=>{},1000);");
  const child = spawn(cli, [], { stdio: ['ignore', 'pipe', 'pipe'] });
  const [data] = await once(child.stdout!, 'data');
  const pid = Number(String(data).trim());
  assert.ok(pid > 0);
  const closed = once(child, 'close');
  stopCliProcess(child);
  await closed;
  assert.throws(() => process.kill(pid, 0));
});
