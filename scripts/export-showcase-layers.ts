import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { preparePrivateKrita } from '../.agents/skills/live2d-maker/shared/krita/private-environment.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { values } = parseArgs({ options: {
  krita: { type: 'string', default: process.platform === 'darwin' ? '/Applications/krita.app/Contents/MacOS/krita' : 'krita' },
  case: { type: 'string' },
} });
const supportedCases = ['jianma', 'pink-doll', 'pink-elf', 'black-white-doll'];
if (values.case && !supportedCases.includes(values.case)) throw new Error(`Unknown case: ${values.case}. Choose ${supportedCases.join(', ')}.`);
const selectedCases = values.case ? [values.case] : supportedCases;
const temporary = await mkdtemp(join(process.platform === 'darwin' ? '/tmp' : tmpdir(), 'astra-showcase-'));
try {
  const cases = await Promise.all(selectedCases.map(async name => {
    const relativeKra = `demos/${name}/character-assembly/step01/character-assembled.kra`;
    const kra = join(root, relativeKra);
    return { name, kra, relativeKra, output: join(root, '.web/showcase-layers', name),
      sha256: createHash('sha256').update(await readFile(kra)).digest('hex') };
  }));
  const job = join(temporary, 'job.json');
  await writeFile(job, JSON.stringify({ cases }));
  const prepared = await preparePrivateKrita(temporary, 'astra_showcase', join(root, 'scripts/export-showcase-layers.py'), process.env);
  const env = { ...prepared.env, ASTRA_SHOWCASE_JOB: job, QT_QPA_PLATFORM: process.platform === 'darwin' ? 'cocoa' : 'offscreen' };
  await new Promise<void>((resolve, reject) => {
    const child = spawn(values.krita!, ['--nosplash', '--resource-location', prepared.resource],
      { cwd: temporary, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let log = '';
    child.stdout.on('data', data => { log = (log + data).slice(-12000); });
    child.stderr.on('data', data => { log = (log + data).slice(-12000); });
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Krita export timed out\n' + log)); }, 90_000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Krita export exited ${code}\n${log}`)); });
  });
  const result = JSON.parse(await readFile(join(temporary, 'job.result.json'), 'utf8'));
  if (result.error) throw new Error(result.error);
  console.log(JSON.stringify(result, null, 2));
} finally { await rm(temporary, { recursive: true, force: true }); }
