import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { preparePrivateKrita } from './private-environment.ts';
import { ensureWindowsKritaPlugin, prepareWindowsKritaApplication, windowsKritaConfigDirectory } from './windows-launch.ts';
import { readDefaultConfiguration } from '../default-configuration.ts';

// One private Krita per section. A section that needs Krita first reserves a
// machine-wide slot (queueing while all are taken) and holds it until it ends;
// only then can its agents start Krita through the krita tool, restarting it
// themselves after a crash. The section releases both when it ends, however it ends. Krita itself is the user's
// executable; the framework provides the private profile, the bridge plugin
// and, on Linux without a display, a shared Xvfb.

export const bridgeSubmitScript = fileURLToPath(new URL('./bridge/submit.mjs', import.meta.url));
const bridgePlugin = fileURLToPath(new URL('./bridge/astra_bridge.py', import.meta.url));
const tempPrefix = 'astra-krita-';

export type KritaState = 'stopped' | 'starting' | 'running' | 'crashed';
export type KritaStatus = {
  state: KritaState; section: string; executable: string; restarts: number;
  pid?: number; version?: string; bridge?: string; startedAt?: string;
  // Set while the section waits for a free machine-wide slot.
  waiting?: string;
  // How the previous process ended, with the end of its log, after a crash.
  lastExit?: { code: number | null; signal: string | null; at: string; log: string };
};
// Written to `record` while the section queues for or holds a machine-wide
// slot, for other processes (web status): `waiting` for a slot, `reserved`
// with no Krita running, `running` with the Krita's process.
export type KritaRecord = { section: string; owner: number; limit: number; since: string } & (
  | { state: 'waiting' | 'reserved' }
  | { state: 'running'; pid: number; bridge: string; version: string; startedAt: string });

// ---- Shared virtual display (Linux, no DISPLAY/WAYLAND_DISPLAY) ----------

// -noreset is required, not tuning. Every Xvfb started with -displayfd tries
// display numbers from 0 up and, for each one in use, unlinks that server's
// /tmp/.X11-unix/X<n> before finding the number taken. A server whose socket
// file is gone and that then resets (by default when its last client leaves,
// e.g. Krita's OpenGL probe at startup) re-creates the listener and stops
// serving the next client: Krita blocks forever in XOpenDisplay before it
// logs anything. Sections in separate processes starting together hit this
// for every display but the newest (Xvfb 21.1.8).
const xvfbArguments = ['-displayfd', '1', '-screen', '0', '1920x1080x24', '-nolisten', 'tcp', '-noreset'];

let display: { process: ChildProcess; name: string; users: number } | undefined;
let displayStarting: Promise<string> | undefined;

async function acquireDisplay(inherited: NodeJS.ProcessEnv): Promise<string | undefined> {
  // An explicit Qt platform (e.g. offscreen) needs no display.
  if (process.platform !== 'linux' || inherited.DISPLAY || inherited.WAYLAND_DISPLAY || inherited.QT_QPA_PLATFORM) return;
  if (display) { display.users++; return display.name; }
  displayStarting ??= (async () => {
    // Not detached: a stop that kills the worker's process group takes it too.
    const child = spawn(inherited.ASTRA_STUDIO_XVFB || 'Xvfb', xvfbArguments,
      { stdio: ['ignore', 'pipe', 'ignore'] });
    try {
      const name = ':' + await new Promise<string>((accept, reject) => {
        let buffer = '';
        const timer = setTimeout(() => reject(new Error('Xvfb 启动超时')), 10_000);
        child.once('error', error => { clearTimeout(timer); reject(new Error(`无法启动 Xvfb（${inherited.ASTRA_STUDIO_XVFB || 'Xvfb'}）：${error.message}`)); });
        child.once('exit', () => { clearTimeout(timer); reject(new Error('Xvfb 未能启动')); });
        child.stdout!.on('data', data => { buffer += data; if (/^\d+\n/.test(buffer)) { clearTimeout(timer); accept(buffer.trim()); } });
      });
      child.unref();
      display = { process: child, name, users: 0 };
      return name;
    } catch (error) { child.kill('SIGKILL'); throw error; }
    finally { displayStarting = undefined; }
  })();
  const name = await displayStarting;
  display!.users++;
  return name;
}

