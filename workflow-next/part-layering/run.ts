import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CodexAgents, type AgentOptions, type GeneratedImage } from './agents.ts';
import { prepareReferences, type PreparationInput, type PreparationReferences, type PreparationSteps } from './preparation.ts';
import { runWorkflow, type ReadyGroup } from './workflow.ts';

async function saveImage(image: GeneratedImage | undefined, output: string): Promise<void> {
  if (!image) throw new Error('image_generation did not produce an image');
  const bytes = await readFile(image.savedPath);
  if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('image_generation did not produce a PNG image');
  }
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, bytes);
    await rename(temporary, output);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

export function createPreparationSteps(agents: Pick<CodexAgents, 'run'>): PreparationSteps {
  const imageOutputSchema = {
    type: 'object', properties: { savedPath: { type: 'string' } },
    required: ['savedPath'], additionalProperties: false,
  };
  return {
    judge: async (image, prompt) => {
      const result = await agents.run({
        name: '参考判断', prompt, images: [{ path: image, description: '角色原始参考图' }],
        outputSchema: {
          type: 'object', properties: { needsSimplification: { type: 'boolean' } },
          required: ['needsSimplification'], additionalProperties: false,
        },
      });
      return JSON.parse(result.text);
    },
    simplify: async (image, output, prompt) => {
      const result = await agents.run({
        name: '简化图片', prompt, imageGeneration: true, outputSchema: imageOutputSchema,
        images: [
          { path: image, description: '图 1：目标角色，角色设计以此图为准。' },
          { path: fileURLToPath(new URL('resources/简化参考图片.png', import.meta.url)),
            description: '图 2：简化风格参考，仅参考线稿、上色与部件区分，不复制人物设计或水印。' },
        ],
      });
      await saveImage(result.images.at(-1), output);
    },
    baseSubject: async (image, output, prompt) => {
      const result = await agents.run({
        name: '素体参考', prompt, imageGeneration: true, outputSchema: imageOutputSchema,
        images: [{ path: image, description: '已准备的简化角色参考图' }],
      });
      await saveImage(result.images.at(-1), output);
    },
  };
}

export type AgentWorkflowHooks<G> = {
  initialize(input: G | G[] | null, agents: CodexAgents, references: PreparationReferences): Promise<void>;
  ready(): Promise<ReadyGroup<G>[]>;
  runRound(group: G, agents: CodexAgents, references: PreparationReferences): Promise<void>;
};

export async function runPartLayering<G>(
  input: { reference: PreparationInput; groups: G | G[] | null; concurrency?: number; maxDepth?: number },
  hooks?: AgentWorkflowHooks<G>,
  agentOptions: AgentOptions = {},
): Promise<PreparationReferences> {
  const agents = new CodexAgents(agentOptions);
  let references!: PreparationReferences;
  await runWorkflow(input.groups, {
    preparation: async () => {
      references = await prepareReferences(input.reference, createPreparationSteps(agents));
    },
    initialize: async groups => {
      if (hooks) await hooks.initialize(groups, agents, references);
    },
    ready: () => hooks ? hooks.ready() : Promise.resolve([]),
    runRound: async group => {
      if (hooks) await hooks.runRound(group, agents, references);
    },
  }, { concurrency: input.concurrency, maxDepth: input.maxDepth });
  return references;
}

if (import.meta.main) {
  try {
    const { values } = parseArgs({ options: {
      image: { type: 'string' }, name: { type: 'string' }, help: { type: 'boolean' },
    } });
    if (values.help) {
      console.log('pnpm start --name <运行名> [--image <角色图片路径>]');
      console.log('--image 首次启动需要；续跑使用运行目录中的原图，并自动补齐缺失的参考输出。');
    } else {
      if (!values.name) throw new Error('需要 --name <运行名>');
      const references = await runPartLayering({
        reference: { image: values.image, runName: values.name }, groups: null,
      }, undefined, { progress: console.log });
      console.log(`参考输出：${references.directory}`);
      console.log('参考准备已就绪。组循环的具体步骤仍待配置。');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
