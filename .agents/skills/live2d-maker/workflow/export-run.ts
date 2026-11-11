import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { exportCompletedRun } from './export.ts';
import { directoryFor } from './state.ts';

export function parseExportArguments(args: string[]) {
  const { values } = parseArgs({ args, options: { name: { type: 'string' }, dir: { type: 'string' },
    output: { type: 'string' }, alias: { type: 'string', multiple: true }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } }, strict: true });
  if (values.help) return undefined;
  if (!values.name) throw new Error('请提供 --name <任务名>。');
  directoryFor({ name: values.name, dir: values.dir });
  return { name: values.name, dir: values.dir, output: resolve(values.output ?? values.name + '.zip'), aliases: values.alias?.map(alias => resolve(alias)), json: values.json };
}
export async function main(args = process.argv.slice(2)) {
  const options = parseExportArguments(args);
  if (!options) { console.log('pnpm export --name <任务名> [--dir <运行根目录>] [--output <目录或.zip>] [--alias <其他来源目录>]... [--json]\n默认输出到当前目录的 <任务名>.zip；仅导出全流程已完成的任务。'); return; }
  const result = await exportCompletedRun(options);
  console.log(options.json ? JSON.stringify(result, null, 2) : `已导出：${result.output}\n${result.files} 个文件，${result.bytes} 字节；${result.warnings.length} 个历史图片引用未找到。`);
}
if (import.meta.main) main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