function releaseDisplay(name: string | undefined) {
  if (!name || !display || display.name !== name || --display.users > 0) return;
  display.process.kill('SIGTERM');
  display = undefined;
}

// ---- Krita process --------------------------------------------------------

// Bundled Linux builds (an extracted AppImage, run as AppRun or usr/bin/krita)
// need their own Python and, on older hosts, the shipped libstdc++. Explicit
// ASTRA_STUDIO_* values win.
async function bundleEnvironment(krita: string, env: NodeJS.ProcessEnv, inherited: NodeJS.ProcessEnv) {
  const exists = (path: string) => stat(path).then(() => true, () => false);
  const bundle = await exists(join(dirname(krita), 'usr/lib/krita-python-libs')) ? join(dirname(krita), 'usr') : join(dirname(krita), '..');
  if (inherited.ASTRA_STUDIO_KRITA_PYTHONHOME) env.PYTHONHOME = inherited.ASTRA_STUDIO_KRITA_PYTHONHOME;
  else if (process.platform === 'linux' && await exists(join(bundle, 'lib/krita-python-libs'))) env.PYTHONHOME = bundle;
  if (inherited.ASTRA_STUDIO_KRITA_PYTHONPATH) env.PYTHONPATH = inherited.ASTRA_STUDIO_KRITA_PYTHONPATH;
  else if (env.PYTHONHOME === bundle) env.PYTHONPATH = [join(bundle, 'share/krita/pykrita'), join(bundle, 'lib/krita-python-libs')].join(':');
  const fallback = join(bundle, 'libstdcpp-fallback');
  if (process.platform === 'linux' && await exists(fallback))
    env.LD_LIBRARY_PATH = [fallback, inherited.LD_LIBRARY_PATH].filter(Boolean).join(':');
}

// Completes `env` for starting `krita` on the given display (Linux).
async function kritaEnvironment(krita: string, env: NodeJS.ProcessEnv, inherited: NodeJS.ProcessEnv, displayName: string | undefined) {
  if (process.platform === 'linux') {
    if (displayName) env.DISPLAY = displayName;
    if (!env.WAYLAND_DISPLAY && !inherited.QT_QPA_PLATFORM) env.QT_QPA_PLATFORM = 'xcb';
    env.FONTCONFIG_PATH ||= '/etc/fonts';
    env.FONTCONFIG_FILE ||= '/etc/fonts/fonts.conf';
  }
  await bundleEnvironment(krita, env, inherited);
}

const alive = (pid: number) => {
  try { process.kill(pid, 0); return true; }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM'; }
};

// Temporary profiles left by a process that was killed before it could
// clean up: their Krita is gone, so they are only clutter.
async function removeStaleProfiles() {
  const names = (await readdir(tmpdir()).catch(() => [] as string[])).filter(name => name.startsWith(tempPrefix));
  await Promise.all(names.map(async name => {
    const root = join(tmpdir(), name);
    const ready = await readFile(join(root, 'bridge', 'ready.json'), 'utf8').then(text => JSON.parse(text) as { pid: number }, () => undefined);
    // Without ready.json the profile may belong to a Krita still starting.
    if (ready && !alive(ready.pid)) await rm(root, { recursive: true, force: true }).catch(() => {});
  }));
}

// ---- Machine-wide cap ------------------------------------------------------

// Each Krita takes several hundred MB, and separate tasks each run their own
// sections, so all of them share krita_max_instances slots (.env,
// default in example.env): one lock file per slot, holding its owner's pid.
// A slot whose owner died is free.
export const kritaLimitKey = 'krita_max_instances';
// ASTRA_STUDIO_KRITA_SLOTS moves the locks elsewhere (tests keep their own).
const defaultSlotsDirectory = () => process.env.ASTRA_STUDIO_KRITA_SLOTS || join(tmpdir(), 'astra-krita.slots');

export function kritaLimit(env: NodeJS.ProcessEnv, defaults: Readonly<Record<string, string>> = readDefaultConfiguration()): number {
  const value = env[kritaLimitKey]?.trim() || defaults[kritaLimitKey]?.trim() || '';
  const limit = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(limit) || limit < 1) throw new Error(`${kritaLimitKey} 须为正整数：${value || '（空）'}`);
  return limit;
}

