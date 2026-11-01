import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { parseEnv } from 'node:util';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { configurationReport } from '../codex/config-report.ts';
import { parseProviderModels, validateProviderModel } from '../agents/providers.ts';
import { parseAgentModel, type Harness } from '../agents/models.ts';
import { preflightAgentSteps } from '../agents/preflight.ts';
import { runCliTask } from '../agents/cli.ts';
import { CodexAgents } from '../codex/agents.ts';
import { createFunctionToolSession } from '../codex/tool-agent.ts';
import { runAgent } from '../raster/agent.ts';

async function fixture(t: { after(callback: () => Promise<unknown>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'layering-providers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('blank uniform connections preserve native login, cloud routing and code defaults', async t => {
  const root = await fixture(t);
  const shell = { CODEX_HOME: '/existing/codex', ANTHROPIC_AUTH_TOKEN: 'TOKEN_FIXTURE', CLAUDE_CODE_USE_BEDROCK: '1' };
  const template = await readFile(new URL('../../example.env', import.meta.url), 'utf8');
  const variables = parseEnv(template);
  for (const key of ['layering_codex_protocol', 'layering_claude_protocol', 'layering_openai_image_protocol']) assert.ok(!Object.hasOwn(variables, key));
  assert.ok(Object.hasOwn(variables, 'layering_agv_protocol'));
  assert.ok(Object.hasOwn(variables, 'layering_google_image_protocol'));
  await writeFile(join(root, '.env'), template);
  const settings = loadWorkflowEnvironment(shell, root);
  assert.deepEqual(settings.codex.config, {});
  assert.equal(settings.codex.env!.CODEX_HOME, shell.CODEX_HOME);
  assert.equal(settings.codex.env!.ANTHROPIC_AUTH_TOKEN, shell.ANTHROPIC_AUTH_TOKEN);
  assert.equal(settings.codex.env!.CLAUDE_CODE_USE_BEDROCK, '1');
  for (const provider of Object.values(settings.providers!)) {
    assert.equal(provider.connection, 'inherited');
    assert.equal(provider.models, undefined);
    assert.equal(provider.apiKey, undefined);
  }
  assert.equal(settings.providers!.claude.protocol, undefined);
  assert.equal(settings.providers!.agv.protocol, undefined);
});

test('uniform fields map to each CLI without modifying the caller or embedding keys in Codex config', async t => {
  const root = await fixture(t);
  const shell = {
    layering_codex_api_key: 'CODEX_SECRET', layering_codex_base_url: 'https://codex.test/v1',
    layering_codex_models: 'gpt-6.1-sol, gpt-6-astra,gpt-6.1-sol',
    layering_claude_api_key: 'CLAUDE_SECRET', layering_claude_base_url: 'https://claude.test',
    layering_claude_models: 'claude-sonnet-5-5,claude-opus-5-5',
    layering_agv_api_key: 'AGV_SECRET', layering_agv_base_url: 'https://agv.test/v1beta',
    layering_agv_models: 'gemini-4-argon,gemini-3-flash-preview', layering_agv_protocol: 'genai',
    ANTHROPIC_AUTH_TOKEN: 'INHERITED_TOKEN',
  };
  const before = { ...shell }, hostToken = process.env.ANTHROPIC_AUTH_TOKEN;
  const settings = loadWorkflowEnvironment(shell, root), env = settings.codex.env!;
  assert.deepEqual(settings.providers!.codex.models, ['gpt-6.1-sol', 'gpt-6-astra']);
  assert.equal(settings.codex.config!.model_provider, 'layering_custom');
  assert.equal(settings.providers!.codex.protocol, 'responses');
  assert.equal(settings.providers!.claude.protocol, 'anthropic');
  assert.equal((settings.codex.config!.model_providers as any).layering_custom.env_key, 'layering_codex_api_key');
  assert.equal(env.layering_codex_api_key, shell.layering_codex_api_key);
  assert.equal(env.ANTHROPIC_API_KEY, shell.layering_claude_api_key);
  assert.equal(env.ANTHROPIC_BASE_URL, shell.layering_claude_base_url);
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.AGY_LLM_GATEWAY_API_KEY, shell.layering_agv_api_key);
  assert.equal(env.AGY_LLM_GATEWAY_URL, shell.layering_agv_base_url);
  assert.equal(env.AGY_LLM_GATEWAY_MODELS, shell.layering_agv_models);
  assert.equal(env.AGY_LLM_GATEWAY_WIRE_PROTOCOL, 'genai');
  assert.doesNotMatch(JSON.stringify(settings.codex.config), /SECRET|TOKEN/);
  assert.deepEqual(shell, before);
  assert.equal(process.env.ANTHROPIC_AUTH_TOKEN, hostToken);
  const official = loadWorkflowEnvironment({ layering_codex_api_key: 'fixture', layering_claude_api_key: 'fixture' }, root);
  assert.equal(official.providers!.codex.baseUrl, 'https://api.openai.com/v1');
  assert.equal(official.providers!.claude.baseUrl, 'https://api.anthropic.com');
  assert.equal(official.providers!.claude.protocol, 'anthropic');
});

