"""Reference-guided, semantic SVG reconstruction. Python 3.12.

Dependencies: pillow numpy scipy opencv-python-headless skia-python potracer.
The existing demo supplies anatomical/garment construction guides only.
Visible contours, ink and flat colours are rebuilt from the supplied JPG.
No reference bitmap is embedded in the SVG.
"""
from pathlib import Path
from copy import deepcopy
import argparse
import hashlib
import json
import shutil
import time
import xml.etree.ElementTree as ET

import cv2
import numpy as np
import potrace
import skia
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

try:
    from native_trace import trace as native_trace
except OSError:
    native_trace = None

HERE = Path(__file__).resolve().parent
WORK = HERE / 'work'
ROOT = HERE.parent.parent
NS = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('', NS)
ET.register_namespace('inkscape', INK)
W, H = 1024, 1536
S = 2


def tag(n):
    return '{' + NS + '}' + n


def render(xml, w=W, h=H):
    dom = skia.SVGDOM.MakeFromStream(skia.MemoryStream(xml.encode() if isinstance(xml, str) else xml))
    surface = skia.Surface(w, h)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorTRANSPARENT)
    canvas.scale(w / W, h / H)
    dom.render(canvas)
    return surface.makeImageSnapshot().toarray(colorType=skia.ColorType.kRGBA_8888_ColorType)


def seed_mask(part):
    large = part['id'].startswith(('train_', 'ponytail_', 'thigh_', 'calf_', 'foot_',
                                  'upperarm_', 'forearm_', 'hand_', 'sidelock_',
                                  'fringe_', 'feather_')) or part['id'] in ['torso', 'neck', 'face', 'hair_back', 'dress', 'cup_L', 'cup_R', 'bow_L']
    shapes = part['shapes'][:1] if large else part['shapes']
    svg = ET.Element(tag('svg'), {'width': str(W), 'height': str(H), 'viewBox': f'0 0 {W} {H}'})
    for shape in shapes:
        attrs = {k: v for k, v in shape.items() if k in ['d', 'cx', 'cy', 'rx', 'ry', 'r', 'transform', 'fill-rule', 'stroke-width']}
        attrs['fill'] = 'none' if shape.get('fill') == 'none' else '#ffffff'
        if shape.get('stroke') and shape.get('stroke') != 'none':
            attrs.update(stroke='#ffffff', **{'stroke-linecap': 'round', 'stroke-linejoin': 'round'})
        ET.SubElement(svg, tag(shape['tag']), attrs)
    return render(ET.tostring(svg))[:, :, 3] > 80


def family(pid):
    if pid.startswith(('ponytail', 'sidelock', 'fringe', 'crown')) or pid in ['hair_back', 'feather_L_slim', 'feather_R_slim']:
        return 'hair'
    if pid.startswith(('train', 'strap', 'cup', 'bow', 'clasp', 'jewel', 'choker', 'feather', 'tie')) or pid == 'dress':
        return 'cloth'
    if pid.startswith(('nails', 'toenails')):
        return 'nails'
    if pid.startswith(('eye', 'lip', 'mouth')) or pid == 'nose':
        return 'feature'
    return 'skin'


