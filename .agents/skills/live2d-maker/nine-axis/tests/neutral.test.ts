import '../../shared/tests/ignore-local-env.ts';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test, type TestContext } from 'node:test';
import sharp from 'sharp';
import { SectionKrita } from '../../shared/krita/section-krita.ts';
import { submitJob, type BridgeResult } from '../../shared/krita/bridge/client.mjs';
import { evaluatePoints, lattice } from '../../shared/nine-axis-model.js';
import { compileContinuation, startContinuation, sha256 } from '../continuation.ts';
import { checkFaceLeft, compileHead, writeBuilt, type HeadInput } from '../head.ts';
import { fileHash } from '../turn.ts';
import { prepareNeutral, prepareNeutralBridge } from '../neutral.ts';

const scale = { x: [-30, 30] as [number, number], y: [-25, 25] as [number, number] };
const box = { x: 4, y: 4, size: 8 };
type Layer = { name: string; bounds?: number[]; color?: string; children?: Layer[]; visible?: boolean };
const layers: Layer[] = [
  { name: 'neck', bounds: [6, 10, 4, 4], color: '#ff0000' },
  { name: '0002 | face/face_base', bounds: [-2, 4, 20, 8], color: '#ff0000', children: [{ name: 'child mask' }] },
  { name: '0001 | face/eye_left/iris', bounds: [6, 6, 4, 4], color: '#00ff00' },
  { name: 'hair/bangs', bounds: [2, 2, 12, 8], color: '#0000ff', visible: false },
  { name: 'head_accessories::front', bounds: [0, 0, 2, 2], color: '#ffffff' },
  { name: 'body', bounds: [0, 14, 16, 2], color: '#000000' },
];

