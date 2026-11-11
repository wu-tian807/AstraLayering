import { readFile, copyFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const code = dirname(fileURLToPath(import.meta.url));
const repo = resolve(code, '../../..');
const input = join(repo, 'demos/tanuki-girl/nine-axis');
const example = join(input, 'step08_hair');
if (!process.argv[2]) throw Error('Pass a new task directory; --current loads the last result for preview.');
const task = resolve(process.argv[2]);
const model = join(example, process.argv.includes('--current') ? 'hair-x.json' : 'baseline-hair-x.json');
const doc = JSON.parse(await readFile(model, 'utf8'));
await mkdir(dirname(task), { recursive: true });
await mkdir(task);
const output = join(task, 'nine-axis/step08_hair');
await mkdir(join(output, 'workspace'), { recursive: true });
for (const name of ['hair-x.json', 'deformers.json']) await copyFile(model, join(output, name));
for (const part of doc.parts) {
  const source = part.id.startsWith('hair/')
    ? join(input, 'step01_preparation/reference-layers', basename(part.texture))
    : join(input, 'step07_jaw-line', part.texture);
  const destination = join(output, part.texture);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}
await mkdir(join(task, 'nine-axis/step07_jaw-line'), { recursive: true });
await copyFile(join(input, 'step07_jaw-line/deformers.json'), join(task, 'nine-axis/step07_jaw-line/deformers.json'));
await mkdir(join(output, 'references'), { recursive: true });
for (const name of ['left.png', 'tutorial-front-parent-1430.jpg', 'tutorial-front-local-2020.jpg']) {
  await copyFile(join(example, 'references', name), join(output, 'references', name));
}
await mkdir(join(task, 'nine-axis/step02_video'), { recursive: true });
await copyFile(join(example, 'references/neutral.png'), join(task, 'nine-axis/step02_video/upper-body.png'));
for (const name of ['side-hair-left-task.md', 'side-hair-left-tools.md']) {
  await copyFile(join(code, name), join(output, 'workspace', name));
}
console.log(task);
