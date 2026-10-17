import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import type { TestContext } from 'node:test';

// Windows 不执行 Node shebang；模拟协议仍通过真实子进程运行。
export function nodeExecutables(t: TestContext): void {
  if (process.platform !== 'win32') return;
  const spawn = childProcess.spawn;
  t.mock.method(childProcess, 'spawn', ((file: string, args: string[], options: any) =>
    file.endsWith('.mjs') ? spawn(process.execPath, [file, ...args], options) : spawn(file, args, options)) as typeof spawn);
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
}
