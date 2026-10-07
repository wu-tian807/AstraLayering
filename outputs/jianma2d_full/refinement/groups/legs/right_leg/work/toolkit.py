from pathlib import Path
import json,re,hashlib,subprocess,sys,copy,xml.etree.ElementTree as E
from PIL import Image,ImageDraw
W=Path.cwd();S=Path('../../workflow-next/live2d-layering');P=Path('refinement/groups/legs/right_leg');CANONICAL=Path('refinement/character.svg');ART=CANONICAL;NS='http://www.w3.org/2000/svg';PY=Path('.runtime/svg-preview/python/bin/python');E.register_namespace('',NS)
def el(tag,attrs=None,text=None):
 e=E.Element('{'+NS+'}'+tag,attrs or {});e.text=text;return e
def child(parent,tag,attrs=None,text=None):
 e=el(tag,attrs,text);parent.append(e);return e
def pid(n):return 'legs_right_leg_'+n
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def command(args):
 r=subprocess.run([str(PY),*map(str,args)],check=True,text=True,capture_output=True);return r.stdout.strip()
def start_stage(node):
 global ART
 (P/'work').mkdir(exist_ok=True);ART=P/'work/candidate.svg';ART.write_bytes(CANONICAL.read_bytes());(P/'work/stage.json').write_text(json.dumps({'node':node,'input_sha256':digest(CANONICAL)}))
def resume_stage():
 global ART
 ART=P/'work/candidate.svg'
def span(text,ident):
 m=re.search(r'<g\b[^>]*\bid="'+re.escape(ident)+r'"',text)
 if not m:return None
 depth=0
 for t in re.finditer(r'<g\b[^>]*>|</g>',text[m.start():]):
  depth+=-1 if t.group()=='</g>' else (0 if t.group().endswith('/>') else 1)
  if depth==0:return (m.start(),m.start()+t.end())
 raise ValueError(ident)
def part(n):return next(e for e in E.parse(ART).getroot() if e.get('id')==pid(n))
def save(e):
 text=ART.read_text();pos=span(text,e.get('id'));blob=E.tostring(e,encoding='unicode')
 if pos:text=text[:pos[0]]+blob+text[pos[1]:]
 else:text=text.replace('</svg>',blob+'\n</svg>')
 ART.write_text(text)
def commit_stage():
 global ART
 meta=json.loads((P/'work/stage.json').read_text());assert digest(CANONICAL)==meta['input_sha256']
 # All old non-leg containers/resources remain byte-identical.
 before=CANONICAL.read_text();after=ART.read_text()
 for ident in [pid('thigh'),pid('lower_leg')]:
  for key,s in [('before',before),('after',after)]:
   pos=span(s,ident)
   if pos:s=s[:pos[0]]+s[pos[1]:]
   if key=='before':before=s
   else:after=s
 assert before.rsplit('</svg>',1)[0].rstrip()==after.rsplit('</svg>',1)[0].rstrip(),'unrelated artwork changed'
 CANONICAL.write_bytes(ART.read_bytes());ART=CANONICAL
 command([S/'tools/svg_preview.py',ART,'refinement/preview.png','--background','white'])
def layer(n,key):
 p=part(n);ident=pid(n)+'_'+key
 for e in list(p):
  if e.get('id')==ident:p.remove(e)
 return p,child(p,'g',{'id':ident})
def path(parent,ident,d,desc,**attrs):
 e=child(parent,'path',{'id':ident,'d':d,**{k.replace('_','-'):str(v) for k,v in attrs.items()}});child(e,'desc',text=desc);return e
def defs(p):return next(e for e in p if e.tag.endswith('defs'))
def gradient(p,name,kind,attrs,stops):
 ident=p.get('id')+'_'+name;df=defs(p)
 for e in list(df):
  if e.get('id')==ident:df.remove(e)
 g=child(df,kind,{'id':ident,**{k:str(v) for k,v in attrs.items()}})
 for off,col,opacity in stops:child(g,'stop',{'offset':str(off),'stop-color':col,'stop-opacity':str(opacity)})
 return 'url(#'+ident+')'
