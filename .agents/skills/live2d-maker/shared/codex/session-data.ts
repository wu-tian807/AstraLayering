import { access, lstat, mkdir, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { copyCredential } from '../agents/session-data.ts';

// These are runtime defaults, not user-profile imports. Apply the same values
// at process startup as at thread/start: hooks can run before the first turn.
export const productionCodexConfig = {
  project_doc_max_bytes: 0,
  project_root_markers: ['.astra-layering-workspace-root'],
  'skills.include_instructions': false,
  'skills.bundled.enabled': false,
  'features.apps': false,
  'features.hooks': false,
  'features.codex_hooks': false,
  'features.memories': false,
  'features.goals': false,
};

export async function prepareCodexWorkspace(workspace: string): Promise<void> {
  // Stop native project-config discovery at the production workspace instead
  // of walking into the checkout that happens to contain a .run directory.
  try { await writeFile(join(workspace, productionCodexConfig.project_root_markers[0]), '', { flag: 'wx' }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
}

export async function codexSessionEnvironment(data: string, source: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
  const directory = join(data, 'codex');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (relative(await realpath(data), await realpath(directory)) !== 'codex') throw Error('Codex 配置目录不能指向会话数据目录外的路径');
  for (const name of ['auth.json', 'config.toml']) try {
    if (!(await lstat(join(directory, name))).isFile()) throw Error('Codex 配置和认证必须是会话内的普通文件');
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const auth = join(directory, 'auth.json');
  try { await access(auth); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    await copyCredential(join(source.CODEX_HOME || join(homedir(), '.codex'), 'auth.json'), auth);
  }
  // Never copy config.toml, AGENTS.md, memories, plugins or hook definitions.
  // Provider/model settings continue to come from WorkflowEnvironment.
  await writeFile(join(directory, 'config.toml'),
    'cli_auth_credentials_store = "file"\n' + Object.entries(productionCodexConfig).map(([key, value]) => `${key} = ${JSON.stringify(value)}\n`).join(''), { mode: 0o600 });
  return { ...source, CODEX_HOME: directory };
}
