// Development only; wabt is not a runtime dependency. The binary stays embedded
// so native view tools and the workbench use the same synchronous evaluator.
import spawn from 'cross-spawn';
import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const shared = fileURLToPath(new URL('../shared/', import.meta.url)), temp = await mkdtemp(join(tmpdir(), 'astra-warp-'));
const output = join(temp, 'warp.wasm');
try {
  const result = spawn.sync('pnpm', ['--package=wabt@1.0.39', 'dlx', 'wat2wasm', join(shared, 'nine-axis-warp.wat'), '-o', output], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw Error('Warp compilation failed: ' + result.status);
  const path = join(shared, 'nine-axis-warp.js'), source = await readFile(path, 'utf8');
  await writeFile(path, source.replace(/const binary = '[^']*';/, `const binary = '${(await readFile(output)).toString('base64')}';`));
} finally { await unlink(output).catch(error => { if (error.code !== 'ENOENT') throw error; }); await rmdir(temp); }