def make_ownership(src, parts, masks):
    r, g, b = np.moveaxis(src.astype(float), 2, 0)
    chroma = src.max(2).astype(float) - src.min(2)
    # Reject JPEG background noise, retain pale skin and the narrow drawn contour.
    foreground = ((src.min(2) < 247) & (chroma > 5)) | (src.min(2) < 235)
    core = ((b-r > 55) & (g-r > 18)) | ((r-g > 3) & (r-b > -4) & (r > 155)) | (src.max(2) < 207)
    for part, mask in zip(parts, masks):
        if part['id'].startswith(('eye_white_', 'eye_iris_', 'eye_pupil_', 'eye_irislight_')):
            foreground |= mask
            core |= mask
    foreground &= ndi.distance_transform_edt(~core) <= 1.1
    labels, n = ndi.label(foreground)
    sizes = np.bincount(labels.ravel())
    foreground &= sizes[labels] >= 7
    blue = (b - r > 23) & (g - r > 11)
    skin = (r - g > 5) & (r > 155) & (b - g < 11)
    dark = (r < 108) & (g < 131) & (b < 157)
    owner = np.full((H, W), -1, np.int16)
    allowed = []
    for part, mask in zip(parts, masks):
        f = family(part['id'])
        if f == 'hair':
            ok = ~skin & ((b > r + 8) | (dark & (b >= r)))
        elif f == 'skin':
            ok = ~blue
        elif f == 'nails':
            ok = ~skin & (blue | dark)
        elif f == 'cloth':
            ok = ~skin
        else:
            ok = np.ones((H, W), bool)
        allowed.append(ok)
    # Increasing rank makes the frontmost compatible construction surface win.
    for i, mask in enumerate(masks):
        owner[mask & foreground & allowed[i]] = i
    missing = foreground & (owner < 0)
    ys, xs = np.nonzero(missing)
    best = np.full(len(xs), np.inf)
    result = np.zeros(len(xs), np.int16)
    for i, mask in enumerate(masks):
        if not mask.any():
            continue
        d = ndi.distance_transform_edt(~mask)[ys, xs]
        d += (~allowed[i][ys, xs]) * 500
        # Keep tiny facial features local rather than assigning nearby skin to them.
        if family(parts[i]['id']) == 'feature':
            d += 3
        select = d < best
        result[select] = i
        best[select] = d[select]
    owner[ys, xs] = result
    return owner, foreground


def trace_mask(mask, ox=0, oy=0, scale=S, small=False):
    """Potrace fits cubic Beziers to closed contours, including genuine holes."""
    if not mask.any():
        return ''
    if native_trace is not None:
        return native_trace(mask, ox, oy, scale, small)
    bitmap = potrace.Bitmap(~mask.astype(bool))
    curves = bitmap.trace(turdsize=1 if small else 3, alphamax=1.05, opticurve=True, opttolerance=.16)
    out = []

    def p(pt):
        return f'{pt.x / scale + ox:.2f},{pt.y / scale + oy:.2f}'

    for curve in curves:
        out.append('M' + p(curve.start_point))
        for seg in curve:
            if seg.is_corner:
                out.append('L' + p(seg.c) + ' ' + p(seg.end_point))
            else:
                out.append('C' + p(seg.c1) + ' ' + p(seg.c2) + ' ' + p(seg.end_point))
        out.append('Z')
    return ''.join(out)


def hexcolor(rgb):
    return '#' + ''.join(f'{int(x):02x}' for x in rgb)


