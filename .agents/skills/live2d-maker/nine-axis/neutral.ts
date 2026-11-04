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
import { fileHash, type Box } from './turn.ts';

type Bounds = [number, number, number, number];
export type NeutralLayer = {
  id: string; group: string; texture: string; textureBounds: Bounds; bbox: Bounds;
  uuid: string; layerName: string; nodeType: string; parentUuid: string;
  order: number; stackPath: number[]; visible: boolean; layerOpacity: number; blendingMode: string; sha256: string;
};
export type NeutralManifest = {
  version: 1; sourceKra: string; sourceKraSha256: string; sourceColor: string; sourceColorSha256: string;
  canvas: [number, number]; method: string; order: 'top-to-bottom'; parts: NeutralLayer[]; referenceLayers: NeutralLayer[];
  preview: { texture: string; textureBounds: Bounds; sha256: string };
};
export type NeutralPart = Omit<HeadDeformer, 'keyforms' | 'keyformsY'> & NeutralLayer & {
  keyforms: Record<string, Point[]>; keyformsY: Record<string, Point[]>;
};
export type NeutralDocument = Omit<HeadNineAxis, 'parts' | 'source'> & {
  axis: number; canvas: [number, number]; parts: NeutralPart[];
  source: { document: string; sha256: string };
};
export type NeutralBuilt = Omit<Built, 'doc'> & {
  doc: NeutralDocument; directory: string; path: string; manifestPath: string; exportRecordPath: string; sourcePath: string;
  preview: string; manifest: NeutralManifest; source: Record<string, string>;
};

