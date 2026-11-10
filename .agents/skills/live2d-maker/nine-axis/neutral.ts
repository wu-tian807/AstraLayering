import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { submitJob, type BridgeResult } from '../shared/krita/bridge/client.mjs';
import type { SectionKrita } from '../shared/krita/section-krita.ts';
import { checkWarpGeometry, lattice, validateHeadNineAxis, type HeadDeformer, type HeadNineAxis, type Point } from '../shared/nine-axis-model.js';
import { fromTaskPath, toTaskPath } from '../shared/task-paths.ts';
import { angleParameter, angleScale, type AngleScale } from './angles.ts';
import { faceLevel, writeBuilt, type Built, type HeadInput } from './head.ts';
import type { Box } from './turn.ts';
import { headMaterialSelection } from './materials.ts';

type Bounds = [number, number, number, number];
export type NeutralLayer = {
  id: string; group: string; texture: string; textureBounds: Bounds; bbox: Bounds;
  uuid: string; layerName: string; nodeType: string; parentUuid: string;
  order: number; stackPath: number[]; visible: boolean; layerOpacity: number; blendingMode: string;
  scope?: 'face' | 'hair' | 'accessory'; partId?: string; materialRole?: 'shadow'; casterPartId?: string; receiverPartIds?: string[]; receiverLayerUuids?: string[]; follow?: string;
};
export type NeutralManifest = {
  version: 1; sourceKra: string; sourceColor: string;
  canvas: [number, number]; method: string; order: 'top-to-bottom'; parts: NeutralLayer[]; referenceLayers: NeutralLayer[];
  shadowLayers?: NeutralLayer[];
  preview: { texture: string; textureBounds: Bounds };
};
export type NeutralPart = Omit<HeadDeformer, 'keyforms' | 'keyformsY'> & NeutralLayer & {
  keyforms: Record<string, Point[]>; keyformsY: Record<string, Point[]>;
};
export type NeutralDocument = Omit<HeadNineAxis, 'parts' | 'source'> & {
  axis: number; canvas: [number, number]; parts: NeutralPart[];
  source: { document: string };
};
export type NeutralBuilt = Omit<Built, 'doc'> & {
  doc: NeutralDocument; directory: string; path: string; manifestPath: string; exportRecordPath: string; sourcePath: string;
  preview: string; manifest: NeutralManifest; source: Record<string, string>;
};

