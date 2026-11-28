import { symlink } from 'node:fs/promises';
import type { TestContext } from 'node:test';

export const linkDirectory = (target: string, path: string) =>
  symlink(target, path, process.platform === 'win32' ? 'junction' : 'dir');

export async function linkFile(t: TestContext, target: string, path: string): Promise<boolean> {
  try {
    await symlink(target, path, 'file');
    return true;
  } catch (error) {
    if (process.platform !== 'win32' || (error as NodeJS.ErrnoException).code !== 'EPERM'
      || process.env.ASTRA_TEST_REQUIRE_FILE_SYMLINK === '1') throw error;
    t.skip('此用例需创建真实的 Windows 文件符号链接。Windows PR 检查要求此权限。');
    return false;
  }
}
