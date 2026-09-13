"""Build README evidence from the real SVG; requires Pillow, Node.js and sharp."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import copy
import hashlib
import json
import os
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = ROOT / 'outputs/step05-base-character/05-2_局部色彩与材质.svg'
REFERENCE = ROOT / 'outputs/case1_miku/references/base-character.png'
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
TAG = lambda name: '{' + NS + '}' + name
FONT_PATH = os.environ.get('ASTRA_DISPLAY_FONT', '/System/Library/Fonts/STHeiti Light.ttc')
FONT = lambda size: ImageFont.truetype(FONT_PATH, size)
BG, INK, MUTED, TEAL = '#f3f6f7', '#20383e', '#647b81', '#147f8b'
tree = ET.parse(SOURCE)
svg = tree.getroot()
tops = [e for e in svg.findall(TAG('g')) if e.get('data-kind') != 'background']
nodes = []


def parts(parent, parent_id=None, depth=0):
    for e in parent:
        if e.tag in {TAG('defs'), TAG('clipPath'), TAG('mask')}:
            continue
        entity = e in tops or e.get('data-role') == 'subpart'
        if entity:
            title = e.findtext(TAG('title')) or e.get('id')
            node = dict(id=e.get('id'), title=title, part=e.get('data-part'),
                        parent=parent_id, depth=depth, top=e in tops)
            nodes.append(node)
            parts(e, node['id'], depth + 1)
        else:
            parts(e, parent_id, depth)


parts(svg)
by_id = {n['id']: n for n in nodes}
assert len(nodes) == len(by_id)


def extract(ids):
    """Preserve ancestor attributes and all definitions; remove other drawing nodes."""
    out = copy.deepcopy(svg)
    definitions = ET.Element(TAG('defs'))
    for d in out.iter(TAG('defs')):
        for child in d:
            definitions.append(copy.deepcopy(child))
    for parent in list(out.iter()):
        for child in list(parent):
            if child.tag == TAG('defs'):
                parent.remove(child)
    keep = set(ids)

    def prune(e):
        if e.get('id') in keep:
            return True
        retained = False
        for child in list(e):
            if child.tag in {TAG('title'), TAG('desc'), TAG('metadata')}:
                continue
            if prune(child):
                retained = True
            else:
                e.remove(child)
        return retained

    prune(out)
    # Each main entity is isolated without its external occluders. Their cast
    # shadows stay separately editable in the source, but are off in this view.
    for group in out.iter(TAG('g')):
        if group.get('data-shading-type') == 'cast':
            group.set('display', 'none')
    out.insert(0, definitions)
    out.attrib.pop('data-stage', None)
    out.find(TAG('title')).text = '阶段5终稿 · 所选部件独显'
    out.find(TAG('desc')).text = '从终稿提取所属实体及全部定义；保留原坐标、完整底形与隐藏延续。独显中关闭已移开遮挡物的外来投影，保留自身体积与局部色彩。'
    return out


def fit(image, size, crop=False):
    image = image.convert('RGBA')
    if crop and image.getbbox():
        image = image.crop(image.getbbox())
    image.thumbnail(size, Image.Resampling.LANCZOS)
    return image


def paste_fit(canvas, image, box, crop=False):
    x, y, w, h = box
    im = fit(image.copy(), (w, h), crop)
    canvas.paste(im, (x + (w-im.width)//2, y + (h-im.height)//2), im)


def label(draw, xy, text, size=22, color=INK):
    draw.text(xy, text, font=FONT(size), fill=color)


def ellipsis(text, limit=25):
    return text if len(text) <= limit else text[:limit-1] + '…'


def tree_image(width=565, row=43, active=None):
    im = Image.new('RGB', (width, len(nodes)*row + 16), 'white')
    d = ImageDraw.Draw(im)
    for i, n in enumerate(nodes):
        y = i*row + 8
        x = 14 + n['depth']*20
        if n['id'] == active:
            d.rounded_rectangle((6, y-2, width-12, y+row-3), 6, fill='#e1f2f2')
        d.line((x, y+row-3, width-20, y+row-3), fill='#edf1f2')
        d.rectangle((x, y+9, x+10, y+19), outline=TEAL, width=1)
        label(d, (x+20, y+1), ellipsis(n['title'], 24-n['depth']), 19)
        kind = '实体分组' if n['top'] else '内部子部件'
        label(d, (x+20, y+23), f"{i+1:02d} · {kind}", 11, MUTED)
    return im


def main():
    with tempfile.TemporaryDirectory(prefix='astra-showcase-') as temp:
        work = Path(temp)
        jobs = [dict(source=str(SOURCE), output=str(work/'complete.png'))]
        # Render every main drawing group independently, not only selected examples.
        for e in tops:
            name = e.get('id')
            p = work/(name+'.svg')
            ET.ElementTree(extract([name])).write(p, encoding='utf-8', xml_declaration=True)
            jobs.append(dict(source=str(p), output=str(work/(name+'.png'))))
        manifest = work/'render.json'
        manifest.write_text(json.dumps(jobs))
        node = shutil.which('node') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
        subprocess.run([node, str(HERE/'render.cjs'), str(manifest)], check=True)
        complete = Image.open(work/'complete.png').convert('RGBA')
        reference = Image.open(REFERENCE).convert('RGBA')
        isolated = {e.get('id'): Image.open(work/(e.get('id')+'.png')).convert('RGBA') for e in tops}
        assert all(im.getbbox() for im in isolated.values())

        out = Image.new('RGB', (2200, 1750), BG)
        d = ImageDraw.Draw(out)
        label(d, (54, 26), 'AstraLayering / 首次完整生成', 38)
        label(d, (54, 83), '同一画布 · 同一比例 · 参考彩图与实际分层 SVG', 24, MUTED)
        for x, heading, im in [(54, '参考彩图 · base-character', reference), (1122, '生成结果 · 阶段5终稿', complete)]:
            label(d, (x, 138), heading, 27)
            d.rounded_rectangle((x, 191, x+1024, 1727), 14, fill='white')
            paste_fit(out, im, (x, 191, 1024, 1536))
        out.save(HERE/'reference-vs-svg.png', optimize=True)

        examples = [
            ('body-head-face', '头脸：补全发下额头与侧脸'),
            ('hair-back-head', '后脑发体：保留被前发遮挡的发根'),
            ('hair-left-sweep', '长发：保留根部与被遮挡的连续发体'),
            ('body-neck-torso-pelvis', '躯干：保留衣服下的完整身体底形'),
            ('body-left-arm', '手臂：肩部到腕部的完整底形'),
            ('garment-base', '衣服：完整衣片，可独立替换'),
        ]
        sheet = Image.new('RGB', (1590, 1370), BG)
        d = ImageDraw.Draw(sheet)
        label(d, (32, 24), '独显示例 / 同一份终稿中的完整实体', 32)
        label(d, (32, 77), '独显关闭外来投影，保留本体明暗；下列部件为适应各自卡片而缩放。', 21, MUTED)
        for i, (name, heading) in enumerate(examples):
            x, y = 28+(i%3)*520, 128+(i//3)*612
            d.rounded_rectangle((x, y, x+500, y+588), 12, fill='white')
            label(d, (x+18, y+18), heading, 20)
            paste_fit(sheet, isolated[name], (x+28, y+70, 444, 482), crop=True)
        sheet.save(HERE/'isolated-parts.png', optimize=True)

        # Every semantic node is present. Paint/resource groups are not body parts.
        tall = tree_image(width=660)
        full = Image.new('RGB', (724, tall.height+130), BG)
        d = ImageDraw.Draw(full)
        label(d, (32, 22), '完整部件树 / 36 个绘制分组 + 29 个内部子部件', 23)
        label(d, (32, 65), '按原 SVG 后到前顺序；同归属跨层段可合并提取', 18, MUTED)
        full.paste(tall, (32, 108))
        full.save(HERE/'parts-tree-full.png', optimize=True)

        # A scrolling evidence graphic, not a screenshot of an unimplemented app.
        width, height, viewport = 1460, 950, 610
        frames, durations = [], []
        max_scroll = max(0, tree_image().height-viewport)
        scrolls = [round(max_scroll*i/60) for i in range(61)]
        for i, scroll in enumerate(scrolls):
            frame = Image.new('RGB', (width, height), BG)
            d = ImageDraw.Draw(frame)
            label(d, (30, 22), '完整分层 / 从终稿 SVG 读取的部件树', 30)
            label(d, (30, 71), '31 个实体归属 · 36 个绘制分组 · 29 个内部子部件', 21, MUTED)
            label(d, (30, 130), '阶段5完整组合', 23)
            d.rounded_rectangle((28, 179, 459, 834), 10, fill='white')
            paste_fit(frame, complete, (37, 187, 414, 636))
            label(d, (495, 130), '独显：完整底形与遮挡补全', 23)
            phase = min(len(examples)-1, round(i/60*(len(examples)-1)))
            name, caption = examples[phase]
            d.rounded_rectangle((487, 179, 859, 834), 10, fill='white')
            paste_fit(frame, isolated[name], (507, 218, 332, 526), crop=True)
            label(d, (504, 772), caption.split('：')[0], 23, TEAL)
            label(d, (504, 807), '关闭外来投影 · 保留本体明暗', 15, MUTED)
            label(d, (888, 130), f'部件树  {min(65, scroll//43+1):02d}—{min(65, (scroll+viewport)//43+1):02d} / 65', 23)
            full_tree = tree_image(active=name)
            frame.paste(full_tree.crop((0, scroll, 565, scroll+viewport)), (880, 179))
            d.rounded_rectangle((1436, 181, 1441, 789), 3, fill='#e0e8ea')
            thumb = max(30, viewport*viewport/full_tree.height)
            sy = 181+(viewport-thumb)*(scroll/max_scroll if max_scroll else 0)
            d.rounded_rectangle((1436, sy, 1441, sy+thumb), 3, fill='#599ba5')
            label(d, (888, 811), '完整语义部件树；底形 / 墨线 / 效果资源折叠', 15, MUTED)
            label(d, (30, 869), '实体部件保留当前姿态所需的遮挡补全，可独立显隐和提取图层。', 24)
            label(d, (30, 913), '部件树由源码生成；独显关闭已移开遮挡物的投影，未重绘或补画。', 18, MUTED)
            frames.append(frame)
            durations.append(1800 if i in (0, len(scrolls)-1) else 230)
        # README uses true-color APNG so animation does not change artwork colors.
        frames[0].save(HERE/'parts-tree.png', save_all=True, append_images=frames[1:],
                       duration=durations, loop=0, disposal=0, blend=0, compress_level=9)
        palette = frames[0].resize((730,475)).quantize(colors=248).getpalette()
        # Preserve small pink/purple tips and accessory accents in the GIF palette.
        accents = ['d575bc','9a8bbf','c859a5','8d81be','f6d1c4','edb3a8','5ac8d5','eaf7f6']
        for j, color in enumerate(accents):
            palette[(248+j)*3:(249+j)*3] = [int(color[k:k+2],16) for k in (0,2,4)]
        palette_image = Image.new('P', (1,1)); palette_image.putpalette(palette)
        converted = [im.quantize(palette=palette_image, dither=Image.Dither.FLOYDSTEINBERG) for im in frames]
        converted[0].save(HERE/'parts-tree.gif', save_all=True, append_images=converted[1:],
                          duration=durations, loop=0, disposal=1, optimize=True)

        audit = dict(source=str(SOURCE.relative_to(ROOT)), reference=str(REFERENCE.relative_to(ROOT)),
                     source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                     logical_entities=len({g.get('data-part') for g in tops}),
                     drawing_groups=len(tops), internal_subparts=len(nodes)-len(tops),
                     semantic_nodes=nodes, independently_rendered=[g.get('id') for g in tops],
                     each_main_group_has_base=all(g.find(TAG('g')+'[@data-role="base"]') is not None for g in tops),
                     isolated_view_cast_shadows='Disabled only in isolated display copies; self shading and appearance retained.',
                     isolated_cast_groups=[g.get('id') for g in svg.iter(TAG('g')) if g.get('data-shading-type') == 'cast'],
                     scope='Current-pose complete base shapes. Full semantic tree, excluding paint and resource groups.')
        (HERE/'evidence.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2)+'\n')
        print(json.dumps({p.name:p.stat().st_size for p in HERE.iterdir() if p.suffix in ['.png','.gif']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
