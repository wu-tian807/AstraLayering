import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import type { AgentResult, AgentTask, CodexAgents } from '../../shared/codex/agents.ts';
import type { FunctionTool } from '../../shared/codex/function-tools.ts';
import type { Harness } from '../../shared/agents/models.ts';
import { clearStepSession, readStepSession, sessionPath } from '../../shared/agents/step-session.ts';
import { executionPaths } from '../../shared/agents/workspace.ts';
import { knowledgeDirectory, useKnowledge } from '../../shared/knowledge.ts';
import { applyStepAction } from '../../workflow/step-actions.ts';
import { createFitHead } from '../run.ts';

const groups = ['left', 'up', 'down'] as const;
type Group = typeof groups[number];
type Callbacks = NonNullable<Parameters<CodexAgents['createSession']>[1]>;
type Capture = { resumeThreadId?: string; options: Callbacks; threadId: string; task?: AgentTask; closed: number; events: string[] };
type Plan = { started?: boolean; harness?: Harness; result?: Partial<AgentResult>; error?: Error & { threadId?: string };
  afterStarted?: (call: Capture) => Promise<void> };

async function put(path: string, value: string) {
  await mkdir(dirname(path), { recursive: true }); await writeFile(path, value);
}

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'nine-axis-sessions-')), previous = knowledgeDirectory();
  t.after(async () => { useKnowledge(previous); await rm(root, { recursive: true, force: true }); });
  const section = join(root, 'case/nine-axis'), knowledge = join(root, 'knowledge');
  // One shared agent.json, with observable tool ordering and descriptions.
  // No group agent.json exists: a lookup under left/up/down must fail.
  const configPath = join(knowledge, 'nine-axis/step02_angles/agent.json');
  await put(configPath, JSON.stringify({ main: { initial: ['prompts/main.md'], tools: ['view_bitmap', 'edit_nine_axis'] } }));
  await put(join(knowledge, 'nine-axis/step02_angles/prompts/main.md'), 'shared nine-axis agent');
  await put(join(knowledge, 'shared/prompts/runtime/agent-turn.md'), 'Session task root: {uri:.}');
  await put(join(knowledge, 'nine-axis/step02_angles/tools/view_bitmap/description.md'), 'single agent.json bitmap tool');
  await put(join(knowledge, 'nine-axis/step02_angles/tools/edit_nine_axis/description.md'), 'single agent.json edit tool');
  useKnowledge(knowledge);
  const captures: Capture[] = [], toolSteps: string[] = [], plans = new Map<Group, Plan>();
  let fresh = 0;
  const agents = {
    async run(): Promise<AgentResult> { assert.fail('createFitHead must use its persistent session, never agents.run'); },
    createSession(id?: string, options: Callbacks = {}) {
      const call: Capture = { resumeThreadId: id, options, threadId: id ?? `fresh-thread-${++fresh}`, closed: 0, events: [] };
      captures.push(call);
      return {
        async run(task: AgentTask, signal?: AbortSignal): Promise<AgentResult> {
          signal?.throwIfAborted(); call.task = task; call.events.push('run');
          const plan = plans.get(basename(task.outputDirectory!) as Group) ?? {}, harness = plan.harness ?? options.resumeHarness ?? 'agv';
          if (plan.started !== false) {
            await options.onSessionStarted?.(call.threadId, harness); call.events.push('started');
          }
          await plan.afterStarted?.(call);
          if (plan.error) { call.events.push('throw'); throw plan.error; }
          call.events.push('result');
          return { text: '{"error":null}', images: [], threadId: call.threadId, harness, ...plan.result };
        },
        async close() { call.closed++; call.events.push('close'); },
      };
    },
  } satisfies Parameters<typeof createFitHead>[0];
  const tools = async (step: string): Promise<FunctionTool[]> => {
    toolSteps.push(step);
    return ['edit_nine_axis', 'unused_tool', 'view_bitmap'].map(name => ({ name, description: 'provided tool', inputSchema: { type: 'object' },
      async execute() { assert.fail('session tests never execute real tools or models'); } }));
  };
  const step = (group: Group) => `step02_angles/${group}`;
  const output = (group: Group) => join(section, step(group));
  const run = (group: Group) => createFitHead(agents, tools, step(group), `axis ${group}`, undefined, section)
    (output(group), `work only in ${output(group)}`);
  const records = () => Promise.all(groups.map(group => readStepSession(section, step(group))));
  const bytes = () => Promise.all(groups.map(group => readFile(sessionPath(section, step(group)), 'utf8')));
  for (const group of groups) {
    await put(join(output(group), '.running'), '');
    await put(join(output(group), `face-${group}.json`), `original author ${group}`);
  }
  return { root, section, configPath, captures, toolSteps, plans, run, records, bytes, step, output };
}

