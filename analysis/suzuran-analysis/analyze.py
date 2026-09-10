"""Read-only analysis of the supplied SVG; derivatives are inspection aids.

Hiding SVG strokes does not remove filled ink shapes. These derivatives are
controlled display experiments, not recovered historical versions.
"""
from pathlib import Path
from collections import Counter
from copy import deepcopy
import json
import re
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
SOURCE = OUT / 'source.svg'
NS = '{http://www.w3.org/2000/svg}'
ET.register_namespace('', NS[1:-1])
text = SOURCE.read_text()
root = ET.fromstring(text)
by_id = {e.get('id'): e for e in root.iter() if e.get('id')}
hair_roots = ['rear-crown', 'back-locks', 'left-side-locks', 'bangs',
              'fringe-filaments-v10', 'left-forelock', 'right-foreground-locks']
hair_elements = {e for name in hair_roots for e in by_id[name].iter()}
graphics = {'path', 'ellipse', 'circle', 'rect', 'polygon', 'polyline', 'line'}
stroked_hair = []
widths = []
paint_counts = Counter()


def inspect(e, inherited=None, in_art=False):
    props = dict(inherited or {'fill': 'black', 'stroke': 'none', 'stroke-width': '1'})
    props.update({k: v for k, v in e.attrib.items() if k in props})
    in_art = in_art or e.get('id') == 'illustration'
    if in_art and e.tag.removeprefix(NS) in graphics:
        fill = props['fill'] != 'none'
        stroke = props['stroke'] != 'none'
        paint_counts['fill_and_stroke' if fill and stroke else 'fill_only' if fill
                     else 'stroke_only' if stroke else 'unpainted'] += 1
        if stroke:
            widths.append(float(props['stroke-width']))
        if e in hair_elements and stroke:
            stroked_hair.append(e)
            e.set('data-analysis-stroke', '1')
    for child in e:
        inspect(child, props, in_art)


inspect(root)
root.set('width', '1458')
root.set('height', '1056')
root.set('id', 'suzuran-source-art')
stats = {
    'source': SOURCE.name,
    'viewBox': root.get('viewBox'),
    'element_counts': dict(Counter(e.tag.removeprefix(NS) for e in root.iter())),
    'drawable_path_count': len(list(by_id['illustration'].iter(NS + 'path'))),
    'paint_counts_all_graphics': dict(paint_counts),
    'explicit_and_inherited_stroke_width': {
        'min': min(widths), 'max': max(widths),
        'median': sorted(widths)[len(widths) // 2],
    },
    'experiment_stroked_hair_elements': len(stroked_hair),
    'top_level_order': [e.get('id') for e in by_id['illustration']],
    'groups': [
        {'id': name, 'path_count': len(list(e.iter(NS + 'path'))),
         'source_line': text[:text.index('id="' + name + '"')].count('\n') + 1}
        for name, e in by_id.items() if e.tag == NS + 'g'
    ],
    'notes': [
        'Counts include definitions unless specified as drawable.',
        'Version suffixes are labels, not an authenticated edit history.',
        'The display experiments preserve filled ink and shadow shapes.',
    ],
}
(OUT / 'evidence.json').write_text(json.dumps(stats, ensure_ascii=False, indent=2))
ET.ElementTree(root).write(OUT / 'annotated.svg', encoding='unicode')
for mode in ['original', 'no-hair-strokes', 'heavy-hair-strokes']:
    variant = deepcopy(root)
    if mode != 'original':
        for e in variant.iter():
            if e.get('data-analysis-stroke'):
                e.set('stroke', 'none' if mode == 'no-hair-strokes' else '#302820')
                if mode == 'heavy-hair-strokes':
                    e.set('stroke-width', '3')
    ET.ElementTree(variant).write(OUT / (mode + '.svg'), encoding='unicode')
    # Independent inspection page: artwork scales to the viewport width.
    svg = ET.tostring(variant, encoding='unicode')
    (OUT / (mode + '.html')).write_text(
        '<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Suzuran inspection</title><style>body{margin:0}'
        'svg{display:block;width:100%;height:auto}</style>' + svg + '</html>')
print(json.dumps({k: v for k, v in stats.items() if k != 'groups'}, ensure_ascii=False, indent=2))
