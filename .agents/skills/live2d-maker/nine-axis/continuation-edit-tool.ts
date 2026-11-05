import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import { textResult, type FunctionTool } from '../shared/codex/function-tools.ts';
import { editNineAxis } from '../shared/nine-axis-edit.js';
import { nodes, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { stepTexture } from './head.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { readUpstream, startContinuation, compileContinuation, authorFile, sha256, type AuthoredHead, type Stage } from './continuation.ts';
import { checkAxisSource } from './axis-groups.ts';

export function createContinuationEditTool(directory: string, upstreamDirectory: string, stage: Stage, scale: AngleScale = angleScale(), taskRoot = dirname(dirname(directory))): FunctionTool {
  return { ...toolDefinition('edit_nine_axis'), async execute(value, signal) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('参数须为对象');
    const args = value as { operations?: any[]; revision?: string; notes?: string; axis?: unknown; importParts?: unknown };
    if (args.axis !== undefined || args.importParts !== undefined) throw Error('后续阶段从上游导入；不能重导入图层或更换中轴');
    const upstream = await readUpstream(upstreamDirectory), path = join(directory, authorFile(stage));
    let text = '', doc: AuthoredHead;
    try { text = await readFile(path, 'utf8'); doc = JSON.parse(text); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; doc = startContinuation(upstream.doc, upstream.hash, stage, scale); }
    if (args.revision !== undefined && args.revision !== sha256(text)) throw Error('九轴数据已变化，请读取最新 revision');
    if (args.operations) {
      const operations = structuredClone(args.operations);
      if (Array.isArray(operations)) for (const op of operations) {
        if (['points','drag','transform'].includes(op?.action)) {
          const x = op.x ?? 0, y = op.y ?? 0;
          if ((stage === 'up' || stage === 'down') && (x !== 0 || y !== (stage === 'up' ? scale.y[1] : scale.y[0]))) throw Error(`${stage} 阶段只编辑 X=0、Y=${stage === 'up' ? scale.y[1] : scale.y[0]} 的关键形`);
          if (stage === 'xy' && (x !== scale.x[0] || !scale.y.includes(y))) throw Error('四角阶段只编辑左上、左下；右侧由组合形变镜像');
        }
        if (op?.action === 'add_part' && op.part) op.part.texture = stepTexture(directory, taskRoot, op.part.id, op.part.texture);
      }
      doc = editNineAxis(doc, operations) as AuthoredHead;
    }
    if (args.notes !== undefined) doc.notes = args.notes;
    const built = await compileContinuation(directory, upstreamDirectory, doc, stage, scale);
    if (stage === 'up' || stage === 'down') await checkAxisSource(upstreamDirectory, built);
    signal.throwIfAborted();
    if (!text || args.operations || args.notes !== undefined) {
      const current = await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
      if (current !== text) throw Error('九轴数据在编辑期间变化，请重试');
      await mkdir(directory, { recursive: true }); const temporary = `${path}.${randomUUID()}.tmp`;
      text = JSON.stringify(doc) + '\n'; await writeFile(temporary, text); await rename(temporary, path);
    }
    return textResult({ revision: sha256(text), source: path, stage, nodes: nodes(built.doc as unknown as HeadNineAxis).map(n => ({
      id:n.id, kind:doc.deformers.some(p=>p.id===n.id)?'warp':'part', parent:n.parent??null, mirror:n.mirror??null,
      bbox:n.bbox, cols:n.cols, rows:n.rows, keys:Object.keys(n.keyforms), keysY:Object.keys(n.keyformsY??{}), keysXY:Object.keys(n.keyformsXY??{}),
    })) });
  } };
}
