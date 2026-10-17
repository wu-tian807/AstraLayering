import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PartLayeringInput } from './input.ts';
import type { KritaInstallation } from './krita.ts';

export const stepModels = {
  1: { model: 'gpt-6-astra', effort: 'xhigh' },
  2: { model: 'gpt-6-astra', effort: 'xhigh' },
} as const;

export type StepDefinition = {
  id: string;
  title: string;
  model: string;
  effort: 'xhigh';
  prompt: URL;
  inputFiles?: readonly string[]; // Relative to the named run root; previous deliveries are read-only.
  requiredFiles: readonly string[];
  review?: { prompt: URL; repairPrompt: URL; model: string; effort: 'xhigh' };
};

export const steps = [{
  id: 'step01', title: '衣服分件、补全与 Krita 拼装', model: 'gpt-6-astra', effort: 'xhigh',
  prompt: new URL('./prompts/01-衣服分层与补全.md', import.meta.url),
  requiredFiles: ['clothing-depth.kra', 'report.md'],
}, {
  id: 'step02', title: '衣服边缘与衔接修画', model: 'gpt-6-astra', effort: 'xhigh',
  prompt: new URL('./prompts/02-边缘柔化.md', import.meta.url),
  inputFiles: ['step01/clothing-depth.kra', 'step01/report.md'],
  requiredFiles: ['clothing-soft-edges.kra', 'report.md'],
  review: {
    model: 'gpt-6-astra', effort: 'xhigh',
    prompt: new URL('./prompts/02-review.md', import.meta.url),
    repairPrompt: new URL('./prompts/02-repair.md', import.meta.url),
  },
}] as const satisfies readonly StepDefinition[];

export async function buildPrompt(step: StepDefinition, input: PartLayeringInput, output: string, krita: KritaInstallation, previous: readonly string[] = []): Promise<string> {
  // The final report also checkpoints the initial drawing before review begins.
  // Publish it only after the agent turn and all delivery checks have succeeded.
  const report = step.review ? 'report.md.tmp' : 'report.md';
  const body = (await readFile(step.prompt, 'utf8')).replaceAll(`${step.id}/report.md`, `${step.id}/${report}`);
  const requiredFiles = step.requiredFiles.map(file => file === 'report.md' ? report : file);
  return `${body}\n---\n本次运行信息（上方为完整步骤提示词）：
- 本任务根目录：${JSON.stringify(dirname(output))}。正文中的 step01/、step02/ 和 input/ 均相对此目录。
- 本步输入文件（绝对路径，只读）：${JSON.stringify((step.inputFiles ?? []).map(file => join(dirname(output), file)))}。
- 输入副本目录：${JSON.stringify(input.directory)}。只读使用，后续续跑均以这份已保存的输入为准。
- 主要产物路径：${JSON.stringify(input.parts)}。以这里已完成的分层 part 作为部件形状与补全标准；保留输入文件。
- 参考图目录：${JSON.stringify(join(input.directory, 'references'))}。读取输入副本中的 groups.json、occlusion.json 等已有说明与深度表；parts/ 是主要部件产物，层级依据仍以输入提供的标准为准。
- 输出目录：${JSON.stringify(output)}。已有合格成果应继续使用；中间文件、每件生成记录和最终交付均放在这里。
- 前序已完成步骤：${JSON.stringify(previous.map(directory => ({ directory, report: join(directory, 'report.md') })))}。需要时读取这些交付和报告，不修改前序成果；即使本次是新会话，也从这些文件接续任务。
- Krita 已检查：${JSON.stringify(krita.executable)}，版本 ${krita.version}；沿用当前显示环境。
- 本步必须交付（绝对路径）：${JSON.stringify(requiredFiles.map(file => join(output, file)))}。按本步正文逐层验收、重开核对，并将修改、偏差和未解决问题写入 ${JSON.stringify(join(output, report))}。${step.review ? '报告先写暂存文件，调度器检查通过后发布为 report.md；不要自行写入正式报告或 review / repair 报告。' : ''}
- run.json、input/、各步的 .running / .completed 及 prompt.md、attempts.jsonl、events.jsonl、result.json、error.txt 由调度器维护，不要改写它们；不要自行推进后续步骤。
- 最后按输出 schema 返回 status 和 summary。只有完成上述交付与验收才返回 completed；若工具不可用或存在无法继续的问题，返回 blocked 并说明已保存进度和原因，不得冒充完成。\n`;
}
