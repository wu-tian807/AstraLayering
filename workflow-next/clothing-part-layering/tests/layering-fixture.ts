import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import sharp from 'sharp';
import { svgHash } from '../artifact-facts.ts';
import { writeAtomic } from '../groups.ts';
import type { GroupSeed, LayeringSteps, SvgMerger } from '../layering-types.ts';
import { occlusionSourceHash, terminalParts } from '../occlusion-plan.ts';

export function shape(id: string, left = 10, right = 90, empty = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="shape" data-group-path="${id}">${empty ? '' : `<path fill="#55b9ad" d="M${left} 10H${right}V90H${left}Z"/>`}</g></svg>`;
}
export async function fixture(t: TestContext) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'part-layering-bfs-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const references = { directory: join(directory, 'references'), judgment: join(directory, 'references/judgment.json'),
    simplifiedSubject: join(directory, 'references/simplified.png'), baseSubject: join(directory, 'references/base.png') };
  await mkdir(references.directory);
  await writeAtomic(references.judgment, '{"needsSimplification":false}');
  const png = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#ffffff' } }).png().toBuffer();
  await writeAtomic(references.baseSubject, png);
  await writeAtomic(references.simplifiedSubject, png);
  return { directory, references };
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