def quantize(rgb, visible, family_name):
    if family_name == 'hair':
        rgb = cv2.bilateralFilter(rgb, 5, 15, 1.5)
    pix = rgb[visible]
    if len(pix) == 0:
        return np.array([[252, 241, 237]], np.uint8), np.zeros(visible.shape, np.uint8)
    counts = {'hair': 24, 'skin': 24, 'cloth': 24, 'nails': 16, 'feature': 32}
    k = min(counts[family_name], max(2, len(pix)//8), len(np.unique(pix, axis=0)))
    # Local LAB clustering retains low-contrast dark dress folds that global
    # colour merging would incorrectly discard.
    lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    sample = lab[visible]
    if len(sample) > 45000:
        sample = sample[np.linspace(0, len(sample)-1, 45000).astype(int)]
    cv2.setRNGSeed(8421)
    _, _, centers = cv2.kmeans(sample, k, None, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_MAX_ITER, 35, .08), 1, cv2.KMEANS_PP_CENTERS)
    palette = cv2.cvtColor(np.clip(np.round(centers), 0, 255).astype(np.uint8)[None], cv2.COLOR_LAB2RGB)[0]
    labels = np.zeros(visible.shape, np.uint8)
    best = np.full(visible.shape, np.inf, np.float32)
    for i, center in enumerate(centers):
        d = ((lab - center) ** 2).sum(2)
        take = d < best
        labels[take] = i
        best[take] = d[take]
    # Recover actual RGB colour averages rather than LAB round-trip error.
    for i in range(k):
        members = rgb[visible & (labels == i)]
        if len(members):
            palette[i] = np.rint(members.mean(0))
    return palette, labels


def vector_part(part, mask, owner, index, src):
    visible = owner == index
    hidden = mask & (owner > index)
    complete = visible | hidden
    ys, xs = np.nonzero(complete)
    if not len(xs):
        return []
    x0, x1 = max(0, xs.min()-3), min(W, xs.max()+4)
    y0, y1 = max(0, ys.min()-3), min(H, ys.max()+4)
    crop = (slice(y0, y1), slice(x0, x1))
    comp = complete[crop]
    vis = visible[crop]
    colors, labels = quantize(src[crop], vis, family(part['id']))
    counts = np.bincount(labels[vis], minlength=len(colors))
    dominant = int(counts.argmax())
    if family(part['id']) == 'hair':
        fallback = np.array([70, 173, 236])
    elif family(part['id']) == 'skin':
        fallback = np.array([252, 241, 237])
    elif family(part['id']) == 'cloth':
        fallback = np.array([31, 35, 44])
    else:
        fallback = colors[dominant]
    # The unseen continuation is a solid construction surface; the reference
    # contributes only this part's visible markings and colours.
    h2, w2 = comp.shape[0] * S, comp.shape[1] * S
    big_comp = cv2.resize(comp.astype(np.float32), (w2, h2), interpolation=cv2.INTER_LINEAR) > .4
    big_vis = cv2.resize(vis.astype(np.uint8), (w2, h2), interpolation=cv2.INTER_NEAREST) > 0
    big_labels = cv2.resize(labels, (w2, h2), interpolation=cv2.INTER_NEAREST)
    paths = []
    shape = trace_mask(big_comp, x0, y0, small=family(part['id']) == 'feature')
    if shape:
        paths.append({'d': shape, 'fill': hexcolor(fallback), 'role': 'complete-surface'})
    # Dominant flat paint first, then local tones and finally the darkest ink.
    order = [dominant] + sorted([i for i in range(len(colors)) if i != dominant], key=lambda i: -float(colors[i].mean()))
    positions = np.zeros(len(colors), np.uint8)
    positions[order] = np.arange(len(order))
    levels = positions[big_labels]
    for position, ci in enumerate(order):
        # Overlapping cumulative colour regions retain continuous antialiased
        # outlines; disjoint colour tiles would expose seams between Beziers.
        region = big_vis & (levels >= position)
        if not region.any():
            continue
        # Slight coverage overlap eliminates hairline gaps between fitted curves.
        region = cv2.GaussianBlur(region.astype(np.float32), (3,3), .45) > .30
        d = trace_mask(region, x0, y0, small=family(part['id']) == 'feature')
        if d:
            role = 'flat-fill' if ci == dominant else 'ink-and-colour-detail'
            paths.append({'d': d, 'fill': hexcolor(colors[ci]), 'role': role})
    return paths


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--only', default='')
    args = parser.parse_args()
    WORK.mkdir(exist_ok=True, parents=True)
    parts = json.loads((WORK / 'part-seeds.json').read_text())
    source = Image.open(args.source).convert('RGB')
    if args.source.resolve() != (HERE/'reference.jpg').resolve():
        shutil.copy2(args.source, HERE/'reference.jpg')
    raw = np.array(source)
    # Suppress only JPEG noise, keeping fine pencil-like contours.
    src = cv2.bilateralFilter(raw, 5, 7, 1.4)
    if (WORK / 'ownership.npz').exists():
        cache = np.load(WORK / 'ownership.npz')
        masks, owner = cache['masks'], cache['owner']
    else:
        masks = np.array([seed_mask(p) for p in parts])
        owner, _ = make_ownership(raw, parts, masks)
        np.savez_compressed(WORK / 'ownership.npz', masks=masks, owner=owner)
    rng = np.random.default_rng(567)
    colors = rng.integers(30, 230, (len(parts), 3), dtype=np.uint8)
    vis = np.full((H,W,3), 254, np.uint8)
    vis[owner>=0] = colors[owner[owner>=0]]
    Image.fromarray(vis).save(WORK / 'ownership.png')
    for i, part in enumerate(parts):
        cache = WORK / (part['id'] + '.json')
        if args.only and part['id'] not in args.only.split(','):
            continue
        if cache.exists():
            continue
        started = time.time()
        paths = vector_part(part, masks[i], owner, i, src)
        cache.write_text(json.dumps(paths, ensure_ascii=False))
        print(f"{i+1:02}/{len(parts)} {part['id']}: {len(paths)} colour paths, {time.time()-started:.1f}s", flush=True)
    if args.only:
        return
    svg = ET.Element(tag('svg'), {'id':'character-svg', 'width':str(W), 'height':str(H), 'viewBox':f'0 0 {W} {H}', 'version':'1.1', 'role':'img'})
    ET.SubElement(svg, tag('title')).text = '深海少女 · 平涂分层矢量临摹'
    ET.SubElement(svg, tag('desc')).text = '依据用户提供的平涂参考图重建。所有图形均为闭合贝塞尔 path，采用独立 fill；顶层语义图层按从后到前排序。drawing-sequence 完整记录先建立路径、再逐一赋色的两阶段构建顺序。'
    manifest = []
    manifest_node = ET.SubElement(svg, tag('metadata'), {'id':'layer-manifest'})
    history_node = ET.SubElement(svg, tag('metadata'), {'id':'drawing-sequence'})
    source_node = ET.SubElement(svg, tag('metadata'), {'id':'source-and-method'})
    source_node.text = json.dumps({'source_sha256':hashlib.sha256(args.source.read_bytes()).hexdigest(), 'reference_size':[W,H], 'construction_guides':'demos/wu-tian807/miku深海少女服装.svg; structural silhouettes only', 'visible_art':'Contours and locally sampled flat colours reconstructed from the supplied JPG', 'hidden_surfaces':'Inferred continuations beneath the subsequent independent parts; not ground-truth unseen anatomy', 'coordinates':'Original reference pixel coordinates; L/R indicate image left/right', 'raster_images_embedded':False}, ensure_ascii=False)
    all_parts = [{'id':'background', 'name':'白色背景（可隐藏）', 'category':'背景'}] + parts
    created = []
    for rank, part in enumerate(all_parts):
        manifest.append({k:part[k] for k in ['id','name','category']} | {'rank':rank})
        g = ET.SubElement(svg, tag('g'), {'id':part['id'], 'data-name':part['name'], 'data-category':part['category'], 'data-rank':str(rank), '{'+INK+'}groupmode':'layer', '{'+INK+'}label':part['name']})
        ET.SubElement(g, tag('title')).text = part['name']
        if rank == 0:
            paths = [{'d':f'M0,0H{W}V{H}H0Z','fill':'#fefefe','role':'background'}]
        else:
            paths = json.loads((WORK / (part['id']+'.json')).read_text())
        for j,p in enumerate(paths):
            pid = f"{part['id']}-path-{j+1:03}"
            # Geometry is actually created unfilled. Assignment of every final
            # fill happens only after all paths have been constructed below.
            node = ET.SubElement(g, tag('path'), {'id':pid, 'd':p['d'], 'fill':'none', 'fill-rule':'evenodd', 'data-role':p['role'], 'data-draw-step':str(len(created)+1)})
            created.append((node,p['fill'],part['id']))
    events = []
    for i,(node,color,partid) in enumerate(created):
        events.append({'step':i+1,'action':'draw-path','target':node.get('id'),'layer':partid})
    count = len(created)
    for i,(node,color,partid) in enumerate(created):
        node.set('fill',color)
        node.set('data-final-fill',color)
        node.set('data-fill-step',str(count+i+1))
        events.append({'step':count+i+1,'action':'fill-path','target':node.get('id'),'fill':color,'layer':partid})
    manifest_node.text = json.dumps({'version':'0.1','layers':manifest},ensure_ascii=False)
    history_node.text = json.dumps({'version':'1.0','kind':'deterministic-svg-construction-record','note':'Records this SVG construction and colouring order; not an original-artist pen-stroke recording.', 'path_count':count,'phase1':{'action':'draw-path','first':1,'last':count},'phase2':{'action':'fill-path','first':count+1,'last':count*2},'events':events},ensure_ascii=False)
    ET.indent(svg, space='  ')
    final = ET.tostring(svg, encoding='utf-8', xml_declaration=True)
    (HERE/'深海少女_平涂分层.svg').write_bytes(final)
    (HERE/'drawing-sequence.json').write_text(json.dumps({'layers':manifest,'events':events},ensure_ascii=False,indent=2))
    arr=render(final,w=W*2,h=H*2)
    Image.fromarray(arr).save(HERE/'深海少女_预览.png')
    print(f'COMPLETE: {len(manifest)} layers, {count} closed filled paths, {len(final):,} bytes',flush=True)


if __name__=='__main__':
    main()