// Use the real submitJob file protocol, executing the generated Python with
// small Krita/QImage doubles. This exercises traversal, export and finally-close
// rather than merely returning a precomputed manifest from a mocked TS API.
async function fixture(t: TestContext, nodes = layers, options: { failExport?: boolean; corruptHash?: boolean; depth?: string;
  startupReplies?: Partial<BridgeResult>[]; exportReply?: Partial<BridgeResult> } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'neutral-原图-'));
  let stop = async () => {};
  t.after(async () => { await stop(); await rm(root, { recursive: true, force: true }); });
  const sourceDirectory = join(root, 'character-assembly/step01');
  const directory = join(root, 'nine-axis/step02_angle-x/neutral');
  await mkdir(sourceDirectory, { recursive: true });
  const document = join(sourceDirectory, 'original "doll".kra'), color = join(sourceDirectory, 'original.png');
  await writeFile(document, 'original KRA fixture');
  await sharp({ create: { width: 16, height: 16, channels: 4, background: '#ffffffff' } }).png().toFile(color);
  const input: HeadInput = { document, color, source: { id: 'character-assembly/step01', directory: sourceDirectory }, parts: [] };
  let serial = 0;
  const bake = async (n: Layer): Promise<any> => {
    const children = await Promise.all((n.children ?? []).map(bake));
    const node = { ...n, children, uuid: `uuid-${serial++}`, png: '', raw: '' };
    if (n.bounds) {
      const [, , width, height] = n.bounds;
      const image = sharp({ create: { width, height, channels: 4, background: n.color ?? '#ff0000' } });
      node.png = (await image.clone().png().toBuffer()).toString('base64');
      const raw = await image.raw().toBuffer();
      for (let i = 0; i < raw.length; i += 4) [raw[i], raw[i + 2]] = [raw[i + 2], raw[i]];
      node.raw = raw.toString('base64');
    }
    return node;
  };
  const config = { nodes: await Promise.all(nodes.map(bake)), document, depth: options.depth ?? 'U8', failExport: options.failExport ?? false };
  const bootstrap = `import sys, types, json, base64, traceback
cfg = json.loads(${JSON.stringify(JSON.stringify(config))})
events, pngs = [], {}
class Rect:
    def __init__(self, b): self.b = b
    def x(self): return self.b[0]
    def y(self): return self.b[1]
    def width(self): return self.b[2]
    def height(self): return self.b[3]
class UUID:
    def __init__(self, value): self.value = value
    def toString(self): return self.value
class Node:
    def __init__(self, n):
        self.n = n
        self.children = [Node(c) for c in n.get('children', [])]
        if n.get('raw'): pngs[base64.b64decode(n['raw'])] = base64.b64decode(n['png'])
    def childNodes(self): return self.children
    def name(self): return self.n['name']
    def uniqueId(self): return UUID(self.n.get('uuid', 'root-uuid'))
    def bounds(self): return Rect(self.n['bounds'])
    def type(self): return 'grouplayer' if self.children else 'paintlayer'
    def visible(self): return self.n.get('visible', True)
    def opacity(self): return 255
    def blendingMode(self): return 'normal'
    def projectionPixelData(self, x, y, w, h):
        assert [x,y,w,h] == self.n['bounds'], 'original bounds were cropped'
        events.append('projection:' + self.name())
        return base64.b64decode(self.n['raw'])
class Document:
    def __init__(self): self.root = Node(dict(name='root', children=cfg['nodes']))
    def setBatchmode(self, value): assert value
    def waitForDone(self): pass
    def rootNode(self): return self.root
    def colorModel(self): return 'RGBA'
    def colorDepth(self): return cfg['depth']
    def width(self): return 16
    def height(self): return 16
    def close(self): events.append('close')
class Krita:
    @staticmethod
    def instance(): return Krita()
    def openDocument(self, path):
        assert path == cfg['document'], path
        events.append('open')
        return Document()
class QImage:
    Format_ARGB32 = 1
    def __init__(self, raw, w, h, fmt):
        assert len(raw) == w*h*4 and fmt == 1
        self.raw = bytes(raw)
    def copy(self): return self
    def save(self, path, fmt):
        if cfg['failExport']: return False
        assert fmt == 'PNG'
        with open(path, 'wb') as handle: handle.write(pngs[self.raw])
        return True
krita = types.ModuleType('krita'); krita.Krita = Krita
qt = types.ModuleType('PyQt5.QtGui'); qt.QImage = QImage
sys.modules.update({'krita':krita, 'PyQt5':types.ModuleType('PyQt5'), 'PyQt5.QtGui':qt})
namespace = {}
try:
    exec(sys.stdin.read(), namespace)
    reply = dict(ok=True, result=namespace.get('result'))
except Exception:
    reply = dict(ok=False, error=traceback.format_exc())
reply['events'] = events
print(json.dumps(reply))
`;
  const bridge = join(root, 'bridge'), jobs = join(bridge, 'jobs');
  await mkdir(jobs, { recursive: true });
  await writeFile(join(bridge, 'ready.json'), JSON.stringify({ pid: process.pid, jobs }));
  const calls = { reserve: 0, start: 0, release: 0, jobs: 0, events: [] as string[] };
  const replies: (BridgeResult & { startup: boolean })[] = [];
  const handled = new Set<string>();
  let running = false, pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    pending = (async () => {
      for (const name of await readdir(jobs)) {
        if (!name.endsWith('.py') || handled.has(name)) continue;
        handled.add(name); calls.jobs++;
        const python = spawn('python3', ['-c', bootstrap], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
        let stdout = '', stderr = '';
        python.stdout.on('data', chunk => { stdout += chunk; });
        python.stderr.on('data', chunk => { stderr += chunk; });
        python.stdin.end(await readFile(join(jobs, name), 'utf8'));
        const code = await new Promise<number | null>((resolve, reject) => { python.once('error', reject); python.once('close', resolve); });
        const reply = code === 0 ? JSON.parse(stdout) : { ok: false, error: stderr };
        const startup = name.includes('-startup-');
        if (startup && options.startupReplies?.length) Object.assign(reply, options.startupReplies.shift());
        if (!startup && options.exportReply) Object.assign(reply, options.exportReply);
        calls.events = reply.events ?? [];
        if (!startup && options.corruptHash && reply.ok) reply.result.parts[0].sha256 = '0'.repeat(64);
        replies.push({ ...reply, startup });
        await writeFile(join(jobs, name.replace(/\.py$/, '.json')), JSON.stringify(reply));
      }
    })().finally(() => { running = false; });
  }, 10);
  stop = async () => { clearInterval(timer); await pending; };
  const krita = { bridge, async reserve(signal?: AbortSignal) { signal?.throwIfAborted(); calls.reserve++; },
    async start(signal?: AbortSignal) { signal?.throwIfAborted(); calls.start++; }, async release() { calls.release++; } } as unknown as SectionKrita;
  return { root, directory, input, krita, calls, replies };
}

