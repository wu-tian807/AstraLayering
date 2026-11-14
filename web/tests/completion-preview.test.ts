import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createWorkbench } from '../server.ts';
import { acquireTaskLock, configureRun, saveRun } from '../../.agents/skills/live2d-maker/workflow/state.ts';

test('completion preview waits, follows the saved draft, and survives its publication', { timeout: 45_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'completion-preview-')), task = join(root, 'case');
  await mkdir(task);
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, value: string) => {
    const file = join(task, path); await mkdir(dirname(file), { recursive: true }); await writeFile(file, value);
  };
  const section = 'part-layering', draft = `${section}/step11_completion/body/workspace/completion.draft.svg`;
  const reduced = `${section}/step10_reduce/depth01/body.svg`, final = `${section}/parts/body.svg`;
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>';
  const run = await configureRun({ name: 'case', dir: root, from: section, to: section }, task);
  run.status = 'running'; run.activeSections = [section];
  run.runner = { id: 'test-runner', pid: process.pid, startedAt: new Date(Date.now() - 1000).toISOString() };
  run.sections[section]!.status = 'running'; await saveRun(task, run);
  const releaseLock = await acquireTaskLock(task); t.after(async () => { await releaseLock(); });
  await put(`${section}/groups.json`, JSON.stringify({ groups: [{ id: 'body', kind: 'part', groups: [] }] }));
  await put(`${section}/step11_completion/body/.running`, '');
  await put(`${section}/agents/completion/request.json`, JSON.stringify({ task: { name: '正面遮挡补全-body' } }));
  const server = await createWorkbench({ defaultDir: root, settingsPath: join(root, 'settings.json') });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const browser = await chromium.launch({ headless: true }).catch(error => {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    t.skip('Install the Playwright Chromium browser to run preview checks.'); return null;
  });
  if (!browser) return;
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/version', route => route.fulfill({ json: { label: 'test' } }));
  let hold = false, releaseSnapshot = () => {};
  const barrier = new Promise<void>(resolve => { releaseSnapshot = resolve; });
  await page.route('**/api/task?*', async route => { if (hold) await barrier; await route.continue(); });
  t.after(() => releaseSnapshot());
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/?name=case&page=preview`);
  const group = page.locator('[data-cycle="0"]'); await group.waitFor();
  await group.locator('[data-group-toggle="0"]').first().evaluate(button => (button as HTMLButtonElement).click());
  const panel = page.locator('[data-svg-preview="0:completion"]');
  await panel.getByText('等待首次保存 SVG').waitFor();
  assert.equal(await group.locator('[data-phase="0:completion"] .phase-state').textContent(), '进行中');
  const waitForPath = (path: string) => page.waitForFunction(([selector, value]) =>
    document.querySelector(selector)?.getAttribute('title') === value,
  ['[data-svg-preview="0:completion"] button.artifact-image', path]);
  await put(reduced, svg); await waitForPath(reduced);
  await put(draft, svg); await waitForPath(draft);
  await panel.locator('button.artifact-image').evaluate(button => (button as HTMLButtonElement).click());
  const inspector = page.locator('.output-inspector'); await inspector.waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('.output-inspector img[data-svg-artifact]') as HTMLImageElement | null;
    return image?.complete && image.naturalWidth > 0;
  });
  // The browser has a snapshot containing the draft; the pipeline then moves it
  // before the next image request and before a new snapshot arrives.
  hold = true;
  await mkdir(dirname(join(task, final)), { recursive: true });
  await rename(join(task, draft), join(task, final));
  for (const image of [panel.locator('img[data-svg-artifact]'), inspector.locator('img[data-svg-artifact]')]) {
    await image.evaluate(element => {
      const img = element as HTMLImageElement, url = new URL(img.src);
      url.searchParams.set('race', 'publication'); img.loading = 'eager'; img.src = url.toString();
    });
  }
  await panel.getByText('画面暂不可用，等待刷新').waitFor();
  await inspector.getByText('画面暂不可用，等待刷新').waitFor();
  hold = false; releaseSnapshot();
  await waitForPath(final);
  await page.waitForFunction(path => document.querySelector('.output-inspector .artifact-source')?.textContent?.includes(path), final);
  await page.waitForFunction(() => [...document.querySelectorAll('[data-svg-preview="0:completion"] img, .output-inspector img[data-svg-artifact]')]
    .length === 2 && [...document.querySelectorAll('[data-svg-preview="0:completion"] img, .output-inspector img[data-svg-artifact]')]
    .every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0));
  assert.equal(await panel.locator('.svg-unavailable').count(), 0);
  assert.equal(await inspector.locator('.svg-unavailable').count(), 0);
  assert.deepEqual(errors, []);
});
