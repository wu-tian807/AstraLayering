import xml.etree.ElementTree as ET
from pathlib import Path
import subprocess, copy,json
from PIL import Image,ImageDraw,ImageFont
P=Path('tmp/block-drawing'); (P/'isolated').mkdir(exist_ok=True)
src=ET.parse('block-layers/character.svg');root=src.getroot();ns='{http://www.w3.org/2000/svg}'
groups=list(root.findall(ns+'g'));parts={g.attrib['data-part'] for g in groups}
for part in sorted(parts):
 r=copy.deepcopy(root)
 for g in r.findall(ns+'g'):
  if g.attrib['data-part']!=part:r.remove(g)
 f=P/'isolated'/(part+'.svg');ET.ElementTree(r).write(f,encoding='utf-8',xml_declaration=True)
 subprocess.run(['node','tmp/block-drawing/render.cjs',str(f),str(f.with_suffix('.png'))],check=True)
# Whole body without clothing/hair/accessories verifies connections.
for name,kinds in [('body',{'face','eyes','mouth','body','lower_body','arms'}),('garment',{'clothing'}),('hair',{'hair'})]:
 r=copy.deepcopy(root)
 for g in r.findall(ns+'g'):
  if g.attrib['data-kind'] not in kinds:r.remove(g)
 f=P/(name+'-isolated.svg');ET.ElementTree(r).write(f,encoding='utf-8',xml_declaration=True)
 subprocess.run(['node','tmp/block-drawing/render.cjs',str(f),str(f.with_suffix('.png'))],check=True)
# Each actual part is rendered alone, cropped and captioned to preserve inspecting small shapes.
thumbs=[];report=[]
for part in sorted(parts):
 im=Image.open(P/'isolated'/(part+'.png')).convert('RGB')
 from PIL import ImageChops
 box=ImageChops.difference(im,Image.new('RGB',im.size,'white')).getbbox()
 assert box,part
 b=(max(0,box[0]-8),max(0,box[1]-8),min(941,box[2]+8),min(1672,box[3]+8))
 crop=im.crop(b);crop.thumbnail((212,230))
 tile=Image.new('RGB',(232,270),'#F4F4F4');tile.paste(crop,((232-crop.width)//2,22+(230-crop.height)//2));ImageDraw.Draw(tile).text((7,6),part,fill='black');thumbs.append(tile)
 report.append({'part':part,'bbox':box,'groups':len([g for g in groups if g.attrib['data-part']==part])})
for page in range(3):
 chosen=thumbs[page*16:(page+1)*16];sheet=Image.new('RGB',(232*4,270*4),'white')
 for i,t in enumerate(chosen):sheet.paste(t,((i%4)*232,(i//4)*270))
 sheet.save(P/f'contact-{page+1}.png')
(P/'verification.json').write_text(json.dumps({'part_count':len(parts),'group_count':len(groups),'parts':report},ensure_ascii=False,indent=2))
print('Verified',len(parts),'actual rendered parts,',len(groups),'groups')
