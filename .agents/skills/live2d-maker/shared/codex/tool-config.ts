import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeDirectory } from '../knowledge.ts';
import type { FunctionTool } from './function-tools.ts';

type Definition = Pick<FunctionTool, 'name' | 'description' | 'inputSchema'>;
export const toolsDirectory = fileURLToPath(new URL('../tools/', import.meta.url));
// Sections whose tools/<name>/schema.json add or replace a shared schema.
export const sectionToolDirectories = ['../../shadow/tools/', '../../part-layering/tools/']
  .map(path => fileURLToPath(new URL(path, import.meta.url)));

function optional(path: string): string | undefined {
  try { return readFileSync(path, 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
}
const directories = (path: string) => readdirSync(path, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);

export function toolSchemaNames(): string[] {
  return [...new Set([toolsDirectory, ...sectionToolDirectories].flatMap(directories))].sort();
}

// Schemas are code: shared/tools/<name>/schema.json, optionally replaced by a
// section's tools/<name>/schema.json (`overrides`). Descriptions are prior
// knowledge: knowledge/shared/tools/<name>/description.md; a step may supply
// its own (see stepKnowledge().tools). A catalog is a snapshot. Running
// sessions keep their registered definitions; editing the files takes effect
// on the next workflow launch.
export class ToolCatalog {
  private definitions = new Map<string, Definition>();

  constructor(directory = toolsDirectory, overrides?: string, knowledge = knowledgeDirectory()) {
    const shared = new Set(directories(directory));
    for (const name of new Set([...shared, ...overrides ? directories(overrides) : []])) {
      if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error(`无效工具目录：${name}`);
      const own = overrides ? optional(join(overrides, name, 'schema.json')) : undefined;
      if (own === undefined && !shared.has(name)) throw new Error(`工具 ${name} 缺少 schema.json：${join(overrides!, name)}`);
      const schema = own ?? readFileSync(join(directory, name, 'schema.json'), 'utf8');
      const description = (optional(join(knowledge, 'shared', 'tools', name, 'description.md')) ?? '').trim();
      let inputSchema: unknown;
      try { inputSchema = JSON.parse(schema); }
      catch (error) { throw new Error(`工具 ${name} 的 schema.json 无效`, { cause: error }); }
      if (!inputSchema || typeof inputSchema !== 'object' || Array.isArray(inputSchema)
        || (inputSchema as Record<string, unknown>).type !== 'object') {
        throw new Error(`工具 ${name} 需要 object 类型的 schema.json`);
      }
      this.definitions.set(name, { name, description, inputSchema: inputSchema as Record<string, unknown> });
    }
  }

  names(): string[] { return [...this.definitions.keys()].sort(); }

  get(name: string): Definition {
    const definition = this.definitions.get(name);
    if (!definition) throw new Error(`未配置的工具：${name}`);
    return structuredClone(definition);
  }
}

export function toolCatalog(overrides?: string): ToolCatalog {
  return new ToolCatalog(toolsDirectory, overrides);
}

export function toolDefinition(name: string, overrides?: string, omitParameters: readonly string[] = []): Definition {
  const definition = toolCatalog(overrides).get(name);
  const properties = definition.inputSchema.properties as Record<string, unknown> | undefined;
  for (const key of omitParameters) if (properties) delete properties[key];
  if (Array.isArray(definition.inputSchema.required)) {
    definition.inputSchema.required = definition.inputSchema.required.filter(key => !omitParameters.includes(key));
  }
  return definition;
}
