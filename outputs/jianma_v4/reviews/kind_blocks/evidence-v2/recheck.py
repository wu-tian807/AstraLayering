from pathlib import Path
from PIL import Image,ImageChops,ImageFilter,ImageDraw
import subprocess,json,xml.etree.ElementTree as ET,hashlib
E=Path('reviews/kind_blocks/evidence-v2')
regions={'toes':(358,1570,170,74,6),'hand_right':(200,785,65,98,6),'hand_left':(620,785,65,98,6),'crown':(392,43,100,62,6),'anklets':(380,1460,130,128,4),'earring_right':(368,215,46,120,6),'earring_left':(478,215,43,120,6)}
for name,(x,y,w,h,s) in regions.items():
 subprocess.run(['python3','/Users/wutian/Desktop/coding/AstraLayering/workflows/3.大层分层稿/3.2.建立色块分层/review/compare.py','--reference','references/base-subject.png','--rendered',str(E/'candidate.png'),'--out',str(E/'compare'/name),'--crop',str(x),str(y),str(w),str(h),'--scale',str(s)],check=True,stdout=subprocess.DEVNULL)
 (E/'compare'/name/'crop.json').write_text(json.dumps({'x':x,'y':y,'width':w,'height':h,'scale':s}))
white=lambda im:Image.alpha_composite(Image.new('RGBA',im.size,'white'),im.convert('RGBA')).convert('RGB')
ref=Image.open('references/base-subject.png').convert('RGBA');part=Image.open(E/'isolated/headdress_center.png').convert('RGBA');box=(390,43,490,101)
a=part.getchannel('A');edge=ImageChops.subtract(a.filter(ImageFilter.MaxFilter(3)),a.filter(ImageFilter.MinFilter(3)));ink=Image.new('RGBA',part.size,(220,20,150,0));ink.putalpha(edge);over=Image.alpha_composite(ref,ink)
out=Image.new('RGB',(1800,348),'white')
for i,im in enumerate([ref,part,over]):out.paste(white(im).crop(box).resize((600,348)),(600*i,0))
out.save(E/'crown-isolated-comparison.png')
for name,box,parts in [('feet-isolated',(355,1570,530,1645),['foot_right','foot_left']),('hands-isolated',(205,797,678,885),['hand_right','hand_left']),('foot-chains-isolated',(378,1455,510,1590),['foot_chain_right','foot_chain_left']),('earrings-isolated',(380,215,510,323),['earring_left','earring_right'])]:
 im=Image.new('RGBA',(941,1672))
 for p in parts:im=Image.alpha_composite(im,Image.open(E/'isolated'/f'{p}.png').convert('RGBA'))
 im=white(im).crop(box);im.resize((im.width*5,im.height*5)).save(E/(name+'.png'))
ns='{http://www.w3.org/2000/svg}';a=ET.parse('reviews/kind_blocks/candidates/character-v1.svg').getroot();b=ET.parse('reviews/kind_blocks/candidates/character-v2.svg').getroot()
grp=lambda r:{g.get('id'):ET.tostring(g) for g in r.findall(ns+'g')};ga,gb=grp(a),grp(b)
unchanged=[k for k in ga if ga[k]==gb[k]];changed=[k for k in ga if ga[k]!=gb[k]]
unchanged_parts=sorted(set(g.get('data-part') for g in b.findall(ns+'g') if g.get('id') in unchanged)-set(g.get('data-part') for g in b.findall(ns+'g') if g.get('id') in changed))
pixel_equal=[]
for p in unchanged_parts:
 p1=Image.open(Path('reviews/kind_blocks/evidence-v1/isolated')/(p+'.png'));p2=Image.open(E/'isolated'/(p+'.png'))
 if ImageChops.difference(p1,p2).getbbox() is None:pixel_equal.append(p)
reg={'changed_groups':changed,'unchanged_groups':unchanged,'added':sorted(set(gb)-set(ga)),'removed':sorted(set(ga)-set(gb)),'root_attributes_equal':a.attrib==b.attrib,'order_equal':list(ga)==list(gb),'unchanged_whole_parts':unchanged_parts,'pixel_equal_unchanged_parts':pixel_equal,'sha256':hashlib.sha256(Path('reviews/kind_blocks/candidates/character-v2.svg').read_bytes()).hexdigest()}
(E/'regression-check.json').write_text(json.dumps(reg,ensure_ascii=False,indent=2))
print('Independent regression check:',len(changed),'changed,',len(unchanged),'unchanged groups;',len(pixel_equal),'unchanged whole parts have identical renders.')