test('source precedence is shell unified, shell alias, file unified, file alias, including legacy Codex flag=false', async t => {
  const aliases: Record<Harness, [string, string]> = {
    codex: ['layering_provider_api_key', 'layering_provider_base_url'],
    claude: ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL'],
    agv: ['AGY_LLM_GATEWAY_API_KEY', 'AGY_LLM_GATEWAY_URL'],
  };
  for (const harness of ['codex', 'claude', 'agv'] as const) {
    const root = await fixture(t), prefix = `layering_${harness}_`, [aliasKey, aliasUrl] = aliases[harness];
    const source = `layering_custom_provider=false\n${prefix}api_key=FILE_UNIFIED\n${prefix}base_url=https://file-unified.test/v1\n${aliasKey}=FILE_ALIAS\n${aliasUrl}=https://file-alias.test/v1\n`;
    await writeFile(join(root, '.env'), source);
    const load = (shell: NodeJS.ProcessEnv) => loadWorkflowEnvironment(shell, root);
    assert.equal(load({}).providers![harness].apiKey, 'FILE_UNIFIED');
    const shellAlias = load({ [aliasKey]: 'SHELL_ALIAS', [aliasUrl]: 'https://shell-alias.test/v1' });
    assert.equal(shellAlias.providers![harness].apiKey, 'SHELL_ALIAS');
    assert.equal(shellAlias.providers![harness].baseUrl, 'https://shell-alias.test/v1');
    assert.equal(shellAlias.providers![harness].sources.apiKey, aliasKey);
    assert.equal(shellAlias.providers![harness].connection, 'unified');
    if (harness === 'codex') {
      assert.equal(shellAlias.codex.config!.model_provider, 'layering_custom');
      assert.equal(shellAlias.codex.env!.layering_codex_api_key, 'SHELL_ALIAS');
    }
    const unified = load({ [prefix + 'api_key']: 'SHELL_UNIFIED', [aliasKey]: 'SHELL_ALIAS' });
    assert.equal(unified.providers![harness].apiKey, 'SHELL_UNIFIED');
    assert.equal(load({ [prefix + 'api_key']: '' }).providers![harness].apiKey, 'FILE_ALIAS');
    assert.equal(await readFile(join(root, '.env'), 'utf8'), source);
  }
  const root = await fixture(t);
  const disabled = loadWorkflowEnvironment({ layering_custom_provider: 'false', layering_provider_api_key: 'unused', layering_provider_base_url: 'https://unused.test/v1' }, root);
  assert.deepEqual(disabled.codex.config, {});
  assert.equal(disabled.providers!.codex.apiKey, undefined);
  const legacy = loadWorkflowEnvironment({ layering_custom_provider: 'true', layering_provider_api_key: 'fixture', layering_provider_base_url: 'https://legacy.test/v1' }, root);
  assert.equal(legacy.providers!.codex.connection, 'legacy');
  assert.equal((legacy.codex.config!.model_providers as any).layering_custom.env_key, 'layering_provider_api_key');
});

