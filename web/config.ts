import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { basename, dirname, extname, join, relative } from 'node:path';
import { sectionToolDirectories, toolsDirectory } from '../.agents/skills/live2d-maker/shared/codex/tool-config.ts';
import { safePath, webFilePath } from './files.ts';

// The prior-knowledge browser: every file under the configured knowledge directory.
// Git versions are offered only when that directory sits inside a git repository.
const git = async (cwd: string, args: string[], encoding: BufferEncoding | 'buffer' = 'utf8') =>
  (await promisify(execFile)('git', args, { cwd, maxBuffer: 64 * 1024 * 1024, encoding: encoding as BufferEncoding })).stdout as unknown as string;
export const mediaTypes: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.ogv': 'video/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
};
const textLimit = 4 * 1024 * 1024;

async function repository(directory: string) {
  try {
    const top = (await git(directory, ['rev-parse', '--show-toplevel'])).trim();
    const prefix = webFilePath(relative(await realpath(top), await realpath(directory)));
    return { top, prefix: prefix ? prefix + '/' : '' };
  } catch { return undefined; }
}
async function revision(top: string, ref: string): Promise<string> {
  if (!ref || ref.startsWith('-') || ref.includes('\0')) throw new Error('无效的版本');
  return (await git(top, ['rev-parse', '--verify', ref + '^{commit}'])).trim();
}
async function walk(directory: string, prefix = ''): Promise<string[]> {
  const paths: string[] = [];
  for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) paths.push(...await walk(directory, path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}
async function snapshot(directory: string, ref: string) {
  if (ref === 'worktree') return { paths: (await walk(directory)).sort(), commit: undefined };
  const repo = await repository(directory);
  if (!repo) throw new Error('先验知识目录不在 Git 仓库内，没有历史版本');
  const commit = await revision(repo.top, ref);
  const listing = await git(repo.top, ['ls-tree', '-r', '-z', '--name-only', commit, '--', repo.prefix || '.']);
  const paths = listing.split('\0').filter(Boolean).map(path => path.slice(repo.prefix.length))
    .filter(path => !path.split('/').some(part => part.startsWith('.')));
  return { paths: paths.sort(), commit, repo };
}
async function selected(directory: string, params: URLSearchParams) {
  const ref = params.get('ref') ?? 'worktree', path = params.get('path') ?? '';
  const listed = await snapshot(directory, ref);
  if (!listed.paths.includes(path)) throw new Error('所选版本没有这个文件');
  return { ref, path, ...listed };
}
async function bytes(directory: string, file: Awaited<ReturnType<typeof selected>>): Promise<Buffer> {
  if (file.ref === 'worktree') return readFile(await safePath(directory, file.path));
  return git(file.repo!.top, ['show', file.commit + ':' + file.repo!.prefix + file.path], 'buffer') as unknown as Buffer;
}
// Schemas are code, not knowledge: a section may replace the shared schema of a tool.
async function toolSchema(path: string): Promise<string> {
  const tool = path.match(/^([^/]+)\/(?:.*\/)?tools\/([^/]+)\/description\.md$/);
  if (!tool) return '';
  const own = sectionToolDirectories.find(directory => basename(dirname(directory)) === tool[1]);
  for (const candidate of [...own ? [join(own, tool[2]!, 'schema.json')] : [], join(toolsDirectory, tool[2]!, 'schema.json')]) {
    try { return await readFile(candidate, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return '';
}

export async function configAPI(path: string, params: URLSearchParams, directory: string) {
  if (path === '/api/config/versions') {
    const repo = await repository(directory);
    if (!repo) return { git: false, branches: [], commits: [] };
    const branches = (await git(repo.top, ['for-each-ref', '--format=%(refname:short)', 'refs/heads', 'refs/remotes'])).trim().split('\n')
      .filter(ref => ref && !ref.endsWith('/HEAD'));
    const ref = params.get('ref') ?? 'HEAD';
    const commit = await revision(repo.top, ref === 'worktree' ? 'HEAD' : ref);
    const commits = (await git(repo.top, ['log', '-15', '--format=%H%x09%h%x09%s', commit, '--', repo.prefix || '.'])).trim().split('\n').filter(Boolean).map(line => {
      const [sha, short, ...title] = line.split('\t'); return { sha, short, title: title.join('\t') };
    });
    return { git: true, branches, commits };
  }
  if (path === '/api/config/files') {
    const { paths, commit } = await snapshot(directory, params.get('ref') ?? 'worktree');
    return { directory, paths, commit };
  }
  if (path === '/api/config/schema') return { text: await toolSchema(params.get('path') ?? '') };
  if (path === '/api/config/content' || path === '/api/config/diff') {
    const file = await selected(directory, params);
    if (path.endsWith('/diff')) {
      const repo = file.repo ?? await repository(directory);
      if (!repo) throw new Error('先验知识目录不在 Git 仓库内，没有历史版本');
      const base = await revision(repo.top, params.get('base') ?? 'HEAD~2');
      return { text: await git(repo.top, ['diff', '--no-ext-diff', '--no-color', base, ...(file.commit ? [file.commit] : []), '--', repo.prefix + file.path]) };
    }
    const content = await bytes(directory, file);
    if (content.length > textLimit) throw new Error('文件超过 4 MB，请下载查看');
    return { text: content.toString('utf8') };
  }
  throw new Error('Unknown API');
}

// Images, video and audio for the preview; a worktree file honours Range so video can seek.
export async function configRaw(params: URLSearchParams, directory: string, request: { headers: { range?: string } }, response: ServerResponse) {
  const file = await selected(directory, params);
  const type = mediaTypes[extname(file.path).toLowerCase()] ?? 'application/octet-stream';
  response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  if (file.ref !== 'worktree') {
    const content = await bytes(directory, file);
    response.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length }); response.end(content); return;
  }
  await streamMediaFile(await safePath(directory, file.path), type, request, response);
}

// Reuse the same ranged file response for task videos and knowledge media.
export async function streamMediaFile(target: string, type: string, request: { headers: { range?: string } }, response: ServerResponse) {
  const size = (await lstat(target)).size;
  const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
    if (start > end || start >= size) { response.writeHead(416, { 'Content-Range': `bytes */${size}` }); response.end(); return; }
    response.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    createReadStream(target, { start, end }).on('error', () => response.destroy()).pipe(response); return;
  }
  response.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
  createReadStream(target).on('error', () => response.destroy()).pipe(response);
}
