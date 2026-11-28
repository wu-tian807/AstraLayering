import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'node:test';
import sharp from 'sharp';
import { createWorkbench } from '../server.ts';

export async function startWorkbench(t: TestContext, options: Parameters<typeof createWorkbench>[0]) {
  const server = await createWorkbench(options);
  await once(server.listen(0, '127.0.0.1'), 'listening');
  t.after(() => new Promise<void>(resolve => {
    server.close(() => resolve());
    server.closeAllConnections();
  }));
  return { server, url: 'http://127.0.0.1:' + (server.address() as AddressInfo).port };
}

export const postTask = (url: string, dir: string) => async (path: string, data: object, headers: Record<string, string> = {}) => {
  const response = await fetch(url + '/api/' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ dir, ...data }),
  });
  return { status: response.status, value: await response.json() as any };
};

export const imageUpload = async () => (await sharp({
  create: { width: 8, height: 8, channels: 3, background: '#cbbbaa' },
}).png().toBuffer()).toString('base64');