def filtered(p,name,sigma):
 ident=p.get('id')+'_'+name;d=defs(p)
 if not any(e.get('id')==ident for e in d):
  f=child(d,'filter',{'id':ident,'filterUnits':'userSpaceOnUse','x':'428','y':'610','width':'170','height':'1040'});child(f,'feGaussianBlur',{'stdDeviation':str(sigma)})
 return 'url(#'+ident+')'
def before_brush(p,g):
 p.remove(g);i=next((i for i,e in enumerate(p) if e.get('id','').endswith('_brush')),len(p));p.insert(i,g)
def checkpoint(node,previous,note,evidence):
 a=json.loads(Path('structure/groups.dispatch.json').read_text())['active'];assert a=={'target':'n19','route':'generic','pointer':previous},a
 out=command([S/'4.专项细化/tools/group_cursor.py','--file','structure/groups.json','--state','structure/groups.dispatch.json','checkpoint','--pointer',node]);(P/'checkpoints').mkdir(exist_ok=True)
 record={'node':node,'target':'n19','worker':'group:legs/right_leg','worker_id':'/root/workflow_runner/leg_right','note':note,'evidence':evidence,'command_result':json.loads(out),'artwork_sha256':digest(CANONICAL)};(P/'checkpoints'/f'{node}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
 nf=P/'work/node_workers.json';nf.parent.mkdir(exist_ok=True);nw=json.loads(nf.read_text()) if nf.exists() else {};nw[node]='/root/workflow_runner/leg_right';nf.write_text(json.dumps(nw,ensure_ascii=False,indent=2)+'\n')
 with (P/'运行记录.md').open('a') as f:f.write(f'\n- n19 {node} 实际成功并原生 checkpoint：{note}；实际作者 /root/workflow_runner/leg_right，见 {P}/checkpoints/{node}.json。\n')
def board(node,line=False,adjacent=False,scale=2):
 out=P/'views';out.mkdir(exist_ok=True);boards=[]
 for n,crop in [('thigh',(432,644,155,548)),('lower_leg',(434,1097,105,529))]:
  dest=out/(node+'-'+n+'.png');command([S/'tools/svg_preview.py',ART,dest,'--only',pid(n),'--reference','references/base-subject.png','--crop',*crop,'--scale',scale,'--columns',3]);b=Image.open(dest).convert('RGB')
  if line:
   ref=Image.open('references/line-reference.png').convert('RGB').crop((crop[0],crop[1],crop[0]+crop[2],crop[1]+crop[3])).resize((crop[2]*scale,crop[3]*scale));c=Image.new('RGB',(b.width+ref.width,max(b.height,ref.height+28)),'white');c.paste(b,(0,0));c.paste(ref,(b.width,28));ImageDraw.Draw(c).text((b.width+4,5),'line ref same pixel crop',fill='black');b=c
  boards.append(b)
 canvas=Image.new('RGB',(sum(b.width for b in boards),max(b.height for b in boards)),'white');x=0
 for b in boards:canvas.paste(b,(x,0));x+=b.width
 if adjacent:
  # Diagnostic context only: complete new leg pieces behind existing pelvis and body.
  doc=E.parse(ART).getroot();own=[e for e in doc if e.get('id') in [pid('thigh'),pid('lower_leg')]]
  for e in own:doc.remove(e)
  idx=next((i for i,e in enumerate(doc) if e.get('id')=='part-pelvis-pelvis-body'),len(doc))
  for i,e in enumerate(own):doc.insert(idx+i,e)
  context=out/(node+'-context.svg');E.ElementTree(doc).write(context,encoding='utf-8',xml_declaration=True)
  dest=out/(node+'-context.png');ids=[pid('thigh'),pid('lower_leg'),'part-pelvis-pelvis-body','body_torso_skin'];args=[S/'tools/svg_preview.py',context,dest,'--reference','references/base-subject.png','--crop',290,605,305,1025,'--scale',1,'--columns',3]
  for ident in ids:args.extend(['--only',ident])
  command(args);b=Image.open(dest).convert('RGB');small=b.resize((round(b.width*0.65),round(b.height*0.65)));c=Image.new('RGB',(canvas.width+small.width,max(canvas.height,small.height)),'white');c.paste(canvas,(0,0));c.paste(small,(canvas.width,0));canvas=c
 target=out/(node+'.png');canvas.save(target);return str(target)
