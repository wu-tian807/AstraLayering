import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

export type KritaInstallation = { executable: string; version: string };
export type Probe = (command: string, args: string[]) => Promise<string>;

const probe: Probe = async (command, args) => {
  const result = await promisify(execFile)(command, args, { timeout: 15_000 });
  return `${result.stdout}\n${result.stderr}`;
};

export async function checkKrita(requested: string, run: Probe = probe): Promise<KritaInstallation> {
  if (!requested?.trim()) throw new Error('请用 --krita 明确指定已安装的 Krita 可执行文件路径。');
  const executable = resolve(requested);
  try {
    if (!(await stat(executable)).isFile()) throw new Error('不是文件');
    await access(executable, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
  } catch (error) { throw new Error(`指定的 Krita 不存在或不可执行：${executable}`, { cause: error }); }
  let output: string;
  try { output = await run(executable, ['--version']); }
  catch (error) { throw new Error(`指定的 Krita 无法启动：${executable}。请检查安装依赖和显示环境。`, { cause: error }); }
  const version = output.match(/\bkrita\s+(\d[^\r\n]*)/i)?.[1];
  if (!version) throw new Error(`未能确认 Krita 版本：${executable}`);
  return { executable, version: version.trim() };
}
