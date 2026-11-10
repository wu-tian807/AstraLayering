import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { FunctionTool } from './codex/function-tools.ts';
import { toolSchemaNames } from './codex/tool-config.ts';
import { knowledgeSteps, runtimePrompts } from './knowledge-steps.ts';

// Prior knowledge (prompts, references, tool descriptions) lives outside the
// code. `--knowledge <dir>` replaces the whole directory; there is no fallback.
export const defaultKnowledgeDirectory = fileURLToPath(new URL('../knowledge/', import.meta.url));
const selected = new AsyncLocalStorage<string>();
export function useKnowledge(directory: string): void { selected.enterWith(resolve(directory)); }
// A run checks the whole knowledge directory before it uses it, so a missing
// file stops the run before any agent starts.
export function selectKnowledge(directory: string): void {
  const path = resolve(directory);
  checkKnowledge(path);
  useKnowledge(path);
}
export function knowledgeDirectory(): string { return selected.getStore() ?? defaultKnowledgeDirectory; }

export type KnowledgeValues = Record<string, string>;
export type KnowledgeRenderOptions = { taskRoot?: string; section?: string; knowledge?: string };
export type KnowledgeRole = 'main' | 'review' | 'repair';

const variable = /\{([a-z][a-z0-9_]*)\}/g;
const token = /\{(?:(uri|reference|shared_reference):((?:[^{}]|\{[a-z][a-z0-9_]*\})*)|([a-z][a-z0-9_]*))\}/g;

// Lenient and one pass: only known variables and exact path prefixes are
// replaced, any other brace text stays verbatim; inserted values are never
// interpreted again. Path prefixes render absolute paths.
export function renderKnowledge(template: string, values: KnowledgeValues, options: KnowledgeRenderOptions = {}): string {
  const directory = options.knowledge ?? knowledgeDirectory();
  const known = (match: string, name: string) => Object.hasOwn(values, name) ? values[name] : match;
  return template.replace(token, (match, prefix: string | undefined, path: string, name: string | undefined) => {
    if (name) return known(match, name);
    const relative = path.replace(variable, known);
    if (prefix === 'uri') {
      if (!options.taskRoot) throw new Error(`${match} 需要任务目录`);
      return join(options.taskRoot, relative);
    }
    if (prefix === 'reference') {
      if (!options.section) throw new Error(`${match} 需要所属管线`);
      return join(directory, options.section, relative);
    }
    return join(directory, 'shared', 'references', relative);
  });
}

function read(path: string): string {
  try { return readFileSync(path, 'utf8'); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`先验知识缺少文件：${path}`);
    throw error;
  }
}

export function runtimePromptPath(name: string, directory = knowledgeDirectory()): string { return join(directory, 'shared', 'prompts', 'runtime', `${name}.md`); }
export function runtimePrompt(name: string, values: KnowledgeValues = {}, options: KnowledgeRenderOptions = {}): string {
  const text = read(runtimePromptPath(name, options.knowledge));
  if (!text.trim()) throw new Error(`先验知识文件为空：${runtimePromptPath(name, options.knowledge)}`);
  return renderKnowledge(text, values, options);
}

type AgentRole = { initial: string[]; tools?: string[] };
type AgentConfig = { main: AgentRole; review?: AgentRole & { repair: { initial: string[] } } };

function parseAgent(path: string, reviewDeclared: boolean): AgentConfig {
  let config: any;
  try { config = JSON.parse(read(path)); }
  catch (error) { throw error instanceof SyntaxError ? new Error(`agent.json 无效：${path}`, { cause: error }) : error; }
  const list = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
  const role = (value: any, keys: string[]) => value && typeof value === 'object' && list(value.initial) && value.initial.length > 0
    && (value.tools === undefined || list(value.tools)) && Object.keys(value).every(key => keys.includes(key));
  const valid = config && typeof config === 'object' && role(config.main, ['initial', 'tools'])
    && Object.keys(config).every(key => key === 'main' || key === 'review')
    && (config.review === undefined || (role(config.review, ['initial', 'tools', 'repair']) && role(config.review.repair, ['initial'])));
  if (!valid) throw new Error(`agent.json 结构无效：${path}`);
  if (config.review && !reviewDeclared) throw new Error(`本步骤没有 review，agent.json 不能声明 review：${path}`);
  if (!config.review && reviewDeclared) throw new Error(`本步骤需要 review 与 repair：${path}`);
  return config;
}

const groupId = /^[\p{L}\p{N}_-]+(?:\/[\p{L}\p{N}_-]+)*$/u;

