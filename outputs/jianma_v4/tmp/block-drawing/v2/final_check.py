from PIL import Image
from pathlib import Path
import xml.etree.ElementTree as E,hashlib,json
p=Path('tmp/block-drawing/v2');base=Image.open('references/base-subject.png').convert('RGBA');v=Image.open('tmp/block-drawing/transparent.png').convert('RGBA');v.putalpha(v.getchannel('A').point(lambda a:round(a*.5)));o=Image.alpha_composite(base,v);o.save(p/'full-overlay.png')
regions={'toes':(358,1570,528,1644),'hand_right':(200,785,265,883),'hand_left':(620,785,685,883),'anklets':(380,1460,510,1588),'crown':(390,43,490,101),'earring_right':(368,215,414,335),'earring_left':(478,215,521,335)}
for n,b in regions.items():
 sc=4 if n=='anklets' else 6;o.crop(b).resize(((b[2]-b[0])*sc,(b[3]-b[1])*sc)).save(p/(n+'-blend.png'))
ns='{http://www.w3.org/2000/svg}';old=E.parse('reviews/kind_blocks/candidates/character-v1.svg').getroot();new=E.parse('block-layers/character.svg').getroot()
a={g.attrib['id']:E.tostring(g) for g in old.findall(ns+'g')};b={g.attrib['id']:E.tostring(g) for g in new.findall(ns+'g')};changed=[k for k in a if a[k]!=b[k]]
assert set(changed)==set(['foot_right','foot_left','hand_right','hand_left','foot_chain_right','foot_chain_left','headdress_center','earring_right','earring_left']),changed
assert len(b)==50
assert len({g.attrib['data-part'] for g in new.findall(ns+'g')})==46
assert all(el.attrib['d'].rstrip().endswith('Z') for el in new.iter(ns+'path'))
report={'parts':46,'groups':50,'changed_groups':changed,'unchanged_groups':50-len(changed),'posterior_ankle_and_branch_groups_unchanged':True,'svg_sha256':hashlib.sha256(Path('block-layers/character.svg').read_bytes()).hexdigest(),'png_sha256':hashlib.sha256(Path('block-layers/preview.png').read_bytes()).hexdigest()}
(p/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False))
