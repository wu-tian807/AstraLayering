import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { checkKrita } from './krita.ts';
import { runWorkflow } from './workflow.ts';

export const help = `clothing-raster-layering — 按顺序执行 Krita 栅格分层流程

首次运行：pnpm start --name <任务名> --input <clothing-part-layering运行目录> --krita <可执行文件路径>
继续运行：pnpm start --name <任务名>
只查安装：pnpm start --krita <可执行文件路径> --check-krita
查看提示词：首次运行参数后加 --dry-run（检查路径和 Krita，不调用模型、不写文件）

任务固定保存到 clothing-raster-layering/.run/<任务名>/，不受启动时的工作目录影响。
--krita 首次必须显式提供，后续读取记录，也可显式更新；不会自动下载、安装或搜索 Krita。
--input 通常传 .run/test，自动使用其 parts/；直接传 .run/test/parts 也可以。
首次保存输入副本；run.json 保存配置和共用 threadId，步骤状态由 .running / .completed 决定。
中断保留 .running 并继续原 thread；删除某步 .completed 后，下次启动清空该步及后续目录，开启新 thread。
两步绘制及 reviewer 使用 gpt-6-astra / xhigh。provider、鉴权和内置 image_generation 由外部 Codex 配置，脚本不接管。
第二步 reviewer 使用 gpt-6-astra / xhigh，每次新会话；反馈由原 thread 全部修完。最多检查两次，无问题即结束，第二次修完不再检查。
第二步完成 review / 修复后结束，交付 step02/clothing-soft-edges.kra 和验收记录，不制作身体装配或身体插层说明。
`;

export function parseRunArguments(args: string[]) {
  const { values } = parseArgs({ args, options: {
    name: { type: 'string' }, input: { type: 'string' }, krita: { type: 'string' },
    'dry-run': { type: 'boolean' }, 'check-krita': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  } });
  if (!values.help) {
    if (values['check-krita'] && !values.krita?.trim()) throw new Error('必须提供 --krita <已安装的 Krita 可执行文件路径>。');
    if (!values['check-krita'] && !values.name?.trim()) throw new Error('必须提供 --name <任务名>。');
  }
  return values;
}

async function main(): Promise<void> {
  const args = parseRunArguments(process.argv.slice(2));
  if (args.help) { console.log(help); return; }
  if (args['check-krita']) {
    console.log(JSON.stringify(await checkKrita(args.krita!), null, 2));
    return;
  }
  const controller = new AbortController();
  const stop = () => controller.abort(new Error('运行已中断；使用同一 --name 继续原会话。'));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    console.log(await runWorkflow({
      name: args.name!, input: args.input, krita: args.krita,
      dryRun: args['dry-run'], signal: controller.signal, progress: message => console.log(message),
    }));
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