export function stepKnowledge(section: string, step: string) {
  const root = knowledgeDirectory(), directory = join(root, section, step);
  const declared = knowledgeSteps.find(item => item.section === section && item.step === step);
  if (!declared) throw new Error(`未登记的先验知识步骤：${section}/${step}`);
  const agent = () => parseAgent(join(directory, 'agent.json'), Boolean(declared.review));
  const initial = (role: KnowledgeRole) => {
    const config = agent();
    if (role === 'main') return config.main.initial;
    if (!config.review) throw new Error(`${section}/${step} 没有 ${role}`);
    return role === 'review' ? config.review.initial : config.review.repair.initial;
  };
  const filePath = (file: string, group?: string) => {
    if (isAbsolute(file) || win32.isAbsolute(file) || file.split(/[\\/]/).includes('..')) throw new Error(`agent.json 的 initial 必须是知识目录内的相对路径：${file}`);
    if (file.startsWith('shared/')) return join(root, file);
    if (group !== undefined && file.startsWith('prompts/')) {
      if (!groupId.test(group)) throw new Error('Invalid group prompt id');
      // A group prior replaces the step file of the same name, nothing else.
      const own = join(directory, 'prompts', 'groups', group, file.slice('prompts/'.length));
      if (existsSync(own)) return own;
    }
    return join(directory, file);
  };
  const files = (role: KnowledgeRole, group?: string) => initial(role).map(file => filePath(file, group));
  const toolNames = (role: KnowledgeRole): string[] => {
    const config = agent();
    // Repairs continue the drawing thread and use its original tool definitions.
    return (role === 'review' ? config.review?.tools : config.main.tools) ?? [];
  };
  return {
    directory,
    files,
    toolNames,
    imageGeneration: (role: KnowledgeRole) => toolNames(role).includes('imagegen'),
    reference: (name: string) => join(directory, 'references', name),
    // Each file is rendered on its own; the results are joined byte for byte.
    render(role: KnowledgeRole, values: KnowledgeValues, options: { taskRoot?: string; group?: string } = {}): string {
      return files(role, options.group).map(path => {
        const text = read(path);
        if (!text.trim()) throw new Error(`先验知识文件为空：${path}`);
        return renderKnowledge(text, values, { taskRoot: options.taskRoot, section, knowledge: root });
      }).join('');
    },
    // agent.json decides which provided tools the agent sees and in what
    // order; a step may replace a tool description in tools/<name>/.
    tools<T extends FunctionTool>(role: KnowledgeRole, provided: readonly T[]): T[] {
      const names = toolNames(role);
      return names.flatMap(name => {
        const tool = provided.find(item => item.name === name);
        if (!tool) {
          // imagegen is a native capability or is attached by the CLI adapter.
          if (name === 'imagegen') return [];
          throw new Error(`${section}/${step} 的 ${role} 声明了工具 ${name}，但没有提供执行实现`);
        }
        const own = join(directory, 'tools', name, 'description.md');
        const description = (existsSync(own) ? read(own) : tool.description).trim();
        if (!description) throw new Error(`工具 ${name} 缺少说明：${own}`);
        return [{ ...tool, description }];
      });
    },
  };
}

// {reference:} and {shared_reference:} name fixed knowledge files, so the
// files they point to must exist; {uri:} points into the task and is not
// checked, nor is a path that still holds a {variable}.
function checkReferences(path: string, section?: string): void {
  for (const match of read(path).matchAll(token)) {
    const [text, prefix, relative] = match;
    if ((prefix !== 'reference' && prefix !== 'shared_reference') || relative.includes('{')) continue;
    if (prefix === 'reference' && !section) throw new Error(`${text} 需要所属管线：${path}`);
    const target = prefix === 'reference' ? join(knowledgeDirectory(), section!, relative) : join(knowledgeDirectory(), 'shared', 'references', relative);
    if (!existsSync(target)) throw new Error(`先验知识引用的文件不存在：${text}（${path}）`);
  }
}

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { recursive: true, encoding: 'utf8' }).filter(name => name.endsWith('.md')).map(name => join(directory, name));
}

// Startup check for the whole knowledge directory, before any agent runs.
export function checkKnowledge(directory = knowledgeDirectory()): void {
  if (!isAbsolute(directory) || !existsSync(directory)) throw new Error(`先验知识目录不存在：${directory}`);
  selected.run(directory, () => {
    for (const name of runtimePrompts) {
      const path = runtimePromptPath(name);
      if (!read(path).trim()) throw new Error(`先验知识文件为空：${path}`);
      checkReferences(path);
    }
    const schemas = new Set(toolSchemaNames());
    for (const declared of knowledgeSteps) {
      const step = stepKnowledge(declared.section, declared.step);
      const config = parseAgent(join(step.directory, 'agent.json'), Boolean(declared.review));
      for (const name of declared.references ?? []) if (!existsSync(step.reference(name))) throw new Error(`先验知识缺少程序读取的文件：${step.reference(name)}`);
      for (const role of ['main', 'review', 'repair'] as const) {
        if (role !== 'main' && !config.review) continue;
        for (const path of step.files(role)) {
          if (!read(path).trim()) throw new Error(`先验知识文件为空：${path}`);
          checkReferences(path, declared.section);
        }
      }
      // Group priors replace step prompts when their group runs.
      for (const path of markdownFiles(join(step.directory, 'prompts', 'groups'))) checkReferences(path, declared.section);
      for (const [role, tools] of [['main', config.main.tools ?? []], ['review', config.review?.tools ?? []]] as const) {
        for (const name of tools) {
          if (!schemas.has(name)) throw new Error(`${declared.section}/${declared.step} 引用了未注册的工具：${name}`);
          const own = join(step.directory, 'tools', name, 'description.md');
          const shared = join(directory, 'shared', 'tools', name, 'description.md');
          const description = existsSync(own) ? read(own) : existsSync(shared) ? read(shared) : '';
          if (!description.trim()) throw new Error(`工具 ${name} 缺少说明：${own}`);
        }
        const required = role === 'main' ? declared.required ?? [] : declared.review?.required ?? [];
        for (const name of required) if (!tools.includes(name)) throw new Error(`${declared.section}/${declared.step} 的 ${role} 缺少必需工具：${name}`);
      }
    }
  });
}
