import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ReferenceJudgment = { needsSimplification: boolean };

export type PreparationInput = { image?: string; runName: string };

export type PreparationSteps = {
  judge(image: string, prompt: string): Promise<ReferenceJudgment>;
  simplify(inputImage: string, outputImage: string, prompt: string): Promise<void>;
  baseSubject(inputImage: string, outputImage: string, prompt: string): Promise<void>;
};

export type PreparationReferences = {
  directory: string;
  originalImage?: string;
  judgment: string;
  simplifiedSubject: string;
  baseSubject: string;
};

function readPrompt(name: string): Promise<string> {
  return readFile(new URL(`prompts/${name}`, import.meta.url), 'utf8');
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function findImage(directory: string, name: string): Promise<string | undefined> {
  let names: string[];
  try {
    names = await readdir(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const matches: string[] = [];
  for (const file of names) {
    if (file.startsWith(`${name}.`) && !file.endsWith('.tmp') && await exists(join(directory, file))) {
      matches.push(join(directory, file));
    }
  }
  if (matches.length > 1) throw new Error(`Multiple ${name} images found in ${directory}`);
  return matches[0];
}

function checkJudgment(value: unknown): asserts value is ReferenceJudgment {
  if (!value || typeof value !== 'object' ||
      typeof (value as ReferenceJudgment).needsSimplification !== 'boolean') {
    throw new Error('judgment must contain a boolean needsSimplification');
  }
}

export async function prepareReferences(
  input: PreparationInput,
  steps: PreparationSteps,
): Promise<PreparationReferences> {
  if (!input.runName || input.runName === '.' || input.runName === '..' ||
      /[\\/:]/.test(input.runName)) {
    throw new Error('runName must be a single directory name');
  }

  const directory = join(fileURLToPath(new URL('.run/', import.meta.url)), input.runName, 'references');
  const judgment = join(directory, 'judgment.json');
  let image = await findImage(directory, 'original');
  if (!image && input.image) {
    const source = resolve(input.image);
    if (!await exists(source)) throw new Error(`Input image is missing: ${source}`);
    await mkdir(directory, { recursive: true });
    image = join(directory, `original${extname(source) || '.png'}`);
    await copyFile(source, image);
  }

  let decision: unknown;
  if (await exists(judgment)) {
    decision = JSON.parse(await readFile(judgment, 'utf8'));
  } else {
    if (!image) throw new Error('首次启动或原图缺失时，需要 --image <角色图片路径>');
    decision = await steps.judge(image, await readPrompt('1-参考判断.md'));
    checkJudgment(decision);
    await writeFile(judgment, JSON.stringify(decision, null, 2) + '\n', 'utf8');
  }
  checkJudgment(decision);

  // A direct copy keeps the original extension; generated images use PNG.
  const extension = decision.needsSimplification ? '.png' : extname(image ?? '') || '.png';
  const simplifiedSubject = await findImage(directory, 'simplified-subject')
    ?? join(directory, `simplified-subject${extension}`);
  const baseSubject = join(directory, 'base-subject.png');

  if (!await exists(simplifiedSubject)) {
    if (!image) throw new Error('简化参考与原图均缺失，需要 --image <角色图片路径>');
    if (decision.needsSimplification) {
      await steps.simplify(image, simplifiedSubject, await readPrompt('2-简化图片.md'));
    } else {
      await copyFile(image, simplifiedSubject);
    }
    if (!await exists(simplifiedSubject)) {
      throw new Error(`Simplified image was not produced: ${simplifiedSubject}`);
    }
  }

  if (!await exists(baseSubject)) {
    await steps.baseSubject(simplifiedSubject, baseSubject, await readPrompt('3-素体参考.md'));
    if (!await exists(baseSubject)) {
      throw new Error(`Base subject was not produced: ${baseSubject}`);
    }
  }

  return { directory, originalImage: image, judgment, simplifiedSubject, baseSubject };
}
