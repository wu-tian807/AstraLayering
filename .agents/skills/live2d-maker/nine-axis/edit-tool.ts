import { createHash, randomUUID } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import sharp from 'sharp';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import { textResult, type FunctionTool } from '../shared/codex/function-tools.ts';
import { editNineAxis } from '../shared/nine-axis-edit.js';
import { nodes, lattice, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { compileHead, stepTexture, writeBuilt, type HeadInput, type FaceLeft, type Part } from './head.ts';
import { angleParameter, angleScale, type AngleScale } from './angles.ts';
import type { Box } from './turn.ts';
import { checkAxisSource } from './axis-groups.ts';

const hash = (s: string) => createHash('sha256').update(s).digest('hex');
// Artist-facing editing of the left/right step's actual authoring document.
// Importing layers creates identity meshes, never a prescribed anatomical rig.
export function createHeadEditTool(directory: string, input: HeadInput, box: Box, scale: AngleScale = angleScale(), taskRoot = dirname(dirname(directory)), neutralDirectory?: string): FunctionTool {
  return { ...toolDefinition('edit_nine_axis'), async execute(value, signal) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('参数须为对象');
    const args = value as { revision?: string; axis?: number; importParts?: Part[]; operations?: any[]; notes?: string };
    const path = join(directory, 'face-left.json'); let text = '', raw: FaceLeft;
    try { text = await readFile(path, 'utf8'); raw = JSON.parse(text); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; raw = { version: 2, axis: box.x + box.size / 2, deformers: [], parts: [] }; }
    if (args.revision !== undefined && args.revision !== hash(text)) throw Error('九轴数据已变化，请先读取最新 revision 再编辑');
    const { width = 0, height = 0 } = await sharp(input.color).metadata();
    let doc = { version: 2, kind: 'head-nine-axis', canvas: [width, height], axis: args.axis ?? raw.axis,
      parameters: [angleParameter('ParamAngleX', '角度 X', scale.x)], levels: [{ id: 'face', includes: ['face'] }],
      deformers: raw.deformers, parts: raw.parts.toReversed().map(p => ({ level: 'face', ...p })) } as HeadNineAxis & { axis: number };
    if (args.importParts) {
      if (raw.parts.length) throw Error('importParts 只用于首次导入；已有图层请直接编辑');
      if (!Array.isArray(args.importParts) || !args.importParts.length) throw Error('importParts 须为 KRA 从上到下排列的图层数组');
      doc.parts = args.importParts.toReversed().map(p => {
        const n = { ...p, level: 'face' as const, cols: p.cols ?? 4, rows: p.rows ?? 4 };
        const rest = lattice(n); const points = Array.from({ length: rest.length / 2 }, (_, i) => [rest[i * 2], rest[i * 2 + 1]]);
        return { ...n, keyforms: Object.fromEntries(scale.x.concat(0).map(k => [String(k), structuredClone(points)])) };
      });
    }
    const localTexture = (p: Part) => { p.texture = stepTexture(directory, taskRoot, p.id, p.texture); };
    for (const p of doc.parts) localTexture(p as Part);
    if (args.operations) {
      const operations = structuredClone(args.operations);
      if (Array.isArray(operations)) for (const op of operations) if (op?.action === 'add_part' && op.part) localTexture(op.part);
      doc = editNineAxis(doc, operations) as typeof doc;
    }
    const edited: FaceLeft = { version: 2, axis: doc.axis, notes: args.notes ?? raw.notes, deformers: doc.deformers,
      parts: doc.parts.toReversed() as Part[] };
    const built = !edited.parts.length && !args.importParts && !args.operations
      ? { doc, textures: new Map<string, string>() } : await compileHead(directory, input, box, edited, scale, taskRoot);
    if (neutralDirectory) await checkAxisSource(neutralDirectory, built);
    signal.throwIfAborted();
    if (args.operations || args.importParts || args.axis !== undefined || args.notes !== undefined) {
      // Validate and mirror in memory before replacing the author source.
      if (await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; }) !== text) throw Error('九轴数据在编辑期间变化，请重试');
      await mkdir(directory, { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(edited) + '\n'); await rename(temporary, path); text = await readFile(path, 'utf8');
    }
    if (built.doc.parts.length) await writeBuilt(directory, built);
    return textResult({ revision: hash(text), source: path, axis: doc.axis, nodes: nodes(built.doc as unknown as HeadNineAxis).map(n => ({
      id: n.id, name: n.name, kind: doc.deformers.some(p => p.id === n.id) ? 'warp' : 'part', parent: n.parent ?? null,
      bbox: n.bbox, cols: n.cols, rows: n.rows, keys: Object.keys(n.keyforms), interpolation: n.interpolation ?? 'linear', parameterInterpolation: n.parameterInterpolation,
    })) });
  } };
}
