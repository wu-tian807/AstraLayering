import { access, chmod, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, relative } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
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

async function selectedProviderConfig(home: string): Promise<string> {
  let profile: unknown;
  try { profile = parseToml(await readFile(join(home, 'config.toml'), 'utf8')); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw new Error('Codex profile 的 config.toml 无法解析；请先检查该 profile 配置。');
  }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) return '';
  const settings = profile as Record<string, unknown>;
  const selected = settings.model_provider;
  const providers = settings.model_providers;
  if (typeof selected !== 'string' || !providers || typeof providers !== 'object' || Array.isArray(providers)) return '';
  const provider = (providers as Record<string, unknown>)[selected];
  if (!provider || typeof provider !== 'object' || Array.isArray(provider)) return '';

  // Carry only the currently selected route and its authentication settings.
  // User instructions, model defaults, history, hooks, plugins and other
  // provider profiles stay in the native Codex home.
  return stringifyToml({ model_provider: selected, model_providers: { [selected]: provider } });
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
  const sourceHome = source.CODEX_HOME || join(homedir(), '.codex');
  const providerConfig = await selectedProviderConfig(sourceHome);
  // Preserve the selected native login/provider route, including auth.command,
  // while keeping the agent's instructions, model defaults, history, hooks,
  // plugins and unrelated provider profiles out of this private CODEX_HOME.
  const config = join(directory, 'config.toml');
  await writeFile(config,
    'cli_auth_credentials_store = "file"\n' + Object.entries(productionCodexConfig).map(([key, value]) => `${key} = ${JSON.stringify(value)}\n`).join('') +
      (providerConfig ? `\n${providerConfig}` : ''), { mode: 0o600 });
  await chmod(config, 0o600);
  return { ...source, CODEX_HOME: directory };
}
