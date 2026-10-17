import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  groupStages, type GroupInput, type GroupNode, type GroupProgress, type GroupsDocument,
  type GroupStage, type GroupStageOutputs, type StepProgress, type Subject,
} from './layering-types.ts';

export async function writeAtomic(path: string, content: string | Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content);
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function readProgress<T>(value: unknown, name: string): StepProgress<T> {
  if (value === undefined) return { status: 'pending' };
  const item = record(value, name);
  if (!['pending', 'running', 'completed', 'failed'].includes(String(item.status))) {
    throw new Error(`${name} has an invalid status`);
  }
  if (item.status === 'completed' && item.output === undefined) throw new Error(`${name} is missing its output`);
  const progress = structuredClone(item) as StepProgress<T>;
  if (progress.status === 'running') {
    progress.status = 'pending';
    progress.message = '上次执行中断，等待续跑';
  }
  return progress;
}

function checkOutput(stage: GroupStage | 'merge', progress: StepProgress<unknown>): void {
  if (progress.status !== 'completed') return;
  const output = record(progress.output, `${stage}.output`);
  if (['outline', 'review', 'reduction', 'completion', 'merge'].includes(stage)) {
    if (typeof output.path !== 'string' || !output.path) throw new Error(`${stage}.output requires an SVG path`);
  } else if (stage === 'completionCheck') {
    if (output.passed !== true) throw new Error('completionCheck must pass before being completed');
  } else if (!Array.isArray(output.ids) || output.ids.some(id => typeof id !== 'string')) {
    throw new Error(`${stage}.output requires group ids`);
  }
}

export function normalizeGroups(values: unknown, seen = new Set<string>()): GroupNode[] {
  if (!Array.isArray(values)) throw new Error('groups must be an array');
  return values.map(value => {
    const raw = record(value, 'group');
    const input: Record<string, unknown> = { ...raw, id: raw.id ?? raw.name };
    if (typeof input.id !== 'string' || !/^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u.test(input.id)) {
      throw new Error('group requires a name or id with safe filename segments');
    }
    if (seen.has(input.id)) throw new Error(`Duplicate group id: ${input.id}`);
    seen.add(input.id);
    for (const field of ['name', 'note']) {
      if (input[field] !== undefined && typeof input[field] !== 'string') throw new Error(`group.${field} must be a string`);
    }
    if (input.metadata !== undefined) record(input.metadata, 'group.metadata');
    if (input.childrenAnalysis !== undefined) {
      const analysis = record(input.childrenAnalysis, 'group.childrenAnalysis');
      if (typeof analysis.sourceHash !== 'string' || !/^[a-f0-9]{64}$/i.test(analysis.sourceHash) ||
          (analysis.note !== undefined && typeof analysis.note !== 'string') ||
          Object.keys(analysis).some(key => !['sourceHash', 'note'].includes(key))) {
        throw new Error('group.childrenAnalysis requires an input SVG hash and optional note');
      }
    }
    if (input.kind !== undefined && input.kind !== 'group' && input.kind !== 'part') throw new Error('节点 kind 必须为 group 或 part');
    if (input.kind === 'part' && Array.isArray(input.groups) && input.groups.length) throw new Error('part 不能包含子节点');
    const rawSteps = input.steps === undefined ? {} : record(input.steps, 'group.steps');
    const steps = Object.fromEntries(groupStages.map(stage => {
      const progress = readProgress(rawSteps[stage], `${input.id}.${stage}`);
      checkOutput(stage, progress);
      return [stage, progress];
    })) as GroupProgress;
    const group: GroupNode = {
      id: input.id,
      ...(input.kind !== undefined ? { kind: input.kind as 'group' | 'part' } : {}),
      ...(input.name !== undefined ? { name: input.name as string } : {}),
      ...(input.note !== undefined ? { note: input.note as string } : {}),
      ...(input.metadata !== undefined ? { metadata: structuredClone(input.metadata) as Record<string, unknown> } : {}),
      ...(input.childrenAnalysis !== undefined ? { childrenAnalysis: structuredClone(input.childrenAnalysis) as GroupNode['childrenAnalysis'] } : {}),
      groups: normalizeGroups(input.groups ?? [], seen), steps,
    };
    if (group.groups.length && rawSteps.children === undefined) {
      steps.children = { status: 'completed', output: { ids: group.groups.map(child => child.id) } };
    }
    if (group.groups.length && steps.children.status !== 'completed') {
      throw new Error(`${group.id}: registered children require a completed split`);
    }
    if (steps.children.status === 'completed' &&
        JSON.stringify(steps.children.output!.ids) !== JSON.stringify(group.groups.map(child => child.id))) {
      throw new Error(`${group.id}: completed child ids do not match its groups`);
    }
    return group;
  });
}