// Selection follows the existing part/UUID relationships. Base projections
// retain their own masks; independent shadows are exported before receiver clipping.
function exportScript(document: string, directory: string, materialSelection: Awaited<ReturnType<typeof headMaterialSelection>>): string {
  return `from krita import Krita
from PyQt5.QtGui import QImage
import os, json, re
config = json.loads(${JSON.stringify(JSON.stringify({ document, directory, ...materialSelection }))})
doc = Krita.instance().openDocument(config['document'])
if doc is None:
    raise RuntimeError('Cannot open source KRA: ' + config['document'])
try:
    doc.setBatchmode(True)
    doc.waitForDone()
    if doc.rootNode() is None or doc.colorModel() != 'RGBA' or doc.colorDepth() != 'U8':
        raise RuntimeError('Source KRA must have an RGBA/U8 projection')
    parts, references, shadows, nodes, original = [], [], [], {}, {}
    def collect(parent, path):
        for index, node in enumerate(reversed(parent.childNodes())):
            key = node.uniqueId().toString().strip('{}').lower()
            nodes[key] = (node, parent, path + [index])
            original[key] = node.visible()
            collect(node, path + [index])
    collect(doc.rootNode(), [])
    for key in config['shadowLayerUuids']:
        if key in nodes:
            nodes[key][0].setVisible(False)
    doc.refreshProjection()
    doc.waitForDone()
    seen = set()
    selections = {row['uuid']: row for row in config['selections']}
    for folder in ('layers', 'reference-layers', 'shadow-layers'):
        os.makedirs(os.path.join(config['directory'], folder), exist_ok=True)
    for key, entry in nodes.items():
        if key not in selections:
            continue
        row = selections[key]
        node, parent, stack = entry
        b = node.bounds()
        x, y, w, h = b.x(), b.y(), b.width(), b.height()
        if w <= 0 or h <= 0:
            continue
        is_shadow = row.get('role') == 'shadow'
        raw = node.pixelData(x, y, w, h) if is_shadow else node.projectionPixelData(x, y, w, h)
        if len(raw) != w * h * 4:
            raise RuntimeError('Invalid RGBA/U8 pixels: ' + row['id'])
        image = QImage(raw, w, h, QImage.Format_ARGB32).copy()
        order = len(parts) + len(references) + len(shadows)
        name = row['id']
        if not is_shadow and name in seen:
            raise RuntimeError('Duplicate semantic id: ' + name)
        if not is_shadow:
            seen.add(name)
        filename = str(order).zfill(4) + '-' + re.sub(r'[^A-Za-z0-9_-]', '_', name.replace('/', '__').replace('::', '--')) + '.png'
        folder = 'shadow-layers' if is_shadow else 'layers' if row['scope'] == 'face' else 'reference-layers'
        texture = folder + '/' + filename
        if not image.save(os.path.join(config['directory'], texture), 'PNG'):
            raise RuntimeError('PNG export failed: ' + name)
        record = dict(row, id=name, group=name.rsplit('/', 1)[0] if '/' in name else 'body',
            texture=texture, textureBounds=[x,y,w,h], bbox=[x,y,x+w,y+h],
            layerName=node.name(), nodeType=node.type(), parentUuid=parent.uniqueId().toString(),
            order=order, stackPath=stack, visible=original[key], layerOpacity=node.opacity(), blendingMode=node.blendingMode())
        record.pop('role', None)
        if is_shadow:
            record['materialRole'] = 'shadow'
        (shadows if is_shadow else parts if row['scope'] == 'face' else references).append(record)
    exported = dict(canvas=[doc.width(), doc.height()], parts=parts, referenceLayers=references, shadowLayers=shadows)
finally:
    doc.close()
result = exported
`;
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function bridgeFailure(stage: string, reply: BridgeResult): Error {
  const detail = reply.error?.trim() || reply.stderr?.trim() || reply.hints?.filter(h => h.trim()).join('\n')
    || reply.dialogs?.map(d => d.title).join('、') || '桥接未返回成功结果';
  return Error(`neutral：Krita ${stage}失败：${detail}\n${JSON.stringify({ id: reply.id, ok: reply.ok,
    error: reply.error, stderr: reply.stderr, dialogs: reply.dialogs, hints: reply.hints })}`, { cause: reply });
}

/** Drain startup recovery independently of asset work; also usable as a native
 * bridge probe. A recovery dialog on this no-op is cancelled by the shared
 * bridge. Require a clean second no-op before opening the source document.
 */
export async function prepareNeutralBridge(krita: SectionKrita, signal?: AbortSignal): Promise<BridgeResult> {
  signal?.throwIfAborted();
  await krita.reserve(signal); await krita.start(signal);
  const temporary = await mkdtemp(join(tmpdir(), 'nine-axis-neutral-startup-'));
  try {
    const script = join(temporary, 'startup.py');
    await writeFile(script, "result = {'neutralStartup': True}\n");
    let reply = await submitJob(krita.bridge!, script, { signal });
    const completed = (r: BridgeResult) => r.result !== null && typeof r.result === 'object'
      && (r.result as { neutralStartup?: unknown }).neutralStartup === true;
    const recoveryOnly = !reply.ok && completed(reply) && !reply.error?.trim() && !reply.stderr?.trim()
      && !!reply.dialogs?.length && reply.dialogs.every(d => d.class === 'QDialog' && /^Recover Files(?:\s+[–-]\s+Krita)?$/.test(d.title));
    if (recoveryOnly) reply = await submitJob(krita.bridge!, script, { signal });
    if (reply.ok !== true || !completed(reply) || reply.dialogs?.length || reply.error?.trim() || reply.stderr?.trim())
      throw bridgeFailure('启动检查', reply);
    return reply;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** One read-only KRA export. The caller owns beginStep/completion and Krita.release().
 * Pass the same taskRoot to all independent axes; omitting it uses directory itself,
 * never a guessed ancestor. Clone doc before authoring any directional keyforms.
 */
export async function prepareNeutral(directory: string, input: HeadInput, krita: SectionKrita, box: Box,
  scale: AngleScale = angleScale(), signal?: AbortSignal, taskRoot?: string): Promise<NeutralBuilt> {
  signal?.throwIfAborted();
  const root = resolve(taskRoot ?? directory), output = taskRoot ? fromTaskPath(root, directory) : resolve(directory);
  const document = fromTaskPath(root, input.document), color = fromTaskPath(root, input.color);
  if (![box.x, box.y, box.size].every(Number.isFinite) || box.size <= 0) throw Error('neutral：view box 无效');
  for (const range of [scale.x, scale.y]) if (range.length !== 2 || !range.every(Number.isFinite) || !(range[0] < 0 && range[1] > 0))
    throw Error('neutral：角度范围须包含负值与正值');
  const colorMetadata = await sharp(color).metadata();
  await prepareNeutralBridge(krita, signal);
  signal?.throwIfAborted();
  const temporary = await mkdtemp(join(tmpdir(), 'nine-axis-neutral-'));
  let exported: Pick<NeutralManifest, 'canvas' | 'parts' | 'referenceLayers' | 'shadowLayers'>;
  try {
    const script = join(temporary, 'export_layers.py');
    await writeFile(script, exportScript(document, output, await headMaterialSelection(document, root)));
    const reply = await submitJob(krita.bridge!, script, { signal });
    if (!reply.ok) throw bridgeFailure('原 KRA 导出', reply);
    exported = reply.result as typeof exported;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  signal?.throwIfAborted();
  if (!exported) throw Error('neutral：原 KRA 导出没有结果');
  const [width, height] = exported.canvas ?? [];
  if (width !== colorMetadata.width || height !== colorMetadata.height || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw Error('neutral：源 KRA 与原始首图画布不一致');
  const axis = box.x + box.size / 2;
  if (!(axis > 0 && axis < width)) throw Error('neutral：axis 须在原始画布内');
  if (!Array.isArray(exported.parts) || !Array.isArray(exported.referenceLayers)) throw Error('neutral：导出缺少图层 metadata');
  for (const layer of [...exported.parts, ...exported.referenceLayers, ...exported.shadowLayers ?? []]) {
    const meta = await sharp(join(output, layer.texture)).metadata();
    if (meta.width !== layer.textureBounds[2] || meta.height !== layer.textureBounds[3])
      throw Error(`neutral：原图层 PNG 尺寸不一致：${layer.id}`);
  }
  // Identical to importParts initialization, without compileHead's mirror or
  // anatomical ordering rules. Original metadata and pixels remain untouched.
  const parts = exported.parts.toReversed().map(layer => {
    const part = { ...layer, level: 'face' as const, cols: 4, rows: 4 };
    const rest = lattice({ ...part, keyforms: {} }), points = Array.from({ length: rest.length / 2 }, (_, i): Point => [rest[i * 2], rest[i * 2 + 1]]);
    return { ...part, keyforms: Object.fromEntries([scale.x[0], 0, scale.x[1]].map(key => [String(key), structuredClone(points)])),
      keyformsY: { '0': structuredClone(points) } };
  });
  const doc: NeutralDocument = { version: 2, kind: 'head-nine-axis', canvas: [width, height], axis,
    source: { document: toTaskPath(root, document) },
    view: { x: box.x, y: box.y, width: box.size, height: box.size }, levels: [structuredClone(faceLevel)],
    parameters: [{ ...angleParameter('ParamAngleX', '角度 X', scale.x), status: '未制作' },
      { ...angleParameter('ParamAngleY', '角度 Y', scale.y), keys: [0], status: '未制作' }],
    notes: '原 KRA immutable neutral；原图 identity 网格，X/Y 尚未制作。各方向须独立克隆。', deformers: [], parts };
  validateHeadNineAxis(doc);
  for (const part of parts) checkWarpGeometry(part);
  // Full canvas, extended for any original off-canvas pixels. box is only the
  // workbench view; neither original PNGs nor the full face preview use its crop.
  const x0 = Math.min(0, ...parts.map(p => p.bbox[0])), y0 = Math.min(0, ...parts.map(p => p.bbox[1]));
  const x1 = Math.max(width, ...parts.map(p => p.bbox[2])), y1 = Math.max(height, ...parts.map(p => p.bbox[3]));
  const preview = join(output, 'original-full-face.png');
  await sharp({ create: { width: x1 - x0, height: y1 - y0, channels: 4, background: '#00000000' } })
    .composite(parts.map(p => ({ input: join(output, p.texture), left: p.textureBounds[0] - x0, top: p.textureBounds[1] - y0 })))
    .png().toFile(preview);
  const manifest: NeutralManifest = { version: 1, sourceKra: doc.source.document,
    sourceColor: toTaskPath(root, color), canvas: [width, height],
    method: 'Authored part/UUID selection; base projection with own masks; independent shadow pixels before receiver clipping; original bounds; no view crop',
    order: 'top-to-bottom', parts: exported.parts, referenceLayers: exported.referenceLayers, shadowLayers: exported.shadowLayers ?? [],
    preview: { texture: 'original-full-face.png', textureBounds: [x0, y0, x1 - x0, y1 - y0] } };
  signal?.throwIfAborted();
  const textures = new Map(parts.map(p => [p.texture, join(output, p.texture)]));
  await writeBuilt(output, { doc, textures });
  const manifestPath = join(output, 'head_parts_manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  // Merge consumes drawing order, while the manifest above keeps the original
  // top-first export. Both records retain the same unmodified texture metadata.
  const exportRecordPath = join(output, 'export-record.json'), sourcePath = join(output, 'source.json');
  await writeFile(exportRecordPath, JSON.stringify({ version: 1, sourceKra: doc.source.document,
    canvas: doc.canvas, order: 'bottom-to-top', parts: doc.parts, referenceLayers: manifest.referenceLayers, shadowLayers: manifest.shadowLayers }, null, 2) + '\n');
  const source = { sourceDocument: doc.source.document, sourceColor: manifest.sourceColor };
  await writeFile(sourcePath, JSON.stringify({ version: 1, ...source }, null, 2) + '\n');
  return { doc: freeze(doc), textures, directory: output, path: join(output, 'deformers.json'),
    manifest: freeze(manifest), manifestPath, exportRecordPath, sourcePath, source: freeze(source), preview };
}