async function acquireKritaSlot(directory: string, limit: number, signal: AbortSignal | undefined, waiting: () => void): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  for (let announced = false; ; announced = true) {
    for (let index = 0; index < limit; index++) {
      const path = join(directory, `${index}.lock`);
      try {
        const handle = await open(path, 'wx');
        await handle.writeFile(String(process.pid)); await handle.close();
        return () => rm(path, { force: true });
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      const owner = Number(await readFile(path, 'utf8').catch(() => ''));
      // An empty file is a slot being taken right now, unless it is old.
      const stale = owner ? !alive(owner) : await stat(path).then(info => Date.now() - info.mtimeMs > 10_000, () => false);
      if (stale) await rm(path, { force: true }).catch(() => {});
    }
    if (!announced) waiting();
    signal?.throwIfAborted();
    await delay(1_000, undefined, { signal });
  }
}

// Slots held by live processes, machine-wide (web status).
export async function kritaSlotsInUse(directory = defaultSlotsDirectory()): Promise<number> {
  const names = (await readdir(directory).catch(() => [] as string[])).filter(name => /^\d+\.lock$/.test(name));
  const owners = await Promise.all(names.map(name => readFile(join(directory, name), 'utf8').then(Number, () => 0)));
  return owners.filter(owner => owner && alive(owner)).length;
}

type Running = { child: ChildProcess; root: string; bridge: string; display?: string; pid: number; version: string;
  startedAt: string; closed: Promise<void>; exited: boolean; stopping: boolean; log: string };

const live = new Set<SectionKrita>();
export const kritaRecordFile = 'krita.json';

export type SectionKritaOptions = { section: string; krita: string; env?: NodeJS.ProcessEnv; record?: string; readyTimeoutMs?: number;
  // Where the machine-wide slot locks live (tests).
  slotsDirectory?: string };

export class SectionKrita {
  readonly section: string;
  readonly executable: string;
  private readonly options: SectionKritaOptions;
  private current?: Running;
  private pending?: Promise<Running>;
  private restarts = 0;
  private lastExit?: KritaStatus['lastExit'];
  private released = false;
  private queued = false;
  private reservation?: Promise<() => Promise<void>>;
  private slot?: () => Promise<void>;
  // Aborts a start still waiting for a slot or for the bridge once the section ends.
  private readonly ending = new AbortController();
  // Record writes, in order; the last one wins.
  private recording: Promise<void> = Promise.resolve();

  constructor(options: SectionKritaOptions) {
    this.options = options; this.section = options.section; this.executable = options.krita;
  }

  status(): KritaStatus {
    const running = this.current && !this.current.exited ? this.current : undefined;
    return { state: running ? 'running' : this.pending ? 'starting' : this.lastExit ? 'crashed' : 'stopped',
      section: this.section, executable: this.executable, restarts: this.restarts,
      ...(this.queued ? { waiting: `本机 Krita 已达上限 ${kritaLimit(this.options.env ?? process.env)} 个（${kritaLimitKey}），等待其他 section 释放` } : {}),
      ...(running ? { pid: running.pid, version: running.version, bridge: running.bridge, startedAt: running.startedAt } : {}),
      ...(this.lastExit && !running ? { lastExit: this.lastExit } : {}) };
  }

  // The bridge directory of the running Krita, if any.
  get bridge(): string | undefined { return this.current && !this.current.exited ? this.current.bridge : undefined; }

  // True once the section holds a machine-wide slot.
  get reserved(): boolean { return !!this.slot; }

  // Takes a machine-wide slot for the rest of the section, waiting while all
  // are taken; `waiting` is called once if it has to wait. Idempotent.
  async reserve(signal?: AbortSignal, waiting?: (message: string) => void): Promise<void> {
    if (this.released) throw new Error('这个 section 已结束，不能再占用 Krita。');
    if (this.slot) return;
    const combined = signal ? AbortSignal.any([signal, this.ending.signal]) : this.ending.signal;
    this.reservation ??= acquireKritaSlot(this.options.slotsDirectory ?? defaultSlotsDirectory(), kritaLimit(this.options.env ?? process.env), combined,
      () => { this.queued = true; this.record('waiting'); waiting?.(this.status().waiting!); }).finally(() => { this.queued = false; this.reservation = undefined; });
    const ended = () => new Error('这个 section 已结束，不能再占用 Krita。');
    const slot = await this.reservation.catch(async error => {
      // A wait given up (aborted) leaves no waiting record behind.
      if (!this.slot && !this.released) await this.record(undefined);
      throw this.released ? ended() : error;
    });
    // release() may have run while the slot was being taken.
    if (this.released) { await slot(); throw ended(); }
    this.slot ??= slot;
    if (!this.bridge) await this.record('reserved');
  }

