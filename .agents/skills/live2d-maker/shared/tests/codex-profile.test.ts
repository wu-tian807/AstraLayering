import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createFunctionToolSession } from '../codex/tool-agent.ts';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';
import { fakeDebug } from './fake-codex.ts';

test('Codex catalog and app server use one private profile, resume it after reconnect, and isolate a new session', { timeout: 10_000 }, async t => {
  nodeExecutables(t);
  const root = await mkdtemp(join(tmpdir(), 'codex-profile-wire-')); t.after(() => rm(root, { recursive: true, force: true }));
  const native = join(root, 'native'), capture = join(root, 'launches.jsonl'), executable = join(root, 'codex.mjs');
  await mkdir(native); await writeFile(join(native, 'auth.json'), '{"fixture":"credential"}');
  await writeFile(join(native, 'AGENTS.md'), 'private agent instructions');
  await writeFile(join(native, 'config.toml'), 'developer_instructions="private instructions"');
  await writeFile(executable, `#!${process.execPath}
import {createInterface} from 'node:readline';
import {appendFile,readFile,readdir,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
const args=process.argv.slice(2);
await appendFile(${JSON.stringify(capture)},JSON.stringify({args,profile:process.env.CODEX_HOME})+'\\n');
${fakeDebug()}
const emit=m=>console.log(JSON.stringify(m));
let threadId;
for await(const line of createInterface({input:process.stdin})){
 const m=JSON.parse(line);
 if(m.method==='initialize')emit({id:m.id,result:{}});
 if(m.method==='thread/start'||m.method==='thread/resume'){
  threadId=m.params.threadId??'thread-'+(await readdir(process.env.CODEX_HOME)).filter(p=>p.startsWith('saved-')).length;
  const saved=join(process.env.CODEX_HOME,'saved-'+threadId);
  if(m.method==='thread/resume')await readFile(saved);
  await writeFile(saved,'native history');
  await appendFile(${JSON.stringify(capture)},JSON.stringify({method:m.method,config:m.params.config,profile:process.env.CODEX_HOME})+'\\n');
  if(m.method==='thread/resume'&&await realpath(m.params.path)!==await realpath(saved))throw Error('resume did not select private history');
  emit({id:m.id,result:{thread:{id:threadId,path:m.method==='thread/resume'?null:saved}}});
 }
 if(m.method==='turn/start'){
  emit({id:m.id,result:{turn:{id:'turn',status:'inProgress'}}});
  emit({method:'item/completed',params:{threadId,turnId:'turn',item:{type:'agentMessage',text:'done'}}});
  emit({method:'turn/completed',params:{threadId,turn:{id:'turn',status:'completed'}}});
 }
}
`, { mode: 0o700 });
  const environment = loadWorkflowEnvironment({ CODEX_HOME: native }, root);
  const options = { environment, codexPathOverride: executable, cwd: root, logDirectory: join(root, 'agents'),
    config: { model_provider: 'fixture', model_providers: { fixture: { name: 'Fixture', base_url: 'https://fixture.invalid/v1', wire_api: 'responses' } },
      features: { apps: true, hooks: true, memories: true }, project_doc_max_bytes: 9999, 'skills.include_instructions': true } };
  const task = { name: 'profile', cwd: root, outputDirectory: 'step', prompt: 'formal workflow task' };
  const first = createFunctionToolSession(options);
  let id: string;
  try { id = (await first.run(task, t.signal)).threadId!; } finally { await first.close(); }
  const resumed = createFunctionToolSession(options, id);
  try { assert.equal((await resumed.run(task, t.signal)).threadId, id); } finally { await resumed.close(); }
  assert.match(JSON.parse(await readFile(join(root, 'agents/sessions.json'), 'utf8'))[id].rollout, /saved-thread/);
  const fresh = createFunctionToolSession(options);
  try { await fresh.run(task, t.signal); } finally { await fresh.close(); }
  const launches = (await readFile(capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const servers = launches.filter(row => row.args?.[0] === 'app-server');
  assert.equal(servers.length, 3);
  assert.equal(servers[0].profile, servers[1].profile); assert.notEqual(servers[0].profile, servers[2].profile);
  assert.ok(servers.every(row => row.profile.startsWith(join(root, 'agents'))));
  assert.ok(launches.filter(row => row.args).every(row => row.profile !== native));
  for (const row of servers) assert.ok(row.args.includes('model_provider="fixture"'));
  for (const row of launches.filter(row => row.config)) {
    assert.equal(row.config.project_doc_max_bytes, 0); assert.equal(row.config['skills.include_instructions'], false);
    for (const key of ['apps', 'hooks', 'memories']) assert.equal(row.config['features.' + key], false);
  }
  assert.equal(await readFile(join(native, 'auth.json'), 'utf8'), '{"fixture":"credential"}');
  assert.equal(await readFile(join(servers[0].profile, 'auth.json'), 'utf8'), '{"fixture":"credential"}');
  await assert.rejects(readFile(join(servers[0].profile, 'AGENTS.md')), { code: 'ENOENT' });
});
