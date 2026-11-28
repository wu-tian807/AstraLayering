import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import type { TestContext } from 'node:test';
import { promisify } from 'node:util';

// Windows 不执行 Node shebang；模拟协议仍通过真实子进程运行。
export function nodeExecutables(t: TestContext): void {
  if (process.platform !== 'win32') return;
  const { spawn, execFile } = childProcess;
  const invocation = (file: string, rest: unknown[]) => {
    if (!/\.[cm]js$/i.test(file)) return [file, ...rest];
    const args = Array.isArray(rest[0]) ? rest.shift() as string[] : [];
    return [process.execPath, [file, ...args], ...rest];
  };
  const mockedSpawn = t.mock.method(childProcess, 'spawn', ((file: string, ...rest: unknown[]) =>
    Reflect.apply(spawn, childProcess, invocation(file, rest))) as unknown as typeof spawn);
  const run = promisify(execFile);
  childProcess.execFile = Object.assign(
    (file: string, ...rest: unknown[]) => Reflect.apply(execFile, childProcess, invocation(file, rest)),
    { [promisify.custom]: (file: string, ...rest: unknown[]) => Reflect.apply(run, childProcess, invocation(file, rest)) },
  ) as unknown as typeof execFile;
  syncBuiltinESMExports();
  t.after(() => { childProcess.execFile = execFile; mockedSpawn.mock.restore(); syncBuiltinESMExports(); });
}
