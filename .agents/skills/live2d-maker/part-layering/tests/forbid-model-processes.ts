import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import '../../shared/tests/ignore-local-env.ts';
import { fakeModelCatalog, patchedCodexCapabilities } from '../../shared/tests/fake-codex.ts';

// CLI 缓存测试也必须离线；缓存失效只能使测试失败，不能落入真实模型调用。
const forbidden = () => { throw new Error('CLI 测试禁止启动模型或其他外部进程'); };
for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync']) {
  Object.defineProperty(childProcess, name, { value: forbidden });
}
// 模拟版本、补丁能力和模型目录。实际 app-server 启动由保护拒绝。
Object.defineProperty(childProcess, 'spawn', { value: (file: string, args: string[] = []) => {
  if (file !== process.execPath || args.length !== 1 || args[0] !== '--version') return forbidden();
  const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), kill: () => true });
  queueMicrotask(() => {
    child.stdout.end('fixture CLI 1.2.3'); child.stderr.end();
    child.emit('exit', 0, null); child.emit('close', 0, null);
  });
  return child;
} });
Object.defineProperty(childProcess, 'execFile', { value: Object.assign(() => forbidden(), {
  [promisify.custom]: async (file: string, args: string[]) => {
    if (args.join(' ') === 'debug layering-capabilities') return { stdout: JSON.stringify(patchedCodexCapabilities), stderr: '' };
    if (file === process.execPath && args[0] === 'debug' && args[1] === 'models') return { stdout: JSON.stringify(fakeModelCatalog), stderr: '' };
    if (file !== process.execPath || args.length !== 1 || args[0] !== '--version') return forbidden();
    return { stdout: 'fixture CLI 1.2.3', stderr: '' };
  },
}) });
syncBuiltinESMExports();