// Keep node projections (including their child masks) and original bounds,
// as in the successful export_layers.py. Only unlabelled containers recurse:
// a semantic node is one asset, never exported again through its children.
function exportScript(document: string, directory: string): string {
  return `from krita import Krita
from PyQt5.QtGui import QImage
import os, json, hashlib, re
config = json.loads(${JSON.stringify(JSON.stringify({ document, directory }))})
def digest(path):
    h = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()
source_hash = digest(config['document'])
doc = Krita.instance().openDocument(config['document'])
if doc is None:
    raise RuntimeError('Cannot open source KRA: ' + config['document'])
try:
    doc.setBatchmode(True)
    doc.waitForDone()
    if doc.rootNode() is None or doc.colorModel() != 'RGBA' or doc.colorDepth() != 'U8':
        raise RuntimeError('Source KRA must have an RGBA/U8 projection')
    parts, references, seen, uuids = [], [], set(), set()
    for folder in ('layers', 'reference-layers'):
        os.makedirs(os.path.join(config['directory'], folder), exist_ok=True)
    def visit(parent, path):
        for index, node in enumerate(reversed(parent.childNodes())):
            stack = path + [index]
            name = node.name().split(' | ', 1)[-1]
            core = name.startswith('face/') or name == 'neck' or name.startswith('neck/')
            reference = name.startswith('hair/') or re.match(r'^head_accessories(?:/|::|$)', name) is not None
            if not core and not reference:
                if node.type() == 'grouplayer':
                    visit(node, stack)
                continue
            uuid = node.uniqueId().toString()
            if name in seen or not uuid or uuid in uuids:
                raise RuntimeError('Duplicate semantic id or UUID: ' + name)
            seen.add(name)
            uuids.add(uuid)
            b = node.bounds()
            x, y, w, h = b.x(), b.y(), b.width(), b.height()
            if w <= 0 or h <= 0:
                raise RuntimeError('Empty original layer bounds: ' + name)
            raw = node.projectionPixelData(x, y, w, h)
            if len(raw) != w * h * 4:
                raise RuntimeError('Invalid RGBA/U8 projection: ' + name)
            image = QImage(raw, w, h, QImage.Format_ARGB32).copy()
            order = len(parts) + len(references)
            filename = str(order).zfill(4) + '-' + re.sub(r'[^A-Za-z0-9_-]', '_', name.replace('/', '__').replace('::', '--')) + '.png'
            texture = ('layers/' if core else 'reference-layers/') + filename
            destination = os.path.join(config['directory'], texture)
            os.makedirs(os.path.dirname(destination), exist_ok=True)
            if not image.save(destination, 'PNG'):
                raise RuntimeError('PNG export failed: ' + name)
            record = dict(id=name, group=name.rsplit('/', 1)[0] if '/' in name else 'body',
                texture=texture, textureBounds=[x,y,w,h], bbox=[x,y,x+w,y+h], uuid=uuid,
                layerName=node.name(), nodeType=node.type(), parentUuid=parent.uniqueId().toString(),
                order=order, stackPath=stack, visible=node.visible(), layerOpacity=node.opacity(),
                blendingMode=node.blendingMode(), sha256=digest(destination))
            (parts if core else references).append(record)
    visit(doc.rootNode(), [])
    if not any(p['id'] == 'face/face_base' for p in parts):
        raise RuntimeError('Source KRA has no face/face_base')
    exported = dict(canvas=[doc.width(), doc.height()], sourceKraSha256=source_hash,
        parts=parts, referenceLayers=references)
finally:
    doc.close()
if digest(config['document']) != source_hash:
    raise RuntimeError('Source KRA changed during neutral export')
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
  const [kraHash, colorHash, colorMetadata] = await Promise.all([fileHash(document), fileHash(color), sharp(color).metadata()]);
  await prepareNeutralBridge(krita, signal);
  signal?.throwIfAborted();
  const temporary = await mkdtemp(join(tmpdir(), 'nine-axis-neutral-'));
  let exported: Pick<NeutralManifest, 'canvas' | 'sourceKraSha256' | 'parts' | 'referenceLayers'>;
  try {
    const script = join(temporary, 'export_layers.py');
    await writeFile(script, exportScript(document, output));
    const reply = await submitJob(krita.bridge!, script, { signal });
    if (!reply.ok) throw bridgeFailure('原 KRA 导出', reply);
    exported = reply.result as typeof exported;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
  signal?.throwIfAborted();
  if (!exported || exported.sourceKraSha256 !== kraHash || await fileHash(document) !== kraHash || await fileHash(color) !== colorHash)
    throw Error('neutral：源 KRA 或首图在导出期间变化');
  const [width, height] = exported.canvas ?? [];
  if (width !== colorMetadata.width || height !== colorMetadata.height || !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    throw Error('neutral：源 KRA 与原始首图画布不一致');
  const axis = box.x + box.size / 2;
  if (!(axis > 0 && axis < width)) throw Error('neutral：axis 须在原始画布内');
  if (!Array.isArray(exported.parts) || !Array.isArray(exported.referenceLayers)) throw Error('neutral：导出缺少图层 metadata');
  for (const layer of [...exported.parts, ...exported.referenceLayers]) {
    const [meta, hash] = await Promise.all([sharp(join(output, layer.texture)).metadata(), fileHash(join(output, layer.texture))]);
    if (hash !== layer.sha256 || meta.width !== layer.textureBounds[2] || meta.height !== layer.textureBounds[3])
      throw Error(`neutral：原图层 PNG hash 或尺寸不一致：${layer.id}`);
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
    source: { document: toTaskPath(root, document), sha256: kraHash },
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
  const manifest: NeutralManifest = { version: 1, sourceKra: doc.source.document, sourceKraSha256: kraHash,
    sourceColor: toTaskPath(root, color), sourceColorSha256: colorHash, canvas: [width, height],
    method: 'Krita node.projectionPixelData; child masks included; RGBA/U8 ARGB32 PNG; original bounds; no view crop',
    order: 'top-to-bottom', parts: exported.parts, referenceLayers: exported.referenceLayers,
    preview: { texture: 'original-full-face.png', textureBounds: [x0, y0, x1 - x0, y1 - y0], sha256: await fileHash(preview) } };
  signal?.throwIfAborted();
  const textures = new Map(parts.map(p => [p.texture, join(output, p.texture)]));
  await writeBuilt(output, { doc, textures });
  const manifestPath = join(output, 'head_parts_manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  // Merge consumes drawing order, while the manifest above keeps the original
  // top-first export. Both records retain the same unmodified texture metadata.
  const exportRecordPath = join(output, 'export-record.json'), sourcePath = join(output, 'source.json');
  await writeFile(exportRecordPath, JSON.stringify({ version: 1, sourceKra: doc.source.document, sourceKraSha256: kraHash,
    canvas: doc.canvas, order: 'bottom-to-top', parts: doc.parts, referenceLayers: manifest.referenceLayers }, null, 2) + '\n');
  const source = { sourceDocument: doc.source.document, sourceColor: manifest.sourceColor, sourceKraHash: kraHash, sourceColorHash: colorHash };
  await writeFile(sourcePath, JSON.stringify({ version: 1, ...source }, null, 2) + '\n');
  return { doc: freeze(doc), textures, directory: output, path: join(output, 'deformers.json'),
    manifest: freeze(manifest), manifestPath, exportRecordPath, sourcePath, source: freeze(source), preview };
}
