"""Fixed-operation bridge for a dedicated Krita process, never a script evaluator.

Krita owns compositing, masks, clipping imports, blend modes and color management.
The HTTP service owns document tokens, upload boundaries, revisions and lifetime.
"""
from krita import Krita, Extension, InfoObject
from PyQt5.QtCore import QTimer, QBuffer, QIODevice, QRect
from PyQt5.QtGui import QImage
from pathlib import Path
import os
import json
import traceback
import re
import hashlib

ROOT = Path(os.environ['ASTRA_LAYER_BRIDGE']).resolve()
BLENDS = {'normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'}
FIELDS = ('visible', 'opacity', 'blend', 'inheritAlpha', 'passThrough')


def part_label(label):
    """Depth prefixes and ::regions are metadata, never another movable part."""
    name = re.sub(r'^\d+(?:\s*\|\s*|\s+)', '', label.strip())
    prefix = re.match(r'^(人物|衣服|衣装)\s*\|\s*', name)
    namespace = 'character:' if prefix and prefix.group(1) == '人物' else 'clothing:' if prefix else ''
    if prefix:
        name = re.sub(r'^\d+(?:\s*\|\s*|\s+)', '', name[prefix.end():])
    name = name.strip()
    path = name.split('::', 1)[0]
    return namespace, name, path


def atomic(path, value):
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')
    temp.replace(path)


def state(node):
    return {'visible': node.visible(), 'opacity': node.opacity(),
            'blend': node.blendingMode(), 'inheritAlpha': node.inheritAlpha(),
            'passThrough': node.passThroughMode() if node.type() == 'grouplayer' else None}


def thumbnail(node):
    buffer = QBuffer()
    buffer.open(QIODevice.WriteOnly)
    node.thumbnail(40, 40).save(buffer, 'PNG')
    return 'data:image/png;base64,' + bytes(buffer.data().toBase64()).decode('ascii')


