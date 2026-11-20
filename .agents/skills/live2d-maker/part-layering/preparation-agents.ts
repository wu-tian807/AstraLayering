import { asCheck, checkedTurn } from '../shared/codex/checked-turn.ts';
import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { stepKnowledge } from '../shared/knowledge.ts';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskRootOf, toAgentPath } from '../shared/task-paths.ts';
import type { AgentTask, AgentDispatcher, GeneratedImage } from '../shared/agents/dispatcher.ts';
import { textResult } from '../shared/codex/function-tools.ts';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { PreparationSteps, ProcessGenerated, ReferenceChoice } from './preparation.ts';
import { reuseReference } from './preparation-state.ts';
import { isPng } from '../shared/png.ts';

async function readableImage(image: GeneratedImage | undefined): Promise<GeneratedImage> {
  if (!image) throw new Error('imagegen did not produce an image');
  if (!isPng(await readFile(image.savedPath))) throw new Error('imagegen did not produce a PNG image');
  return image;
}

async function saveImage(image: GeneratedImage | undefined, output: string): Promise<void> {
  if (!image) throw new Error('imagegen did not produce an image');
  const bytes = await readFile(image.savedPath);
  if (!isPng(bytes)) {
    throw new Error('imagegen did not produce a PNG image');
  }
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, output);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

async function prepareImage(agents: Pick<AgentDispatcher, 'run'>, knowledge: ReturnType<typeof stepKnowledge>, task: AgentTask,
  input: string, output: string, { requireTransparentForReuse = false, processGenerated }: {
    requireTransparentForReuse?: boolean; processGenerated?: ProcessGenerated;
  } = {}): Promise<ReferenceChoice> {
  let reusedReason: string | undefined;
  const checked = await checkedTurn({ agents, task: { ...task, tools: knowledge.tools('main', [{
    ...toolDefinition('reuse_reference', fileURLToPath(new URL('./tools/', import.meta.url))),
    async execute(value, signal, context) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => key !== 'reason')
        || typeof (value as { reason?: unknown }).reason !== 'string' || !(value as { reason: string }).reason.trim()) {
        throw new Error('复用参考只接受非空 reason；输入与输出路径由本步骤绑定。');
      }
      if (reusedReason !== undefined) throw new Error('本次参考已经复制完成。');
      if (!await reuseReference(input, output, requireTransparentForReuse, signal)) {
        return textResult({ status: 'needs_cutout', instruction: '保持原图人物前景，去除其他背景。' });
      }
      reusedReason = (value as { reason: string }).reason;
      return textResult({ savedPath: await toAgentPath(context?.root ?? taskRootOf(dirname(output)), output), reason: reusedReason });
    },
  }]) }, check: result => asCheck('invalid-output', async () => {
    if (reusedReason !== undefined) {
      if (result.images.length) throw new Error('本次参考同时执行了复制与生图，请只选择一种交付方式。');
      return { image: undefined, reason: reusedReason };
    }
    const reason: unknown = task.outputSchema ? JSON.parse(result.text).reason : '';
    if (typeof reason !== 'string' || (task.outputSchema && !reason.trim())) throw new Error('参考准备须说明复制或生图的判断依据。');
    return { image: await readableImage(result.images.at(-1)), reason };
  }) });
  if (checked.image) {
    await saveImage(checked.image, output);
    await processGenerated?.(output);
  }
  return { generated: checked.image !== undefined, reason: checked.reason };
}

export function createPreparationSteps(agents: Pick<AgentDispatcher, 'run'>): PreparationSteps {
  const referenceOutputSchema = {
    type: 'object', properties: { error: { type: ['string', 'null'] }, reason: { type: 'string' } },
    required: ['error', 'reason'], additionalProperties: false,
  };
  const standard = stepKnowledge('part-layering', 'step04_standard');
  const cutout = stepKnowledge('part-layering', 'step04_cutout');
  const simplified = stepKnowledge('part-layering', 'step05_simplified'), base = stepKnowledge('part-layering', 'step06_base');
  return {
    generateStandardReference: async (mode, image, output, prompt, outputDirectory) => {
      await prepareImage(agents, mode === 'standard' ? standard : cutout, {
        step: 'part_standardize', name: mode === 'standard' ? '标准姿态' : '原图去背景', outputDirectory, prompt,
      }, image, output, { requireTransparentForReuse: true });
    },
    simplify: async (image, output, prompt, processGenerated) => {
      await prepareImage(agents, simplified, {
        step: 'part_simplify', name: '参考判断与简化', prompt,
        outputSchema: referenceOutputSchema,
      }, image, output, { processGenerated });
    },
    baseSubject: async (image, output, prompt, processGenerated) => {
      return prepareImage(agents, base, {
        step: 'part_base_subject', name: '素体换装', prompt, outputSchema: referenceOutputSchema,
      }, image, output, { processGenerated });
    },
  };
}
