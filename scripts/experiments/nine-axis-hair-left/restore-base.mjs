import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, utimes } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Research runs keep the delivered base and its completion markers. Copying
// just deformers.json loses the workflow history and the model's own textures.
// Existing research files are always kept; step08 belongs to the new trial.
export async function restoreBaseArchive(source, target) {
  source = resolve(source); target = resolve(target);
  if (source === target || target.startsWith(source + sep) || source.startsWith(target + sep)) throw Error('恢复目录必须独立于来源归档');
  const run = JSON.parse(await readFile(resolve(source, 'run.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'));
  if (!run.archive || manifest.format !== 'live2d-export' || !manifest.files) throw Error('来源必须是完整的成果归档');
  const files = ['run.json', ...Object.keys(manifest.files).filter(path => path !== 'run.json' && !path.startsWith('nine-axis/step08_hair/'))];
  let copied = 0;
  for (const path of files) {
    if (isAbsolute(path) || path.split(/[\\/]/).some(part => part === '..' || part === '') || path.includes('\0')) throw Error('归档文件路径无效：' + path);
    const input = resolve(source, path), output = resolve(target, path);
    // Never traverse a symlink in either side of a restored task.
    for (const [root, file] of [[source, input], [target, output]]) {
      let current = root;
      for (const part of ['', ...relative(root, file).split(sep)]) {
        current = resolve(current, part);
        const info = await lstat(current).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (info?.isSymbolicLink()) throw Error('恢复文件不能经过符号链接：' + current);
      }
    }
    const info = await lstat(input);
    if (!info.isFile()) throw Error('归档交付必须是文件：' + path);
    await mkdir(dirname(output), { recursive: true });
    try {
      await copyFile(input, output, constants.COPYFILE_EXCL);
      await utimes(output, info.atime, info.mtime);
      copied++;
    } catch (error) { if (error.code !== 'EEXIST') throw error; }
  }
  return { copied };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4) throw Error('用法：node restore-base.mjs <来源归档> <研究任务目录>');
  console.log(await restoreBaseArchive(process.argv[2], process.argv[3]));
}
