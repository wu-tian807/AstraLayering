import './ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { videoModels, requireVideoApi } from '../video.ts';

test('video configuration preserves the exact eight upstream model IDs', () => {
  for (const model of videoModels) {
    const environment = loadWorkflowEnvironment({ video_base_url: 'https://video.example/v1', video_api_key: 'fixture', nine_axis_view_video_model: model });
    assert.equal(requireVideoApi(environment).model, model);
  }
});

test('unsupported image models and unpublished video aliases fail before a request', () => {
  for (const model of ['gpt-image-1', 'seedance-2.0', 'seedance-2.5-unknown']) {
    assert.throws(() => loadWorkflowEnvironment({ video_base_url: 'https://video.example/v1', video_api_key: 'fixture', nine_axis_view_video_model: model }), /nine_axis_view_video_model/);
  }
  assert.throws(() => requireVideoApi({}), /生视频接口/);
});
