import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { fakeAppServer } from '../../part-layering/tests/fake-app-server.ts';
import { nodeExecutables } from '../../part-layering/tests/node-executables.ts';

// Raster steps drive the same app-server session as every other agent turn.
export async function rasterAppServer(t: TestContext, finalText: string, behavior: Parameters<typeof fakeAppServer>[4] = {}, mode = 'completed') {
  nodeExecutables(t);
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'raster-agent-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const server = await fakeAppServer(directory, [], mode, [], { finalText, ...behavior });
  const environment = loadWorkflowEnvironment({ codex_path: server.executable }, directory);
  const protocol = async () => (await readFile(server.capture, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  return { directory, environment, protocol };
}