test('left/up/down concurrently start distinct sessions, share one agent.json, and resume their own saved threads', { timeout: 10_000 }, async t => {
  const f = await fixture(t);
  assert.deepEqual(await f.records(), [undefined, undefined, undefined]);
  let entered = 0, release!: () => void;
  const allStarted = new Promise<void>(resolve => { release = resolve; });
  for (const group of groups) f.plans.set(group, { afterStarted: async call => {
    const saved = await readStepSession(f.section, f.step(group));
    assert.deepEqual(saved, { threadId: call.threadId, harness: 'agv' }); // durable before the result
    if (++entered === 3) release();
    await allStarted;
  } });
  await Promise.all(groups.map(f.run));
  assert.equal(entered, 3);
  assert.deepEqual(f.captures.map(call => call.resumeThreadId), [undefined, undefined, undefined]);
  const saved = await f.records();
  assert.equal(new Set(saved.map(record => record!.threadId)).size, 3);
  const config = JSON.parse(await readFile(f.configPath, 'utf8'));
  const workspaces = new Set<string>();
  for (const call of f.captures) {
    const task = call.task!, group = basename(task.outputDirectory!) as Group;
    assert.equal(task.step, 'nine_axis_head'); assert.equal(task.cwd, f.section);
    assert.equal(task.outputDirectory, f.output(group));
    assert.deepEqual(task.tools!.map(tool => tool.name), config.main.tools);
    assert.deepEqual(task.tools!.map(tool => tool.description), ['single agent.json bitmap tool', 'single agent.json edit tool']);
    const workspace = executionPaths(task, f.section).workspace;
    assert.equal(workspace, join(f.output(group), 'workspace')); await access(workspace); workspaces.add(workspace);
    assert.ok(task.prompt.includes(f.output(group)));
    assert.deepEqual(call.events, ['run', 'started', 'result', 'close']); assert.equal(call.closed, 1);
  }
  assert.equal(workspaces.size, 3);
  const originalBytes = await f.bytes(); f.plans.clear();
  // New fit closures re-read disk; use a different invocation order.
  for (const group of ['down', 'left', 'up'] as const) await f.run(group);
  for (const call of f.captures.slice(3)) {
    const group = basename(call.task!.outputDirectory!) as Group, own = saved[groups.indexOf(group)]!;
    assert.equal(call.resumeThreadId, own.threadId); assert.equal(call.options.resumeHarness, own.harness);
    assert.equal(call.closed, 1);
  }
  assert.deepEqual(await f.bytes(), originalBytes);
  assert.deepEqual(f.toolSteps.sort(), groups.flatMap(group => [f.step(group), f.step(group)]).sort());
});

test('onSessionStarted persists the interrupted thread even when the error and result contain no threadId', async t => {
  const f = await fixture(t), error = new Error('interrupt after session callback');
  f.plans.set('up', { error, harness: 'claude', afterStarted: async call => {
    assert.deepEqual(await readStepSession(f.section, f.step('up')), { threadId: call.threadId, harness: 'claude' });
  } });
  await assert.rejects(f.run('up'), e => e === error);
  const interrupted = f.captures[0]; assert.equal(interrupted.closed, 1);
  assert.deepEqual(await f.records(), [undefined, { threadId: interrupted.threadId, harness: 'claude' }, undefined]);
  f.plans.set('up', { result: { threadId: null } });
  await f.run('up');
  assert.equal(f.captures[1].resumeThreadId, interrupted.threadId);
  assert.equal(f.captures[1].options.resumeHarness, 'claude');
  assert.deepEqual(await readStepSession(f.section, f.step('up')), { threadId: interrupted.threadId, harness: 'claude' });
});

test('run result threadId and writable thrown error threadId are saved only under their own direction', async t => {
  const f = await fixture(t);
  f.plans.set('left', { started: false, result: { threadId: 'result-left', harness: 'codex' } });
  const error = Object.assign(new Error('transport interrupted'), { threadId: '' }); error.threadId = 'error-down';
  f.plans.set('down', { error });
  await f.run('left'); await assert.rejects(f.run('down'), e => e === error);
  assert.deepEqual(await f.records(), [{ threadId: 'result-left', harness: 'codex' }, undefined, { threadId: 'error-down', harness: 'agv' }]);
  assert.ok(f.captures.every(call => call.closed === 1));
  f.plans.clear(); await f.run('down'); await f.run('left');
  assert.deepEqual(f.captures.slice(2).map(call => call.resumeThreadId), ['error-down', 'result-left']);
  const history = JSON.parse(await readFile(sessionPath(f.section, f.step('down')) + '.history.jsonl', 'utf8'));
  assert.equal(history.threadId, f.captures[1].threadId); assert.equal(history.harness, 'agv');
});

