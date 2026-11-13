import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { toolDefinition } from '../shared/codex/tool-config.ts';
import { textResult, type FunctionTool } from '../shared/codex/function-tools.ts';
import { editNineAxis } from '../shared/nine-axis-edit.js';
import { nodes, kraReferences, type HeadNineAxis } from '../shared/nine-axis-model.js';
import { stepTexture, writeBuilt } from './head.ts';
import { angleScale, type AngleScale } from './angles.ts';
import { readUpstream, startContinuation, compileContinuation, authorFile, sha256, type AuthoredHead, type Stage } from './continuation.ts';
import { checkAxisSource } from './axis-groups.ts';
import { bindKraDocument, kraCatalog, type MaterialLoader } from './kra-materials.ts';

export type EditScope = { label: string; allows: (id: string) => boolean; allowsParent?:(id:string)=>boolean };
export function createContinuationEditTool(directory: string, upstreamDirectory: string, stage: Stage, scale: AngleScale = angleScale(), taskRoot = dirname(dirname(directory)), materialize?: MaterialLoader, scope?: EditScope): FunctionTool {
  return { ...toolDefinition('edit_nine_axis'), async execute(value, signal) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('参数须为对象');
    const args = value as { operations?: any[]; revision?: string; notes?: string; axis?: unknown; importParts?: unknown; bindings?: { id: string; uuid?: string; material?: 'transparent' }[] };
    if (args.axis !== undefined || args.importParts !== undefined) throw Error('后续阶段从上游导入；不能重导入图层或更换中轴');
    const upstream = await readUpstream(upstreamDirectory), path = join(directory, authorFile(stage));
    let text = '', doc: AuthoredHead;
    try { text = await readFile(path, 'utf8'); doc = JSON.parse(text); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; doc = startContinuation(upstream.doc, stage, scale); }
    if (args.revision !== undefined && args.revision !== sha256(text)) throw Error('九轴数据已变化，请读取最新 revision');
    if (args.bindings !== undefined && stage !== 'jaw' && stage !== 'hair' && stage !== 'accessories') throw Error('本阶段使用固定 KRA 导出素材，不能更换图层绑定');
    const catalog=materialize?await kraCatalog(taskRoot,directory,doc):undefined;
    if (args.operations) {
      const operations = structuredClone(args.operations);
      if (Array.isArray(operations)) for (const op of operations) {
        if (scope) {
          const ids = [op.id,op.part?.id,...op.targets ?? []].filter((id): id is string => typeof id === 'string');
          if (ids.some(id=>!scope.allows(id))) throw Error(`${scope.label}：只能编辑当前轮次的部件和 Warp`);
          // Attaching a new part to an existing carrier does not edit that
          // parent's geometry. The caller may expose those read-only mounts.
          if(typeof op.parent==='string'&&!scope.allows(op.parent)&&!scope.allowsParent?.(op.parent))throw Error(`${scope.label}：只能编辑当前轮次的部件和 Warp`);
        }
        if (['points','drag','transform'].includes(op?.action)) {
          const x = op.x ?? 0, y = op.y ?? 0;
          if (stage === 'hair' && y !== 0) throw Error('头发步骤只制作 left/right，编辑必须使用 Y=0');
          if (stage === 'accessories' && y !== 0) throw Error('头部饰品步骤只制作 left/right，编辑必须使用 Y=0');
          if ((stage === 'up' || stage === 'down') && (x !== 0 || y !== (stage === 'up' ? scale.y[1] : scale.y[0]))) throw Error(`${stage} 阶段只编辑 X=0、Y=${stage === 'up' ? scale.y[1] : scale.y[0]} 的关键形`);
          if (stage === 'xy' && (x !== scale.x[0] || !scale.y.includes(y))) throw Error('四角阶段只编辑左上、左下；右侧由组合形变镜像');
        }
        if (op?.action === 'add_part' && op.part) {
          if(op.part.texture&&!op.part.uuid&&op.part.material!=='transparent')op.part.texture=stepTexture(directory,taskRoot,op.part.id,op.part.texture);
          if(op.part.shadow&&catalog){
            const layer=catalog.layers.find(layer=>layer.uuid===op.part.uuid?.replace(/[{}]/g,'').toLowerCase());
            if(!layer)throw Error('绑定的 KRA 图层不存在');
            op.part.shadow={...op.part.shadow,blendMode:layer.blendMode,opacity:layer.opacity};
          }
        }
      }
      doc = editNineAxis(doc, operations) as AuthoredHead;
    }
    if (args.bindings !== undefined) {
      if (!Array.isArray(args.bindings)) throw Error('bindings 须为图层绑定数组');
      for (const binding of args.bindings) {
        if(scope && !scope.allows(binding.id)) throw Error(`${scope.label}：只能绑定当前轮次的图层`);
        if (stage === 'hair' && !/^hair(?:\/|$)/.test(binding.id)) throw Error('头发阶段只能更换 hair/ 的图层绑定');
        if (stage === 'accessories' && !/^head_accessories(?:\/|::|$)/.test(binding.id)) throw Error('头部饰品阶段只能更换 head_accessories/ 的图层绑定');
        const part = doc.parts.find(p => p.id === binding.id);
        if (!part || (!!binding.uuid === (binding.material === 'transparent'))) throw Error('binding 需要现有部件 id 和 uuid，或 material=transparent');
        if (binding.uuid) { part.uuid = binding.uuid.replace(/[{}]/g, '').toLowerCase(); delete part.material; }
        else { part.material = 'transparent'; delete part.uuid; }
      }
    }
    if (args.notes !== undefined) doc.notes = args.notes;
    if(materialize)doc=kraReferences(await bindKraDocument(taskRoot,directory,doc)) as AuthoredHead;
    const built = await compileContinuation(directory, upstreamDirectory, doc, stage, scale, undefined, signal);
    doc.source = built.doc.source;
    for (const part of doc.parts) {
      const bound = built.doc.parts.find(p => p.id === part.id)!;
      if (bound.uuid) part.uuid = bound.uuid;
      if (bound.material) part.material = bound.material;
      if (bound.shadow) part.shadow = bound.shadow;
    }
    if (stage === 'up' || stage === 'down') await checkAxisSource(upstreamDirectory, built);
    signal.throwIfAborted();
    if (!text || args.operations || args.bindings || args.notes !== undefined || JSON.stringify(JSON.parse(text).source) !== JSON.stringify(doc.source)) {
      const current = await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
      if (current !== text) throw Error('九轴数据在编辑期间变化，请重试');
      await mkdir(directory, { recursive: true }); const temporary = `${path}.${randomUUID()}.tmp`;
      text = JSON.stringify(kraReferences(doc)) + '\n'; await writeFile(temporary, text); await rename(temporary, path);
    }
    await writeBuilt(directory, built);
    return textResult({ revision: sha256(text), source: path, document: built.doc.source?.document, stage, ...(catalog&&!args.operations&&!args.bindings?{materials:catalog}:{}), nodes: nodes(built.doc as unknown as HeadNineAxis).map(n => ({
      id:n.id, kind:doc.deformers.some(p=>p.id===n.id)?'warp':'part', parent:n.parent??null, mirror:n.mirror??null,
      bbox:n.bbox, cols:n.cols, rows:n.rows, ...('textureBounds' in n?{textureBounds:n.textureBounds,drawOrder:built.doc.parts.findIndex(p=>p.id===n.id)}:{}), keys:Object.keys(n.keyforms), keysY:Object.keys(n.keyformsY??{}), keysXY:Object.keys(n.keyformsXY??{}),
      ...built.doc.parts.filter(p => p.id === n.id).map(p => ({ uuid: p.uuid, material: p.material, ...(p.shadow?{shadow:p.shadow}:{}) }))[0],
    })) });
  } };
}
