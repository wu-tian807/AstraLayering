from pathlib import Path
import copy,hashlib,json,re,subprocess,sys,xml.etree.ElementTree as E
W=Path('.');S=Path('../../workflow-next/live2d-layering');P=Path('refinement/groups/head/face/mouth');T=P/'work';PY=Path('.runtime/svg-preview/python/bin/python');CAN=Path('refinement/character.svg');ART=T/'candidate.svg';GUIDE=Path('block-layers/groups.svg');GROUP='head/face/mouth';PARTS=('upper_lip','lower_lip','mouth_interior');PAINT_ORDER=('mouth_interior','lower_lip','upper_lip');IDS={k:'head_face_mouth_'+k for k in PARTS};NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
ORDER=['part_motion_completion','part_contours','part_structure','part_tone_boundaries','part_detail_lines','part_brush_lines','part_base_colors','part_volume','part_color_transitions','part_local_shading','cast_shadow_relations','cast_shadow_artwork','part_highlights','part_rendered']
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def spec(node):
 for f in (S/'templates/部件专项/generic').rglob('流程.yaml'):
  if re.search(r'^id:\s*'+re.escape(node)+r'\s*$',f.read_text(),re.M):return f
 raise ValueError(node)
def read(node):
 f=spec(node);files=[f,f.parent/'提示词.txt',*sorted(f.parent.glob('*.model'))];record=[]
 for path in files:
  print(str(path)+'\n'+path.read_text());record.append({'path':str(path),'sha256':sha(path)})
 (T/'reads').mkdir(exist_ok=True);(T/'reads'/f'{node}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
def begin(node):
 assert (T/'reads'/f'{node}.json').exists(),'Read selected node first'
 expected=ORDER[ORDER.index(node)-1];active=json.loads(Path('structure/groups.dispatch.json').read_text())['active'];assert active=={'target':'n24','route':'generic','pointer':expected},active
 b=P/'baselines'/node;b.mkdir(parents=True,exist_ok=True);(b/'artwork.svg').write_bytes(CAN.read_bytes());ART.write_bytes(CAN.read_bytes())
 (T/'stage.json').write_text(json.dumps({'node':node,'previous':expected,'input_sha256':sha(CAN),'guide_sha256':sha(GUIDE),'groups_sha256':sha('structure/groups.json'),'rendering':json.loads(Path('structure/rendering.json').read_text())},ensure_ascii=False,indent=2)+'\n')
def el(tag,attrs=None,text=None):
 e=E.Element('{'+NS+'}'+tag,attrs or {});e.text=text;return e
def add(parent,tag,attrs=None,text=None):e=el(tag,attrs,text);parent.append(e);return e
def path(parent,key,d,note,**attrs):
 e=add(parent,'path',{'id':parent.get('id')+'_'+key,'d':d,**{k.replace('_','-'):str(v) for k,v in attrs.items()}});add(e,'desc',text=note);return e
def replace(text,ident,blob):
 m=re.search(r'<g\b[^>]*\bid="'+re.escape(ident)+r'"',text)
 if not m:return text.replace('</svg>',blob+'\n</svg>')
 depth=0
 for token in re.finditer(r'<g\b[^>]*>|</g>',text[m.start():]):
  depth+=-1 if token.group()=='</g>' else (0 if token.group().endswith('/>') else 1)
  if depth==0:end=m.start()+token.end();break
 return text[:m.start()]+blob+text[end:]
def save(p):ART.write_text(replace(ART.read_text(),p.get('id'),E.tostring(p,encoding='unicode')))
def part(key):return next(e for e in E.parse(ART).getroot() if e.get('id')==IDS[key])
def guide_paths(key):
 p=next(e for e in E.parse(GUIDE).getroot().iter() if e.get('data-part-path')==GROUP+'/'+key)
 return [(e.get('id'),e.get('d')) for e in p if e.tag.endswith('path')]
def layer(key,name,clip=True):
 p=part(key);g=add(p,'g',{'id':IDS[key]+'_'+name,**({'clip-path':'url(#'+IDS[key]+'_clip)'} if clip else {})});return p,g
def under_brush(p,g):
 p.remove(g);idx=next((i for i,e in enumerate(p) if e.get('id')==p.get('id')+'_brush'),len(p));p.insert(idx,g)
def grad(p,key,kind,attrs,stops):
 defs=next(e for e in p if e.tag.endswith('defs'));ident=p.get('id')+'_'+key
 for e in list(defs):
  if e.get('id')==ident:defs.remove(e)
 g=add(defs,kind,{'id':ident,**{k:str(v) for k,v in attrs.items()}})
 for offset,color,opacity in stops:add(g,'stop',{'offset':str(offset),'stop-color':color,'stop-opacity':str(opacity)})
 return 'url(#'+ident+')'
def blur(p,name,sigma):
 defs=next(e for e in p if e.tag.endswith('defs'));ident=p.get('id')+'_'+name;f=add(defs,'filter',{'id':ident,'x':'-30%','y':'-100%','width':'160%','height':'300%','color-interpolation-filters':'sRGB'});add(f,'feGaussianBlur',{'stdDeviation':str(sigma)});return 'url(#'+ident+')'
def native(svg,out,ids=None,parts=True,edge=False):
 ids=list(IDS.values()) if ids is None else ids
 cmd=[str(PY),str(S/'tools/svg_preview.py'),str(svg),str(out),'--reference','references/base-subject.png','--crop','419','283','39','25','--scale','8','--columns','4']
 for ident in ids:cmd+=['--only',ident]
 if parts:
  for ident in IDS.values():cmd+=['--part',ident]
 if edge:cmd+=['--edge-overlay']
 subprocess.run(cmd,check=True,capture_output=True)
def board(node,line=False,context=False,extra=()):
 from PIL import Image,ImageDraw
 out=P/'views';out.mkdir(exist_ok=True);dest=out/(node+'-native.png');native(ART,dest,ids=list(IDS.values())+list(extra));ims=[('Three mouth parts with reference and independent part cells',Image.open(dest).convert('RGB'))]
 if line:
  im=Image.open('references/line-reference.png').convert('RGB').crop((419,283,458,308)).resize((312,200),Image.Resampling.NEAREST);ims.append(('Same-coordinate line reference; no whole-image rescale',im))
 if context:
  dest=out/(node+'-context.png');native(ART,dest,ids=['head_face_face_skin']+list(IDS.values())+list(extra),parts=False);ims.append(('Actual face plus mouth context (this group only)',Image.open(dest).convert('RGB')))
 b=Image.new('RGB',(max(im.width for _,im in ims),sum(im.height+26 for _,im in ims)),'white');y=0
 for label,im in ims:ImageDraw.Draw(b).text((4,y+5),label,fill='black');b.paste(im,(0,y+26));y+=im.height+26
 dest=out/(node+'.png');b.save(dest);return str(dest)
def finish(note,evidence=None):
 stage=json.loads((T/'stage.json').read_text());node=stage['node'];assert sha(CAN)==stage['input_sha256'];assert sha(GUIDE)==stage['guide_sha256'];assert sha('structure/groups.json')==stage['groups_sha256']
 owned=lambda e:(e.get('id') or '').startswith(('head_face_mouth_','mouth_'))
 before=[E.tostring(e) for e in E.parse(CAN).getroot() if not owned(e)];after=[E.tostring(e) for e in E.parse(ART).getroot() if not owned(e)];assert before==after,'Other root payload/order changed'
 old=[r for r in stage['rendering']['layers'] if not r['id'].startswith(('head_face_mouth_','mouth_'))];new=[r for r in json.loads(Path('structure/rendering.json').read_text())['layers'] if not r['id'].startswith(('head_face_mouth_','mouth_'))];assert old==new,'Other rendering records changed'
 ids=[e.get('id') for e in E.parse(ART).getroot().iter() if e.get('id')];assert len(ids)==len(set(ids))
 CAN.write_bytes(ART.read_bytes())
 if re.search(r'preview:\s*[\"\x27]?refinement/preview.png',spec(node).read_text()):subprocess.run([str(PY),str(S/'tools/svg_preview.py'),str(CAN),'refinement/preview.png','--background','white'],check=True,capture_output=True)
 r=subprocess.run([str(PY),str(S/'4.专项细化/tools/group_cursor.py'),'--file','structure/groups.json','--state','structure/groups.dispatch.json','checkpoint','--pointer',node],check=True,text=True,capture_output=True)
 record={'target':'n24','node':node,'status':'pass','worker':'group:head/face/mouth','worker_id':'/root','new_independent_context':False,'note':note,'artwork_sha256':sha(CAN),'guide_sha256':sha(GUIDE),'other_root_elements_preserved':len(before),'other_rendering_layers_preserved':len(old),'evidence':evidence or ['views/'+node+'.png'],'command_result':json.loads(r.stdout)}
 (P/'checkpoints'/f'{node}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
 with (P/'运行记录.md').open('a',encoding='utf-8') as f:f.write('\n- n24 '+node+' 实际完成并原生checkpoint：'+note+' 实际作者/root；其他part、guide几何、树与其他rendering关系保护通过。见checkpoints/'+node+'.json。\n')
 print(json.dumps(record,ensure_ascii=False))
if __name__=='__main__':
 if sys.argv[1]=='read':read(sys.argv[2])
 elif sys.argv[1]=='finish':finish(sys.argv[2])
