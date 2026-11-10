import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const refresh = source.slice(source.indexOf('let refreshVersion='), source.indexOf('function artifacts('));

function fixture(status: string, interaction: string) {
  const next: any = { status, runnerAlive: status === 'running', lockHeld: status === 'running', files: [], sections: [] };
  const calls: string[] = [];
  const context: any = {
    data: { status: 'running', runnerAlive: true, lockHeld: true },
    state: { name: 'test', directory: '/runs', page: 'project', asset: null },
    document: {
      activeElement: { matches: () => interaction === 'focus' },
      querySelector: (selector: string) => selector === '.app-header' ||
        (selector === 'dialog[open]' && interaction === 'dialog') ||
        (selector === '.panning' && interaction === 'panning') ? {} : null,
    },
    get: async (path: string) => path === './api/tasks' ? { directory: '/runs', tasks: [{ name: 'test' }] } : next,
    taskParams: () => 'name=test',
    rememberTask: () => {},
    selectedTask: () => 'test',
    applySnapshot: (value: any) => { context.data = value; calls.push('apply'); },
    render: () => calls.push('render'),
    headPreview: { update: () => {} },
  };
  return { calls, next, context, run: () => runInNewContext(refresh + '\nrefreshTask();', context) };
}

for (const status of ['failed', 'interrupted', 'completed']) {
  for (const interaction of ['focus', 'dialog', 'panning']) {
    test(`${status} updates immediately while ${interaction} is active`, async () => {
      const f = fixture(status, interaction);
      await f.run();
      assert.deepEqual(f.calls, ['apply', 'render']);
      assert.equal(f.context.data, f.next);
    });
  }
}

test('artifact-only refreshes still defer during interaction', async () => {
  const f = fixture('running', 'focus');
  await f.run();
  assert.deepEqual(f.calls, []);
});

test('group selection keeps focus while progress and intermediate files refresh', async () => {
  const f = fixture('running', 'focus');
  let focused = false;
  f.context.document.activeElement = { dataset: { treeDepth: '0' }, getAttribute: () => '0', matches: () => true };
  const query = f.context.document.querySelector;
  f.context.document.querySelector = (selector: string) => selector === '[data-tree-depth="0"]' ? { focus: () => { focused = true; } } : query(selector);
  await f.run();
  assert.deepEqual(f.calls, ['apply', 'render']); assert.equal(focused, true);
});

test('the separate preview tab still redraws new progress and artifacts', async () => {
  const f = fixture('running', 'none');
  f.context.state.page = 'preview';
  await f.run();
  assert.deepEqual(f.calls, ['apply', 'render']);
});

