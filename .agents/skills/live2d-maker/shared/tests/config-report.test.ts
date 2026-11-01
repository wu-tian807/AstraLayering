import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { configurationReport } from '../codex/config-report.ts';

test('effective configuration reports shell overrides and disabled/enabled compaction without exposing credentials or rewriting files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'layering-config-report-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = 'layering_custom_provider=true\nlayering_provider_base_url=https://example.test/v1\nlayering_provider_api_key=SECRET_PROVIDER\nlayering_google_image_base_url=https://example.test/v1beta\nlayering_google_image_api_key=SECRET_IMAGE\nlayering_image_compact_threshold=\n';
  await writeFile(join(directory, '.env'), source);
  const disabled = configurationReport({}, directory);
  assert.deepEqual(disabled.codex.imageCompaction, { enabled: false, threshold: null, childThreshold: null });
  assert.equal(disabled.codex.patchAutoBuild, true);
  assert.deepEqual(disabled.agvPatch, {enabled: false});
  assert.equal(configurationReport({layering_agv_unlimited_response_header_timeout: 'true', layering_codex_path: '/fixture/codex'}, directory).codex.patchAutoBuild, false);
  assert.deepEqual(configurationReport({layering_agv_unlimited_response_header_timeout: 'true'}, directory).agvPatch, {enabled: true});
  const enabled = configurationReport({ layering_image_compact_threshold: '49', part_review_agent_model: 'gemini-4-argon-high' }, directory);
  assert.deepEqual(enabled.codex.imageCompaction, { enabled: true, threshold: 49, childThreshold: '49' });
  assert.deepEqual(enabled.shellOverrides, ['layering_image_compact_threshold']);
  assert.equal(enabled.models.part_review.harness, 'agv');
  assert.deepEqual(enabled.imageApis.google, { configured: true, protocol: 'gemini' });
  assert.doesNotMatch(JSON.stringify(enabled), /SECRET_PROVIDER|SECRET_IMAGE/);
  assert.equal(enabled.providers.codex.credentialsConfigured, true);
  assert.equal(enabled.providers.codex.sources.apiKey, 'layering_provider_api_key');
  assert.equal(await readFile(join(directory, '.env'), 'utf8'), source);
});