test('one original KRA job preserves layers, metadata, identity and the merge export contract', async t => {
  const f = await fixture(t), originalHash = await fileHash(f.input.document);
  const built = await prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root);
  const { doc, manifest } = built;
  assert.deepEqual(f.calls, { reserve: 1, start: 1, release: 0, jobs: 2, events: ['open',
    'projection:head_accessories::front', 'projection:hair/bangs', 'projection:0001 | face/eye_left/iris',
    'projection:0002 | face/face_base', 'projection:neck', 'close'] });
  assert.deepEqual(doc.parts.map(p => p.id), ['neck', 'face/face_base', 'face/eye_left/iris']);
  assert.deepEqual(manifest.parts.map(p => p.id), doc.parts.map(p => p.id).toReversed());
  assert.deepEqual(manifest.referenceLayers.map(p => p.id), ['head_accessories::front', 'hair/bangs']);
  assert.equal(manifest.referenceLayers[1].visible, false);
  assert.deepEqual(doc.canvas, [16, 16]); assert.equal(doc.axis, 8);
  assert.deepEqual(doc.view, { x: 4, y: 4, width: 8, height: 8 });
  assert.equal(doc.source.document, 'character-assembly/step01/original "doll".kra');
  assert.equal(doc.source.sha256, originalHash);
  assert.deepEqual(doc.deformers, []);
  assert.deepEqual(doc.parameters!.map(p => [p.id, p.keys, p.status]), [['ParamAngleX', [-30, 0, 30], '未制作'], ['ParamAngleY', [0], '未制作']]);
  assert.deepEqual(doc.parts[1].textureBounds, [-2, 4, 20, 8]);
  assert.deepEqual(doc.parts[1].bbox, [-2, 4, 18, 12]);
  assert.deepEqual(doc.parts[1].stackPath, [4]);
  assert.equal(doc.parts[1].layerName, '0002 | face/face_base');
  assert.ok(doc.parts.every(p => p.uuid && p.parentUuid === 'root-uuid' && p.nodeType && !p.parent && !p.mirror));
  for (const p of doc.parts) {
    const identity = Array.from(lattice(p));
    for (const x of [-30, -15, 0, 15, 30]) for (const y of [-25, 0, 25])
      assert.deepEqual(Array.from(evaluatePoints(doc, p, x, y)), identity);
    assert.deepEqual(Object.keys(p.keyformsY!), ['0']);
    assert.notEqual(p.keyforms['0'], p.keyforms['-30']);
    assert.equal(await fileHash(built.textures.get(p.texture)!), p.sha256);
  }
  assert.deepEqual(JSON.parse(await readFile(built.path, 'utf8')), doc);
  const record = JSON.parse(await readFile(built.exportRecordPath, 'utf8'));
  assert.deepEqual(record.parts, doc.parts);
  assert.equal(record.sourceKraSha256, originalHash); assert.equal(record.sourceKra, doc.source.document);
  assert.deepEqual(record.canvas, doc.canvas);
  assert.deepEqual(JSON.parse(await readFile(built.sourcePath, 'utf8')), { version: 1, sourceDocument: doc.source.document,
    sourceColor: manifest.sourceColor, sourceKraHash: originalHash, sourceColorHash: await fileHash(f.input.color) });
  assert.deepEqual(JSON.parse(await readFile(built.manifestPath, 'utf8')), manifest);
  assert.deepEqual(manifest.preview.textureBounds, [-2, 0, 20, 16]);
  const { data, info } = await sharp(built.preview).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [20, 16]);
  const pixel = (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4));
  assert.deepEqual(pixel(0, 4), [255, 0, 0, 255]); // outside original canvas and view survives
  assert.deepEqual(pixel(8, 6), [0, 255, 0, 255]); // top eye over face; reference hair excluded
  assert.equal(await fileHash(f.input.document), originalHash);
  assert.deepEqual((await readdir(f.directory)).sort(), ['deformers.json', 'export-record.json', 'head_parts_manifest.json',
    'layers', 'original-full-face.png', 'reference-layers', 'source.json']);
});

