import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { atomicJSON } from './files.ts';
import { workflowsDirectory } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { withLegacyKeys } from '../.agents/skills/live2d-maker/shared/legacy-keys.ts';
import { compareVersions, installedVersion, releaseTag, type InstalledVersion } from '../.agents/skills/live2d-maker/shared/version.ts';

// Looks up the newest release tag on GitHub at most once a day and only reports it; nothing is
// downloaded or replaced. Offline or failed lookups stay silent. update_check=false in the skill
// .env (the file people already carry over when updating) or in the shell disables it; the shell wins.
export const repository = 'wu-tian807/AstraLayering';
export const updateCheckKey = 'update_check';
const day = 24 * 60 * 60 * 1000, retry = 60 * 60 * 1000;
export type UpdateState = InstalledVersion & {
  check: 'off' | 'ok' | 'unavailable';
  latest?: string; updateAvailable?: boolean; releaseUrl?: string;
};

export function newestTag(tags: unknown): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.map(tag => releaseTag.exec(String(tag?.name ?? ''))?.[0].slice(1)).filter((v): v is string => !!v)
    .sort(compareVersions).at(-1);
}

// Read on every request, so switching it on the configuration page needs no restart.
export async function updateCheckEnabled(env: NodeJS.ProcessEnv = process.env, envFile = join(workflowsDirectory, '.env')) {
  let value = withLegacyKeys(env)[updateCheckKey];
  if (value === undefined) try { value = withLegacyKeys(parseEnv(await readFile(envFile, 'utf8')) as Record<string, string>)[updateCheckKey]; } catch { /* No .env yet. */ }
  return !/^(off|false|0|no)$/i.test(value?.trim() ?? '');
}

export function createUpdateCheck({ cachePath, enabled = () => updateCheckEnabled(),
  fetchTags = defaultFetch, installed = installedVersion, clock = Date.now }: {
  cachePath: string; enabled?: () => Promise<boolean>; fetchTags?: () => Promise<unknown>; installed?: () => Promise<InstalledVersion>; clock?: () => number;
}) {
  let pending: Promise<string | undefined> | undefined, failedAt = -Infinity;
  async function latest() {
    let cached: { checkedAt?: number; latest?: string } = {};
    try { cached = JSON.parse(await readFile(cachePath, 'utf8')); } catch { /* No earlier check. */ }
    if (typeof cached.checkedAt === 'number' && clock() - cached.checkedAt < day) return cached.latest;
    if (clock() - failedAt < retry) return cached.latest;
    try {
      const found = newestTag(await fetchTags());
      await atomicJSON(cachePath, { checkedAt: clock(), latest: found });
      return found;
    } catch { failedAt = clock(); return cached.latest; }
  }
  return async function state(): Promise<UpdateState> {
    const local = await installed();
    if (!await enabled()) return { ...local, check: 'off' };
    const found = await (pending ??= latest().finally(() => { pending = undefined; }));
    if (!found) return { ...local, check: 'unavailable' };
    // Commits after a tag count as that tag: a newer tag is still an update.
    return { ...local, check: 'ok', latest: found, updateAvailable: local.source !== 'unknown' && compareVersions(found, local.version) > 0,
      releaseUrl: `https://github.com/${repository}/releases/tag/v${found}` };
  };
}

async function defaultFetch() {
  const response = await fetch(`https://api.github.com/repos/${repository}/tags?per_page=100`, {
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'astra-layering-workbench' }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('GitHub ' + response.status);
  return response.json();
}
