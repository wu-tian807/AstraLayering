import { chmod, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { WorkflowEnvironment } from '../codex/environment.ts';

// Every Codex run requires the patched build. Tests that reach the startup check
// without a fake app server use the test-only runtime preload instead of building it.
// Every patched build reports the full set patches/codex/build.ts verifies, so the
// fakes do too: what a run needs must not depend on the local .env.
export const patchedCodexCapabilities = { version: 1, image_provider: true, image_provider_version: 2, image_compaction: true,
  image_compaction_version: 2, request_compaction_version: 1, failed_error_event_version: 1 };
// Sessions rewrite the catalog from `debug models` so every model calls tools directly.
export const fakeModelCatalog = { models: [{ slug: 'fixture-model', tool_mode: 'code_mode_only' }] };

export function withCodex(settings: WorkflowEnvironment, executable: string): WorkflowEnvironment {
  settings.codex.codexPathOverride = executable;
  return settings;
}

// Fake CLI source for `debug models` and `debug layering-capabilities`.
export function fakeDebug(capabilities: object = patchedCodexCapabilities) {
  return `if (process.argv[2] === 'debug') { console.log(process.argv[3] === 'models' ? ${JSON.stringify(JSON.stringify(fakeModelCatalog))} : ${JSON.stringify(JSON.stringify(capabilities))}); process.exit(0); }`;
}

export async function fakePatchedCodex(directory?: string): Promise<string> {
  const executable = join(directory ?? await mkdtemp(join(tmpdir(), 'fake-patched-codex-')), 'fake-patched-codex.mjs');
  await writeFile(executable, `#!${process.execPath}
${fakeDebug()}
if (process.argv[2] === '--version') console.log('codex-cli 0.161.0');
else { console.error('fake patched Codex only answers startup checks'); process.exit(1); }
`);
  await chmod(executable, 0o755);
  return executable;
}