test('left/up/down independently clone frozen neutral without changing baseline bytes', async t => {
  const f = await fixture(t), built = await prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root);
  const text = await readFile(built.path, 'utf8'), hash = sha256(text);
  const left = { version: 2 as const, axis: built.doc.axis, deformers: [], parts: structuredClone(built.doc.parts.toReversed()) };
  checkFaceLeft(left, built.doc.canvas, '-30');
  const up = startContinuation(built.doc, hash, 'up', scale), down = startContinuation(built.doc, hash, 'down', scale);
  up.parts[1].keyformsY!['25'][0][0] += 1;
  left.parts[1].keyforms['-30'][0][0] += 2;
  assert.deepEqual(down.parts[1].keyformsY!['-25'], built.doc.parts[1].keyforms['0']);
  assert.ok(Object.isFrozen(built.doc) && Object.isFrozen(built.doc.parts[1].keyforms['0'][0]));
  assert.throws(() => { built.doc.parts[1].bbox[0] = 500; }, TypeError);
  assert.equal(await readFile(built.path, 'utf8'), text);
  assert.deepEqual(built.doc.parts[1].keyforms['-30'], built.doc.parts[1].keyforms['0']);
  const leftDirectory = join(f.root, 'nine-axis/step02_angle-x');
  await writeBuilt(leftDirectory, built);
  const compiledLeft = await compileHead(leftDirectory, f.input, box, left, scale);
  const compiledUp = await compileContinuation(join(f.root, 'nine-axis/up'), f.directory, up, 'up', scale);
  const compiledDown = await compileContinuation(join(f.root, 'nine-axis/down'), f.directory, down, 'down', scale);
  for (const axis of [compiledLeft, compiledUp, compiledDown]) {
    assert.deepEqual(axis.doc.source, built.doc.source);
    assert.deepEqual(axis.doc.parts.map(p => p.id), built.doc.parts.map(p => p.id));
  }
  assert.equal(await readFile(built.path, 'utf8'), text);
});

test('explicit root resolves task-relative input and deep neutral output; custom degree range remains identity', async t => {
  const f = await fixture(t), custom = { x: [-20, 20] as [number, number], y: [-10, 15] as [number, number] };
  const built = await prepareNeutral('nine-axis/step02_angle-x/neutral', { ...f.input,
    document: 'character-assembly/step01/original "doll".kra', color: 'character-assembly/step01/original.png' }, f.krita, box, custom, undefined, f.root);
  assert.equal(built.directory, f.directory);
  assert.deepEqual(built.doc.parameters![0].keys, [-20, 0, 20]);
  assert.deepEqual(Object.keys(built.doc.parts[0].keyforms).sort(), ['-20', '0', '20']);
});

test('semantic nodes inside unlabelled containers retain full stack paths', async t => {
  const f = await fixture(t, [{ name: 'container', children: layers }]);
  const built = await prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root);
  assert.deepEqual(built.doc.parts[1].stackPath, [0, 4]);
  assert.notEqual(built.doc.parts[1].parentUuid, 'root-uuid');
});

