"""Scoped n29 authoring helpers. No automatic visual approval or stage loop."""
from pathlib import Path
import sys,os,json,hashlib,subprocess,xml.etree.ElementTree as E,copy,re
sys.dont_write_bytecode=True
from PIL import Image
W=Path.cwd();G=W/'refinement/groups/head/rear_hair_left/inner_back_curtain';WORK=G/'work';R=(W/'../../workflow-next/live2d-layering').resolve();PY=W/'.runtime/svg-preview/python/bin/python'
ACTOR='/root/jianma_runner_recovery/maker_n29_render';GROUP='head/rear_hair_left/inner_back_curtain';KEYS=['nape_back_sheet','inner_side_lock'];IDS={k:'part-head-rear-hair-left-inner-back-curtain-'+k.replace('_','-') for k in KEYS};START='<!-- n29-inner-back-curtain-artwork-start -->';END='<!-- n29-inner-back-curtain-artwork-end -->'
FOLDERS={'part_contours':'3.geometry/3.1.外轮廓与接界','part_structure':'3.geometry/3.2.内部结构线','part_tone_boundaries':'3.geometry/3.3.明暗范围线','part_detail_lines':'3.geometry/3.4.细节与纹理线','part_brush_lines':'3.geometry/3.5.画笔重绘','part_base_colors':'4.rendering stack/4.1.基色与材质分区','part_volume':'4.rendering stack/4.2.大明暗与体积','part_color_transitions':'4.rendering stack/4.3.过渡色与局部色','part_local_shading':'4.rendering stack/4.4.局部暗部细化','cast_shadow_relations':'4.rendering stack/4.5.投影处理/4.5.1.投影识别与关系定义','cast_shadow_artwork':'4.rendering stack/4.5.投影处理/4.5.2.独立投影绘制','part_highlights':'4.rendering stack/4.6.高光与反光','part_rendered':'4.rendering stack/4.7.线色融合与材质细化'}
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
def el(tag,**attrs):return E.Element(tag,{k.replace('_','-'):str(v) for k,v in attrs.items()})
def xml(e):return E.tostring(e,encoding='unicode')
def path(id,d,desc='',**attrs):
 p=el('path',id=id,d=d,**attrs)
 if desc:E.SubElement(p,'desc').text=desc
 return xml(p)
def load():return json.loads((WORK/'art-state.json').read_text())
def save(s):(WORK/'art-state.json').write_text(json.dumps(s,ensure_ascii=False,indent=2)+'\n')
def initialize():
 assert not (WORK/'art-state.json').exists()
 base=(W/'refinement/character.svg').read_text();assert START not in base;(WORK/'artwork-before.svg').write_text(base)
 guide=E.parse(W/'block-layers/groups.svg').getroot();s={'parts':{},'raw':[]}
 for k in KEYS:
  g=next(x for x in guide.iter() if x.get('id')==IDS[k]);d=next(x for x in g if x.tag.rsplit('}',1)[-1]=='path').get('d');s['parts'][k]={'d':d,'base':'#E2E5EE','geometry':[],'layers':[],'defs':[],'geometry_hidden':False,'brush':[]}
 (WORK/'protected-inputs.json').write_text(json.dumps({p:sha(W/p) for p in ['block-layers/groups.svg','structure/groups.json','structure/rendering.json','refinement/character.svg']},indent=2)+'\n');save(s);return s
EAR='M 0 0 H 895 V 1758 H 0 Z M 352.2 302.7 C 351.7 310 349.0 319.5 346.0 332.8 C 344.1 330.3 343.4 325.4 345.5 318.2 C 347.6 311.5 350.2 306.6 352.2 302.7 Z'
def group(s,k):
 a=s['parts'][k];pr='n29_'+k;body='<defs>'
 body+=f'<clipPath id="{pr}_ear" clipPathUnits="userSpaceOnUse"><path d="{EAR}" clip-rule="evenodd"/></clipPath>'
 body+=f'<clipPath id="{pr}_surface_clip" clipPathUnits="userSpaceOnUse"><path d="{a["d"]}" clip-rule="evenodd"/></clipPath>'
 body+=''.join(a['defs'])+'</defs>'
 body+=path(pr+'_surface',a['d'],f'{GROUP}/{k}完整闭合表面；沿用运动补齐范围。耳孔透明，隐藏同面连续，闭合边不等于最终硬描边。',fill=a['base'],stroke='none',fill_rule='evenodd',data_role='surface')
 body+='<g id="'+pr+'_surface_features" clip-path="url(#'+pr+'_surface_clip)">'
 body+=''.join(a['layers'])
 body+='<g id="'+pr+'_geometry"'+(' display="none"' if a['geometry_hidden'] else '')+'>'
 for q in a['geometry']:
  attrs={'fill':'none','stroke':q.get('color','#6F7C94'),'stroke_width':q.get('width',.5),'opacity':q.get('opacity',.72),'stroke_linecap':'round','data_role':q['role'],'data_final':q['final']}
  if q.get('dash'):attrs['stroke_dasharray']=q['dash']
  body+=path(pr+'_source_'+q['name'],q['d'],q['desc'],**attrs)
 body+='</g><g id="'+pr+'_brush">'+''.join(a['brush'])+'</g></g>'
 return f'<g id="{IDS[k]}" data-part-path="{GROUP}/{k}" clip-path="url(#{pr}_ear)"><desc>Editable continuous left inner rear hair; local author n29. Surface isolation only; external cast-light layers remain independent raw artwork.</desc>{body}</g>'
