import { readFile, stat } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import { renderContentThumbnail } from './svg-thumbnail.ts';

// Krita writes its actual saved projection into the KRA. No model call,
// document mutation, or another Krita process is needed for this preview.
export class KRAPreviews {
  private cache = new Map<string, { version: string; png: Buffer; thumbnail?: Promise<Buffer> }>();
  private pending = new Map<string, Promise<Buffer>>();
  async get(file: string, version: string, content = false): Promise<Buffer> {
    if (content) {
      const png = await this.get(file, version), cached = this.cache.get(file);
      if (cached?.version === version) return cached.thumbnail ??= renderContentThumbnail(png);
      return renderContentThumbnail(png);
    }
    const cached = this.cache.get(file);
    if (cached?.version === version) return cached.png;
    const key = file + ':' + version;
    if (this.pending.has(key)) return this.pending.get(key)!;
    const request = (async () => {
      const before = await stat(file), bytes = await readFile(file);
      const archive = unzipSync(bytes, { filter: entry => {
        if (entry.name !== 'mergedimage.png') return false;
        if (entry.originalSize > 64_000_000) throw new Error('KRA 合成预览过大');
        return true;
      } });
      if (!archive['mergedimage.png']) throw new Error('KRA 尚未保存有效的合成预览');
      const png = await sharp(archive['mergedimage.png'], { limitInputPixels: 32_000_000 }).png().toBuffer();
      const after = await stat(file);
      if (before.mtimeMs !== after.mtimeMs || before.size !== after.size) throw new Error('KRA 正在保存，请稍后刷新');
      this.cache.delete(file); this.cache.set(file, { version, png });
      // Cached projections can be large; bound memory as well as entry count.
      let size = [...this.cache.values()].reduce((n, entry) => n + entry.png.length, 0);
      while (this.cache.size > 16 || size > 64_000_000) {
        const first = this.cache.keys().next().value!;
        size -= this.cache.get(first)!.png.length; this.cache.delete(first);
      }
      return png;
    })();
    this.pending.set(key, request);
    try { return await request; } finally { this.pending.delete(key); }
  }
}
