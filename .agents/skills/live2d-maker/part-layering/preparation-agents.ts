import { validateAgentOutcome } from '../shared/codex/diagnostics.ts';
import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { stepKnowledge } from '../shared/knowledge.ts';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { taskRootOf, toAgentPath } from '../shared/task-paths.ts';
import type { AgentTask, CodexAgents, GeneratedImage } from '../shared/codex/agents.ts';
import { textResult } from '../shared/codex/function-tools.ts';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import type { PreparationSteps, ProcessGenerated, ReferenceChoice } from './preparation.ts';
import { checkStandardJudgment } from './preparation-state.ts';
import { copyAsPng, isPng } from '../shared/png.ts';

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

async function prepareImage(agents: Pick<CodexAgents, 'run'>, knowledge: ReturnType<typeof stepKnowledge>, task: AgentTask, input: string, output: string, processGenerated?: ProcessGenerated): Promise<ReferenceChoice> {
  let reusedReason: string | undefined;
  const result = await agents.run({ ...task, tools: knowledge.tools('main', [{
    ...toolDefinition('reuse_reference', fileURLToPath(new URL('./tools/', import.meta.url))),
    async execute(value, signal, context) {
      if (!value || typeof value !== 'object' || Array.isArray(value)
        || Object.keys(value).some(key => key !== 'reason')
        || typeof (value as { reason?: unknown }).reason !== 'string' || !(value as { reason: string }).reason.trim()) {
        throw new Error('复用参考只接受非空 reason；输入与输出路径由本步骤绑定。');
      }
      if (reusedReason !== undefined) throw new Error('本次参考已经复制完成。');
      signal.throwIfAborted();
      await copyAsPng(input, output);
      signal.throwIfAborted();
      reusedReason = (value as { reason: string }).reason;
      return textResult({ savedPath: await toAgentPath(context?.root ?? taskRootOf(dirname(output)), output), reason: reusedReason });
    },
  }]) });
  return validateAgentOutcome(result, async () => {
    if (reusedReason !== undefined && result.images.length) throw new Error('本次参考同时执行了复制与生图，请只选择一种交付方式。');
    const reason: unknown = reusedReason ?? JSON.parse(result.text).reason;
    if (typeof reason !== 'string' || !reason.trim()) throw new Error('参考准备须说明复制或生图的判断依据。');
    if (reusedReason === undefined) {
      await saveImage(result.images.at(-1), output);
      await processGenerated?.(output);
    }
    return { generated: reusedReason === undefined, reason };
  });
}

export function createPreparationSteps(agents: Pick<CodexAgents, 'run'>): PreparationSteps {
  const imageOutputSchema = {
    type: 'object', properties: { error: { type: ['string', 'null'] } }, required: ['error'], additionalProperties: false,
  };
  const referenceOutputSchema = {
    ...imageOutputSchema,
    properties: { ...imageOutputSchema.properties, reason: { type: 'string' } },
    required: [...imageOutputSchema.required, 'reason'],
  };
  const simplified = stepKnowledge('part-layering', 'step05_simplified'), base = stepKnowledge('part-layering', 'step06_base');
  return {
    judgeStandard: async (image, prompt) => {
      const result = await agents.run({
        step: 'part_pose_judgment', name: '姿态判断', prompt,
        outputSchema: {
          type: 'object', properties: { needsAdjustment: { type: 'boolean' }, reason: { type: 'string' } },
          required: ['needsAdjustment', 'reason'], additionalProperties: false,
        },
      });
      return validateAgentOutcome(result, () => {
        const decision: unknown = JSON.parse(result.text);
        checkStandardJudgment(decision);
        return decision;
      });
    },
    standardize: async (image, output, prompt) => {
      const result = await agents.run({
        step: 'part_standardize', name: '标准姿态', outputSchema: imageOutputSchema,
        prompt,
      });
      await validateAgentOutcome(result, () => saveImage(result.images.at(-1), output));
    },
    simplify: async (image, output, prompt, processGenerated) => {
      await prepareImage(agents, simplified, {
        step: 'part_simplify', name: '参考判断与简化', prompt,
        outputSchema: referenceOutputSchema,
      }, image, output, processGenerated);
    },
    baseSubject: async (image, output, prompt, processGenerated) => {
      return prepareImage(agents, base, {
        step: 'part_base_subject', name: '素体换装', prompt, outputSchema: referenceOutputSchema,
      }, image, output, processGenerated);
    },
  };
}