test('reject unsupported protocols, malformed lists and unusable explicit connections before requests', async t => {
  const root = await fixture(t);
  for (const harness of ['codex', 'claude', 'agv']) {
    const prefix = `layering_${harness}_`;
    assert.throws(() => loadWorkflowEnvironment({ [prefix + 'base_url']: 'https://valid.test/v1' }, root), /缺少鉴权或地址/);
    for (const url of ['not-a-url', 'file:///tmp/api', 'https://user:secret@test/v1', 'https://test/v1?key=secret', 'https://test/#secret']) {
      assert.throws(() => loadWorkflowEnvironment({ [prefix + 'api_key']: 'fixture', [prefix + 'base_url']: url }, root), /HTTP\(S\)/);
    }
    for (const models of ['a,,b', 'a,', '["a","b"]', 'a b']) {
      assert.throws(() => loadWorkflowEnvironment({ [prefix + 'models']: models }, root), /逗号分隔/);
    }
  }
  assert.throws(() => loadWorkflowEnvironment({ layering_agv_protocol: 'invalid' }, root), /仅支持 genai \/ openai/);
  assert.throws(() => loadWorkflowEnvironment({ layering_google_image_protocol: 'invalid' }, root), /layering_google_image_protocol 无效/);
  const image = loadWorkflowEnvironment({ layering_openai_image_base_url: 'https://image.test/v1', layering_openai_image_api_key: 'fixture' }, root);
  assert.equal(image.imageApis.openai!.protocol, 'openai');
  assert.throws(() => loadWorkflowEnvironment({ layering_agv_api_key: 'fixture' }, root), /layering_agv_base_url/);
  assert.deepEqual(parseProviderModels('gemini-4-argon, vendors/model:version,gemini-4-argon', 'models'), ['gemini-4-argon', 'vendors/model:version']);
  for (const protocol of ['genai', 'openai']) assert.equal(loadWorkflowEnvironment({ layering_agv_api_key: 'fixture', layering_agv_base_url: 'https://agv.test/v1', layering_agv_protocol: protocol }, root).codex.env!.AGY_LLM_GATEWAY_WIRE_PROTOCOL, protocol);
});

// Captures only fixture credentials inside the disposable request workspace.
// No provider, model or external network is contacted by this executable.
const cliFixture = `#!${process.execPath}
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('fixture 2.1.280');process.exit(0);}
const claude=args.includes('--settings'),flag=claude?'--resume':'--conversation';
const id=args.includes(flag)?args[args.indexOf(flag)+1]:randomUUID();
let input='';for await(const chunk of process.stdin)input+=chunk;
const env=Object.fromEntries(['ANTHROPIC_API_KEY','ANTHROPIC_BASE_URL','ANTHROPIC_AUTH_TOKEN','AGY_LLM_GATEWAY_API_KEY','AGY_LLM_GATEWAY_URL','AGY_LLM_GATEWAY_MODELS','AGY_LLM_GATEWAY_WIRE_PROTOCOL','CLAUDE_CONFIG_DIR','ANTIGRAVITY_APP_DATA_DIR'].map(key=>[key,process.env[key]]));
const settings=claude?JSON.parse(await readFile(args[args.indexOf('--settings')+1],'utf8')):undefined;
await writeFile(join(process.cwd(),'fixture.json'),JSON.stringify({args,input,env,settings}));
console.log(JSON.stringify(claude?{type:'system',subtype:'init',session_id:id}:{event:'init',conversation_id:id}));
console.log(JSON.stringify(claude?{type:'result',session_id:id,result:'done'}:{event:'result',result:{conversation_id:id,status:'SUCCESS',response:'done'}}));
`;

test('only selected steps are validated, and all validation finishes before any capability probe or model call', async t => {
  const root = await fixture(t), cli = join(root, 'fixture-cli');
  await writeFile(cli, cliFixture, { mode: 0o700 });
  const settings = loadWorkflowEnvironment({ layering_claude_path: cli, layering_codex_path: '/nonexistent/codex',
    part_review_agent_model: 'claude-sonnet-5-5-high', layering_codex_models: 'gpt-6-astra', layering_claude_models: 'claude-sonnet-5-5' }, root);
  await preflightAgentSteps(settings, ['part_outline_review']);
  assert.throws(() => validateProviderModel(settings.providers, settings.stepModels.part_outline, 'part_outline'), /part_outline.*gpt-6.1-sol/);
  await assert.rejects(preflightAgentSteps(settings, ['part_outline', 'part_outline_review']), /不在 layering_codex_models/);
  const denied = loadWorkflowEnvironment({ layering_codex_path: '/nonexistent/codex', layering_claude_path: '/nonexistent/claude',
    layering_codex_models: 'gpt-6.1-sol', part_review_agent_model: 'claude-sonnet-5-5-high', layering_claude_models: 'claude-opus-5-5' }, root);
  // First step passes its model list; second fails before probing the first CLI.
  await assert.rejects(preflightAgentSteps(denied, ['part_outline', 'part_outline_review']), /不在 layering_claude_models/);
  const task = { name: 'denied', prompt: 'fixture', cwd: root };
  const agents = new CodexAgents({ environment: settings, cwd: root });
  await assert.rejects(agents.run(task), /不在 layering_codex_models/);
  const session = agents.createSession();
  try { await assert.rejects(session.run(task), /不在 layering_codex_models/); } finally { await session.close(); }
  const functions = createFunctionToolSession({ environment: settings, cwd: root });
  try { await assert.rejects(functions.run(task), /不在 layering_codex_models/); } finally { await functions.close(); }
  await assert.rejects(runAgent({ directory: root, prompt: 'fixture', model: 'gpt-6.1-sol', effort: 'medium', environment: settings, onEvent: async () => {} }), /不在 layering_codex_models/);
  await assert.rejects(runCliTask(task, parseAgentModel('claude-sonnet-5-5-high', 'fixture'), denied, { cwd: root }, new AbortController().signal), /不在 layering_claude_models/);
  assert.deepEqual((await readdir(root)).sort(), ['fixture-cli']);
});