  // Starts Krita unless it already runs; resolves once its bridge is ready.
  async start(signal?: AbortSignal): Promise<KritaStatus> {
    if (this.released) throw new Error('这个 section 已结束，它的 Krita 不能再启动。');
    if (!this.slot) throw new Error('这个 section 没有占用 Krita 名额，不能启动 Krita。');
    if (!this.current || this.current.exited) {
      if (this.current) await this.discard(this.current);
      this.pending ??= this.launch(signal ? AbortSignal.any([signal, this.ending.signal]) : this.ending.signal).finally(() => { this.pending = undefined; });
      this.current = await this.pending;
    }
    return this.status();
  }

  // Replaces the running (or crashed) Krita with a fresh one.
  async restart(signal?: AbortSignal): Promise<KritaStatus> {
    await this.pending?.catch(() => {});
    if (this.current) { await this.stop(this.current); this.current = undefined; }
    this.restarts++;
    return this.start(signal);
  }

  // Ends the section's Krita for good; safe to call more than once.
  async release(): Promise<void> {
    this.released = true;
    this.ending.abort(new Error('section 已结束'));
    await this.pending?.catch(() => {});
    await this.reservation?.catch(() => {});
    if (this.current) await this.stop(this.current);
    this.current = undefined;
    const slot = this.slot;
    this.slot = undefined;
    await this.record(undefined);
    await slot?.().catch(() => {});
    live.delete(this);
  }

  // Last resort on process exit: synchronous kill, files stay behind.
  kill() { if (this.current && !this.current.exited) try { this.current.child.kill('SIGKILL'); } catch {} }

