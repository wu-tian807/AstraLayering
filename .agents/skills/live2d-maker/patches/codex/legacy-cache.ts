import { glob, lstat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import lockfile from 'proper-lockfile';
import { workflowsDirectory } from '../../shared/paths.ts';

export async function cleanLegacyCodexCache({ skill = workflowsDirectory, progress, preparing }: {
  skill?: string; progress?: (message: string) => void; preparing?: () => void;
} = {}): Promise<void> {
  const directory = join(skill, '.codex-build');
  try {
    if (!(await lstat(directory)).isDirectory()) return;
    for await (const lock of glob('*/*.lock', { cwd: directory })) {
      const build = join(directory, lock.slice(0, -5));
      if (await lockfile.check(build, { realpath: false, stale: 30_000 })) {
        progress?.('旧版 Codex 缓存仍在构建，下次启动时再清理。');
        return;
      }
    }
    progress?.('正在清理旧版 Codex 构建缓存。');
    preparing?.();
    await rm(directory, { recursive: true, force: true, maxRetries: 3 });
    progress?.('已清理旧版 Codex 构建缓存。');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      progress?.(`旧版 Codex 缓存暂时无法清理（${directory}）：${String(error)}`);
    }
  }
}
