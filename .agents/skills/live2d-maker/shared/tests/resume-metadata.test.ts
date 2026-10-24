import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CodexAgents } from '../codex/agents.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { textResult } from '../codex/function-tools.ts';

test('resuming image-bearing history requests metadata only and retains tools on the same thread', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'astra-resume-metadata-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const executable = join(directory, 'server.mjs'), capture = join(directory, 'capture.jsonl');
  await writeFile(executable, `#!${process.execPath}
import { createInterface } from 'node:readline';
import { appendFile } from 'node:fs/promises';
const send = value => process.stdout.write(JSON.stringify(value) + '\\n');
for await (const line of createInterface({input:process.stdin})) {
  const message = JSON.parse(line);
  await appendFile(${JSON.stringify(capture)}, line + '\\n');
  if (message.method === 'initialize') send({id:message.id,result:{}});
  else if (message.method === 'thread/resume') {
    if (message.params.threadId !== 'image-history' || message.params.excludeTurns !== true)
      send({id:message.id,error:{code:-32602,message:'Full image history must not be hydrated'}});
    else send({id:message.id,result:{thread:{id:'image-history',turns:[]}}});
  } else if (message.method === 'turn/start') {
    send({id:message.id,result:{turn:{id:'continued',status:'inProgress'}}});
    send({id:'probe-call',method:'item/tool/call',params:{threadId:'image-history',namespace:null,tool:'probe',arguments:{}}});
  } else if (message.id === 'probe-call') {
    send({method:'item/completed',params:{item:{type:'agentMessage',text:'continued'}}});
    send({method:'turn/completed',params:{turn:{id:'continued',status:'completed',error:null}}});
  }
}
`);
  await chmod(executable, 0o755);
  const agents = new CodexAgents({ environment: loadWorkflowEnvironment({}, directory),
    codexPathOverride: executable, cwd: directory, logDirectory: join(directory, 'logs') });
  const session = agents.createSession('image-history'); let calls = 0;
  try {
    const task = { name: 'repair', prompt: 'continue', tools: [{ name: 'probe', description: 'probe',
      inputSchema: { type: 'object', properties: {} }, execute: async () => { calls++; return textResult('ok'); } }] };
    const first = await session.run(task), second = await session.run(task);
    assert.equal(first.threadId, 'image-history'); assert.equal(second.threadId, first.threadId);
    assert.equal(calls, 2);
    const messages = (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.equal(messages.filter(message => message.method === 'thread/resume').length, 1);
    assert.equal(messages.filter(message => message.method === 'thread/start').length, 0);
    assert(messages.filter(message => message.method === 'turn/start').every(message => message.params.threadId === 'image-history'));
  } finally { await session.close(); }
});