class Layers(Extension):
    def setup(self):
        self.docs = {}
        Krita.instance().setBatchmode(True)
        self.timer = QTimer()
        self.timer.timeout.connect(self.poll)
        self.timer.start(80)
        atomic(ROOT / 'ready.json', {'version': Krita.instance().version()})

    def createActions(self, window):
        pass

    def import_psd(self, doc, specs):
        def walk(parent, records):
            children = [n for n in parent.childNodes() if not n.type().endswith('mask')]
            if len(children) != len(records) or any(n.name() != r['name'] for n, r in zip(children, records)):
                raise ValueError('此 PSD 的图层结构无法完整导入，请在 Krita 中检查并另存 KRA')
            for node, spec in zip(children, records):
                if spec['group']:
                    walk(node, spec['children'])
                node.setVisible(spec['visible'])
                node.setOpacity(spec['opacity'])
                masks = [n for n in node.childNodes() if n.type() == 'transparencymask']
                if spec['maskDisabled'] is not None:
                    if len(masks) != 1:
                        raise ValueError('此 PSD 的复合蒙版需要先在 Krita 中确认并另存 KRA')
                    masks[0].setVisible(not spec['maskDisabled'])
            i = 0
            while i < len(children):
                if records[i]['clipping']:
                    raise ValueError('PSD 剪贴层缺少底层，请先修复剪贴链')
                end = i + 1
                while end < len(children) and records[end]['clipping']:
                    end += 1
                if end > i + 1:
                    base = children[i]
                    group = doc.createGroupLayer('剪贴 · ' + base.name())
                    group.setPassThroughMode(False)
                    if not parent.addChildNode(group, base):
                        raise ValueError('无法创建 PSD 剪贴组')
                    above = None
                    for j in range(i, end):
                        original = children[j]
                        # Detaching a live Kis node can invalidate attached masks.
                        # Duplicate the complete subtree before removing the old node.
                        node = original.duplicate()
                        node.setName(original.name())
                        if not parent.removeChildNode(original) or not group.addChildNode(node, above):
                            raise ValueError('无法保留 PSD 剪贴顺序')
                        node.setInheritAlpha(j != i)
                        above = node
                i = end
        walk(doc.rootNode(), specs)
        doc.refreshProjection()
        doc.waitForDone()

    def tree(self, doc):
        nodes, rows = {}, []
        def walk(parent, parent_id=None, depth=0, legacy_parent=None):
            for index, node in enumerate(reversed(parent.childNodes())):
                legacy = (legacy_parent + '.' if legacy_parent else 'n') + str(index)
                key = node.uniqueId().toString().strip('{}').lower()
                if not key or key in nodes:
                    raise ValueError('图层 UUID 缺失或重复，请重新保存工程')
                nodes[key] = node
                if len(rows) >= 10000 or depth > 100:
                    raise ValueError('图层数量或嵌套过多')
                kind = node.type()
                rows.append({'id': key, 'uuid': key, 'legacyId': legacy, 'parentId': parent_id, 'depth': depth,
                             'name': node.name(), 'type': kind, 'group': kind == 'grouplayer',
                             'mask': kind.endswith('mask'), 'locked': node.locked(),
                             'alphaLocked': node.alphaLocked(), 'thumbnail': thumbnail(node),
                             **state(node)})
                walk(node, key, depth + 1, legacy)
        walk(doc.rootNode())
        return nodes, rows

    def metadata(self, session, thumbnails=False):
        rows = []
        for original in session['rows']:
            node = session['nodes'][original['id']]
            row = {**original, **state(node)}
            if not thumbnails:
                row.pop('thumbnail', None)
            rows.append(row)
        baseline = all({k: row[k] for k in FIELDS} == session['baseline'][row['id']] for row in rows)
        return {'layers': rows, 'baseline': baseline,
                'width': session['doc'].width(), 'height': session['doc'].height()}

    def validate(self, session, changes):
        if not isinstance(changes, list) or len(changes) != len(session['nodes']):
            raise ValueError('图层状态不完整，请重新打开文件')
        seen = set()
        for value in changes:
            key = value.get('id')
            if key not in session['nodes'] or key in seen:
                raise ValueError('无效图层')
            seen.add(key)
            if set(value) != {'id', *FIELDS}:
                raise ValueError('无效图层参数')
            node = session['nodes'][key]
            current = state(node)
            if type(value['visible']) is not bool or type(value['inheritAlpha']) is not bool:
                raise ValueError('图层开关必须为布尔值')
            if type(value['opacity']) is not int or not 0 <= value['opacity'] <= 255:
                raise ValueError('图层透明度超出范围')
            if value['blend'] != current['blend'] and value['blend'] != session['baseline'][value['id']]['blend'] and value['blend'] not in BLENDS:
                raise ValueError('不支持的混合模式')
            if node.type() == 'grouplayer':
                if type(value['passThrough']) is not bool:
                    raise ValueError('无效组穿透参数')
            elif value['passThrough'] is not None:
                raise ValueError('仅分组支持穿透模式')
            if node.type().endswith('mask'):
                for key in ('opacity', 'blend', 'inheritAlpha'):
                    if value[key] != current[key]:
                        raise ValueError('蒙版仅支持启用或停用；保留原有蒙版内容')
                if node.type() == 'selectionmask' and value != {'id': value['id'], **current}:
                    raise ValueError('选区蒙版不参与图像显影')

    def apply(self, session, changes):
        for value in changes:
            node = session['nodes'][value['id']]
            current = state(node)
            for key, setter in [('visible', node.setVisible), ('opacity', node.setOpacity),
                                ('blend', node.setBlendingMode), ('inheritAlpha', node.setInheritAlpha)]:
                if current[key] != value[key]:
                    setter(value[key])
            if node.type() == 'grouplayer' and current['passThrough'] != value['passThrough']:
                node.setPassThroughMode(value['passThrough'])
        session['doc'].refreshProjection()
        session['doc'].waitForDone()

    def render(self, session, path):
        config = InfoObject()
        for key, value in {'alpha': True, 'compression': 3, 'forceSRGB': True,
                           'indexed': False, 'interlaced': False, 'saveSRGBProfile': True}.items():
            config.setProperty(key, value)
        if not session['doc'].exportImage(str(path), config):
            raise ValueError('Krita 未能导出合成图')

    def surfaces(self, session, directory, projections=None):
        """Read-only source-UV snapshot, with native isolated clipping islands.

        Krita resolves each isolated group's clipping and blend modes once.
        Ordinary paint layers retain their individual identity and mesh; no
        source nodes, masks, visibility or document bytes are changed.
        """
        doc = session['doc']
        if doc.colorModel() != 'RGBA' or doc.colorDepth() != 'U8' or 'srgb' not in doc.colorProfile().lower():
            raise ValueError('部件试验需要 8 位 sRGB 图层；请在 Krita 中另存副本')
        rows = {r['id']: r for r in session['rows']}
        islands = set()
        def ancestor(key):
            return rows[key]['parentId']
        def isolate(key):
            while key:
                n = session['nodes'][key]
                if n.type() == 'grouplayer' and not n.passThroughMode() and n.blendingMode() == 'normal' and not n.inheritAlpha():
                    islands.add(key)
                    return
                key = ancestor(key)
            raise ValueError('依赖外部底图的剪贴或混合需要隔离组；原生预览保持不变')
        for key, node in session['nodes'].items():
            if node.type() == 'transformmask' or node.type() == 'filtermask':
                raise ValueError('请先将变形或滤镜蒙版整理到部件副本，再进行部件试验')
            if node.type() == 'grouplayer':
                if node.blendingMode() != 'normal' or node.inheritAlpha():
                    isolate(ancestor(key))
                elif node.opacity() != 255 or any(n.type().endswith('mask') for n in node.childNodes()):
                    isolate(key)
            elif not node.type().endswith('mask'):
                if node.type() != 'paintlayer':
                    raise ValueError('部件试验需要绘画层；请先整理特殊节点到部件副本')
                if node.blendingMode() != 'normal' or node.inheritAlpha():
                    isolate(ancestor(key))
        records = []
        directory.mkdir(exist_ok=True)
        by_uuid = {r['uuid']: r for r in session['rows']}
        projection_groups = {}
        for binding in (projections or []):
            shadow = by_uuid.get(binding.get('shadowLayerUuid'))
            base = by_uuid.get(binding.get('clipBaseLayerUuid'))
            if not shadow or not base:
                raise ValueError('投影来源不属于当前文档')
            parent = shadow['parentId']
            n = session['nodes'][shadow['id']]
            if parent != base['parentId'] or parent not in islands or binding.get('follow') != 'caster' or n.type() != 'paintlayer' or n.blendingMode() not in ('normal', 'multiply') or not n.inheritAlpha() or n.childNodes():
                raise ValueError('此投影混合结构尚不支持动态裁切，保留原生预览')
            projection_groups.setdefault(parent, []).append((binding, shadow, base))
        for key, entries in projection_groups.items():
            allowed = {s['id'] for _, s, _ in entries} | {b['id'] for _, _, b in entries}
            if len({b['id'] for _, _, b in entries}) != 1 or any(r['parentId'] == key and r['id'] not in allowed for r in session['rows']):
                raise ValueError('投影隔离组含有额外合成依赖，保留原生预览')
        extra_index = len(session['rows'])
        def save_pixels(raw, rect):
            nonlocal extra_index
            if len(raw) != rect.width() * rect.height() * 4:
                raise ValueError('投影像素格式不匹配')
            name = 'part-%d-original.png' % extra_index
            extra_index += 1
            image = QImage(raw, rect.width(), rect.height(), rect.width() * 4, QImage.Format_ARGB32).copy()
            if not image.save(str(directory / name), 'PNG'):
                raise ValueError('无法读取投影像素')
            return name
        for row in reversed(session['rows']):
            node = session['nodes'][row['id']]
            parent = row['parentId']
            covered = False
            while parent:
                if parent in islands:
                    covered = True
                    break
                parent = ancestor(parent)
            if covered or (node.type() != 'paintlayer' and row['id'] not in islands):
                continue
            b = node.bounds().intersected(QRect(0, 0, doc.width(), doc.height()))
            if b.isEmpty():
                continue
            files = {}
            composited = row['id'] in islands
            content_hash = None
            for kind, read in [('original', node.projectionPixelData if composited else node.pixelData), ('masked', node.projectionPixelData)]:
                raw = bytes(read(b.x(), b.y(), b.width(), b.height()))
                if len(raw) != b.width() * b.height() * 4:
                    raise ValueError('部件像素格式不匹配')
                if kind == 'original':
                    content_hash = hashlib.sha256(raw).hexdigest()
                image = QImage(raw, b.width(), b.height(), b.width() * 4, QImage.Format_ARGB32).copy()
                name = 'part-%d-%s.png' % (len(records), kind)
                if not image.save(str(directory / name), 'PNG'):
                    raise ValueError('无法读取部件像素')
                files[kind] = name
            visible = node.visible()
            parent = row['parentId']
            while parent:
                visible = visible and session['nodes'][parent].visible()
                parent = next(r['parentId'] for r in session['rows'] if r['id'] == parent)
            namespace, name, path = part_label(row['name'])
            part_path = namespace + path if namespace else None
            group = namespace + path.rsplit('/', 1)[0] if '/' in path else row['parentId'] or row['id']
            members = []
            source_layers = []
            source_digest = hashlib.sha256()
            if composited:
                for candidate in sorted(session['rows'], key=lambda r: r['uuid']):
                    parent = candidate['parentId']
                    while parent and parent != row['id']:
                        parent = ancestor(parent)
                    if parent == row['id']:
                        members.append(candidate['uuid'])
                        source = session['nodes'][candidate['id']]
                        source_digest.update(candidate['uuid'].encode('ascii'))
                        source_digest.update(source.type().encode('ascii'))
                        if source.type() == 'paintlayer':
                            sb = source.bounds().intersected(QRect(0, 0, doc.width(), doc.height()))
                            source_digest.update(json.dumps([sb.x(), sb.y(), sb.width(), sb.height()]).encode('ascii'))
                            if not sb.isEmpty():
                                source_raw = bytes(source.pixelData(sb.x(), sb.y(), sb.width(), sb.height()))
                                source_digest.update(source_raw)
                                source_layers.append({'uuid': candidate['uuid'], 'contentHash': hashlib.sha256(source_raw).hexdigest(), 'bounds': {'x': sb.x(), 'y': sb.y(), 'width': sb.width(), 'height': sb.height()}})
                # A shadow visibility/opacity edit changes the flattened colour,
                # not its source identity. Fingerprint original member pixels.
                content_hash = source_digest.hexdigest()
            projection = None
            if row['id'] in projection_groups:
                entries = projection_groups[row['id']]
                states = [(session['nodes'][s['id']], session['nodes'][s['id']].visible()) for _, s, _ in entries]
                try:
                    for n, _ in states:
                        n.setVisible(False)
                    doc.refreshProjection()
                    doc.waitForDone()
                    base_file = save_pixels(bytes(node.projectionPixelData(b.x(), b.y(), b.width(), b.height())), b)
                finally:
                    for n, state in states:
                        n.setVisible(state)
                    doc.refreshProjection()
                    doc.waitForDone()
                shadows = []
                for binding, shadow, _ in sorted(entries, key=lambda e:session['rows'].index(e[1]), reverse=True):
                    n = session['nodes'][shadow['id']]
                    sb = n.bounds().intersected(QRect(0, 0, doc.width(), doc.height()))
                    if sb.isEmpty():
                        continue
                    shadows.append({**binding, 'original':save_pixels(bytes(n.pixelData(sb.x(), sb.y(), sb.width(), sb.height())), sb),
                                    'blendMode':n.blendingMode(), 'opacity':n.opacity(), 'visible':n.visible() and visible,
                                    'bounds':{'x':sb.x(), 'y':sb.y(), 'width':sb.width(), 'height':sb.height()}})
                projection = {'base':base_file, 'shadows':shadows, 'version':1}
            records.append({'id':row['id'], 'uuid':row['uuid'], 'legacyId':row['legacyId'],
                            'partPath':part_path, 'sourceLayers':source_layers, 'sourceLayerUuids':members if composited else [row['uuid']],
                            'contentHash':content_hash,
                            'partId':group, 'name':name, 'visible':visible, 'opacity':node.opacity(),
                            'composited':composited, 'projection':projection,
                            'bounds':{'x':b.x(), 'y':b.y(), 'width':b.width(), 'height':b.height()}, **files})
        return {'layers':records, 'width':doc.width(), 'height':doc.height()}

    def run(self, job):
        key = job['session']
        if job['op'] == 'open':
            if key in self.docs or len(self.docs) >= 4:
                raise ValueError('打开的文件过多，请关闭其他文件后重试')
            doc = Krita.instance().openDocument(job['input'])
            if not doc:
                raise ValueError('Krita 无法打开此文件')
            try:
                doc.setBatchmode(True)
                doc.waitForDone()
                if job.get('psd') is not None:
                    self.import_psd(doc, job['psd'])
                nodes, rows = self.tree(doc)
                session = {'doc': doc, 'nodes': nodes, 'rows': rows,
                           'baseline': {row['id']: {k: row[k] for k in FIELDS} for row in rows}}
                self.render(session, Path(job['output']))
                self.docs[key] = session
                return self.metadata(session, True)
            except Exception:
                doc.close()
                raise
        if key not in self.docs:
            raise ValueError('图层会话已结束，请重新打开文件')
        session = self.docs[key]
        if job['op'] == 'surfaces':
            return self.surfaces(session, Path(job['output']), job.get('projections'))
        if job['op'] == 'close':
            session['doc'].setModified(False)
            session['doc'].close()
            del self.docs[key]
            return {'closed': True}
        if job['op'] == 'export':
            # A new KRA preserves all imported nodes/masks; the original stays untouched.
            if not session['doc'].saveAs(job['output']):
                raise ValueError('无法保存图层工程')
            session['doc'].waitForDone()
            return {'saved': True}
        if job['op'] != 'compose':
            raise ValueError('未知图层操作')
        changes = job['state']
        self.validate(session, changes)
        before = [{'id': key, **state(node)} for key, node in session['nodes'].items()]
        try:
            self.apply(session, changes)
            self.render(session, Path(job['output']))
            return self.metadata(session)
        except Exception:
            self.apply(session, before)
            raise

    def poll(self):
        path = ROOT / 'request.json'
        if not path.exists():
            return
        self.timer.stop()
        job = {}
        try:
            job = json.loads(path.read_text())
            path.unlink()
            result = {'id': job['id'], 'ok': True, 'value': self.run(job)}
        except Exception as error:
            traceback.print_exc()
            result = {'id': job.get('id'), 'ok': False, 'error': str(error)}
        atomic(ROOT / 'response.json', result)
        self.timer.start(80)

Krita.instance().addExtension(Layers(Krita.instance()))
