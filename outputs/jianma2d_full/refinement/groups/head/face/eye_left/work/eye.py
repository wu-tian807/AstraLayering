from pathlib import Path
import copy,json,hashlib,re,subprocess,os,xml.etree.ElementTree as E
W=Path('.');S=Path('../../workflow-next/live2d-layering');P=W/'refinement/groups/head/face/eye_left';T=P/'work';PY=W/'.runtime/svg-preview/python/bin/python';CAN=W/'refinement/character.svg';ART=T/'candidate.svg';GROUP='head/face/eye_left';PARTS=('sclera','lower_eyelid');IDS={k:'head_face_eye_left_'+k for k in PARTS};GUIDE=W/'block-layers/groups.svg';ENV=dict(os.environ,TMPDIR=str(T.resolve()));NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def el(tag,attrs=None,text=None):
 e=E.Element('{'+NS+'}'+tag,attrs or {});e.text=text;return e
def add(p,tag,attrs=None,text=None):e=el(tag,attrs,text);p.append(e);return e
def begin(node):
 ART.write_bytes(CAN.read_bytes());(T/'stage.json').write_text(json.dumps({'node':node,'input_sha256':sha(CAN)}));b=P/'baselines'/node;b.mkdir(parents=True,exist_ok=True);(b/'artwork.svg').write_bytes(CAN.read_bytes())
def part(key):return next(e for e in E.parse(ART).getroot() if e.get('id')==IDS[key])
def replace(text,ident,blob):
 m=re.search(r'<g\b[^>]*\bid="'+re.escape(ident)+r'"',text)
 if m:
  depth=0
  for t in re.finditer(r'<g\b[^>]*>|</g>',text[m.start():]):
   depth+=-1 if t.group()=='</g>' else (0 if t.group().endswith('/>') else 1)
   if depth==0:end=m.start()+t.end();break
  return text[:m.start()]+blob+text[end:]
 return text.replace('</svg>',blob+'\n</svg>')
def save(p,dest=ART):dest.write_text(replace(dest.read_text(),p.get('id'),E.tostring(p,encoding='unicode')))
def paths(key):
 p=next(e for e in E.parse(GUIDE).getroot().iter() if e.get('data-part-path')==GROUP+'/'+key)
 return [e.get('d') for e in p if e.tag.endswith('path')]
def path(p,key,d,desc,**attrs):
 e=add(p,'path',{'id':p.get('id')+'_'+key,'d':d,**{k.replace('_','-'):str(v) for k,v in attrs.items()}});add(e,'desc',text=desc);return e
def layer(key,name,clip=True):
 p=part(key);g=add(p,'g',{'id':IDS[key]+'_'+name,**({'clip-path':'url(#'+IDS[key]+'_clip)'} if clip else {})});return p,g
def under_brush(p,g):
 p.remove(g);idx=next((i for i,e in enumerate(p) if e.get('id')==p.get('id')+'_brush'),len(p));p.insert(idx,g)
def grad(p,key,kind,attrs,stops):
 defs=next(e for e in p if e.tag.endswith('defs'));ident=p.get('id')+'_'+key
 for e in list(defs):
  if e.get('id')==ident:defs.remove(e)
 g=add(defs,kind,{'id':ident,**{k:str(v) for k,v in attrs.items()}})
 for o,c,a in stops:add(g,'stop',{'offset':str(o),'stop-color':c,'stop-opacity':str(a)})
 return 'url(#'+ident+')'
def native(svg,out,ids=None,parts=True,edge=False):
 args=[str(PY),str(S/'tools/svg_preview.py'),str(svg),str(out),'--reference','references/base-subject.png','--crop','374','230','56','40','--scale','6','--columns','3']
 for ident in (list(IDS.values()) if ids is None else ids):args+=['--only',ident]
 if parts:
  for ident in (list(IDS.values()) if ids is None else ids):args+=['--part',ident]
 if edge:args+=['--edge-overlay']
 return subprocess.run(args,check=True,capture_output=True,text=True,env=ENV)
def board(node,line=False,context=False,extra=()):
 from PIL import Image,ImageDraw
 out=P/'views';out.mkdir(exist_ok=True);target=out/(node+'-native.png');native(ART,target,ids=list(IDS.values())+list(extra))
 b=Image.open(target).convert('RGB')
 if line:
  im=Image.open('references/line-reference.png').convert('RGB').crop((374,230,430,270)).resize((336,240),Image.Resampling.NEAREST)
  c=Image.new('RGB',(max(b.width,720),b.height+280),'white');c.paste(b,(0,0));c.paste(im,(0,b.height+28));d=ImageDraw.Draw(c);d.text((4,b.height+4),'Line reference: same-coordinate crop (no whole-image resize)',fill='black');d.text((346,b.height+42),'Only sclera + lower eyelid. Upper lid and iris pending.',fill='black');b=c
 if context:
  dest=out/(node+'-context.png');native(ART,dest,ids=['head_face_face_skin']+list(IDS.values())+list(extra),parts=False)
  im=Image.open(dest).convert('RGB');c=Image.new('RGB',(max(b.width,im.width),b.height+im.height+28),'white');c.paste(b,(0,0));ImageDraw.Draw(c).text((4,b.height+6),'Temporary face context: upper eyelid and iris not yet painted; raw effects not final-clipped.',fill='black');c.paste(im,(0,b.height+28));b=c
 dest=out/(node+'.png');b.save(dest);return str(dest)
def checkpoint(node,previous,note,evidence,extra=None):
 state=W/'structure/groups.dispatch.json';assert json.loads(state.read_text())['active']=={'target':'n23','route':'generic','pointer':previous}
 r=subprocess.run([str(PY),str(S/'4.专项细化/tools/group_cursor.py'),'--file','structure/groups.json','--state',str(state),'checkpoint','--pointer',node],check=True,capture_output=True,text=True)
 out=P/'checkpoints';out.mkdir(exist_ok=True);record={'target':'n23','node':node,'worker':'group:head/face/eye_left','worker_id':'/root/workflow_runner/arm_right','new_independent_context':False,'note':note,'evidence':evidence,'command_result':json.loads(r.stdout),'artwork_sha256':sha(CAN),'guide_sha256':sha(GUIDE),**(extra or {})}
 (out/(node+'.json')).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
 with (P/'运行记录.md').open('a') as f:f.write('\n- n23 '+node+' 实际成功并原生checkpoint：'+note+' 实际worker_id=/root/workflow_runner/arm_right；逻辑worker=group:head/face/eye_left；非新独立上下文；见checkpoints/'+node+'.json。\n')
def finish(node,previous,note,preview=False,extra=None):
 stage=json.loads((T/'stage.json').read_text());assert stage['node']==node;assert sha(CAN)==stage['input_sha256'];CAN.write_bytes(ART.read_bytes())
 if preview:subprocess.run([str(PY),str(S/'tools/svg_preview.py'),str(CAN),'refinement/preview.png','--background','white'],check=True,capture_output=True,env=ENV)
 checkpoint(node,previous,note,['views/'+node+'.png'],extra)
