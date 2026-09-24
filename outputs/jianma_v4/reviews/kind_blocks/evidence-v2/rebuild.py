from pathlib import Path
from PIL import Image, ImageDraw, ImageChops, ImageFilter
import xml.etree.ElementTree as ET
import copy, json, hashlib, subprocess, re
E=Path('reviews/kind_blocks/evidence-v2'); (E/'isolated').mkdir(exist_ok=True); (E/'segments').mkdir(exist_ok=True); (E/'combinations').mkdir(exist_ok=True)
S=Path('reviews/kind_blocks/candidates/character-v2.svg'); root=ET.parse(S).getroot(); ns='{http://www.w3.org/2000/svg}'
groups=root.findall(ns+'g'); parts=list(dict.fromkeys(g.get('data-part') for g in groups))
expected=re.findall(r'^  - id: (\w+)',Path('structure/parts.yaml').read_text(),re.M)
jobs=[{'input':str(S),'output':str(E/'candidate.png')}]
def create(name, selected):
 r=copy.deepcopy(root)
 for g in r.findall(ns+'g'):
  if g.get('id') not in selected:r.remove(g)
 f=E/(name+'.svg');ET.ElementTree(r).write(f,encoding='utf-8',xml_declaration=True)
 jobs.append({'input':str(f),'output':str(f.with_suffix('.png'))})
for p in expected:create('isolated/'+p,[g.get('id') for g in groups if g.get('data-part')==p])
for p in parts:
 gs=[g for g in groups if g.get('data-part')==p]
 if len(gs)>1:
  for g in gs:create('segments/'+g.get('id'),[g.get('id')])
combos={
 'body_only':{'face','eyes','mouth','body','lower_body','arms'},
 'garment_only':{'clothing'}, 'hair_only':{'hair'},
 'body_garment':{'face','eyes','mouth','body','lower_body','arms','clothing'},
 'head_hair':{'face','eyes','mouth','hair'},
 'accessories_only':{'physics_details'}}
for name,kinds in combos.items():create('combinations/'+name,[g.get('id') for g in groups if g.get('data-kind') in kinds])
(E/'jobs.json').write_text(json.dumps(jobs))
renderer=E/'render.cjs';renderer.write_text('''const fs=require('fs'); const {Resvg}=require(process.cwd()+'/tmp/block-drawing/runtime/node_modules/@resvg/resvg-js'); for (const j of JSON.parse(fs.readFileSync(process.argv[2]))) { const r=new Resvg(fs.readFileSync(j.input)); fs.writeFileSync(j.output,r.render().asPng()); }''')
subprocess.run(['node',str(renderer),str(E/'jobs.json')],check=True)
report={'sha256':hashlib.sha256(S.read_bytes()).hexdigest(),'canvas':[root.get('width'),root.get('height')],'expected_count':len(expected),'actual_count':len(parts),'groups':len(groups),'missing':sorted(set(expected)-set(parts)),'extra':sorted(set(parts)-set(expected)),'parts':[]}
def white(im):return Image.alpha_composite(Image.new('RGBA',im.size,'white'),im.convert('RGBA')).convert('RGB')
for p in expected:
 im=Image.open(E/'isolated'/f'{p}.png').convert('RGBA'); box=im.getchannel('A').getbbox()
 report['parts'].append({'part':p,'bbox':box,'groups':[{'id':g.get('id'),'path_count':len(g.findall(ns+'path'))} for g in groups if g.get('data-part')==p]})
(E/'structure-check.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
# Keep native-coordinate isolated renders. Contact sheets are only navigation, never used for source registration.
for page in range(4):
 chosen=expected[page*12:(page+1)*12]; out=Image.new('RGB',(1200,1120),'#e5e5e5');d=ImageDraw.Draw(out)
 for i,p in enumerate(chosen):
  im=Image.open(E/'isolated'/f'{p}.png').convert('RGBA');b=im.getchannel('A').getbbox();c=white(im).crop((max(0,b[0]-5),max(0,b[1]-5),min(941,b[2]+5),min(1672,b[3]+5)));c.thumbnail((275,310))
  x=(i%4)*300;y=(i//4)*373;out.paste(c,(x+(300-c.width)//2,y+40+(310-c.height)//2));d.text((x+8,y+10),p,fill='black');d.text((x+8,y+26),str(b),fill='#555555')
 out.save(E/f'contact-{page+1}.png')
ref=Image.open('references/base-subject.png').convert('RGBA');cand=Image.open(E/'candidate.png').convert('RGBA');assert ref.size==cand.size
regions={'full':(0,0,941,1672,1),'head':(300,0,290,340,3),'face':(370,165,150,115,5),'shoulders':(290,270,320,190,3),'torso_hips':(290,450,315,370,2),'hands':(190,730,500,165,3),'feet':(345,1440,200,215,4),'hair_left':(0,390,325,1065,1),'hair_right':(590,390,351,1065,1),'neck_join':(340,230,210,160,3)}
for name,(x,y,w,h,s) in regions.items():
 dest=E/'compare'/name
 subprocess.run(['python3','/Users/wutian/Desktop/coding/AstraLayering/workflows/3.大层分层稿/3.2.建立色块分层/review/compare.py','--reference','references/base-subject.png','--rendered',str(E/'candidate.png'),'--out',str(dest),'--crop',str(x),str(y),str(w),str(h),'--scale',str(s)],check=True,stdout=subprocess.DEVNULL)
 (dest/'crop.json').write_text(json.dumps({'x':x,'y':y,'width':w,'height':h,'scale':s}))
# A registered body/garment/hair combination overview.
for cname in combos:
 im=white(Image.open(E/'combinations'/f'{cname}.png')); im.save(E/'combinations'/f'{cname}-white.png')
print(json.dumps({k:v for k,v in report.items() if k!='parts'},ensure_ascii=False))
