import './ignore-local-env.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadWorkflowEnvironment } from '../codex/environment.ts';
import { videoModels, requireVideoApi } from '../video.ts';

test('video configuration preserves presets and manually entered model IDs', () => {
  for (const model of videoModels) {
    const environment = loadWorkflowEnvironment({ video_base_url: 'https://video.example/v1', video_api_key: 'fixture', nine_axis_view_video_model: model });
    assert.equal(requireVideoApi(environment).model, model);
  }
});

test('free-form video IDs retain the selected provider; malformed IDs fail before a request', () => {
  for(const model of ['seedance-2.0','custom-seedance-v3','ep-custom-deployment']) {
    const environment=loadWorkflowEnvironment({video_provider:'openai',video_base_url:'https://video.example/v1',video_api_key:'fixture',nine_axis_view_video_model:model});
    assert.equal(requireVideoApi(environment).model,model);
    assert.equal(requireVideoApi(environment).provider,'openai');
  }
  for(const model of ['*','model with spaces','model?query'])assert.throws(()=>loadWorkflowEnvironment({nine_axis_view_video_model:model}));
  assert.throws(() => requireVideoApi({}), /生视频接口/);
});
