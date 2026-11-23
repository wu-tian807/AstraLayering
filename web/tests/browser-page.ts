import type { TestContext } from 'node:test';
import { chromium, type BrowserContextOptions } from 'playwright';

export async function openPage(t: TestContext, options?: BrowserContextOptions) {
  const browser = await chromium.launch({ headless: true }).catch(error => {
    if (!String(error).includes("Executable doesn't exist")) throw error;
    t.skip('Playwright Chromium is unavailable');
    return null;
  });
  if (!browser) return;
  t.after(() => browser.close());
  return browser.newPage(options);
}
