from pathlib import Path
import json, hashlib, subprocess, xml.etree.ElementTree as E, math, re, shutil
from perfect_freehand import get_stroke
BASE=Path('refinement/groups/head/front_hair/temple_sweeps_left')
WORK=BASE/'work'
PY='.runtime/svg-preview/python/bin/python'
TOOL='../../workflow-next/live2d-layering/tools/svg_preview.py'
START='<!-- n27-temple-sweeps-left-artwork-start -->'
END='<!-- n27-temple-sweeps-left-artwork-end -->'
IDS={k:'part-head-front-hair-temple-sweeps-left-'+k.replace('_','-') for k in ['ear_lock','lower_temple_lock','middle_temple_lock','upper_temple_lock']}
def begin():
 if (WORK/'artwork.before.svg').exists():return
 shutil.copyfile('refinement/character.svg',WORK/'artwork.before.svg')
 protected=['block-layers/groups.svg','structure/groups.json','structure/rendering.json','refinement/character.svg']
 (WORK/'protected.before.json').write_text(json.dumps({p:hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in protected},indent=2)+'\n')
root=E.parse('block-layers/groups.svg').getroot()
D={k:next(p for p in next(e for e in root.iter() if e.get('id')==IDS[k]).iter() if p.tag.rsplit('}',1)[-1]=='path').get('d') for k in IDS}
def el(tag,**attrs):
 return E.Element(tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
def path(id,d,desc='',**attrs):
 p=el('path',id=id,d=d,**attrs)
 if desc:E.SubElement(p,'desc').text=desc
 return E.tostring(p,encoding='unicode')
def load():
 return json.loads((WORK/'state.json').read_text())
def save(s):
 (WORK/'state.json').write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
def init():
 begin()
 s={k:{'defs':[], 'nodes':[], 'mask':False} for k in IDS}
 for k in IDS:
  prefix='n27_'+k
  s[k]['defs']=[f'<clipPath id="{prefix}_clip" clipPathUnits="userSpaceOnUse"><path d="{D[k]}" /></clipPath>',f'<mask id="{prefix}_alpha" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="336" y="154" width="84" height="140" mask-type="alpha"><path d="{D[k]}" fill="white" /></mask>']
 return s
def add(s,k,name,content,attrs=''):
 s[k]['nodes'].append({'name':name,'content':content,'attrs':attrs})
def hide(s,k,names):
 for node in s[k]['nodes']:
  if node['name'] in names:node['attrs']='display="none"'
def group(s,k):
 pr='n27_'+k
 attr=f'mask="url(#{pr}_alpha)"' if s[k]['mask'] else f'clip-path="url(#{pr}_clip)"'
 body='<defs>'+''.join(s[k]['defs'])+'</defs>'
 body+=''.join(f'<g id="{pr}_{n["name"]}" {n["attrs"]}>{n["content"]}</g>' for n in sorted(s[k]['nodes'],key=lambda n:n['name']=='brush_lines'))
 return f'<g id="{IDS[k]}" data-part-path="head/front_hair/temple_sweeps_left/{k}" {attr}><desc>Editable complete n27 {k}; self surface isolation only, not a receiver mask. Approved geometry and inter-lock negative space retained.</desc>{body}</g>'
def prepare(stage,s,note,gap=False,line=False):
 save(s)
 current=Path('refinement/character.svg').read_text()
 if START in current:current=current[:current.index(START)]+current[current.index(END)+len(END):]
 assert current==(WORK/'artwork.before.svg').read_text()
 chunk=START+''.join(group(s,k)+''.join(s.get('_raw_after',{}).get(k,[])) for k in IDS)+''.join(s.get('_raw',[]))+END
 text=current.replace('</svg>',chunk+'</svg>')
 folder=BASE/'stages'/stage;folder.mkdir(parents=True,exist_ok=True)
 (folder/'candidate.svg').write_text(text)
 (folder/'说明.md').write_text(note+'\n\n实际 actor：`/root/workflow_runner`；本阶段候选需实际查看后才checkpoint。\n')
 commands=[]
 cmd=[PY,TOOL,str(folder/'candidate.svg'),str(folder/'inspection.png'),'--reference','references/base-subject.png','--edge-overlay','--crop','337','155','82','137','--scale','4','--columns','4']
 for id in IDS.values():cmd+=['--only',id,'--part',id]
 subprocess.run(cmd,check=True);commands.append(cmd)
 if line:
  cmd=[PY,TOOL,str(folder/'candidate.svg'),str(folder/'line-reference.png'),'--reference','references/line-reference.png','--reference-crop','337','155','82','137','--crop','337','155','82','137','--scale','4','--columns','4']
  for id in IDS.values():cmd+=['--only',id,'--part',id]
  subprocess.run(cmd,check=True);commands.append(cmd)
 if gap:
  cmd=[PY,TOOL,str(folder/'candidate.svg'),str(folder/'gap-8x.png'),'--reference','references/base-subject.png','--edge-overlay','--crop','341','227','44','60','--scale','8','--columns','4']
  for id in IDS.values():cmd+=['--only',id]
  subprocess.run(cmd,check=True);commands.append(cmd)
 (folder/'commands.json').write_text(json.dumps(commands,ensure_ascii=False,indent=2)+'\n')
 print(stage,'candidate ready')
def accept(stage):
 folder=BASE/'stages'/stage
 assert (folder/'appearance-review.md').exists(), 'Actual visual notes required before acceptance'
 shutil.copyfile(folder/'candidate.svg','refinement/character.svg')
 s=json.loads(Path('structure/groups.dispatch.json').read_text());assert s['active']['target']=='n27'
 cmd=[PY,'../../workflow-next/live2d-layering/4.专项细化/tools/group_cursor.py','--file','structure/groups.json','--state','structure/groups.dispatch.json','checkpoint','--pointer',stage]
 r=subprocess.run(cmd,check=True,capture_output=True,text=True)
 (folder/'checkpoint.json').write_text(r.stdout)
 frozen=hashlib.sha256(Path('refinement/character.svg').read_bytes()).hexdigest()
 (folder/'accepted.json').write_text(json.dumps({'actor':'/root/workflow_runner','node':stage,'artwork_sha256':frozen,'viewed':'Actual views and observations recorded in appearance-review.md; no automatic visual verdict','exit_code':r.returncode},ensure_ascii=False,indent=2)+'\n')
 w=Path('workers.json');workers=json.loads(w.read_text());entry=workers['group:head/front_hair/temple_sweeps_left'];entry['selected_node']=stage;entry.setdefault('node_workers',{})[stage]='/root/workflow_runner';w.write_text(json.dumps(workers,ensure_ascii=False,indent=2)+'\n')
 print(stage,frozen)
def brush(d,width=.6,start=.15,end=.05):
 toks=re.findall(r'[MCLZ]|[-+]?(?:\d*\.\d+|\d+)',d);i=0;points=[];cur=None
 while i<len(toks):
  c=toks[i];i+=1
  if c=='M':cur=(float(toks[i]),float(toks[i+1]));points.append(cur);i+=2
  elif c=='L':cur=(float(toks[i]),float(toks[i+1]));points.append(cur);i+=2
  elif c=='C':
   a,b,cpt=[(float(toks[i+j]),float(toks[i+j+1])) for j in (0,2,4)];i+=6;p=cur
   for j in range(1,31):
    t=j/30;u=1-t;points.append(tuple(u*u*u*p[v]+3*u*u*t*a[v]+3*u*t*t*b[v]+t*t*t*cpt[v] for v in (0,1)))
   cur=cpt
  elif c=='Z':break
  else:raise ValueError(c)
 sampled=[]
 for j,pt in enumerate(points):
  u=j/(len(points)-1)
  pressure=max(.02,min(1,start*(1-u)+end*u+.72*math.sin(math.pi*u)**.65))
  sampled.append((pt[0],pt[1],pressure))
 pts=get_stroke(sampled,size=width,thinning=.6,smoothing=.5,streamline=0,simulate_pressure=False,taper_start=width*3,taper_end=width*4,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t),last=True)
 return 'M '+' L '.join(f'{x:.3f} {y:.3f}' for x,y in pts)+' Z'
