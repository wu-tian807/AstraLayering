import { cp, rm } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { defaultKnowledgeDirectory, knowledgeDirectory, stepKnowledge, useKnowledge } from '../knowledge.ts';

// A private copy of the default knowledge, active until the test ends.
export async function temporaryKnowledge(t: TestContext): Promise<string> {
  const previous = knowledgeDirectory(), directory = mkdtempSync(join(tmpdir(), 'live2d-knowledge-'));
  // Bind before the first await so the calling test resumes in this context.
  useKnowledge(directory);
  t.after(async () => { useKnowledge(previous); await rm(directory, { recursive: true, force: true }); });
  await cp(defaultKnowledgeDirectory, directory, { recursive: true });
  return directory;
}

export async function stubStepTools(section: string, step: string) {
  return stepKnowledge(section, step).toolNames('main').filter(name => name !== 'imagegen').map(name => ({
    name, description: 'fixture', inputSchema: { type: 'object' },
    async execute(): Promise<never> { throw new Error(`Unexpected fixture tool call: ${name}`); },
  }));
}
