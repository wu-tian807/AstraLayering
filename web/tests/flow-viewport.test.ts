import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createWorkbench } from '../server.ts';

test('flow preview retains the right edge, manual zoom and a middle position across layout changes and polling',
  { timeout: 30_000 }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'flow-viewport-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const workspace = join(root, 'case/nine-axis/step07_jaw-line/workspace');
    await mkdir(workspace, { recursive: true });
    await writeFile(join(workspace, '../.completed'), '');
    const server = await createWorkbench({ defaultDir: root, settingsPath: join(root, 'settings.json') });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
    const browser = await chromium.launch({ headless: true }).catch(error => {
      if (!String(error).includes("Executable doesn't exist")) throw error;
      t.skip('Install the Playwright Chromium browser to run viewport checks.');
      return null;
    });
    if (!browser) return;
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1708, height: 1418 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/version', route => route.fulfill({ json: { label: 'test' } }));
    await page.goto(`http://127.0.0.1:${(server.address() as any).port}/?name=case&page=preview`);
    const viewport = page.locator('.flow-scroll');
    await viewport.waitFor();
    const position = () => viewport.evaluate(element => ({ left: element.scrollLeft, max: element.scrollWidth - element.clientWidth }));
    const atEnd = async () => { const { left, max } = await position(); assert.ok(Math.abs(max - left) < 2, JSON.stringify({ left, max })); };
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    await page.setViewportSize({ width: 1708, height: 1050 });
    await page.waitForTimeout(150);
    await atEnd();
    await page.setViewportSize({ width: 1708, height: 1418 });
    await page.waitForTimeout(150);
    await atEnd();
    await page.locator('[data-action="zoom-reset"]').click();
    await page.locator('[data-action="zoom-out"]').click();
    assert.equal(await page.locator('#zoom-label').textContent(), '90%');
    await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
    const refresh = async (number: number) => {
      await writeFile(join(workspace, `poll-${number}.md`), 'saved research');
      await page.locator('[data-details="process:6:step07_jaw-line"] > summary').filter({ hasText: `${number} 个过程文件` }).waitFor();
      await page.waitForTimeout(100);
      assert.equal(await page.locator('#zoom-label').textContent(), '90%');
    };
    await refresh(1); await atEnd();
    await viewport.evaluate(element => { element.scrollLeft = (element.scrollWidth - element.clientWidth) * .46; });
    const middle = await position();
    await refresh(2);
    assert.ok(Math.abs((await position()).left - middle.left) < 2);
    assert.deepEqual(errors, []);
  });
