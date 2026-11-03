import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectAgv } from './inspect.ts';
import { parseArgs } from 'node:util';
import { resolveRunsDirectory, workflowsDirectory } from '../../shared/paths.ts';

const instruction = Buffer.from('48ba005847f80d00000048899000010000', 'hex');
export const knownBuild = {
  version: '1.4.4 linux-x64',
  sourceSha256: '337dcde668441a2828968644d7982829c2d2a5e0c4144f346e1f3fc6abb3cdc7',
  patchedSha256: 'e9bcf1865173e79129cd2029ffd2a4eecabebc8b9c66ed756291338d4cab86d0',
  offset: 0x8833e32,
};
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

export function patchResponseHeaders(source: Buffer, build = knownBuild): Buffer {
  if (sha256(source) !== build.sourceSha256) throw new Error('未知 AGV 构建，拒绝修改。此补丁只支持已验证的 ' + build.version + ' SHA-256。');
  if (!source.subarray(build.offset, build.offset + instruction.length).equals(instruction)) {
    throw new Error('AGV 响应头期限指令不匹配，拒绝修改。');
  }
  const patched = Buffer.from(source);
  // Only the default ResponseHeaderTimeout constant changes: 60s -> 0 (no deadline).
  // Explicit options, connect/TLS deadlines, HTTP status parsing and monitors remain intact.
  patched.fill(0, build.offset + 2, build.offset + 10);
  if (sha256(patched) !== build.patchedSha256) throw new Error('AGV 补丁产物校验失败。');
  return patched;
}

export async function createPatchedAgv(sourcePath: string, directory?: string): Promise<string> {
  const root = resolveRunsDirectory(directory), skill = resolve(workflowsDirectory);
  const realRoot = await realpath(root);
  if (realRoot === skill || realRoot.startsWith(skill + sep)) throw new Error('--dir 必须位于 skill 外。');
  let source = await readFile(await realpath(sourcePath));
  if (!source.subarray(0, 4).equals(Buffer.from('7f454c46', 'hex'))) {
    // Accept this tool's installed launcher as --source without treating a shell
    // script or another executable as a patchable binary.
    const manifest = JSON.parse(await readFile(join(dirname(sourcePath), 'patch.json'), 'utf8'));
    if (manifest.format !== 2) throw new Error('指定的 AGV 入口不是可确认的补丁副本。');
    source = await readFile(join(dirname(sourcePath), 'antigravity.bin'));
    if (sha256(source) !== manifest.patchedSha256) throw new Error('指定的 AGV 补丁副本已被替换，请提供原始 CLI。');
  }
  const layout = inspectAgv(source);
  const original = Buffer.from(source);
  original.writeBigUInt64LE(60_000_000_000n, layout.headerOffset + 2);
  const sourceHash = sha256(original);
  const bytes = Buffer.from(original); bytes.fill(0, layout.headerOffset + 2, layout.headerOffset + 10);
  const patchedHash = sha256(bytes);
  const folder = join(realRoot, '.runtime', 'agv', sourceHash, 'v2');
  const output = join(folder, 'antigravity');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  const install = async (name: string, value: Buffer | string, mode = 0o600) => {
    const target = join(folder, name), temporary = target + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, value, { flag: 'wx', mode });
      try { await link(temporary, target); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      if (!(await readFile(target)).equals(Buffer.from(value))) throw new Error('AGV 运行副本内容已变化，未覆盖：' + target);
    } finally { await rm(temporary, { force: true }); }
  };
  await install('antigravity.bin', bytes, 0o700);
  await install('patch.json', JSON.stringify({ format: 2,
    version: sourceHash === knownBuild.sourceSha256 ? knownBuild.version : '结构兼容的 linux-x64 AGV',
    sourceSha256: sourceHash, patchedSha256: patchedHash, headerOffset: layout.headerOffset,
    defaultResponseHeaderTimeoutSeconds: 0, autoUpdateDisabledByTrue: true, originalModified: false }, null, 2) + '\n');
  await install('launch.mjs', await readFile(fileURLToPath(new URL('../../shared/agents/agv-launch.mjs', import.meta.url))));
  await install('antigravity', '#!/usr/bin/env node\nimport "./launch.mjs";\n', 0o700);
  return output;
}


if (import.meta.main) {
  const { values } = parseArgs({ options: { source: { type: 'string' }, dir: { type: 'string' } }, strict: true, allowPositionals: false });
  if (!values.source) throw new Error('请指定 --source <已安装的 AGV 可执行文件>，不会下载或安装 CLI。');
  console.log('agv_path=' + await createPatchedAgv(resolve(values.source), values.dir));
}
