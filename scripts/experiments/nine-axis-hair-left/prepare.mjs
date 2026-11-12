import { access, readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { restoreBaseArchive } from './restore-base.mjs';
import { promisify } from 'node:util';

const code = dirname(fileURLToPath(import.meta.url));
const repo = resolve(code, '../../..');
const input = join(repo, 'demos/tanuki-girl/nine-axis');
const example = join(input, 'step08_hair');
if (!process.argv[2]) throw Error('Pass a new task directory; defaults to the current demo. --baseline explicitly selects the historical baseline.');
const task = resolve(process.argv[2]);
if (process.argv.includes('--current') && process.argv.includes('--baseline')) throw Error('Choose --current or --baseline.');
const sourceAt = process.argv.indexOf('--source-model');
if (sourceAt >= 0 && (!process.argv[sourceAt + 1] || process.argv[sourceAt + 1].startsWith('--'))) throw Error('--source-model requires a model path.');
if (sourceAt >= 0 && process.argv.includes('--baseline')) throw Error('Choose --source-model or --baseline.');
const model = sourceAt >= 0 ? resolve(process.argv[sourceAt + 1]) : join(example, process.argv.includes('--baseline') ? 'baseline-hair-x.json' : 'hair-x.json');
await access(model).catch(error => { throw Error(`Missing model: ${model}. Use the current demo unless the historical baseline has been restored.`, { cause: error }); });
const doc = JSON.parse(await readFile(model, 'utf8'));
await mkdir(dirname(task), { recursive: true });
await mkdir(task);
await restoreBaseArchive(dirname(input), task);
const output = join(task, 'nine-axis/step08_hair');
await mkdir(join(output, 'workspace'), { recursive: true });
for (const name of ['hair-x.json', 'deformers.json']) await copyFile(model, join(output, name));
for (const part of doc.parts) {
  const destination = join(output, part.texture);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(dirname(model), part.texture), destination);
}
await mkdir(join(task, 'nine-axis/step07_jaw-line'), { recursive: true });
await copyFile(join(input, 'step07_jaw-line/deformers.json'), join(task, 'nine-axis/step07_jaw-line/deformers.json'));
const references = join(output, 'references');
await mkdir(references, { recursive: true });
await mkdir(join(task, 'nine-axis/step02_video'), { recursive: true });
const exists = file => access(file).then(() => true, () => false);
const provenance = { model, referenceBounds: [doc.view.x, doc.view.y, doc.view.width, doc.view.height], images: {} };
async function referenceImage(destination, candidates, frameIndex) {
  for (const source of candidates) if (await exists(source)) {
    await copyFile(source, destination);
    provenance.images[destination] = { source };
    return;
  }
  const selection = JSON.parse(await readFile(join(example, 'references/left-reference.json'), 'utf8'));
  const video = resolve(dirname(input), selection.video);
  const ffmpegAt = process.argv.indexOf('--ffmpeg');
  if (ffmpegAt >= 0 && !process.argv[ffmpegAt + 1]) throw Error('--ffmpeg requires an executable path.');
  const ffmpeg = ffmpegAt >= 0 ? process.argv[ffmpegAt + 1] : 'ffmpeg';
  const index = frameIndex ?? selection.frameIndex;
  if (!Number.isSafeInteger(index) || index < 0) throw Error('Reference metadata requires a non-negative frameIndex.');
  // Resample the recorded full-frame canvas window; do not fit the model or
  // register individual facial features. Legacy preview scripts use this size.
  await promisify(execFile)(ffmpeg, ['-y', '-loglevel', 'error', '-i', video, '-vf', `select=eq(n\\,${index}),scale=${doc.view.width}:${doc.view.height}:flags=lanczos`, '-frames:v', '1', '-update', '1', destination]);
  await access(destination);
  provenance.images[destination] = { video, frameIndex: index, outputSize: [doc.view.width, doc.view.height] };
}
await referenceImage(join(references, 'left.png'), [join(example, 'references/left.png'), join(input, 'step03_frames/left.png')]);
await referenceImage(join(task, 'nine-axis/step02_video/upper-body.png'), [join(example, 'references/neutral.png'), join(input, 'step02_video/upper-body.png')], 0);
for (const name of ['tutorial-front-parent-1430.jpg', 'tutorial-front-local-2020.jpg']) {
  const file = join(example, 'references', name);
  if (await exists(file)) await copyFile(file, join(references, name));
}
for (const name of ['side-hair-left-task.md', 'side-hair-left-tools.md', 'bangs-left-task.md', 'bangs-left-tools.md', 'back-hair-left-task.md', 'back-hair-left-tools.md', 'hair-left-tools.md', 'hair-reference-review.md']) {
  await copyFile(join(code, name), join(output, 'workspace', name));
}
await writeFile(join(output, 'workspace/input-provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(task);
