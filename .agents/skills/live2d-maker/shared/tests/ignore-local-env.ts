import fs from 'node:fs';
import './codex-runtime-preload.ts';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workflowsDirectory } from '../paths.ts';

// Tests resolve configuration from example.env alone: the developer's own
// live2d-maker/.env must not change which harness, model or capability a test
// exercises. Preloaded before any module reads it, so the binding is replaced in time.
const localEnv = resolve(join(workflowsDirectory, '.env'));
const readFileSync = fs.readFileSync;
fs.readFileSync = ((path: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
  if (typeof path === 'string' && resolve(path) === localEnv) {
    throw Object.assign(new Error(`ENOENT: no such file or directory, open '${path}'`), { code: 'ENOENT' });
  }
  return (readFileSync as (...args: unknown[]) => unknown)(path, ...rest);
}) as typeof fs.readFileSync;
syncBuiltinESMExports();

// node --test hands this preload on to the test processes, and they to the workflow
// processes they start from other directories: pass it as a URL that resolves anywhere.
const self = fileURLToPath(import.meta.url);
process.execArgv.forEach((arg, index) => {
  if (arg.startsWith('--import=') && resolve(arg.slice('--import='.length)) === self) process.execArgv[index] = `--import=${import.meta.url}`;
  else if (process.execArgv[index - 1] === '--import' && resolve(arg) === self) process.execArgv[index] = import.meta.url;
});

// Workflows under test take Krita slots of their own, not the machine-wide ones
// that real sections share; each test process gets its own set.
const slots = join(tmpdir(), `astra-krita-test-slots-${process.pid}`);
process.env.ASTRA_STUDIO_KRITA_SLOTS = slots;
process.once('exit', () => fs.rmSync(slots, { recursive: true, force: true }));