  // Replaces the record with the given state, or removes it (undefined).
  private record(state: KritaRecord['state'] | undefined, running?: Running): Promise<void> {
    const path = this.options.record;
    if (!path) return Promise.resolve();
    let limit = 0;
    try { limit = kritaLimit(this.options.env ?? process.env); } catch {}
    const base = { section: this.section, owner: process.pid, limit, since: new Date().toISOString() };
    const value: KritaRecord | undefined = state === 'running'
      ? { ...base, state, pid: running!.pid, bridge: running!.bridge, version: running!.version, startedAt: running!.startedAt }
      : state && { ...base, state };
    this.recording = this.recording.then(async () => {
      if (!value) return rm(path, { force: true });
      const temporary = `${path}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
      await rename(temporary, path);
    }).catch(() => {});
    return this.recording;
  }

  private async launch(signal?: AbortSignal): Promise<Running> {
    signal?.throwIfAborted();
    await removeStaleProfiles();
    const inherited = this.options.env ?? process.env, krita = this.executable;
    const root = await mkdtemp(join(tmpdir(), tempPrefix));
    const bridge = join(root, 'bridge');
    let displayName: string | undefined, running: Running | undefined;
    try {
      const { resource, env: privateEnv } = await preparePrivateKrita(root, 'astra_bridge', bridgePlugin, inherited);
      const env: NodeJS.ProcessEnv = { ...privateEnv, ASTRA_KRITA_BRIDGE: bridge };
      let executable = krita;
      if (process.platform === 'win32') {
        await ensureWindowsKritaPlugin(await windowsKritaConfigDirectory(), 'astra_bridge');
        executable = await prepareWindowsKritaApplication(root, krita, resource);
        // Windows Qt reads native Known Folders. Keep the real user preferences;
        // plugin code, resources and bridge jobs remain section-private.
        env.APPDATA = inherited.APPDATA;
        env.LOCALAPPDATA = inherited.LOCALAPPDATA;
      }
      displayName = await acquireDisplay(inherited);
      await kritaEnvironment(krita, env, inherited, displayName);
      // Not detached, for the same reason as Xvfb: the worker's group kill
      // must reach Krita even when no cleanup code gets to run.
      const child = spawn(executable, ['--nosplash', '--resource-location', resource],
        { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      let launchError: Error | undefined;
      child.once('error', error => { launchError = error; });
      const state: Running = running = { child, root, bridge, display: displayName, pid: child.pid ?? 0, version: '', startedAt: '',
        exited: false, stopping: false, log: '', closed: Promise.resolve() };
      displayName = undefined; // Owned by the process state from here on.
      const append = (data: Buffer) => { state.log = (state.log + data).slice(-12_000); };
      child.stdout!.on('data', append); child.stderr!.on('data', append);
      state.closed = new Promise(resolve => child.once('close', (code, exitSignal) => {
        state.exited = true;
        // An exit nobody asked for: keep its log for the agent, free the rest.
        if (!state.stopping) {
          this.lastExit = { code, signal: exitSignal, at: new Date().toISOString(), log: state.log.slice(-4000) };
          void this.discard(state);
        }
        resolve();
      }));
      live.add(this);
      const timeout = this.options.readyTimeoutMs ?? 120_000, until = Date.now() + timeout;
      for (;;) {
        signal?.throwIfAborted();
        if (launchError) throw new Error(`无法启动 Krita：${krita}：${launchError.message}`);
        if (state.exited) throw new Error(`Krita 在桥接就绪前退出：${krita}\n${state.log.slice(-4000)}`);
        // ready.json is written atomically; a partial read cannot happen.
        try {
          const ready = JSON.parse(await readFile(join(bridge, 'ready.json'), 'utf8')) as { pid: number; version: string };
          Object.assign(state, { pid: ready.pid, version: ready.version, startedAt: new Date().toISOString() });
          break;
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (Date.now() > until) throw new Error(`Krita 桥接 ${Math.round(timeout / 1000)} 秒内未就绪：${krita}\n${state.log.slice(-4000)}`);
        await delay(150);
      }
      this.lastExit = undefined;
      await this.record('running', state);
      return state;
    } catch (error) {
      if (running) await this.stop(running);
      else { releaseDisplay(displayName); await rm(root, { recursive: true, force: true }).catch(() => {}); }
      throw error;
    }
  }

  private async stop(state: Running) {
    state.stopping = true;
    if (!state.exited) {
      // A normal quit lets Krita drop its locks and temporary files.
      await writeFile(join(state.bridge, 'quit'), '').catch(() => {});
      await Promise.race([state.closed, delay(5_000)]);
      if (!state.exited) state.child.kill('SIGTERM');
      await Promise.race([state.closed, delay(3_000)]);
      if (!state.exited) { state.child.kill('SIGKILL'); await Promise.race([state.closed, delay(3_000)]); }
    }
    await this.discard(state);
  }

  // Frees what a finished process leaves behind; idempotent.
  private async discard(state: Running) {
    if (!state.root) return;
    const root = state.root;
    state.root = '';
    releaseDisplay(state.display);
    // The section still holds its slot until it ends.
    if (!this.released) await this.record(this.slot ? 'reserved' : undefined);
    await rm(root, { recursive: true, force: true }).catch(() => {});
  }
}

process.once('exit', () => {
  for (const krita of live) krita.kill();
  if (display) try { display.process.kill('SIGKILL'); } catch {}
});

// Releases every section Krita of this process (worker shutdown).
export async function releaseAllSectionKrita(): Promise<void> {
  await Promise.all([...live].map(krita => krita.release()));
}

// A section's record while its process (and, when running, its Krita) is alive,
// for other processes. Records written before states existed are running ones.
export async function readKritaRecord(path: string): Promise<KritaRecord | undefined> {
  try {
    const record = JSON.parse(await readFile(path, 'utf8'));
    if (!record.state) record.state = 'running';
    if (!['waiting', 'reserved', 'running'].includes(record.state) || !Number.isSafeInteger(record.owner ?? record.pid) || (record.owner ?? record.pid) < 1 || !alive(record.owner ?? record.pid)) return;
    // A crashed Krita does not release its section's slot. The producer will
    // rewrite this as reserved; readers reflect that even before the rewrite.
    if (record.state === 'running' && (!Number.isSafeInteger(record.pid) || record.pid < 1 || !alive(record.pid))) return { ...record, state: 'reserved' } as KritaRecord;
    return record as KritaRecord;
  } catch { return; }
}
