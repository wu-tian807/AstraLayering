from pathlib import Path
from copy import deepcopy
import xml.etree.ElementTree as E,json,subprocess
from PIL import Image,ImageDraw
E.register_namespace('','http://www.w3.org/2000/svg')
e=Path('reviews/kind_blocks/evidence-v2');r=E.parse('reviews/kind_blocks/candidate-v2.svg').getroot()
jobs=[]
for name,ids in {'front-hair-only':['hair_front','hair_side_left','hair_side_right'],'earring-left-only':['earring_left'],'body-base-only':['neck_torso'],'crown-only':['crown','crown_center_frame']}.items():
 v=deepcopy(r)
 for g in list(v):
  if not g.get('data-kind'):continue
  for p in list(g):
   if p.get('id') not in ids:g.remove(p)
 out=e/'variants'/f'{name}.svg';E.ElementTree(v).write(out,encoding='utf-8',xml_declaration=True)
 jobs.append({'source':str(out),'output':str(e/f'{name}.png')})
(e/'detail-jobs.json').write_text(json.dumps(jobs))