test('omitted taskRoot uses directory itself without nesting a relative output', async t => {
  const f = await fixture(t);
  const built = await prepareNeutral(relative(process.cwd(), f.directory), f.input, f.krita, box, scale);
  assert.equal(built.directory, f.directory);
  assert.equal(built.doc.source.document, f.input.document);
});

test('abort before export leaves Krita and output untouched', async t => {
  const f = await fixture(t), controller = new AbortController(); controller.abort(new Error('cancel neutral'));
  await assert.rejects(prepareNeutral(f.directory, f.input, f.krita, box, scale, controller.signal, f.root), /cancel neutral/);
  assert.equal(f.calls.reserve + f.calls.start + f.calls.jobs, 0);
  await assert.rejects(readFile(join(f.directory, 'deformers.json')), { code: 'ENOENT' });
});

test('PNG export failure, duplicate ids and unsupported projection always close only the opened doc', async t => {
  for (const [nodes, options, error] of [
    [layers, { failExport: true }, /PNG export failed/],
    [[...layers, { ...layers[1], name: 'face/face_base' }], {}, /Duplicate semantic id/],
    [layers, { depth: 'U16' }, /RGBA\/U8/],
  ] as const) {
    const f = await fixture(t, [...nodes], options);
    await assert.rejects(prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root), error);
    assert.equal(f.calls.events[0], 'open'); assert.equal(f.calls.events.at(-1), 'close');
    assert.equal(f.calls.jobs, 2); assert.equal(f.calls.release, 0);
    await assert.rejects(readFile(join(f.directory, 'deformers.json')), { code: 'ENOENT' });
  }
});

test('bad exported PNG hash prevents publishing a neutral baseline', async t => {
  const f = await fixture(t, layers, { corruptHash: true });
  await assert.rejects(prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root), /PNG hash/);
  assert.equal(f.calls.events.at(-1), 'close');
  await assert.rejects(readFile(join(f.directory, 'deformers.json')), { code: 'ENOENT' });
});

const recovery = { ok: false, error: '', stderr: '', dialogs: [{ title: 'Recover Files – Krita', class: 'QDialog' }],
  hints: ['startup recovery cancelled by the shared bridge'] };

test('first-job startup recovery is drained before opening the original KRA; export still runs exactly once', async t => {
  const f = await fixture(t, layers, { startupReplies: [recovery] });
  const built = await prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root);
  assert.deepEqual(f.replies.map(r => [r.startup, r.ok]), [[true, false], [true, true], [false, true]]);
  assert.deepEqual(f.replies[0].result, { neutralStartup: true });
  assert.deepEqual(f.replies[0].dialogs, recovery.dialogs);
  assert.equal(f.calls.events.filter(e => e === 'open').length, 1);
  assert.equal(f.calls.events.at(-1), 'close');
  assert.equal(built.doc.parts.length, 3); assert.equal(f.calls.release, 0);
});

test('unknown startup dialogs, actual Python failures, and a second recovery failure stop before export', async t => {
  for (const startupReplies of [
    [{ ...recovery, dialogs: [{ title: 'Overwrite source?', class: 'QDialog' }] }],
    [{ ...recovery, error: 'Traceback: actual Python error' }],
    [{ ...recovery, stderr: 'actual stderr error' }],
    [recovery, recovery],
    [{ ...recovery, result: null }],
  ]) {
    const f = await fixture(t, layers, { startupReplies: structuredClone(startupReplies) });
    await assert.rejects(prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root), /启动检查失败/);
    assert.ok(f.replies.every(r => r.startup)); assert.deepEqual(f.calls.events, []);
    await assert.rejects(access(join(f.directory, 'layers')), { code: 'ENOENT' });
  }
});

