from pathlib import Path
import re
import xml.etree.ElementTree as ET

OUT = Path('refinement/groups/legs/right_leg/2.直属拆分与色块/2.2.直属轮廓色块')
source = (OUT / 'work/input-guide.svg').read_text()
root = ET.fromstring(source)
parent = next(n for n in root.iter() if n.get('id') == 'legs-right-leg-silhouette')
path = parent.get('d')
outer, hole = path.split(' Z M ', 1)

def segment(start, end):
    return outer[outer.index(start):outer.index(end)]

# All visible contour segments are inherited byte for byte. Only the hidden,
# rounded knee/ankle overlaps are authored here, following the opposite leg.
thigh = (
    segment('M 553 706', ' C 516 1169')
    + ' C 516 1170 499 1182 479 1182 C 461 1182 445 1169 442 1151'
    + outer[outer.index(' C 439 1135'):]
    + ' Z'
)
lower_leg = (
    'M 514 1144' + segment(' C 516 1169', ' C 497 1594')
    + ' C 497 1594 490 1616 475 1616 C 461 1616 451.4 1610 452 1597'
    + segment(' C 453 1584', ' C 439 1135')
    + ' C 439 1126 456 1108 479 1108 C 502 1108 512 1120 514 1144 Z'
)
foot = (
    'M 500 1559' + segment(' C 503 1569', ' C 450 1566')
    + ' C 450 1566 461 1549 474 1546 C 486 1543 497 1547 500 1559 Z M '
    + hole
)

items = [
    ('part', 'thigh', '#E99296', thigh,
     '完整右大腿：保留圆髋根及本侧外缘；膝端平滑收圆至y1182，与小腿圆膝根重叠。隐藏端部不作横切缝。'),
    ('part', 'lower_leg', '#79BCA4', lower_leg,
     '完整右小腿：圆膝根最高约y1108，沿既有膝下、胫前和踝部外缘；踝端收圆至y1616，与foot搭接。'),
    ('group', 'foot', '#A699D8', foot,
     '完整右脚：圆踝根上延至约y1546，保留本侧足背、五趾和真实趾间孔；蓝色链饰归独立right_anklet。'),
]
children = ''
for kind, name, color, geometry, description in items:
    identity = f'{kind}-legs-right_leg-{name}'
    children += (f'\n    <g id="{identity}" data-{kind}-path="legs/right_leg/{name}" fill="{color}" stroke="none">'
                 f'\n      <desc>{description}</desc>'
                 f'\n      <path id="{identity}-silhouette" d="{geometry}" fill="{color}" stroke="none" fill-rule="evenodd" />'
                 '\n    </g>')
match = re.search(r'<g id="group-legs-right-leg"[^>]*>.*?</g>', source, re.S)
assert match is not None
assert all(f'id="{kind}-legs-right_leg-{name}"' not in source for kind,name,*_ in items)
candidate = source[:match.end()] + children + source[match.end():]
assert candidate.replace(children, '', 1) == source
ET.fromstring(candidate)
(OUT / 'work/candidate.svg').write_text(candidate)
print(OUT / 'work/candidate.svg')
