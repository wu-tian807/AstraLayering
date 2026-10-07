from pathlib import Path
import copy,json,hashlib,re,subprocess,os,sys,xml.etree.ElementTree as E
W=Path.cwd();S=W.parents[1]/'workflow-next/live2d-layering';P=W/'refinement/groups/legs/left_anklet';T=P/'work';PY=W/'.runtime/svg-preview/python/bin/python';CAN=W/'refinement/character.svg';ART=T/'candidate.svg';ID='legs_left_anklet_small_charm';GROUP='legs/left_anklet';PATH=GROUP+'/small_charm';ENV=dict(os.environ,TMPDIR=str(T));NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
def el(tag,attrs=None,text=None):
 e=E.Element('{'+NS+'}'+tag,attrs or {});e.text=text;return e
def add(p,tag,attrs=None,text=None):e=el(tag,attrs,text);p.append(e);return e
def begin(node):
 ART.write_bytes(CAN.read_bytes());(T/'stage.json').write_text(json.dumps({'node':node,'input_sha256':hashlib.sha256(CAN.read_bytes()).hexdigest()}))
def part():return next(e for e in E.parse(ART).getroot() if e.get('id')==ID)
def save(p):
 text=ART.read_text();ident=p.get('id');m=re.search(r'<g\b[^>]*\bid="'+re.escape(ident)+r'"',text);blob=E.tostring(p,encoding='unicode')
 if m:
  depth=0
  for t in re.finditer(r'<g\b[^>]*>|</g>',text[m.start():]):
   depth+=-1 if t.group()=='</g>' else (0 if t.group().endswith('/>') else 1)
   if depth==0:end=m.start()+t.end();break
  text=text[:m.start()]+blob+text[end:]
 else:text=text.replace('</svg>',blob+'\n</svg>')
 ART.write_text(text)
def path(p,key,d,desc,**attrs):
 e=add(p,'path',{'id':ID+'_'+key,'d':d,**{k.replace('_','-'):str(v) for k,v in attrs.items()}});add(e,'desc',text=desc);return e
def layer(key):
 p=part();g=add(p,'g',{'id':ID+'_'+key,'clip-path':'url(#'+ID+'_clip)'});return p,g
def under_brush(p,g):
 p.remove(g);idx=next((i for i,e in enumerate(p) if e.get('id')==ID+'_brush'),len(p));p.insert(idx,g)
def grad(p,key,kind,attrs,stops):
 defs=next(e for e in p if e.tag.endswith('defs'));ident=ID+'_'+key
 for e in list(defs):
  if e.get('id')==ident:defs.remove(e)
 g=add(defs,kind,{'id':ident,**{k:str(v) for k,v in attrs.items()}})
 for o,c,a in stops:add(g,'stop',{'offset':str(o),'stop-color':c,'stop-opacity':str(a)})
 return 'url(#'+ident+')'
def board(node,line=False,context=False):
 from PIL import Image,ImageDraw
 out=P/'views';out.mkdir(exist_ok=True);target=out/(node+'-native.png')
 subprocess.run([str(PY),str(S/'tools/svg_preview.py'),str(ART),str(target),'--only',ID,'--reference','references/base-subject.png','--crop','395','1641','12','11','--scale','8','--columns','3'],check=True,capture_output=True,env=ENV)
 b=Image.open(target).convert('RGB')
 if line:
  im=Image.open(W/'references/line-reference.png').convert('RGB').crop((395,1641,407,1652)).resize((96,88),Image.Resampling.NEAREST)
  c=Image.new('RGB',(b.width+96,b.height),'white');c.paste(b,(0,0));c.paste(im,(b.width,28));ImageDraw.Draw(c).text((b.width+2,4),'line crop',fill='black');b=c
 b=b.resize((b.width*3,b.height*3),Image.Resampling.NEAREST)
 if context:
  dest=out/(node+'-context.png')
  subprocess.run([str(PY),str(S/'tools/svg_preview.py'),str(ART),str(dest),'--only',ID,'--only','legs_left_leg_lower_leg','--reference','references/base-subject.png','--crop','394','1633','24','44','--scale','8','--columns','3'],check=True,capture_output=True,env=ENV)
  im=Image.open(dest).convert('RGB');c=Image.new('RGB',(max(b.width,im.width),b.height+im.height+24),'white');c.paste(b,(0,0));ImageDraw.Draw(c).text((5,b.height+4),'Context: adjacent chain/gem and foot artwork remain pending their groups',fill='black');c.paste(im,(0,b.height+24));b=c
 dest=out/(node+'.png');b.save(dest);return str(dest)
def checkpoint(node,previous,note,evidence):
 state=W/'structure/groups.dispatch.json';assert json.loads(state.read_text())['active']=={'target':'n20','route':'generic','pointer':previous}
 r=subprocess.run([str(PY),str(S/'4.专项细化/tools/group_cursor.py'),'--file','structure/groups.json','--state',str(state),'checkpoint','--pointer',node],check=True,capture_output=True,text=True)
 out=P/'checkpoints';out.mkdir(exist_ok=True);record={'target':'n20','node':node,'worker':'group:legs/left_anklet','worker_id':'/root/workflow_runner/arm_right','new_independent_context':False,'note':note,'evidence':evidence,'command_result':json.loads(r.stdout),'artwork_sha256':hashlib.sha256(CAN.read_bytes()).hexdigest()}
 (out/(node+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
 with (P/'运行记录.md').open('a') as f:f.write('\n- n20 '+node+' 实际成功并原生checkpoint：'+note+' 实际worker_id=/root/workflow_runner/arm_right；见checkpoints/'+node+'.json。\n')
def finish(node,previous,note,preview=False):
 stage=json.loads((T/'stage.json').read_text());assert stage['node']==node;assert hashlib.sha256(CAN.read_bytes()).hexdigest()==stage['input_sha256'];CAN.write_bytes(ART.read_bytes())
 if preview:subprocess.run([str(PY),str(S/'tools/svg_preview.py'),str(CAN),'refinement/preview.png','--background','white'],check=True,capture_output=True,env=ENV)
 checkpoint(node,previous,note,['views/'+node+'.png'])
