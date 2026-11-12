import { dirname, join, relative } from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { SectionKrita } from '../.agents/skills/live2d-maker/shared/krita/section-krita.ts';
import { KraMaterials, nativeMaterialExport } from '../.agents/skills/live2d-maker/nine-axis/kra-materials.ts';
import { modelDocument, modelVersion } from '../.agents/skills/live2d-maker/nine-axis/source.ts';
import type { MaterialBuilt } from '../.agents/skills/live2d-maker/nine-axis/kra-materials.ts';
import { validateHeadNineAxis } from '../.agents/skills/live2d-maker/shared/nine-axis-model.js';
import { nineAxisDeformerPaths } from '../.agents/skills/live2d-maker/shared/nine-axis.ts';
import { isStudioPath } from './studio-project.ts';
import { safePath, webFilePath } from './files.ts';

/** Same exporter as the maker tools, with short-lived private Krita ownership.
 * Saved content hashes make repeated requests pure cache reads. */
export class NineAxisMaterials {
  private instances = new Set<SectionKrita>();
  private queue: Promise<unknown> = Promise.resolve();
  private snapshots = new Map<string, { root: string; built: MaterialBuilt }>();
  private resolvers = new Map<string, KraMaterials>();
  private closed = false;
  private executable: (root: string) => Promise<string>;
  constructor(executable: (root: string) => Promise<string>) { this.executable = executable; }
  async get(root: string, path: string) {
    if (this.closed) throw Error('九轴预览已关闭');
    if (!nineAxisDeformerPaths.has(path)) throw Error('只能预览已知的九轴模型');
    const modelPath = await safePath(root, path), directory = dirname(modelPath);
    const text = await readFile(modelPath, 'utf8'), doc = validateHeadNineAxis(JSON.parse(text));
    const document = await modelDocument(root, directory, doc);
    if (!document) throw Error('九轴模型缺少 KRA 来源');
    const sourcePath = webFilePath(relative(root, document));
    if (!isStudioPath(sourcePath) || !sourcePath.endsWith('.kra')) throw Error('九轴来源必须是任务内已知的 KRA 工程');
    await safePath(root, sourcePath);
    const info = await stat(modelPath), version = await modelVersion(root, directory, doc, `${info.mtimeMs}:${info.size}`);
    let exporter = this.resolvers.get(root);
    if (!exporter) { exporter = new KraMaterials(async (...args) => {
      // The material cache is checked before acquiring a Krita slot. Serialize
      // exports so concurrent tabs never launch competing private processes.
      const operation = this.queue.catch(() => {}).then(async () => {
        const executable = await this.executable(root);
        if (this.closed) throw Error('九轴预览已关闭');
        const instance = new SectionKrita({ section: join(root, '.cache/nine-axis-preview'), krita: executable });
        this.instances.add(instance);
        try { return await nativeMaterialExport(async () => instance)(...args); }
        finally { await instance.release(); this.instances.delete(instance); }
      });
      this.queue = operation; return operation;
    }); this.resolvers.set(root,exporter); }
    const built = await exporter.resolve(root, directory, { doc, textures: new Map() });
    if (await readFile(modelPath, 'utf8') !== text) throw Error('九轴模型在读取期间变化，请刷新');
    const after = await stat(modelPath);
    if (await modelVersion(root, directory, doc, `${after.mtimeMs}:${after.size}`) !== version) throw Error('KRA 或模型在预览期间变化，请刷新');
    const key = createHash('sha256').update(root + path + text + built.sourceRevision).digest('hex');
    this.snapshots.set(key, { root, built });
    while (this.snapshots.size > 16) this.snapshots.delete(this.snapshots.keys().next().value!);
    return { ...built, key, author: doc, version };
  }
  texture(root: string, key: string, index: number) {
    const snapshot = this.snapshots.get(key);
    if (!snapshot || snapshot.root !== root || !Number.isSafeInteger(index) || index < 0) throw Error('九轴预览版本已失效，请刷新');
    const part = snapshot.built.doc.parts[index];
    if (!part) throw Error('九轴贴图索引无效');
    return snapshot.built.textures.get(part.texture)!;
  }
  async dispose() { this.closed = true; await Promise.allSettled([...this.instances].map(instance => instance.release())); }
}
