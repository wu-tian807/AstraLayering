from pathlib import Path
import json,hashlib,subprocess,re,xml.etree.ElementTree as E,math
BASE=Path('refinement/groups/head/hanging_ribbon_left')
ART=Path('refinement/character.svg')
GUIDE=Path('block-layers/groups.svg')
PART='head_hanging_ribbon_left_ribbon_strip'
PP='head/hanging_ribbon_left/ribbon_strip'
NS='http://www.w3.org/2000/svg'; E.register_namespace('',NS)
START='<!-- hanging-ribbon-left:begin -->'; END='<!-- hanging-ribbon-left:end -->'
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def checkpoint(node,previous,note):
 p=Path('structure/groups.dispatch.json');s=json.loads(p.read_text())
 assert s['active']=={'target':'n14','route':'generic','pointer':previous},s['active']
 subprocess.run(['python3','../../workflow-next/live2d-layering/4.专项细化/tools/group_cursor.py','--file','structure/groups.json','--state',str(p),'checkpoint','--pointer',node],check=True)
 assert json.loads(p.read_text())['active']['target']=='n14'
 workers=Path('workers.json');d=json.loads(workers.read_text());i=d['group:head/hanging_ribbon_left'];i['selected_node']=node;i.setdefault('node_workers',{})[node]='/root/workflow_runner/ribbon_left';workers.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
 c=BASE/'checkpoints';c.mkdir(exist_ok=True)
 (c/(node+'.json')).write_text(json.dumps({'node':node,'worker':'/root/workflow_runner/ribbon_left','guide_sha256':sha(GUIDE),'artwork_sha256':sha(ART),'note':note},ensure_ascii=False,indent=2)+'\n')
 with Path('运行记录.md').open('a') as f:f.write('\n- n14 '+node+' 实际成功并原生 checkpoint：'+note+'；见 refinement/groups/head/hanging_ribbon_left/checkpoints/'+node+'.json。\n')
def el(parent,tag,**attrs):
 return E.SubElement(parent,'{'+NS+'}'+tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
def byid(root,identity):return next(e for e in root.iter() if e.get('id')==identity)
def readpart():
 src=ART.read_text();frag=src.split(START,1)[1].split(END,1)[0]
 return E.fromstring(frag.strip())
def savepart(root):
 frag=E.tostring(root,encoding='unicode')
 src=ART.read_text()
 if START in src:
  a=src.index(START)+len(START);b=src.index(END,a);out=src[:a]+'\n'+frag+'\n'+src[b:]
 else:
  out=src.rsplit('</svg>',1)[0]+START+'\n'+frag+'\n'+END+'\n</svg>'+src.rsplit('</svg>',1)[1]
 E.fromstring(out);ART.write_text(out)
def group(root,identity,**attrs):
 return el(root,'g',id=PART+'_'+identity,**attrs)
def guidepath():
 root=E.parse(GUIDE).getroot()
 return byid(root,'head-hanging-ribbon-left-ribbon-strip-silhouette').get('d')
def note(folder,name,text):
 p=BASE/folder;p.mkdir(parents=True,exist_ok=True);(p/name).write_text(text+'\n')
def samples(d,step=.38):
 tokens=re.findall(r'[MLCQZ]|-?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?',d)
 i=0;p=(0.,0.);start=p;pts=[]
 while i<len(tokens):
  cmd=tokens[i];i+=1
  if cmd=='Z':
   if math.dist(p,start)>.001:pts.append(start)
   p=start;continue
  count={'M':2,'L':2,'C':6,'Q':4}[cmd];v=list(map(float,tokens[i:i+count]));i+=count
  if cmd=='M':p=(v[0],v[1]);start=p;pts.append(p);continue
  controls=[p]+[(v[j],v[j+1]) for j in range(0,len(v),2)]
  length=sum(math.dist(a,b) for a,b in zip(controls,controls[1:]));n=max(2,math.ceil(length/step))
  for k in range(1,n+1):
   t=k/n;u=1-t
   if cmd=='L':q=(u*p[0]+t*v[0],u*p[1]+t*v[1])
   elif cmd=='C':q=tuple(u**3*p[j]+3*u*u*t*v[j]+3*u*t*t*v[j+2]+t**3*v[j+4] for j in (0,1))
   else:q=tuple(u*u*p[j]+2*u*t*v[j]+t*t*v[j+2] for j in (0,1))
   pts.append(q)
  p=controls[-1]
 return pts
def pressure_stroke(parent,identity,source,d,size,fill='#526476',start=1.7,end=2.0,select=None):
 from perfect_freehand import get_stroke
 pts=samples(d)
 if select:pts=[p for p in pts if select(p)]
 assert len(pts)>3
 lengths=[0.]
 for a,b in zip(pts,pts[1:]):lengths.append(lengths[-1]+math.dist(a,b))
 total=lengths[-1]
 inputs=[(x,y,.59+.21*math.sin(math.pi*dist/total)+.045*math.sin(7*math.pi*dist/total)) for (x,y),dist in zip(pts,lengths)]
 smooth=lambda t:t*t*(3-2*t)
 poly=get_stroke(inputs,size=size,thinning=.65,simulate_pressure=False,streamline=0,smoothing=.55,taper_start=start,taper_end=end,taper_start_ease=smooth,taper_end_ease=smooth,last=True)
 path='M '+' L '.join(f'{x:.4f} {y:.4f}' for x,y in poly)+' Z'
 q=el(parent,'path',id=identity,d=path,fill=fill,stroke='none',data_source_curve=source,data_brush='perfect-freehand-1.2.0',data_samples=len(inputs))
 el(q,'desc').text='来源 '+source+'；原曲线0.38px密集采样，逐点显式pressure，simulate_pressure=False、streamline=0，首尾三次缓动收尖；保留几何位置及计划留白。'
 return q