def prepare(node,s,note,line=False,regions=None):
 assert node in FOLDERS
 folder=G/FOLDERS[node];folder.mkdir(parents=True,exist_ok=True);(folder/'tmp').mkdir(exist_ok=True)
 current=(W/'refinement/character.svg').read_text();base=(WORK/'artwork-before.svg').read_text()
 stripped=current
 if START in stripped:stripped=stripped[:stripped.index(START)]+stripped[stripped.index(END)+len(END):]
 assert stripped==base,'Other artwork changed; stop before composing.'
 protected=json.loads((WORK/'protected-inputs.json').read_text())
 for p in ['block-layers/groups.svg','structure/groups.json']:assert sha(W/p)==protected[p],p
 save(s)
 at=base.rfind('<',0,base.index('id="head_rear_hair_left_occipital_root"'));chunk=START+''.join(group(s,k) for k in KEYS)+''.join(s.get('raw',[]))+END
 candidate=base[:at]+chunk+base[at:];(folder/'candidate.svg').write_text(candidate)
 (folder/'说明.md').write_text(note+'\n\n真实actor `'+ACTOR+'`。本文件是制作说明，实际视觉观察另记；未看图不接受候选。\n')
 (folder/'binding.json').write_text(json.dumps({'node':node,'branch':'then: two direct parts','actual_actor':ACTOR,'model':'gpt-6-astra','reasoning':'xhigh','input_artwork_sha256':sha(W/'refinement/character.svg'),'guide_sha256':sha(W/'block-layers/groups.svg'),'groups_sha256':sha(W/'structure/groups.json'),'candidate_sha256':sha(folder/'candidate.svg'),'output':'refinement/character.svg'},ensure_ascii=False,indent=2)+'\n')
 jobs=[];env=dict(os.environ,TMPDIR=str(folder/'tmp'),PYTHONDONTWRITEBYTECODE='1')
 if regions is None:regions={'nape_back_sheet':[(325,260,125,140),(300,590,150,160),(320,1110,125,160)],'inner_side_lock':[(335,260,65,155),(275,710,90,190),(310,1230,65,210)]}
 for k in KEYS:
  boards=[]
  for i,box in enumerate(regions[k],1):
   out=folder/f'{k}-{i}.png';ref=W/('references/line-reference.png' if line else 'references/base-subject.png')
   cmd=[str(PY),str(R/'tools/svg_preview.py'),str(folder/'candidate.svg'),str(out),'--only',IDS[k],'--reference',str(ref),'--edge-overlay','--crop',*map(str,box),'--scale','4','--columns','4']
   if line:cmd+=['--reference-crop',*map(str,box)]
   p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr;boards.append(Image.open(out).convert('RGB'))
  sheet=Image.new('RGB',(max(i.width for i in boards),sum(i.height for i in boards)),'white');y=0
  for im in boards:sheet.paste(im,(0,y));y+=im.height
  sheet.save(folder/(k+'-sheet.png'))
 (folder/'render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
 print(node,'candidate',sha(folder/'candidate.svg'),flush=True)
def accept(node,view_count,previous_pointer):
 folder=G/FOLDERS[node];assert (folder/'实际观察.md').exists(),'Manual visual observation required'
 binding=json.loads((folder/'binding.json').read_text());assert sha(folder/'candidate.svg')==binding['candidate_sha256'];assert sha(W/'refinement/character.svg')==binding['input_artwork_sha256']
 active=json.loads((W/'structure/groups.dispatch.json').read_text())['active'];assert active=={'target':'n29','route':'generic','pointer':previous_pointer},active
 (W/'refinement/character.svg').write_bytes((folder/'candidate.svg').read_bytes())
 cmd=[str(PY),str(R/'4.专项细化/tools/group_cursor.py'),'--file',str(W/'structure/groups.json'),'--state',str(W/'structure/groups.dispatch.json'),'checkpoint','--pointer',node];p=subprocess.run(cmd,text=True,capture_output=True,env=dict(os.environ,PYTHONDONTWRITEBYTECODE='1'));assert p.returncode==0,p.stderr
 (folder/'native-checkpoint.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n')
 (folder/'accepted.json').write_text(json.dumps({'node':node,'actual_actor':ACTOR,'artwork_sha256':sha(W/'refinement/character.svg'),'guide_sha256':sha(W/'block-layers/groups.svg'),'rendering_sha256':sha(W/'structure/rendering.json'),'actor_images_total':view_count,'manual_observation':'实际观察.md'},ensure_ascii=False,indent=2)+'\n')
 w=json.loads((W/'workers.json').read_text());e=w['group:'+GROUP];e.update(selected_node=node,status='active',last_successful_node=node,actual_viewed_image_count=view_count,actual_actor=ACTOR);e.setdefault('node_workers',{})[node]=ACTOR;e.setdefault('completed_nodes',[]).append(node);(W/'workers.json').write_text(json.dumps(w,ensure_ascii=False,indent=2)+'\n')
 with (G/'运行记录.md').open('a') as f:f.write(f'\n{node}：已实际查看当前两件原尺寸sheet并记录，native checkpoint成功。artwork `{sha(W/"refinement/character.svg")}`；实际actor `{ACTOR}` 累计{view_count}图。\n')
 print(node,'accepted',sha(W/'refinement/character.svg'))