test('ok:false with a complete export result and empty stderr remains an export failure with dialogs/hints and raw cause', async t => {
  const f = await fixture(t, layers, { exportReply: recovery });
  await assert.rejects(prepareNeutral(f.directory, f.input, f.krita, box, scale, undefined, f.root), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /原 KRA 导出失败：startup recovery cancelled/);
    assert.match(error.message, /Recover Files – Krita/); assert.match(error.message, /"dialogs".*"hints"/);
    const reply = error.cause as BridgeResult;
    assert.equal(reply.ok, false); assert.equal((reply.result as { parts: unknown[] }).parts.length, 3);
    return true;
  });
  assert.equal(f.calls.events.at(-1), 'close');
  assert.equal(f.replies.filter(r => !r.startup).length, 1);
  await assert.rejects(access(join(f.directory, 'deformers.json')), { code: 'ENOENT' });
});

test('real Krita exports original KRA projections, BGRA channels and off-canvas bounds',
  { skip: !process.env.ASTRA_TEST_KRITA && 'ASTRA_TEST_KRITA 未设置' }, async t => {
    const root = await mkdtemp(join(tmpdir(), 'neutral-real-'));
    const krita = new SectionKrita({ section: root, krita: process.env.ASTRA_TEST_KRITA!, slotsDirectory: join(root, 'slots') });
    t.after(async () => { await krita.release(); await rm(root, { recursive: true, force: true }); });
    await krita.reserve(); await krita.start();
    const document = join(root, 'original.kra'), color = join(root, 'original.png'), script = join(root, 'fixture.py');
    // Use production startup handling, not a test-only recovery workaround.
    const startup = await prepareNeutralBridge(krita);
    assert.equal(startup.ok, true, JSON.stringify(startup));
    assert.deepEqual(startup.result, { neutralStartup: true });
    assert.deepEqual(startup.dialogs, []);
    await writeFile(script, `from krita import Krita, InfoObject
from PyQt5.QtCore import QByteArray
doc = Krita.instance().createDocument(32,32,'neutral','RGBA','U8','',72.0)
try:
    root = doc.rootNode()
    for name,x,y,w,h,bgra in [('neck',12,20,8,8,[0,0,255,255]),('0001 | face/face_base',-2,8,36,16,[0,0,255,255]),('face/eye_left',12,12,4,4,[0,255,0,255]),('hair/bangs',8,4,16,8,[255,0,0,255]),('head_accessories::front',6,2,2,2,[255,255,255,255])]:
        node = doc.createNode(name,'paintlayer')
        root.addChildNode(node,None)
        node.setPixelData(QByteArray(bytes(bgra)*(w*h)),x,y,w,h)
    doc.refreshProjection(); doc.waitForDone()
    assert doc.saveAs(${JSON.stringify(document)})
    assert doc.exportImage(${JSON.stringify(color)}, InfoObject())
finally:
    doc.close()
result = True
`);
    const seeded = await submitJob(krita.bridge!, script); assert.equal(seeded.ok, true, JSON.stringify(seeded));
    const input: HeadInput = { document, color, source: { id: 'fixture', directory: root }, parts: [] };
    const built = await prepareNeutral(join(root, 'neutral'), input, krita, { x: 4, y: 4, size: 24 }, scale, undefined, root);
    assert.deepEqual(built.doc.parts.map(p => p.id), ['neck', 'face/face_base', 'face/eye_left']);
    assert.deepEqual(built.doc.parts[1].textureBounds, [-2, 8, 36, 16]);
    const base = await sharp(built.textures.get(built.doc.parts[1].texture)!).raw().toBuffer();
    assert.deepEqual(Array.from(base.subarray(0, 4)), [255, 0, 0, 255]);
    assert.equal(built.manifest.referenceLayers.length, 2);
    assert.equal(krita.status().state, 'running'); // release belongs to parent
    await writeFile(script, 'result = len(Krita.instance().documents())\n');
    const closed = await submitJob(krita.bridge!, script); assert.equal(closed.result, 0, closed.error);
  });
