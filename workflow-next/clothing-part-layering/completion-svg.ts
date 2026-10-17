// 补全只能增加封闭路径。保留输入正文，新增路径置于其下方；不接受任意 SVG 属性或节点。
export type CompletionPath = { d: string; fillRule?: 'nonzero' | 'evenodd' };
const open = '<g data-completion-additions="v1" fill="#58b8a9" stroke="none">';
const clean = (text: string) => text.replace(/\r\n/g, '\n').replace(/<svg\b[^>]*>/, root =>
  root.replace(/\s(?:data-source-sha256|data-completion-inputs)=(['"]).*?\1/g, ''));

export function completionPaths(value: unknown): CompletionPath[] {
  if (!Array.isArray(value) || value.length > 256) throw new Error('补全 paths 须为数组，最多 256 条');
  let size = 0;
  return value.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(key => !['d', 'fillRule'].includes(key)) ||
        typeof raw.d !== 'string' || !/^\s*[Mm]/.test(raw.d) || !/[Zz]\s*$/.test(raw.d) ||
        !/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+eE-]+$/.test(raw.d) ||
        (raw.fillRule !== undefined && !['nonzero', 'evenodd'].includes(raw.fillRule))) {
      throw new Error('补全只接受封闭路径 d 与 fillRule，禁止 XML、样式和原形修改');
    }
    size += raw.d.length;
    if (size > 1_000_000) throw new Error('补全路径数据过大');
    return { d: raw.d, ...(raw.fillRule ? { fillRule: raw.fillRule } : {}) };
  });
}

export function composeCompletion(source: string, value: unknown): string {
  const paths = completionPaths(value);
  if (!paths.length) return source;
  if (source.includes('data-completion-additions')) throw new Error('补全输入已有新增层标记');
  const root = source.match(/<svg\b[^>]*>/)?.[0];
  if (!root || !/<\/svg>\s*$/.test(source)) throw new Error('无效补全输入 SVG');
  const additions = open + paths.map(path => `<path d="${path.d}" fill-rule="${path.fillRule ?? 'nonzero'}"/>`).join('') + '</g>';
  // 在原正文之前绘制，已有区域在上层；原路径、属性及其顺序不动。
  return source.replace(root, root + additions);
}

export function assertCompletionPreserves(source: string, candidate: string): number {
  const before = clean(source), after = clean(candidate);
  if (before === after) return 0;
  const root = after.match(/<svg\b[^>]*>/)?.[0];
  const start = root ? after.indexOf(root) + root.length : -1;
  if (start < 0 || !after.startsWith(open, start)) throw new Error('补全改变了已有 SVG，只允许程序生成的新增层');
  const end = after.indexOf('</g>', start);
  if (end < 0) throw new Error('无效补全新增层');
  const body = after.slice(start + open.length, end);
  const paths: CompletionPath[] = [];
  const pattern = /<path d="([^"]*)" fill-rule="(nonzero|evenodd)"\/>/g;
  let rest = body;
  for (const match of body.matchAll(pattern)) {
    paths.push({ d: match[1], fillRule: match[2] as CompletionPath['fillRule'] });
    rest = rest.replace(match[0], '');
  }
  if (rest || !paths.length || clean(composeCompletion(source, paths)) !== after) {
    throw new Error('补全改变了已有 SVG 或包含未授权属性');
  }
  return paths.length;
}
