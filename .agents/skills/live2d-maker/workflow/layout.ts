import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sectionIds } from '../shared/paths.ts';

export class LayoutError extends Error {}

const partSections = ['part-layering', 'clothing-part-layering'] as const;
const oldPartDirs = ['preparation', 'initial', 'groups', 'layers', 'merge', 'occlusion'];
const shadowModes = ['mask', 'normal-depth'];
const threadFields = ['threadId', 'threadHarness', 'threadStep', 'threadHandoff'] as const;
const legacyRunFields = [...threadFields, 'inputFingerprint'] as const;

async function present(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
async function readJson(path: string): Promise<any> {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}

async function previousLayout(directory: string): Promise<boolean> {
  if ((await readJson(join(directory, 'run.json')))?.pipelines) return true;
  for (const section of partSections) for (const name of oldPartDirs) {
    if (await present(join(directory, section, name))) return true;
  }
  if (await present(join(directory, 'clothing-part-layering/references/preparation.json'))) return true;
  for (const mode of shadowModes) if (await present(join(directory, 'shadow', mode))) return true;
  for (const section of sectionIds) {
    const config = await readJson(join(directory, section, 'run.json')).catch(() => undefined);
    if (config && legacyRunFields.some(field => field in config)) return true;
  }
  return false;
}

export async function requireCurrentLayout(directory: string): Promise<void> {
  for (const name of ['preparation.json', '.steps', 'options.json']) {
    if (await present(join(directory, 'part-layering/references', name))) {
      throw new LayoutError('任务目录布局早于 v0.1.3：' + directory);
    }
  }
  if (await previousLayout(directory)) throw new LayoutError('任务使用旧版目录布局：' + directory);
}
