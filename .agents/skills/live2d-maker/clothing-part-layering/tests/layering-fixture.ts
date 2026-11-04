import { profile } from '../profile.ts';
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import sharp from 'sharp';
import { svgHash } from '../../shared/part/artifact-facts.ts';
import { GroupStore, writeAtomic } from '../../shared/part/groups.ts';
import type { GroupSeed, LayeringSteps, SvgMerger } from '../../shared/part/layering-types.ts';
import { partSteps } from '../../shared/step-paths.js';
import { beginStep, completeStep } from '../../shared/step-chain.ts';
import { occlusionSourceHash, terminalParts } from '../../shared/part/occlusion-plan.ts';

export function shape(id: string, left = 10, right = 90, empty = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="shape" data-group-path="${id}">${empty ? '' : `<path fill="#55b9ad" d="M${left} 10H${right}V90H${left}Z"/>`}</g></svg>`;
}
export async function fixture(t: TestContext) {
  // The task layout of a real run, so the prompt's task paths resolve.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'part-layering-bfs-'))), directory = join(root, 'clothing-part-layering');
  t.after(() => rm(root, { recursive: true, force: true }));
  const references = { directory: join(directory, 'references'), judgment: join(directory, 'references/judgment.json'),
    simplifiedSubject: join(directory, 'references/simplified-subject.png'), baseSubject: join(directory, 'references/clothing.png') };
  await mkdir(references.directory, { recursive: true });
  await writeAtomic(references.judgment, '{"needsSimplification":false}');
  const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffffff' } }).png().toBuffer();
  await writeAtomic(references.baseSubject, png);
  await writeAtomic(references.simplifiedSubject, png);
  return { profile, directory, references };
}
export function workingSteps(events: string[], roots: GroupSeed[] = [{ id: 'head' }], children: Record<string, GroupSeed[]> = {}): LayeringSteps {
  return {
    async initialGroups() { events.push('initial'); return { status: 'completed', output: { groups: roots } }; },
    async drawOutline(context) { events.push(`${context.group.id}:outline`); await writeAtomic(context.outputPath, shape(context.group.id));
      return { status: 'completed', output: { path: context.outputPath } }; },
    async reviewOutline(context) { events.push(`${context.group.id}:review`);
      await writeAtomic(context.reportPath, JSON.stringify({ groupId: context.group.id, reviews: [{ verdict: 'pass', feedback: 'checked',
        candidateHash: svgHash(await readFile(context.outline.path)), observations: [], updatedAt: new Date().toISOString() }] }));
      return { status: 'completed', output: context.outline }; },
    async reduceOutlines(context) { events.push(`layer-${context.depth}:reduce`); return { status: 'completed', output: { changed: [], note: 'no duplicate objects' } }; },
    async completeOcclusion(context) { events.push(`${context.group.id}:completion`); await writeAtomic(context.outputPath, await readFile(context.reviewed.path));
      return { status: 'completed', output: { path: context.outputPath } }; },
    async checkCompletion(context) { events.push(`${context.group.id}:check`); return { status: 'completed', output: { passed: true } }; },
    async splitChildren(context) { events.push(`${context.group.id}:children`); return { status: 'completed', output: { groups: children[context.group.id] ?? [] } }; },
    async planOcclusion(context) { return { status: 'completed', output: { version: 2, direction: 'back-to-front',
      sourceHash: await occlusionSourceHash(context), layers: terminalParts(context).map(({ group }, level) => ({
        id: group.id, level, note: 'fixture depth', check: { passed: true, note: 'fixture checked' },
      })) } }; },
  };
}
export function workingMerger(events: string[]): SvgMerger {
  return async context => { events.push('merge'); await writeAtomic(context.outputPath, shape('character'));
    return { status: 'completed', output: { path: context.outputPath } }; };
}
// Records a finished first grouping, as if step08_initial had run.
export async function seedInitialGroups(directory: string, groups: GroupSeed[]) {
  const step = join(directory, partSteps.initial);
  await beginStep(step, 'absent');
  await writeAtomic(join(step, 'groups.json'), JSON.stringify({ groups }, null, 2) + '\n');
  await completeStep(step);
  // The scheduler publishes groups.json before any group agent runs; prompts name its nodes.
  await (await GroupStore.open(directory)).update(() => {});
}