export function walkGroups(groups: GroupNode[], depth = 0, parent?: GroupNode): {
  group: GroupNode; depth: number; parent?: GroupNode;
}[] {
  return groups.flatMap(group => [
    { group, depth, parent }, ...walkGroups(group.groups, depth + 1, group),
  ]);
}

export function checkSubject(subject: unknown): void {
  if (subject !== undefined && subject !== 'character' && subject !== 'other') {
    throw new Error('subject must be character or other');
  }
}

export function findGroup(document: GroupsDocument, id: string): GroupNode {
  const entry = walkGroups(document.groups).find(entry => entry.group.id === id);
  if (!entry) throw new Error(`Unknown group: ${id}`);
  return entry.group;
}

export function groupCompleted(group: GroupNode): boolean {
  return groupStages.every(stage => group.steps[stage].status === 'completed');
}

// 空的分析结果是终止事实；空的初始 groups 数组本身不是。
export function nodeKind(group: GroupNode): 'group' | 'part' {
  return group.kind === 'part' || (group.steps.children.status === 'completed' && !group.groups.length) ? 'part' : 'group';
}

export function nodeSeed(group: GroupNode) {
  const { groups, steps, childrenAnalysis, ...seed } = group;
  return { ...seed, kind: seed.kind ?? 'group' };
}

export function setGroupProgress<S extends GroupStage>(
  group: GroupNode, stage: S, progress: StepProgress<GroupStageOutputs[S]>,
): void {
  Object.assign(group.steps, { [stage]: progress });
}

export class GroupStore {
  readonly path: string;
  private document: GroupsDocument;
  private writes = Promise.resolve();
  private savedGroups?: string;

  private constructor(path: string, document: GroupsDocument, savedGroups?: string) {
    this.path = path;
    this.document = document;
    this.savedGroups = savedGroups;
  }

  static async open(directory: string): Promise<GroupStore> {
    const path = join(directory, 'groups.json');
    const input = await readDocument(path) ?? { groups: [] };
    if (input.version !== undefined && input.version !== 1) throw new Error('Unsupported groups document version');
    // 旧 progress.json 和混在树里的 steps 都不作为续跑依据。
    function structure(values: unknown): unknown {
      if (!Array.isArray(values)) throw new Error('groups must be an array');
      return values.map(value => {
        const { steps, groups, ...seed } = record(value, 'group');
        return { ...seed, groups: structure(groups ?? []) };
      });
    }
    const groups = normalizeGroups(structure(input.groups));
    const document: GroupsDocument = {
      version: 1,
      ...(input.subject !== undefined ? { subject: input.subject as Subject } : {}),
      groups,
      merge: { status: 'pending' },
    };
    checkSubject(document.subject);
    await (await import('./artifact-facts.ts')).restoreFacts(directory, document);
    const savedGroups = JSON.stringify(input) === JSON.stringify(groupStructure(document)) ? serialize(input) : undefined;
    const store = new GroupStore(path, document, savedGroups);
    return store;
  }

  snapshot(): GroupsDocument { return structuredClone(this.document); }

  // 工具与调度器共用队列；只保存分组事实，steps 仅供运行中展示。
  update(change: (document: GroupsDocument) => void): Promise<void> {
    const write = this.writes.then(async () => {
      const draft = this.snapshot();
      change(draft);
      const groups = serialize(groupStructure(draft));
      if (groups !== this.savedGroups) await writeAtomic(this.path, groups);
      this.savedGroups = groups;
      this.document = draft;
    });
    this.writes = write.catch(() => {});
    return write;
  }
}

async function readDocument(path: string): Promise<Record<string, unknown> | undefined> {
  try { return record(JSON.parse(await readFile(path, 'utf8')), path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

function serialize(value: unknown): string { return JSON.stringify(value, null, 2) + '\n'; }

function groupStructure(document: GroupsDocument) {
  function tree(groups: GroupNode[]): GroupInput[] {
    return groups.map(({ steps, groups: children, ...group }) => ({ ...group, groups: tree(children) }));
  }
  return { ...(document.subject !== undefined ? { subject: document.subject } : {}), groups: tree(document.groups) };
}
