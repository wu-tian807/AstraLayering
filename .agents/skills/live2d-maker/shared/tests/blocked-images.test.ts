import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AgentCallError, blockedAgentError, retryableAgentError } from '../codex/agent-runtime.ts';
import { blockedImagesPrompt, replaceBlockedImages } from '../codex/blocked-images.ts';

const line = (type: string, payload: unknown) => JSON.stringify({ type, payload });
const image = (path: string) => [{ type: 'input_text', text: `<image name=[Image #1] path="${path}">` },
  { type: 'input_image', image_url: 'data:image/png;base64,AA' }, { type: 'input_text', text: '</image>' }];
const user = (...content: unknown[]) => line('response_item', { type: 'message', role: 'user', content });

test('内容策略拦截不按临时错误重试；包在断流里也能识别', () => {
  const error = new AgentCallError('stream disconnected before completion: Image processing blocked due to content policy violation.', 'other');
  assert.ok(blockedAgentError(error));
  assert.equal(retryableAgentError(error), false);
  assert.ok(blockedAgentError(new Error('wrapped', { cause: new AgentCallError('content_policy_violation') })));
  assert.equal(blockedAgentError(new AgentCallError('stream disconnected before completion')), false);
});

test('只换掉模型上次输出之后送入的图片；工具返回的图片标出工具与参数', () => {
  const rollout = [
    line('session_meta', { id: 'old' }),
    line('response_item', { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'instructions' }] }),
    user({ type: 'input_text', text: '<environment_context>x</environment_context>' }),
    user({ type: 'input_text', text: '任务' }, ...image('/in/early.png')),
    line('response_item', { type: 'function_call', name: 'crop', arguments: '{"scale":2}', call_id: 'c1' }),
    line('response_item', { type: 'function_call_output', call_id: 'c1', output: [{ type: 'input_image', image_url: 'data:x' }] }),
  ].join('\n');
  const replaced = replaceBlockedImages(rollout)!;
  assert.deepEqual(replaced.origins, ['工具 crop 的返回（参数：{"scale":2}）']);
  const history = JSON.stringify(replaced.items);
  assert.ok(!history.includes('instructions') && !history.includes('environment_context'));
  assert.equal(history.match(/input_image/g)?.length, 1, '早先已被接受的图片保留');
  assert.match(blockedImagesPrompt(replaced), /换一种方式读取[\s\S]*灰度[\s\S]*不要提交任何产物/);
});

test('压缩后的历史以替换历史为准；本批没有图片时换掉历史里所有图片，完全无图则返回空', () => {
  const rollout = [
    user(...image('/in/dropped.png')),
    line('compacted', { message: 'summary', replacement_history: [{ type: 'message', role: 'user', content: image('/in/kept.png') }] }),
    line('response_item', { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] }),
  ].join('\n');
  assert.deepEqual(replaceBlockedImages(rollout)!.origins, ['输入图片 /in/kept.png']);
  assert.equal(replaceBlockedImages(user({ type: 'input_text', text: '无图' })), undefined);
});
