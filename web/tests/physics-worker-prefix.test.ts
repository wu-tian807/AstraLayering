import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from 'playwright';
import { createWorkbench } from '../server.ts';

test('shared physics Worker starts and advances behind a mounted workbench URL', async () => {
  const root = await mkdtemp(join(tmpdir(), 'astra-worker-prefix-'));
  const workbench = await createWorkbench({ defaultDir: join(root, 'runs'), settingsPath: join(root, 'settings.json') });
  await new Promise<void>(resolve => workbench.listen(0, '127.0.0.1', resolve));
  const target = 'http://127.0.0.1:' + (workbench.address() as any).port;
  const prefix = '/host/character-layering';
  const proxy = createServer(async (request, response) => {
    if (request.url === prefix + '/probe') { response.setHeader('Content-Type', 'text/html'); response.end('<html><title>Worker probe</title></html>'); return; }
    if (!request.url?.startsWith(prefix + '/')) { response.writeHead(404); response.end(); return; }
    try {
      const result = await fetch(target + request.url.slice(prefix.length), { redirect: 'manual' });
      response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(Buffer.from(await result.arrayBuffer()));
    } catch { response.writeHead(500); response.end(); }
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage(), failures: string[] = [];
    page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(response.url()); });
    page.on('pageerror', error => failures.push(error.message));
    await page.goto('http://127.0.0.1:' + (proxy.address() as any).port + prefix + '/probe');
    await page.evaluate(async () => {
      const moduleUrl: string = './studio/component-physics-runner.js';
      const { ComponentPhysicsRunner } = await import(moduleUrl);
      const probe: any = (window as any).probe = { errors: [], steps: 0 };
      const scene: any = { reset() {}, stepNumber: 0 };
      const panel: any = { config: { kind: 'astra-component-physics', version: 1, solver: 'astra-component-physics-1',
        source: { canvas: { width: 100, height: 100 } }, components: [] }, bodies: new Map(), scene,
        enabled: true, paused: false, elapsed: 0, replayStep: 0, playback: '', breeze: false,
        render() { probe.steps = scene.stepNumber; }, error(message: string) { probe.errors.push(message); }, sync() {}, changed() {} };
      probe.runner = new ComponentPhysicsRunner(panel);
    });
    await page.waitForFunction(() => (window as any).probe.runner.ready || (window as any).probe.errors.length, null, { timeout: 15000 });
    assert.deepEqual(await page.evaluate(() => (window as any).probe.errors), []);
    await page.evaluate(() => (window as any).probe.runner.advance(1, true));
    await page.waitForFunction(() => (window as any).probe.steps === 1, null, { timeout: 15000 });
    assert.deepEqual(failures, []);
    await page.evaluate(() => (window as any).probe.runner.dispose());
  } finally {
    await browser.close();
    await new Promise<void>(resolve => proxy.close(() => resolve()));
    await new Promise<void>(resolve => workbench.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
