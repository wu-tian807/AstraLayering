import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createWorkbench } from '../server.ts';

test('startup displays loading and a snapshot error, then recovers on polling', { timeout: 25_000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'workbench-loading-'));
  await mkdir(join(root, 'case'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const server = await createWorkbench({ defaultDir: root, settingsPath: join(root, 'settings.json') });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const browser = await chromium.launch({ headless: true }).catch(error => {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    t.skip('Install the Playwright Chromium browser to run startup checks.'); return null;
  });
  if (!browser) return;
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/version', route => route.fulfill({ json: { label: 'test' } }));
  let release = () => {}, first = true;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/task?*', async route => {
    if (!first) return route.continue();
    first = false; await pending;
    await route.fulfill({ status: 500, json: { error: '模拟读取失败' } });
  });
  t.after(() => release());
  await page.goto(`http://127.0.0.1:${(server.address() as any).port}/?name=case`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('status').filter({ hasText: '正在读取工作台' }).waitFor();
  release();
  await page.locator('.run-notice.error').filter({ hasText: '模拟读取失败' }).waitFor();
  await page.locator('.run-notice.error').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.app-header').count(), 1);
  assert.deepEqual(errors, []);
});