test('Claude private settings apply model lists and explicit credentials, preserving host settings, session data and artifacts', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/raster-layering'), cli = join(root, 'fixture-cli'), user = join(root, 'user-claude');
  await mkdir(cwd, { recursive: true }); await mkdir(user);
  await writeFile(cli, cliFixture, { mode: 0o700 });
  const hostSettings = JSON.stringify({ apiKeyHelper: 'original-helper', env: { ANTHROPIC_API_KEY: 'OLD_KEY', ANTHROPIC_AUTH_TOKEN: 'OLD_TOKEN' } });
  await writeFile(join(user, 'settings.json'), hostSettings);
  await writeFile(join(user, '.credentials.json'), 'existing-login');
  const env = { CLAUDE_CONFIG_DIR: user, ANTHROPIC_AUTH_TOKEN: 'SHELL_TOKEN', layering_claude_path: cli,
    layering_claude_api_key: 'EXPLICIT_FIXTURE_KEY', layering_claude_base_url: 'https://claude.test', layering_claude_models: 'claude-sonnet-5-5,claude-opus-5-5' };
  const settings = loadWorkflowEnvironment(env, root), options = { cwd, logDirectory: join(cwd, 'agents') }, task = { name: 'fixture', cwd, prompt: 'unchanged prompt' };
  const first = await runCliTask(task, parseAgentModel('claude-sonnet-5-5-xhigh', 'fixture'), settings, options, new AbortController().signal);
  const a = JSON.parse(await readFile(join(cwd, 'workspace', 'fixture.json'), 'utf8'));
  assert.equal(a.env.ANTHROPIC_API_KEY, 'EXPLICIT_FIXTURE_KEY');
  assert.equal(a.args[a.args.indexOf('--disallowedTools') + 1], 'ScheduleWakeup,CronCreate,CronDelete,CronList', 'a one-turn run cannot be woken later');
  assert.equal(a.env.ANTHROPIC_BASE_URL, 'https://claude.test');
  assert.equal(a.env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(a.settings.apiKeyHelper, undefined);
  assert.equal(a.settings.env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.deepEqual(a.settings.modelPicker, { options: [{ model: 'claude-sonnet-5-5', label: 'claude-sonnet-5-5' }, { model: 'claude-opus-5-5', label: 'claude-opus-5-5' }], replaceBuiltInOptions: true });
  assert.equal((await stat(join(first.logDirectory!, 'auth-settings.json'))).mode & 0o777, 0o600);
  await writeFile(join(a.env.CLAUDE_CONFIG_DIR, 'session-sentinel'), 'keep');
  await writeFile(join(cwd, 'keep.kra'), 'existing-artifact');
  const changed = loadWorkflowEnvironment({ ...env, layering_claude_api_key: 'NEXT_FIXTURE_KEY', layering_claude_models: 'claude-opus-5-5' }, root);
  const second = await runCliTask(task, parseAgentModel('claude-opus-5-5-high', 'fixture'), changed, options, new AbortController().signal, first.threadId!);
  const b = JSON.parse(await readFile(join(cwd, 'workspace', 'fixture.json'), 'utf8'));
  assert.equal(second.threadId, first.threadId);
  assert.equal(a.env.CLAUDE_CONFIG_DIR, b.env.CLAUDE_CONFIG_DIR);
  assert.equal(b.env.ANTHROPIC_API_KEY, 'NEXT_FIXTURE_KEY');
  assert.equal(b.settings.modelPicker.options.length, 1);
  assert.equal(await readFile(join(b.env.CLAUDE_CONFIG_DIR, 'session-sentinel'), 'utf8'), 'keep');
  assert.equal(await readFile(join(cwd, 'keep.kra'), 'utf8'), 'existing-artifact');
  assert.equal(await readFile(join(user, 'settings.json'), 'utf8'), hostSettings);
  assert.equal(await readFile(join(user, '.credentials.json'), 'utf8'), 'existing-login');
  for (const result of [first, second]) for (const file of ['request.json', 'prompt.md', 'events.jsonl', 'result.json']) {
    try { assert.doesNotMatch(await readFile(join(result.logDirectory!, file), 'utf8'), /FIXTURE_KEY|OLD_KEY|OLD_TOKEN|SHELL_TOKEN/); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
});

test('AGV receives native key, protocol and comma model list in its controlled workspace, with both protocols resumable', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/part-layering'), cli = join(root, 'fixture-cli');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, cliFixture, { mode: 0o700 });
  let previous: string | undefined, data: string | undefined;
  for (const protocol of ['openai', 'genai']) {
    const settings = loadWorkflowEnvironment({ layering_agv_path: cli, layering_agv_api_key: 'AGV_FIXTURE_KEY',
      layering_agv_base_url: 'https://agv.test/v1beta', layering_agv_models: 'gemini-4-argon, gemini-3-flash-preview', layering_agv_protocol: protocol }, root);
    const result = await runCliTask({ name: 'agv', cwd, prompt: 'fixture' }, parseAgentModel('gemini-4-argon-high', 'fixture'), settings,
      { cwd, logDirectory: join(cwd, 'agents') }, new AbortController().signal, previous);
    const meta = JSON.parse(await readFile(join(cwd, 'workspace', 'fixture.json'), 'utf8'));
    assert.equal(meta.env.AGY_LLM_GATEWAY_API_KEY, 'AGV_FIXTURE_KEY');
    assert.equal(meta.env.AGY_LLM_GATEWAY_WIRE_PROTOCOL, protocol);
    assert.equal(meta.env.AGY_LLM_GATEWAY_MODELS, 'gemini-4-argon,gemini-3-flash-preview');
    assert.ok(meta.env.ANTIGRAVITY_APP_DATA_DIR.startsWith(join(cwd, 'agents')));
    if (protocol === 'openai') assert.equal(meta.env.AGY_LLM_GATEWAY_URL, 'https://agv.test/v1beta');
    else { assert.match(meta.env.AGY_LLM_GATEWAY_URL, /^http:\/\/127\.0\.0\.1:/); assert.equal(result.threadId, previous); assert.equal(meta.env.ANTIGRAVITY_APP_DATA_DIR, data); }
    assert.equal(settings.codex.env!.AGY_LLM_GATEWAY_URL, 'https://agv.test/v1beta');
    previous = result.threadId || undefined; data = meta.env.ANTIGRAVITY_APP_DATA_DIR;
  }
});

test('explicit Claude Messages connection rejects native cloud routes while inherited routes remain supported', async t => {
  const root = await fixture(t), cwd = join(root, '.run/case/shadow'), cli = join(root, 'fixture-cli');
  await mkdir(cwd, { recursive: true }); await writeFile(cli, cliFixture, { mode: 0o700 });
  for (const mode of ['BEDROCK', 'VERTEX', 'FOUNDRY']) {
    const inherited = loadWorkflowEnvironment({ layering_claude_path: cli, [`CLAUDE_CODE_USE_${mode}`]: '1' }, root);
    const task = { name: mode, cwd, prompt: 'fixture' }, model = parseAgentModel('claude-sonnet-5-5-high', 'fixture'), options = { cwd };
    assert.equal((await runCliTask(task, model, inherited, options, new AbortController().signal)).text, 'done');
    const explicit = loadWorkflowEnvironment({ layering_claude_path: cli, [`CLAUDE_CODE_USE_${mode}`]: '1', layering_claude_api_key: 'fixture' }, root);
    await assert.rejects(runCliTask(task, model, explicit, options, new AbortController().signal), /Messages.*云平台路由不兼容/);
  }
});

test('configuration report shows unified sources, model lists and credential presence without key values', async t => {
  const root = await fixture(t);
  const report = configurationReport({ layering_codex_api_key: 'CODEX_SECRET', layering_codex_models: 'gpt-6.1-sol',
    layering_claude_api_key: 'CLAUDE_SECRET', layering_agv_api_key: 'AGV_SECRET', layering_agv_base_url: 'https://agv.test/v1beta',
    layering_agv_models: 'gemini-4-argon', ANTHROPIC_AUTH_TOKEN: 'TOKEN_SECRET' }, root);
  assert.equal(report.providers.codex.credentialsConfigured, true);
  assert.equal(report.providers.codex.sources.apiKey, 'layering_codex_api_key');
  assert.deepEqual(report.providers.codex.models, ['gpt-6.1-sol']);
  assert.equal(report.providers.agv.protocol, 'genai');
  assert.equal(report.providers.agv.baseUrl, 'https://agv.test/v1beta');
  assert.doesNotMatch(JSON.stringify(report), /CODEX_SECRET|CLAUDE_SECRET|AGV_SECRET|TOKEN_SECRET/);
});
