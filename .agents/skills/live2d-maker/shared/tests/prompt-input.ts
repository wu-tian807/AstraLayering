import { readFileSync } from 'node:fs';
import type { GroupInput } from '../part/layering-types.ts';

// Reads 【本次输入】: the runtime JSON, if any, merged with the `name：value`
// lines and the `- path：description` items of a list field. A
// `group：<groups.json> 中 id 为 X 的节点` line becomes that node, read from the
// named file (or the file of the named field) as the agent would, and the
// parentGroup rule becomes the parent's ID.
export function promptInput(prompt: string): Record<string, any> {
  prompt = prompt.replace(/\r\n/g, '\n');
  const start = prompt.indexOf('【本次输入】\n');
  if (start < 0) throw new Error('提示词缺少【本次输入】');
  const body = prompt.slice(start + '【本次输入】\n'.length).split('\n\n')[0];
  const json = /^\{[\s\S]*?\n\}(?=\n|$)/.exec(body)?.[0];
  const input: Record<string, any> = json ? JSON.parse(json) : {};
  let list: { path: string; description: string }[] | undefined;
  for (const line of body.slice(json?.length ?? 0).split('\n')) {
    const item = /^- (.+?)：(.*)$/.exec(line);
    if (item && list) { list.push({ path: item[1], description: item[2] }); continue; }
    const field = /^([A-Za-z]+)：(.*)$/.exec(line);
    if (!field) { list = undefined; continue; }
    if (field[2]) { input[field[1]] = field[2]; list = undefined; }
    else input[field[1]] = list = [];
  }
  for (const [name, value] of Object.entries(input)) {
    const parent = typeof value === 'string' && /^(.+?) 去掉最后一段 \/<名称> 后的 ID；不含 \/ 时为 null$/.exec(value);
    if (parent) input[name] = parent[1].includes('/') ? parent[1].slice(0, parent[1].lastIndexOf('/')) : null;
    const node = typeof value === 'string' && /^(.+?) 中 id 为 (.+?) 的节点/.exec(value);
    if (!node) continue;
    const source = typeof input[node[1]] === 'string' ? (input[node[1]] as string).split('；')[0] : node[1];
    const find = (groups: GroupInput[] = []): GroupInput | undefined =>
      groups.find(group => group.id === node[2]) ?? groups.map(group => find(group.groups)).find(Boolean);
    const found = find((JSON.parse(readFileSync(source, 'utf8')) as { groups: GroupInput[] }).groups);
    if (!found) throw new Error(`${source} 中没有 id 为 ${node[2]} 的节点`);
    const { groups: _groups, steps: _steps, ...seed } = found;
    input[name] = seed;
  }
  return input;
}

// The reference images a prompt names, in order.
export const referencePaths = (prompt: string): string[] => [...prompt.matchAll(/^参考图绝对路径：(.+)$/gm)].map(match => match[1]);
