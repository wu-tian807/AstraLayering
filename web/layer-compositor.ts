import { mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import type { IncomingMessage } from "node:http";
import { unzipSync } from "fflate";
import { readPsd, type Layer } from "ag-psd";
import { atomicJSON } from "./files.ts";
import { parseXml } from "../.agents/skills/live2d-maker/shared/xml.ts";
import { SectionKrita } from "../.agents/skills/live2d-maker/shared/krita/section-krita.ts";

const layersPlugin = fileURLToPath(new URL("./krita/astra_layers.py", import.meta.url));

type Session = {
  directory: string;
  revision: number;
  touched: number;
  pixels: number;
  metadata?: any;
};
export function validateDocument(bytes: Uint8Array, extension: string) {
  let width: number, height: number;
  if (extension === "psd") {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      bytes.length < 26 ||
      Buffer.from(bytes.subarray(0, 4)).toString() !== "8BPS" ||
      v.getUint16(4) !== 1 ||
      v.getUint16(22) !== 8 ||
      ![1, 3].includes(v.getUint16(24))
    )
      throw Error("请选择 8 位 RGB／灰度 PSD");
    width = v.getUint32(18);
    height = v.getUint32(14);
  } else if (extension === "kra") {
    const files = unzipSync(bytes, {
      filter: (f) => {
        const selected = f.name === "maindoc.xml" || f.name.endsWith(".svg");
        if (selected && f.originalSize > 8_000_000) throw Error("图层描述过大");
        return selected;
      },
    });
    const xml =
      files["maindoc.xml"] && new TextDecoder().decode(files["maindoc.xml"]);
    if (!xml) throw Error("KRA 缺少图层目录");
    const document = parseXml(xml);
    if (Array.from(document.getElementsByTagName('*')).some(node => node.getAttribute('nodetype')?.toLowerCase() === 'filelayer'))
      throw Error("文件图层请先在 Krita 中转为绘画层，再打开");
    for (const [name, value] of Object.entries(files))
      if (name.endsWith(".svg")) {
        const svg = new TextDecoder().decode(value);
        if (
          /(?:href\s*=\s*["'](?!(?:data:|#))|url\(\s*["']?(?:file:|https?:|\/))/i.test(
            svg,
          )
        )
          throw Error("请先嵌入矢量图层的外部资源");
      }
    const image = document.getElementsByTagName('IMAGE')[0];
    width = Number(image?.getAttribute('width'));
    height = Number(image?.getAttribute('height'));
  } else throw Error("请选择 KRA 或 PSD");
  if (!width || !height || width * height > 64_000_000)
    throw Error("画布超过 6400 万像素，未缩小原图");
  return width * height;
}
// PSD clipping flags are not imported by Krita 5.x. Read only the layer
// structure (never decode raster channels here); the native bridge converts
// each consecutive clipping chain into an isolated alpha-inheritance group.
export function psdStructure(bytes: Uint8Array) {
  const doc = readPsd(bytes, {
    skipLayerImageData: true,
    skipCompositeImageData: true,
    skipThumbnail: true,
    skipLinkedFilesData: true,
    useImageData: true,
  });
  let count = 0;
  function walk(items: Layer[], depth = 0): any[] {
    if (depth > 100) throw Error("PSD 图层嵌套过深");
    return items.map((l) => {
      if (++count > 10000) throw Error("PSD 图层过多");
      return {
        name: l.name || "",
        group: !!l.children,
        clipping: !!l.clipping,
        visible: !l.hidden,
        opacity: Math.round((l.opacity ?? 1) * 255),
        maskDisabled: l.mask ? !!l.mask.disabled : null,
        children: l.children ? walk(l.children, depth + 1) : [],
      };
    });
  }
  return walk(doc.children || []);
}
export class LayerCompositor {
  private sessions = new Map<string, Session>();
  private root = "";
  private instance?: SectionKrita;
  private serial: Promise<unknown> = Promise.resolve();
  private readonly closing = new AbortController();
  private timer = setInterval(() => {
    void this.exclusive(() => this.expire()).catch((error) =>
      console.error("Layer session cleanup:", error.message),
    );
  }, 60_000).unref();
  private readonly executable: () => string | undefined;
  constructor(executable: () => string | undefined) {
    this.executable = executable;
  }
  get available() { return !!this.executable(); }
  private exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serial.then(operation);
    this.serial = result.catch(() => {});
    return result;
  }
  private async start(signal: AbortSignal) {
    if (this.closing.signal.aborted) throw Error("图层服务已关闭");
    if (this.instance?.bridge) return;
    const krita = this.executable();
    if (!krita) throw Error("请先在全局设置中选择 Krita");
    const instance = new SectionKrita({
      section: "studio-layers",
      krita,
      plugin: { module: "astra_layers", source: layersPlugin },
    });
    this.instance = instance;
    const startup = AbortSignal.any([signal, this.closing.signal]);
    await instance.reserve(startup);
    const { bridge } = await instance.start(startup);
    if (!bridge) throw Error("Krita 图层合成器已退出");
    this.root = bridge;
    await mkdir(join(bridge, "docs"), { mode: 0o700 });
  }
  private async command(value: Record<string, unknown>) {
    if (!this.instance?.bridge) {
      await this.stopNative();
      throw Error("图层合成器已退出，请重新打开文件");
    }
    const id = randomUUID();
    await rm(join(this.root, "response.json"), { force: true });
    await atomicJSON(join(this.root, "request.json"), { ...value, id });
    for (let i = 0; i < 1200; i++) {
      if (this.closing.signal.aborted || !this.instance?.bridge) {
        await this.stopNative();
        throw Error("图层合成器已退出，请重新打开文件");
      }
      try {
        const result = JSON.parse(
          await readFile(join(this.root, "response.json"), "utf8"),
        );
        if (result.id === id) {
          if (!result.ok) throw Error(result.error);
          return result.value;
        }
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      await delay(75);
    }
    // A timeout cannot let a late response mutate the next request.
    await this.stopNative();
    throw Error("图层合成超时，请重新打开文件");
  }
  private session(token: string) {
    const value = this.sessions.get(token);
    if (!value) throw Error("图层会话已结束，请重新打开文件");
    value.touched = Date.now();
    return value;
  }
  private async expire() {
    for (const [key, value] of this.sessions)
      if (Date.now() - value.touched > 30 * 60_000)
        await this.closeSession(key);
  }
  async create(request: IncomingMessage, extension: string, signal: AbortSignal) {
    // Reserve capacity before buffering an upload; no discarded full-size decode.
    return this.exclusive(async () => {
      if (this.instance && !this.instance.bridge) await this.stopNative();
      await this.expire();
      if (!this.available) throw Error("请先在全局设置中选择 Krita");
      if (this.sessions.size >= 4)
        throw Error("打开的文件过多，请先关闭其他文件");
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 512 * 1024 * 1024) throw Error("文件超过 512 MB");
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks),
        pixels = validateDocument(bytes, extension);
      if (
        [...this.sessions.values()].reduce((n, s) => n + s.pixels, pixels) >
        64_000_000
      )
        throw Error("已打开的画布总量过大，请先关闭其他文件");
      const token = randomBytes(24).toString("hex");
      let directory: string | undefined;
      try {
        await this.start(signal);
        directory = join(this.root, "docs", token);
        await mkdir(directory, { mode: 0o700 });
        const input = join(directory, "source." + extension);
        await writeFile(input, bytes, { mode: 0o600 });
        const metadata = await this.command({
          op: "open",
          session: token,
          input,
          psd: extension === "psd" ? psdStructure(bytes) : null,
          output: join(directory, "frame-0.png"),
        });
        this.sessions.set(token, {
          directory,
          pixels,
          revision: 0,
          touched: Date.now(),
          metadata,
        });
        return { session: token, revision: 0, ...metadata };
      } catch (e) {
        if (this.sessions.size === 0) await this.stopNative();
        else if (directory) await rm(directory, { recursive: true, force: true });
        throw e;
      }
    });
  }
  async edit(value: any) {
    return this.exclusive(async () => {
      const session = this.session(value.session);
      if (value.revision !== session.revision)
        throw Error("图层版本已改变，请重新打开文件");
      if (!Array.isArray(value.state) || value.state.length > 10_000)
        throw Error("无效的图层状态");
      const revision = session.revision + 1;
      const metadata = await this.command({
        op: "compose",
        session: value.session,
        state: value.state,
        output: join(session.directory, `frame-${revision}.png`),
      });
      session.revision = revision;
      session.metadata = metadata;
      if (revision > 1)
        await rm(join(session.directory, `frame-${revision - 2}.png`), {
          force: true,
        });
      return { session: value.session, revision, ...metadata };
    });
  }
  async asset(token: string, revision: number, kind: string) {
    const session = this.session(token);
    if (kind === "kra") return join(session.directory, "edited.kra");
    if (
      !Number.isSafeInteger(revision) ||
      revision < session.revision - 1 ||
      revision > session.revision ||
      revision < 0
    )
      throw Error("此合成预览已过期");
    return join(session.directory, `frame-${revision}.png`);
  }
  async surfaces(value: any) {
    return this.exclusive(async () => {
      const session = this.session(value.session);
      if (value.revision !== session.revision)
        throw Error("请等待当前图层更新完成后准备部件贴图");
      const directory = join(session.directory, `surfaces-${session.revision}`);
      const packet = await this.command({ op: "surfaces", session: value.session, output: directory });
      return { ...packet, session: value.session, revision: session.revision };
    });
  }
  async surfaceAsset(token: string, revision: number, file: string) {
    const session = this.session(token);
    if (revision !== session.revision || !Number.isSafeInteger(revision) || !/^part-\d+-(original|masked)\.png$/.test(file))
      throw Error("部件快照已过期，请重新准备");
    return join(session.directory, `surfaces-${revision}`, file);
  }
  async export(value: any) {
    return this.exclusive(async () => {
      const session = this.session(value.session);
      if (value.revision !== session.revision)
        throw Error("请等待图层更新完成");
      await this.command({
        op: "export",
        session: value.session,
        output: join(session.directory, "edited.kra"),
      });
      return { session: value.session, saved: true };
    });
  }
  private async closeSession(token: string) {
    const session = this.sessions.get(token);
    if (!session) return;
    try {
      await this.command({ op: "close", session: token });
    } finally {
      this.sessions.delete(token);
      if (this.sessions.size === 0) await this.stopNative();
      else await rm(session.directory, { recursive: true, force: true });
    }
  }
  closeDocument(token: string) {
    return this.exclusive(async () => {
      await this.closeSession(token);
      return { closed: true };
    });
  }
  private async stopNative() {
    const instance = this.instance;
    this.instance = undefined;
    this.root = "";
    this.sessions.clear();
    await instance?.release();
  }
  private disposal?: Promise<void>;
  dispose() {
    this.closing.abort(Error("图层服务已关闭"));
    clearInterval(this.timer);
    return (this.disposal ??= this.serial.then(() => this.stopNative()));
  }
}
