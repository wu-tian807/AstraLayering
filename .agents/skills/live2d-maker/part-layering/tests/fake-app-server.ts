import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fakeDebug } from '../../shared/tests/fake-codex.ts';

export type FakeToolCall = { tool: string; arguments: unknown; threadId?: string; namespace?: string | null };

export async function fakeAppServer(directory: string, calls: FakeToolCall[], mode = 'completed', completedItems: unknown[] = [],
  behavior: { failedTurns?: number; blockedTurns?: number; errorInfo?: unknown; errorMessage?: string; nativeReconnect?: boolean; skipCallsAfterFailure?: boolean; finalText?: string } = {}) {
  const executable = join(directory, 'fake-app-server.mjs');
  const capture = join(directory, 'protocol.jsonl'), argv = join(directory, 'argv.json');
  await writeFile(executable, `#!${process.execPath}
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
const calls = ${JSON.stringify(calls)};
const mode = ${JSON.stringify(mode)};
const completedItems = ${JSON.stringify(completedItems)};
const capture = ${JSON.stringify(capture)};
const behavior = ${JSON.stringify(behavior)};
const finalText = behavior.finalText ?? '文件已保存，不返回 JSON。';
const write = value => process.stdout.write(JSON.stringify(value) + '\\n');
${fakeDebug()}
if (process.argv[2] === 'exec') {
  for await (const chunk of process.stdin) {}
  write({type:'thread.started',thread_id:'sdk-thread'});
  write({type:'turn.completed',usage:{input_tokens:1,cached_input_tokens:0,output_tokens:1}});
  process.exit(0);
}
await writeFile(${JSON.stringify(argv)}, JSON.stringify(process.argv.slice(2)));
let index = 0, turns = 0, threads = 0, threadId = 'native-thread', rollout;
// blockedTurns: the first turn of each of the first N threads is blocked; each thread
// gets its own id and a rollout of what the model saw.
const record = items => rollout && appendFile(rollout, items.map(payload => JSON.stringify({ type: 'response_item', payload }) + '\\n').join(''));
async function advance() {
  if (mode === 'hang') return;
  if (index < calls.length) {
    const call = calls[index++];
    await record([{ type: 'function_call', call_id: 'item-' + index, name: call.tool, arguments: JSON.stringify(call.arguments) }]);
    write({ method: 'item/tool/call', id: 'call-' + index,
      params: { threadId, turnId: 'native-turn', callId: 'item-' + index, namespace: null, ...call } });
  } else if (mode === 'eof') process.exit(0);
  else {
    if (!(behavior.skipCallsAfterFailure && turns > 1)) {
      for (const item of completedItems) write({ method: 'item/completed', params: { threadId, turnId: 'native-turn', item } });
    }
    write({ method: 'item/completed', params: { threadId, turnId: 'native-turn', item: { type: 'reasoning', summary: ['测试工具选择摘要'] } } });
    write({ method: 'item/completed', params: { threadId, turnId: 'native-turn', item: { type: 'agentMessage', text: finalText } } });
    write({ method: 'thread/tokenUsage/updated', params: { threadId, turnId: 'native-turn', tokenUsage: { total: { inputTokens: 12, outputTokens: 3 } } } });
    const blocked = turns === 1 && threads > 0 && threads <= (behavior.blockedTurns ?? 0);
    const failed = blocked || mode === 'failed' || turns <= (behavior.failedTurns ?? 0);
    const error = blocked ? {message:'Image processing blocked due to content policy violation.',codexErrorInfo:'other'}
      : mode === 'failed' ? {message:'测试回合失败',codexErrorInfo:'badRequest'} : {message:behavior.errorMessage ?? 'Selected model is at capacity. Please try a different model.',codexErrorInfo:behavior.errorInfo ?? 'serverOverloaded'};
    if (!blocked) await record([{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: finalText }] }]);
    if (failed) write({method:'error',params:{threadId,turnId:'native-turn',error,willRetry:false}});
    write({ method: 'turn/completed', params: { threadId, turn: {
      id: 'native-turn', status: failed ? 'failed' : 'completed', error: failed ? error : null } } });
  }
}
for await (const line of createInterface({ input: process.stdin })) {
  const msg = JSON.parse(line);
  await appendFile(capture, JSON.stringify(msg) + '\\n');
  if (msg.method === 'initialize') write({ id: msg.id, result: {} });
  else if (msg.method === 'thread/start' && behavior.blockedTurns !== undefined) {
    // Each session is its own process; number threads by the rollouts already written.
    do rollout = ${JSON.stringify(directory)} + '/rollout-' + ++threads + '.jsonl'; while (existsSync(rollout));
    threadId = 'native-thread-' + threads;
    await writeFile(rollout, JSON.stringify({ type: 'session_meta', payload: { id: threadId } }) + '\\n');
    await record([{ type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'instructions' }] }]);
    write({ id: msg.id, result: { thread: { id: threadId, path: rollout } } });
  } else if (msg.method === 'thread/inject_items') { await record(msg.params.items); write({ id: msg.id, result: {} }); }
  else if (msg.method === 'thread/start' || msg.method === 'thread/resume') write({ id: msg.id, result: { thread: { id: 'native-thread' } } });
  else if (msg.method === 'turn/start') {
    turns++;
    await record([{ type: 'message', role: 'user', content: msg.params.input.flatMap(part => part.type === 'localImage'
      ? [{ type: 'input_text', text: '<image name=[Image #1] path="' + part.path + '">' }, { type: 'input_image', image_url: 'data:image/png;base64,AA' }, { type: 'input_text', text: '</image>' }]
      : [{ type: 'input_text', text: part.text }]) }]);
    index = behavior.skipCallsAfterFailure && turns > 1 ? calls.length : 0;
    write({ id: msg.id, result: { turn: { id: 'native-turn', status: 'inProgress' } } });
    if (behavior.nativeReconnect) write({method:'error',params:{threadId,turnId:'native-turn',willRetry:true,error:{message:'Reconnecting... 2/5',codexErrorInfo:{responseStreamDisconnected:{httpStatusCode:503}}}}});
    await advance();
  } else if (typeof msg.id === 'string') {
    // A tool response: record what the model saw, images included.
    await record([{ type: 'function_call_output', call_id: 'item-' + msg.id.slice('call-'.length), output: (msg.result?.contentItems ?? []).map(part =>
      part.type === 'inputImage' ? { type: 'input_image', image_url: part.imageUrl } : { type: 'input_text', text: part.text }) }]);
    await advance();
  }
}
`, 'utf8');
  await chmod(executable, 0o755);
  return { executable, capture, argv };
}