test('a selected task keeps refreshing while its selector has focus', async () => {
  const f = fixture('running', 'focus');
  f.context.document.activeElement.id = 'task-select';
  await f.run();
  assert.deepEqual(f.calls, ['apply', 'render']);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function persistentRefresh(f: ReturnType<typeof fixture>) {
  runInNewContext(refresh, f.context);
  return runInNewContext('refreshTask', f.context) as (force?: boolean) => Promise<void>;
}

test('polling never supersedes a slow forced selection or issues duplicate snapshots', async () => {
  const f = fixture('running', 'focus'), response = deferred<any>(), started = deferred<void>();
  const requests: string[] = [];
  f.context.get = async (path: string) => {
    requests.push(path);
    if (path === './api/tasks') return { directory: '/runs', tasks: [{ name: 'test' }] };
    started.resolve(); return response.promise;
  };
  const run = persistentRefresh(f), selected = run(true);
  await started.promise;
  // These ticks represent a snapshot spanning several polling intervals.
  for (let tick = 0; tick < 3; tick++) await run();
  assert.deepEqual(requests, ['./api/tasks', './api/task?name=test']);
  response.resolve(f.next);
  await selected;
  assert.deepEqual(f.calls, ['apply', 'render']);
  f.context.document.activeElement.id = 'task-select';
  await run();
  assert.equal(requests.length, 4, 'polling resumes after the selection finishes');
});

test('a slow background poll also finishes instead of being discarded by the next tick', async () => {
  const f = fixture('running', 'none'), response = deferred<any>(), started = deferred<void>();
  f.context.get = async (path: string) => {
    if (path === './api/tasks') return { directory: '/runs', tasks: [{ name: 'test' }] };
    started.resolve(); return response.promise;
  };
  const run = persistentRefresh(f), pending = run();
  await started.promise;
  await run(); await run();
  response.resolve(f.next);
  await pending;
  assert.deepEqual(f.calls, ['apply', 'render']);
});

test('rapid selection changes keep the newest task even when the older response finishes last', async () => {
  const f = fixture('running', 'none'), old = deferred<any>(), newer = deferred<any>(), started = deferred<void>();
  f.context.get = async (path: string) => {
    if (path === './api/tasks') return { directory: '/runs', tasks: [{ name: 'test' }, { name: 'second' }] };
    if (path.endsWith('name=test')) { started.resolve(); return old.promise; }
    return newer.promise;
  };
  f.context.taskParams = () => 'name=' + f.context.state.name;
  const run = persistentRefresh(f), first = run(true);
  await started.promise;
  f.context.state.name = 'second';
  const second = run(true), current = { ...f.next, name: 'second' };
  newer.resolve(current); await second;
  old.resolve({ ...f.next, name: 'test' }); await first;
  assert.equal(f.context.data, current);
  assert.deepEqual(f.calls, ['apply', 'render']);
});

test('a failed selection shows an error and releases polling so the next request can recover', async () => {
  const f = fixture('running', 'none');
  f.context.state.loading = true;
  f.context.get = async () => { throw new Error('offline'); };
  const run = persistentRefresh(f);
  await assert.rejects(run(true), /offline/);
  assert.equal(f.context.state.loadError, 'offline');
  assert.equal(f.context.state.loading, false);
  f.context.get = async (path: string) => path === './api/tasks' ? { directory: '/runs', tasks: [{ name: 'test' }] } : f.next;
  await run();
  assert.equal(f.context.state.loadError, null);
  assert.equal(f.context.data, f.next);
});

test('retrying a failed read restores the preview even when the snapshot matches the last successful read', async () => {
  const f = fixture('running', 'none'), run = persistentRefresh(f), get = f.context.get;
  await run(true);
  f.context.state.loading = true;
  f.context.get = async () => { throw new Error('offline'); };
  await assert.rejects(run(true), /offline/);
  f.context.get = get;
  await run();
  assert.equal(f.context.state.loadError, null);
  assert.deepEqual(f.calls, ['apply', 'render', 'render', 'apply', 'render']);
});

test('loss of runner updates even before persisted status leaves running', async () => {
  const f = fixture('running', 'focus');
  f.next.runnerAlive = false;
  await f.run();
  assert.deepEqual(f.calls, ['apply', 'render']);
});

test('打开中的报告草稿发布后读取正式文件，避免刷新成旧路径的错误', async () => {
  const f = fixture('running', 'none'), draft = 'clothing-raster-layering/step01/review-01.md.tmp', published = draft.replace('.tmp', '');
  const selected = { kind: 'file', path: draft, text: '草稿内容' };
  f.context.state.asset = selected;
  f.context.data.fileVersions = { [draft]: '1:100' };
  (f.next as any).fileVersions = { [published]: '2:200' };
  f.next.files = [published] as any;
  f.context.artifact = (path: string) => path;
  f.context.fetch = async (path: string) => { assert.equal(path, published); return { ok: true, text: async () => '正式内容' }; };
  await f.run();
  assert.equal(selected.text, '正式内容');
});

test('failure notice includes the last model message and stays visibly stopped', () => {
  const notice = source.slice(source.indexOf('function runNotice()'), source.indexOf('let flowObserver;'));
  const html = runInNewContext(notice + '\nrunNotice();', {
    data: { status: 'failed', errors: [], run: { error: '未交付结果\n模型最后消息：工具不可用' } },
    taskStatusNames: { failed: '执行失败' }, esc: (value: string) => value, icon: () => '',
  });
  assert.match(html, /执行失败 · 未交付结果/);
  assert.match(html, /模型最后消息：工具不可用/);
  assert.match(html, /class="run-notice error" open/);
});

for (const state of ['waiting', 'reserved', 'running']) test(`Krita ${state} updates while an unrelated input is focused`, async () => {
  const f = fixture('running', 'focus');
  f.context.data.sections = [{ id: 'nine-axis', status: 'running', states: { step01_preparation: 'running' }, krita: null }];
  f.next.sections = [{ id: 'nine-axis', status: 'running', states: { step01_preparation: 'running' }, krita: { state } }];
  await f.run(); assert.deepEqual(f.calls, ['apply', 'render']);
});
