import { fork, type ChildProcess } from 'node:child_process';
import { access, constants, opendir, realpath, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

// Both selectors share this walker and child-process lifecycle. Discovery finds
// executable files; saving settings validates the chosen program.
export type Software = 'krita' | 'ffmpeg';
export type SoftwareScanState = { running: boolean; scanned: number; current: string; found: string[]; startedAt?: string; finishedAt?: string; stopped?: boolean; error?: string };
export type ScanPlan = { known: string[]; roots: string[]; depth: number };
export type ScanMessage = { scanned: number; current: string } | { found: string } | { error: string };
type PlanEnvironment = { platform?: NodeJS.Platform; home?: string; env?: NodeJS.ProcessEnv };

const windows = process.platform === 'win32';
const skipped = new Set(['/proc', '/sys', '/dev', '/run', '/snap', '/System', '/private/var/vm']);
const skippedNames = new Set(['node_modules', '$Recycle.Bin', 'System Volume Information']);
export const softwareName = (software: Software, name: string, platform = process.platform) => platform === 'win32'
  ? name.toLowerCase() === software + '.exe'
  : name === software || (software === 'krita' && /^krita.*\.appimage$/i.test(name));

export function defaultPlan(software: Software, { platform = process.platform, home = homedir(), env = process.env }: PlanEnvironment = {}): ScanPlan {
  const isWindows = platform === 'win32', path = isWindows ? win32 : posix;
  const searchPath = env.PATH ?? (isWindows ? Object.entries(env).find(([key]) => key.toLowerCase() === 'path')?.[1] : '') ?? '';
  const known = [...searchPath.split(path.delimiter).filter(Boolean), path.join(home, 'Downloads'), path.join(home, 'Desktop')];
  if (isWindows) {
    const drive = env.SystemDrive ?? 'C:', programs = env.ProgramFiles ?? path.join(drive + '\\', 'Program Files');
    const local = env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
    known.push(...(software === 'krita' ? [
      path.join(programs, 'Krita (x64)', 'bin'), path.join(programs, 'Krita', 'bin'), path.join(local, 'Programs', 'Krita (x64)', 'bin'),
    ] : [
      path.join(drive + '\\', 'ffmpeg', 'bin'), path.join(programs, 'ffmpeg', 'bin'), path.join(local, 'Microsoft', 'WinGet', 'Links'),
      path.join(home, 'scoop', 'shims'), path.join(home, 'scoop', 'apps', 'ffmpeg', 'current', 'bin'),
      path.join(env.ChocolateyInstall ?? path.join(env.ProgramData ?? path.join(drive + '\\', 'ProgramData'), 'chocolatey'), 'bin'),
    ]));
  } else {
    known.push('/usr/bin', '/usr/local/bin', '/opt/homebrew/bin', '/opt', path.join(home, '.local', 'bin'), path.join(home, 'Applications'));
    if (software === 'krita') known.push('/opt/krita/bin', '/snap/bin', '/var/lib/flatpak/exports/bin',
      '/Applications/krita.app/Contents/MacOS', path.join(home, 'Applications/krita.app/Contents/MacOS'));
  }
  const roots = isWindows ? 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => letter + ':\\') : ['/'];
  return { known: [...new Set(known)], roots, depth: 12 };
}

async function executable(path: string): Promise<string | undefined> {
  try {
    if (!(await stat(path)).isFile()) return;
    await access(path, windows ? constants.F_OK : constants.X_OK);
    return await realpath(path);
  } catch { return; }
}

// Returns the final progress, which the caller sends last.
export async function scan(software: Software, plan: ScanPlan, send: (message: ScanMessage) => void): Promise<ScanMessage> {
  const seen = new Set<string>(); let scanned = 0, last = 0;
  const report = async (path: string) => {
    const real = await executable(path), key = windows ? real?.toLowerCase() : real;
    if (real && key && !seen.has(key)) { seen.add(key); send({ found: path }); }
  };
  const progress = (current: string) => {
    if (Date.now() - last < 200) return;
    last = Date.now(); send({ scanned, current });
  };
  for (const directory of plan.known) {
    await report(join(directory, windows ? software + '.exe' : software));
    try { for await (const entry of await opendir(directory)) if (softwareName(software, entry.name) && !entry.isDirectory()) await report(join(directory, entry.name)); }
    catch { /* absent or unreadable */ }
  }
  // Breadth first, so shallow install locations are reported before deep trees.
  let level = plan.roots.map(path => ({ path, depth: 0 }));
  while (level.length) {
    const next: typeof level = [];
    for (const { path, depth } of level) {
      if (skipped.has(path) || (windows && /^[A-Z]:\\Windows$/i.test(path))) continue;
      let entries;
      try { entries = await opendir(path); } catch { continue; }
      progress(path);
      try {
        for await (const entry of entries) {
          scanned++;
          const child = join(path, entry.name);
          // Symlinked directories are not followed: they would revisit or loop.
          if (entry.isDirectory()) {
            if (depth + 1 < plan.depth && !entry.name.startsWith('.') && !skippedNames.has(entry.name)) next.push({ path: child, depth: depth + 1 });
          } else if (softwareName(software, entry.name)) await report(child);
        }
      } catch { /* vanished or unreadable mid-listing */ }
    }
    level = next;
  }
  return { scanned, current: '' };
}

export function createSoftwareScan(software: Software, plan: () => ScanPlan = () => defaultPlan(software)) {
  let state: SoftwareScanState = { running: false, scanned: 0, current: '', found: [] };
  let child: ChildProcess | undefined;
  return {
    state: () => state,
    start() {
      if (child) return state;
      state = { running: true, scanned: 0, current: '', found: [], startedAt: new Date().toISOString() };
      const process_ = fork(fileURLToPath(import.meta.url), [JSON.stringify({ software, plan: plan() })], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
      child = process_;
      process_.on('message', (message: ScanMessage) => {
        if (child !== process_) return;
        if ('found' in message) state = { ...state, found: [...state.found, message.found] };
        else if ('error' in message) state = { ...state, error: message.error };
        else state = { ...state, scanned: message.scanned, current: message.current };
      });
      process_.once('error', error => { if (child === process_) state = { ...state, error: error.message }; });
      process_.once('close', (code, signal) => {
        if (child !== process_) return;
        child = undefined;
        state = { ...state, running: false, current: '', finishedAt: new Date().toISOString(),
          ...(code && !state.error ? { error: '扫描进程异常退出：' + code } : signal && !state.stopped ? { error: '扫描进程被终止：' + signal } : {}) };
      });
      return state;
    },
    stop() { if (child) { state = { ...state, stopped: true }; child.kill(); } return state; },
  };
}

if (import.meta.main && process.send) {
  const send = (message: ScanMessage) => process.send!(message);
  let final: ScanMessage;
  try { const { software, plan } = JSON.parse(process.argv[2]!); final = await scan(software, plan, send); }
  catch (error) { final = { error: (error as Error).message }; }
  // Disconnect only after the last message is flushed.
  process.send(final, () => process.disconnect());
}
