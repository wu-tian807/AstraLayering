import { open, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { safePath } from '../shared/artifact-files.ts';
import { configHash } from '../shared/physics-evidence/store.ts';

type Request = { test: string; steps: number[]; modes: string[]; cropSteps?: number[]; components?: string[] };
type Renderer = (config: any, source: string, evidence: string, requests: Request[], signal?: AbortSignal) => Promise<any[]>;
type Dependencies = { render: Renderer; fingerprint: (source: string) => Promise<string>; simulationHash: () => Promise<string> };
const key = (frame: any) => JSON.stringify([frame.test, frame.step, frame.mode, frame.component ?? null]);
async function optional(path: string) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}

// Check dimensions and the complete PNG envelope without decoding thousands
// of unchanged images. Missing/truncated/resized files are captured again.
async function intact(evidence: string, frame: any, config: any, manifest: any) {
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(await safePath(evidence, frame.path), 'r');
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 45) return false;
    const header = Buffer.alloc(24), tail = Buffer.alloc(12);
    await handle.read(header, 0, header.length, 0);
    await handle.read(tail, 0, tail.length, stat.size - tail.length);
    if (!header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ||
        header.toString('ascii', 12, 16) !== 'IHDR' ||
        !tail.equals(Buffer.from('0000000049454e44ae426082', 'hex'))) return false;
    const width = header.readUInt32BE(16), height = header.readUInt32BE(20);
    const canvas = config.source.canvas, padding = manifest.framePadding ?? 0;
    const expected = frame.component ? frame.rect : { width: canvas.width + padding * 2, height: canvas.height + padding * 2 };
    return width > 0 && height > 0 && !!expected && width === expected.width && height === expected.height;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return false;
  } finally { await handle?.close(); }
}

export function createFrameRenderer(dependencies: Dependencies): Renderer {
  return async (config, source, evidence, requests, signal) => {
    signal?.throwIfAborted();
    // An unspecified component means a whole-frame request. Simulation already
    // supplies its six required crop times; explicit component requests retain
    // their original-size local crops at every requested step.
    const normalized = requests.map(request => ({ ...request,
      ...(!request.components && request.cropSteps === undefined ? { cropSteps: [] } : {}) }));
    const manifest = await optional(join(evidence, 'manifest.json'));
    if (!manifest || !['partial', 'completed'].includes(manifest.coverage?.render) || manifest.configHash !== configHash(config) ||
        manifest.simulationHash !== await dependencies.simulationHash() ||
        !manifest.renderDirectory || resolve(evidence, manifest.renderDirectory) !== resolve(source) ||
        manifest.renderHash !== await dependencies.fingerprint(source)) {
      return dependencies.render(config, source, evidence, normalized, signal);
    }
    const frames: any[] = await optional(join(evidence, 'frames.json')) ?? [];
    const indexed = new Map(frames.filter(frame => frame.configHash === manifest.configHash &&
      frame.renderHash === manifest.renderHash).map(frame => [key(frame), frame]));
    const wanted = new Map<string, any>();
    const rows: { test: string; step: number; mode: string; ids: string[] }[] = [];
    for (const request of normalized) {
      const run = manifest.runs.find((run: any) => run.test === request.test);
      if (!run) throw Error('未知证据测试');
      const steps = [...new Set(request.steps)].sort((a, b) => a - b);
      if (steps.length > 600 || steps.some(step => !Number.isInteger(step) || step < 0 || step > (run.durationSteps ?? 960))) throw Error('证据帧超出范围');
      if (request.modes.some(mode => !['color', 'lit', 'normal', 'depth'].includes(mode))) throw Error('无效渲染模式');
      for (const step of steps) for (const mode of request.modes) {
        const ids = config.components.filter((component: any) => component.enabled &&
          (!request.components || request.components.includes(component.id)) &&
          (!request.cropSteps || request.cropSteps.includes(step))).map((component: any) => component.id);
        const row = { test: request.test, step, mode, ids }; rows.push(row);
        wanted.set(key(row), row);
        for (const component of ids) { const crop = { ...row, component }; wanted.set(key(crop), crop); }
      }
    }
    const valid = new Map<string, any>(), entries = [...wanted.keys()]; let cursor = 0;
    await Promise.all(Array.from({ length: Math.min(16, entries.length) }, async () => {
      while (cursor < entries.length) {
        signal?.throwIfAborted();
        const id = entries[cursor++], frame = indexed.get(id);
        if (frame && await intact(evidence, frame, config, manifest)) valid.set(id, frame);
      }
    }));
    const missing = new Map<string, Request>();
    for (const row of rows) {
      const ids = row.ids.filter(component => !valid.has(key({ ...row, component })));
      if (valid.has(key(row)) && !ids.length) continue;
      const group = JSON.stringify([row.test, row.mode, ids]);
      let request = missing.get(group);
      if (!request) { request = { test: row.test, steps: [], modes: [row.mode], components: ids }; missing.set(group, request); }
      request.steps.push(row.step);
    }
    if (missing.size) {
      const generated = await dependencies.render(config, source, evidence, [...missing.values()], signal);
      for (const frame of generated) valid.set(key(frame), frame);
    }
    return [...wanted.keys()].map(id => {
      const frame = valid.get(id);
      if (!frame) throw Error('渲染缺少请求的当前帧：' + id);
      return frame;
    });
  };
}
