from pathlib import Path
import hashlib,json,sys,xml.etree.ElementTree as E
sys.path.insert(0,'refinement/groups/legs/right_leg/work')
import toolkit as a
NODE=Path('refinement/groups/legs/right_leg/4.rendering stack/4.7.线色融合与材质细化')
CANONICAL=Path('refinement/character.svg');BEFORE=NODE/'work/input-part-highlights.svg';CANDIDATE=NODE/'work/candidate.svg'
assert a.digest(CANONICAL)=='f80b96281f8c12e7d3ebd0b8df0226ed1baed19d6402eaa78d404b50dbf0310c'
if BEFORE.exists(): assert BEFORE.read_bytes()==CANONICAL.read_bytes(),'Preserve original snapshot'
else: BEFORE.write_bytes(CANONICAL.read_bytes())
CANDIDATE.write_bytes(CANONICAL.read_bytes());a.ART=CANDIDATE
stops={
 'outer':[(0,'#b0918b',1),(.17,'#ae8780',1),(.36,'#bb938b',1),(.475,'#a77e77',1),(.51,'#a97f78',1),(.57,'#b28a82',1),(.69,'#b89188',1),(.82,'#c09b90',1),(.91,'#ad847a',1),(1,'#b68e84',1)],
 'inner':[(0,'#aa8a85',1),(.17,'#a78079',1),(.36,'#af8981',1),(.475,'#9e7872',1),(.51,'#a17a73',1),(.57,'#a98178',1),(.69,'#af887e',1),(.82,'#b59084',1),(.91,'#a67e74',1),(1,'#af867b',1)]
}
for n in ('thigh','lower_leg'):
 p=a.part(n);p.tail=None
 for side in ('outer','inner'):
  fill=a.gradient(p,'skin_ink_'+side,'linearGradient',{'gradientUnits':'userSpaceOnUse','x1':'480','y1':'650','x2':'480','y2':'1640'},stops[side])
  ink=next(e for e in p.iter() if e.get('id')==a.pid(n)+'_ink_'+side)
  ink.set('fill',fill)
  desc=next(e for e in ink if e.tag.endswith('desc'))
  desc.text+=' 4.7仅更换暖棕粉肤色线的世界坐标渐变：膝与踝转折略深，胫前反光附近变浅；双part共用同坐标色标，原压力轮廓、透明度、尖端及留白不变。'
 glint=next(e for e in p.iter() if e.get('id')==a.pid(n)+'_knee_glint')
 glint.set('gradientTransform','translate(474.2 1134) rotate(6) scale(3.6 6.5)')
 a.child(p,'desc',{'id':a.pid(n)+'_line_color_material_review'},'4.7以完整独显和参考的普通腿部局部复核Rendering Stack：大腿/胫前为奶油粉浅亮面，膝部暖粉和两侧柔凹、踝侧淡暗与细白反光延续；光洁皮肤不添加颗粒、毛孔或装饰纹理。线色改为同族暖棕粉，膝前亮点依4×对照从4.5×7.2收拢至3.6×6.5；基色/体积/过渡/暗部及其他亮部按已视局部沿用。完整圆端同面铺色保留，Geometry与独立raw渲染层不改。髋—骨盆组合未实看，接界调和仍由后置组合审查负责，不宣称覆盖。')
 a.save(p)
old=E.parse(BEFORE).getroot();new=E.parse(CANDIDATE).getroot()
oldmap={e.get('id'):e for e in old.iter() if e.get('id')};newmap={e.get('id'):e for e in new.iter() if e.get('id')}
allowed={a.pid(n)+'_ink_'+s for n in ('thigh','lower_leg') for s in ('outer','inner')}
for ident,e in oldmap.items():
 assert ident in newmap,ident
 f=newmap[ident]
 assert e.get('d')==f.get('d'),f'Geometry changed: {ident}'
 if ident in allowed:
  assert {k:v for k,v in e.attrib.items() if k!='fill'}=={k:v for k,v in f.attrib.items() if k!='fill'}
for n in ('thigh','lower_leg'):
 for suffix in ('geometry','surfaces','volume','color_transitions','local_shading','highlights'):
  ident=a.pid(n)+'_'+suffix
  assert E.tostring(oldmap[ident])==E.tostring(newmap[ident]),f'Frozen layer changed: {ident}'
before=BEFORE.read_text();after=CANDIDATE.read_text()
for n in ('thigh','lower_leg'):
 i,j=a.span(before,a.pid(n));before=before[:i]+before[j:]
 i,j=a.span(after,a.pid(n));after=after[:i]+after[j:]
assert before==after,'Non-current artwork changed'
protected=[Path('block-layers/groups.svg'),Path('structure/groups.json'),Path('structure/rendering.json')]+sorted(Path('refinement/groups/legs/right_leg/checkpoints').glob('*.json'))
proof={'node':'part_rendered','worker':'group:legs/right_leg','worker_id':'/root/workflow_runner/leg_right_finish','input_sha256':a.digest(BEFORE),'candidate_sha256':a.digest(CANDIDATE),'all_existing_path_d_unchanged':True,'non_current_artwork_byte_identical':True,'pressure_brush_geometry_and_opacity_unchanged':True,'base_volume_transitions_local_shading_unchanged':True,'highlight_refinement':{'gradient':'knee_glint in both parts','before':'translate(474.2 1134) rotate(6) scale(4.5 7.2)','after':'translate(474.2 1134) rotate(6) scale(3.6 6.5)','reason':'4x reference comparison: old bright spot was wider and more diffuse than reference'},'protected_inputs':{str(f):a.digest(f) for f in protected},'material_decision':'Smooth skin: no invented texture; local colors verified against ordinary leg crops; four pressure-brush fills use skin-family gradients, and the knee glint is narrowed to match the reference density.','limits':['Hip-pelvis composite not visually inspected; must be resolved by later final composite review.','Foot group remains pending and unmodified; any ankle comparison against its guide is geometry-only.']}
(NODE/'proof.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'candidate':str(CANDIDATE),'sha256':a.digest(CANDIDATE)},ensure_ascii=False))