test('clearStepSession resume starts only its own new thread, retaining sibling sessions and all authors', async t => {
  const f = await fixture(t); await Promise.all(groups.map(f.run));
  const before = await f.bytes(), saved = await f.records();
  const dropped = await clearStepSession(f.section, f.step('up'), 'resume up only');
  assert.deepEqual(dropped, saved[1]); assert.equal(await readStepSession(f.section, f.step('up')), undefined);
  for (const group of groups) assert.equal(await readFile(join(f.output(group), `face-${group}.json`), 'utf8'), `original author ${group}`);
  for (const group of ['left', 'down'] as const) assert.equal(await readFile(sessionPath(f.section, f.step(group)), 'utf8'), before[groups.indexOf(group)]);
  const history = JSON.parse(await readFile(sessionPath(f.section, f.step('up')) + '.history.jsonl', 'utf8'));
  assert.equal(history.threadId, saved[1]!.threadId); assert.equal(history.reason, 'resume up only');
  assert.equal(await clearStepSession(f.section, f.step('up'), 'already clear'), undefined);
  await f.run('up'); assert.equal(f.captures[3].resumeThreadId, undefined);
  assert.notEqual((await f.records())[1]!.threadId, saved[1]!.threadId);
  for (const group of ['down', 'left'] as const) await f.run(group);
  assert.deepEqual(f.captures.slice(4).map(call => call.resumeThreadId), [saved[2]!.threadId, saved[0]!.threadId]);
});

test('removing agents/steps/step02_angles/<group> drops only its session and history; siblings still resume', async t => {
  const f = await fixture(t); await Promise.all(groups.map(f.run));
  const saved = await f.records(), before = await f.bytes();
  const own = dirname(sessionPath(f.section, f.step('left')));
  await put(join(own, 'session.json.history.jsonl'), 'old left history');
  const siblingHistory = sessionPath(f.section, f.step('down')) + '.history.jsonl'; await put(siblingHistory, 'keep down history');
  await rm(own, { recursive: true, force: true });
  assert.equal(await readStepSession(f.section, f.step('left')), undefined);
  await assert.rejects(access(join(own, 'session.json.history.jsonl')), { code: 'ENOENT' });
  for (const group of ['up', 'down'] as const) assert.equal(await readFile(sessionPath(f.section, f.step(group)), 'utf8'), before[groups.indexOf(group)]);
  await f.run('left'); assert.equal(f.captures[3].resumeThreadId, undefined);
  assert.notEqual((await f.records())[0]!.threadId, saved[0]!.threadId);
  for (const group of ['up', 'down'] as const) await f.run(group);
  assert.deepEqual(f.captures.slice(4).map(call => call.resumeThreadId), [saved[1]!.threadId, saved[2]!.threadId]);
  assert.equal(await readFile(siblingHistory, 'utf8'), 'keep down history');
  for (const group of groups) assert.equal(await readFile(join(f.output(group), `face-${group}.json`), 'utf8'), `original author ${group}`);
});

test('actual child resume action clears only the selected direction and preserves sibling authors and sessions', async t => {
  const f = await fixture(t); await Promise.all(groups.map(f.run));
  const before = await f.bytes();
  await applyStepAction({ name: 'case', dir: f.root, section: 'nine-axis', step: f.step('up'), action: 'resume' });
  assert.equal(await readStepSession(f.section, f.step('up')), undefined);
  for (const group of ['left', 'down'] as const) assert.equal(await readFile(sessionPath(f.section, f.step(group)), 'utf8'), before[groups.indexOf(group)]);
  for (const group of groups) assert.equal(await readFile(join(f.output(group), `face-${group}.json`), 'utf8'), `original author ${group}`);
  await f.run('up'); assert.equal(f.captures[3].resumeThreadId, undefined);
});

test('actual child retry removes only its output and agents/steps/<group>, then siblings resume their saved threads', async t => {
  const f = await fixture(t); await Promise.all(groups.map(f.run));
  const saved = await f.records(), before = await f.bytes();
  await applyStepAction({ name: 'case', dir: f.root, section: 'nine-axis', step: f.step('left'), action: 'retry' });
  await assert.rejects(access(f.output('left')), { code: 'ENOENT' });
  await assert.rejects(access(dirname(sessionPath(f.section, f.step('left')))), { code: 'ENOENT' });
  for (const group of ['up', 'down'] as const) {
    assert.equal(await readFile(sessionPath(f.section, f.step(group)), 'utf8'), before[groups.indexOf(group)]);
    assert.equal(await readFile(join(f.output(group), `face-${group}.json`), 'utf8'), `original author ${group}`);
  }
  await f.run('left'); assert.equal(f.captures[3].resumeThreadId, undefined);
  for (const group of ['up', 'down'] as const) await f.run(group);
  assert.deepEqual(f.captures.slice(4).map(call => call.resumeThreadId), [saved[1]!.threadId, saved[2]!.threadId]);
});
