import { dirname, join } from 'node:path';
import { createPixelTool } from '../shared/raster/pixel-tool.ts';
import { formatAgentError } from '../shared/codex/diagnostics.ts';
import { runCli } from '../shared/raster/cli.ts';
import { runWorkflow as runSharedWorkflow, type KritaSection, type WorkflowOptions, type Dependencies } from '../shared/raster/workflow.ts';
import { inputDirectories, isAssemblyInput, resolveAssemblyInput, type AssemblyInput } from './input.ts';
import { buildPrompt, steps } from './steps.ts';
import { copyDelivery } from '../shared/raster/passthrough.ts';
export { parseRunArguments } from '../shared/raster/cli.ts';

export const help = `character-assembly — 单 agent 组装人物与衣服 KRA

首次运行：pnpm character-assembly --name <任务名> --krita <可执行文件路径> --knowledge <先验知识目录>
继续运行：同上，仍须带 --krita 与 --knowledge（独立 section 不保存配置；knowledge 完整替换 skill 自带的 knowledge/）
--dir <绝对路径> 指定运行根目录，默认是 skill 上一级。
--dry-run 检查输入和 Krita 并展示提示词，不调用模型、不写任务文件。
--check-krita --krita <可执行文件路径> 只检查指定的 Krita。

从同名任务读取：
  raster-layering/step03/character-dressup-base.kra
  clothing-raster-layering/step02/clothing-soft-edges.kra
  part-layering/references/simplified-subject.png
交付到 <运行根目录>/<name>/character-assembly/step01/：
  character-assembled.kra、character-assembled.png、report.md
使用 assembly_agent_model 配置，默认 gpt-6.1-sol / xhigh；只有一个绘制 agent，不设 reviewer。
.run 不参与路径拼接；各步 thread 记在 agents/steps/<stepNN>/session.json，.running 续原 thread，.completed 跳过。
用总入口 pnpm start --name <任务名> --retry --section character-assembly --step step01（或网页「重试」）重置本步和 thread，不修改上游产物。
`;

export const section: KritaSection<AssemblyInput> = {
  id: 'character-assembly', steps,
  tools: (output, input, _step, phase) => phase === 'draw'
    ? [createPixelTool(dirname(output), dirname(dirname(output)), join(output, 'pixel-review'), {
      sources: [{ namespace: 'character' as const, document: input.characterKra }, ...input.clothingKra ? [{ namespace: 'clothing' as const, document: input.clothingKra }] : []],
    })] : [],
  // No clothing lane ran: the character KRA is the assembled result.
  passthrough: async (output, input) => input.clothingKra !== null ? undefined
    : copyDelivery(output, '素体换装沿用了简化参考，没有衣服需要组装', [
      [input.characterKra, 'character-assembled.kra'],
      [input.characterKra.replace(/\.kra$/, '.png'), 'character-assembled.png'],
    ]),
  resolveInput: resolveAssemblyInput, validateInput: isAssemblyInput, inputDirectories, buildPrompt,
};

export function runWorkflow(options: WorkflowOptions, dependencies: Dependencies = {}) {
  return runSharedWorkflow(section, options, dependencies);
}

if (import.meta.main) {
  runCli(section, help).catch(error => {
    console.error(formatAgentError(error));
    process.exitCode = 1;
  });
}
