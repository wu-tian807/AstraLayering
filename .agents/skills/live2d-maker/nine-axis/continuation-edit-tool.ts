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
import { checkOwnedEdit, nodeOwners, ownsNode, previewAvailability, type OwnershipScope } from './ownership.ts';
import { isHeadPitchStage } from './head-pitch.ts';
import { headCornerControlIds, headCornerPoses } from './head-corners.ts';

export type EditScope = OwnershipScope;
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
    const catalog=materialize?await kraCatalog(taskRoot, doc):undefined;
    if (materialize) doc = kraReferences(await bindKraDocument(taskRoot, doc)) as AuthoredHead;
    const before = structuredClone(doc);
    const cornerControls = stage === 'head-xy' ? headCornerControlIds(upstream.doc, doc) : undefined;
    if (args.operations) {
      const operations = structuredClone(args.operations);
      if (Array.isArray(operations)) for (const op of operations) {
        if (isHeadPitchStage(stage) && !['points', 'drag', 'transform'].includes(op?.action)) throw Error('本阶段已准备头部承载，请编辑节点的本方向关键形');
        if (cornerControls && (!['points', 'drag', 'transform'].includes(op?.action) || !cornerControls.has(op?.id))) throw Error('请编辑程序准备的斜角修正承载');
        if (['points','drag','transform'].includes(op?.action)) {
          const x = op.x ?? 0, y = op.y ?? 0;
          if (isHeadPitchStage(stage) && (x !== 0 || !Number.isFinite(y) || (stage === 'head-up' ? y <= 0 || y > scale.y[1] : y >= 0 || y < scale.y[0]))) throw Error('头部上下只编辑 X=0 的本方向 Y 关键形及中间姿态');
          if (cornerControls && (!Number.isFinite(x) || !Number.isFinite(y) || !x || !y || x < scale.x[0] || x > scale.x[1] || y < scale.y[0] || y > scale.y[1])) throw Error('完整头部斜角只编辑四角及中间组合，保留单轴');
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
        const part = doc.parts.find(p => p.id === binding.id);
        if (!part || (!!binding.uuid === (binding.material === 'transparent'))) throw Error('binding 需要现有部件 id 和 uuid，或 material=transparent');
        if (binding.uuid) { part.uuid = binding.uuid.replace(/[{}]/g, '').toLowerCase(); delete part.material; }
        else { part.material = 'transparent'; delete part.uuid; }
      }
    }
    if (args.notes !== undefined) doc.notes = args.notes;
    if(materialize)doc=kraReferences(await bindKraDocument(taskRoot, doc)) as AuthoredHead;
    if(scope && (args.operations || args.bindings)) checkOwnedEdit(before,doc,scope);
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
    return textResult({ revision: sha256(text), source: path, document: built.doc.source?.document, stage,
      ...(isHeadPitchStage(stage)?{operations:['points','drag','transform'],editableAxis:'Y',editableRange:stage==='head-up'?[0,scale.y[1]]:[scale.y[0],0]}:{}),
      ...(cornerControls?{operations:['points','drag','transform'],editableAxis:'XY',corners:headCornerPoses(scale)}:{}),
      ...(catalog&&!args.operations&&!args.bindings?{materials:catalog}:{}), nodes: nodes(built.doc as unknown as HeadNineAxis).map(n => ({
      id:n.id, kind:doc.deformers.some(p=>p.id===n.id)?'warp':'part', parent:n.parent??null, mirror:n.mirror??null,
      bbox:n.bbox, cols:n.cols, rows:n.rows, ...(scope?{owners:[...nodeOwners(built.doc,n)],editable:cornerControls?cornerControls.has(n.id):ownsNode(built.doc,n,scope),...(scope.includes?{preview:previewAvailability(built.doc,n,scope.includes)}:{})}:{}), ...('textureBounds' in n?{textureBounds:n.textureBounds,drawOrder:built.doc.parts.findIndex(p=>p.id===n.id)}:{}), keys:Object.keys(n.keyforms), keysY:Object.keys(n.keyformsY??{}), keysXY:Object.keys(n.keyformsXY??{}),
      ...built.doc.parts.filter(p => p.id === n.id).map(p => ({ uuid: p.uuid, partId: p.partId, material: p.material, ...(p.shadow?{shadow:p.shadow}:{}) }))[0],
    })) });
  } };
}
