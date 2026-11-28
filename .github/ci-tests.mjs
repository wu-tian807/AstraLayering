import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [directory, script] = process.argv.slice(2);
const cwd = resolve(directory);
const command = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).scripts[script];
if (typeof command !== 'string' || !command.startsWith('node --')) {
  throw new Error('Expected a Node test script in ' + join(cwd, 'package.json'));
}
const args = ['--test-force-exit', '--test-timeout=120000', ...command.slice(5).split(/\s+/)];
const child = spawn(process.execPath, args, { cwd, stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
