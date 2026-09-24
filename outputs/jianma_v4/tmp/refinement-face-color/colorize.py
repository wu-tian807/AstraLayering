from pathlib import Path
import xml.etree.ElementTree as E,copy,hashlib,json
N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1]);src=Path('refinement/groups/face/3.关联部件校准/character.svg');out=Path('refinement/groups/face/old-1.4');assert hashlib.sha256(src.read_bytes()).hexdigest()=='92acb1b6b4a60f66340f225c8a1dbb75c6f9bb670fa466a9e8336b30e16ee77f'
r=E.parse(src).getroot();original=copy.deepcopy(r);groups={g.get('id'):g for g in r.findall(N+'g')};defs=r.find(N+'defs')
def elem(tag,attrs=None,parent=None):
 e=E.Element(N+tag,{k:str(v) for k,v in (attrs or {}).items()});
 if parent is not None:parent.append(e)
 return e
def radial(name,cx,cy,rx,ry,color,stops):
 g=elem('radialGradient',{'id':name,'gradientUnits':'userSpaceOnUse','cx':0,'cy':0,'r':1,'gradientTransform':f'translate({cx} {cy}) scale({rx} {ry})'},defs)
 for at,alpha in stops:elem('stop',{'offset':at,'stop-color':color,'stop-opacity':alpha},g)
 return {'cx':cx,'cy':cy,'rx':rx,'ry':ry,'fill':f'url(#{name})'}
def linear(name,x1,y1,x2,y2,stops):
 g=elem('linearGradient',{'id':name,'gradientUnits':'userSpaceOnUse','x1':x1,'y1':y1,'x2':x2,'y2':y2},defs)
 for at,col in stops:elem('stop',{'offset':at,'stop-color':col},g)
 return f'url(#{name})'
def clip(name,d):
 c=elem('clipPath',{'id':name,'clipPathUnits':'userSpaceOnUse'},defs);elem('path',{'d':d},c)
def blur(name,amount):
 f=elem('filter',{'id':name,'filterUnits':'userSpaceOnUse','x':375,'y':95,'width':145,'height':195,'color-interpolation-filters':'sRGB'},defs);elem('feGaussianBlur',{'stdDeviation':amount},f)
def gchild(parent,id,part,role,attrs=None):
 return elem('g',{'id':id,'data-part':part,'data-kind':'face','data-role':role,**(attrs or {})},parent)
face=groups['face_base'];facepath=face.find('.//*[@id="face_base_shape"]');clip('face_surface_clip',facepath.get('d'));blur('face_cast_soft',1.15);blur('face_jewel_soft',1.05);blur('face_nose_soft',.24);blur('face_brow_soft',.26)
# The closed skin shape and the established outline are retained byte-for-byte at the element level.
selftone=gchild(None,'face_skin_tones','face_base','skin-color-and-self-volume',{'clip-path':'url(#face_surface_clip)'})
face.insert(list(face).index(face.find('.//*[@id="face_base_contour"]')),selftone)
for name,a in [
 ('face_mid_warm',radial('face_mid_warm_grad',443.5,216,35,53,'#F9DAD6',[(0,.30),(.4,.20),(.75,.06),(1,0)])),
 ('face_left_volume',radial('face_left_volume_grad',401.5,235,16.5,28,'#CDA6A5',[(0,.18),(.45,.105),(.8,.028),(1,0)])),
 ('face_right_volume',radial('face_right_volume_grad',490,226,13,30,'#C6ADB5',[(0,.095),(.55,.035),(1,0)])),
 ('face_forehead_left_light',radial('face_forehead_left_light_grad',429,166,13,17,'#FFFFFF',[(0,.16),(.55,.075),(1,0)])),
 ('face_forehead_right_light',radial('face_forehead_right_light_grad',462,166,14,18,'#FFFFFF',[(0,.38),(.5,.18),(1,0)])),
 ('face_forehead_middle_light',radial('face_forehead_middle_light_grad',443.5,183,15,17,'#FFFFFF',[(0,.36),(.5,.14),(1,0)])),
 ('face_chin_warm',radial('face_chin_warm_grad',444.5,260,16,9,'#F1D2C9',[(0,.085),(.45,.05),(1,0)])),
 ('face_orbit_right',radial('face_orbit_right_grad',415,192.7,20,7.3,'#D79D9D',[(0,.26),(.48,.14),(1,0)])),
 ('face_orbit_left',radial('face_orbit_left_grad',474,192.8,20,7.5,'#CE9297',[(0,.24),(.5,.12),(1,0)]))
]:elem('ellipse',{'id':name,**a},selftone)
# Blush is a wide, fading makeup field; the previous hard placement ovals are removed.
for part,cx,cy,color,stops in [('blush_right',409.5,216,'#F3ACA9',[(0,.34),(.3,.23),(.55,.105),(.8,.025),(1,0)]),('blush_left',478.5,215.5,'#F5B8B2',[(0,.30),(.3,.235),(.55,.13),(.82,.025),(1,0)])]:
 g=groups[part];g.attrib.pop('fill',None)
 for x in list(g):
  if x.tag!=N+'title':g.remove(x)
 field=gchild(g,part+'_soft_color',part,'blush-makeup',{'clip-path':'url(#face_surface_clip)'})
 elem('ellipse',{'id':part+'_field',**radial(part+'_grad',cx,cy,18.5,19.5,color,stops)},field)
# Nose surface colors belong to nose, not to the skin or blush parts.
g=groups['nose'];oldpath=next(x for x in g if x.tag==N+'path');g.remove(oldpath);g.attrib.pop('fill',None)
ng=gchild(g,'nose_local_volume','nose','nose-warm-volume',{'clip-path':'url(#face_surface_clip)'})
elem('ellipse',radial('nose_warm_grad',443.7,229,8.4,8.8,'#EEC6C0',[(0,.46),(.4,.32),(.75,.09),(1,0)]),ng)
elem('ellipse',radial('nose_bridge_warm_grad',443.8,220,4.8,10,'#EDC3BF',[(0,.045),(.45,.025),(1,0)]),ng)
elem('ellipse',radial('nose_tip_light_grad',442.9,224,2.2,3.2,'#FFFFFF',[(0,.95),(.35,.65),(.7,.14),(1,0)]),ng)
nostrils=gchild(g,'nose_alar_color','nose','alar-marks',{'clip-path':'url(#face_surface_clip)','fill':'#A58180','filter':'url(#face_nose_soft)'});nostrils.append(oldpath)
# Brow paths and positions remain exactly the same; shade and edge softness are local to each brow.
for part,fill in [('brow_right',linear('brow_right_color',406,183,434,187,[(0,'#9D8E9B'),(.35,'#A8A1B1'),(.8,'#C1AFB4'),(1,'#D4BCBC')])),('brow_left',linear('brow_left_color',454,187,482,183,[(0,'#CBB6B8'),(.5,'#ADAABA'),(1,'#969BAC')]))]:
 g=groups[part];p=next(x for x in g if x.tag==N+'path');g.remove(p);g.attrib.pop('fill',None);clip(part+'_surface_clip',p.get('d'));b=gchild(g,part+'_pigment',part,'brow-pigment',{'clip-path':f'url(#{part}_surface_clip)','fill':fill,'filter':'url(#face_brow_soft)'});b.append(p)
# Ear bases remain complete, including the covered roots. All local ear shades are clipped to the original ear shape.
for part,cx in [('ear_right',394.5),('ear_left',494.5)]:
 g=groups[part];p=next(x for x in g if x.tag==N+'path');g.attrib.pop('fill',None);clip(part+'_surface_clip',p.get('d'))
 p.set('fill',linear(part+'_base_color',cx-4,209,cx+3,225,[(0,'#AE8B96'),(.46,'#D3ABA8'),(.7,'#E3BEB7'),(1,'#B28B94')]))
 eg=gchild(g,part+'_local_tones',part,'ear-self-volume',{'clip-path':f'url(#{part}_surface_clip)'})
 elem('ellipse',radial(part+'_concha_grad',cx-.8,215.3,4.1,7.8,'#927080',[(0,.24),(.6,.10),(1,0)]),eg)
 elem('ellipse',radial(part+'_lobe_light_grad',cx+1.6,219.2,3.3,4.3,'#F6DAD2',[(0,.27),(.6,.11),(1,0)]),eg)
# Cast shadows are independent effects with explicit sources/receiver, inserted over makeup and under the eyes.
cast=gchild(None,'face_cast_shadows','face_base','cast-shadow-effects',{'data-effect':'cast-shadow','data-target-part':'face_base','clip-path':'url(#face_surface_clip)'})
left=gchild(cast,'face_shadow_from_right_forelock','face_base','cast-shadow',{'data-source-part':'hair_front_right','data-target-part':'face_base','fill':'none','stroke':'#AC777D','stroke-width':6,'opacity':.40,'filter':'url(#face_cast_soft)','stroke-linecap':'round'})
elem('path',{'d':'M 390,213 C 400,207 406.7,189.6 410,176.8 C 413.8,163.4 419,150.6 430.4,152.4 C 435.1,153.2 439.7,157.5 443.5,162'},left)
right=gchild(cast,'face_shadow_from_left_forelock','face_base','cast-shadow',{'data-source-part':'hair_front_left','data-target-part':'face_base','fill':'none','stroke':'#AD747B','stroke-width':6.5,'opacity':.39,'filter':'url(#face_cast_soft)','stroke-linecap':'round'})
elem('path',{'d':'M 495,212 C 486.8,204.5 481.9,190.1 478.5,177.3 C 474.9,163.1 469.3,150.3 458.8,152.5 C 453.5,153.3 448.2,157.6 444,162'},right)
# Narrow side-lock shade occurs on the exposed outer cheek; it follows the saved lock boundary, with no geometry changes.
for part,d in [('hair_side_right','M 401,202 C 399.3,210 398.3,216 397.7,223'),('hair_side_left','M 487,202 C 488.4,208.5 489.5,215.5 490.4,222')]:
 c=gchild(cast,'face_shadow_from_'+part,'face_base','cast-shadow',{'data-source-part':part,'data-target-part':'face_base','fill':'none','stroke':'#AA7780','stroke-width':4.2,'opacity':.28,'filter':'url(#face_cast_soft)','stroke-linecap':'round'});elem('path',{'d':d},c)
j=gchild(cast,'face_shadow_from_forehead_jewel','face_base','cast-shadow',{'data-source-part':'forehead_jewel','data-target-part':'face_base','filter':'url(#face_jewel_soft)'})
elem('path',{'d':'M 442.0,172.3 C 442.3,175.3 443.1,177.8 444.1,178.9 C 445.1,176.8 446.5,174.7 446.1,172.0 Z','fill':'#B79294','opacity':.14},j)
r.insert(list(r).index(groups['eye_right']),cast)
r.find(N+'title').text='剑妈 · 完整分层稿 · face 肤色与局部层次'
r.find(N+'desc').text='原画布 941×1672。脸底形、轮廓及五官位置沿用校准稿；脸部自身肤色、独立红晕、鼻、眉、耳局部层次和标明来源的可关闭投影均可编辑。其他部件维持各专项现阶段内容。背景透明。'
out.mkdir(parents=True,exist_ok=True);E.ElementTree(r).write(out/'character.svg',encoding='utf-8',xml_declaration=True)
# Surface paths, placement, identity and untouched groups are checked independently of paint changes.
old={g.get('id'):g for g in original.findall(N+'g')};new={g.get('id'):g for g in r.findall(N+'g')}
pathds=lambda g:[p.get('d') for p in g.iter(N+'path')]
preserved=['face_base','eye_left','eye_right','mouth','brow_left','brow_right','nose','ear_left','ear_right']
checks={p:all(d in pathds(new[p]) for d in pathds(old[p])) for p in preserved}
report={'input_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256((out/'character.svg').read_bytes()).hexdigest(),'changed_original_parts':[k for k in old if E.tostring(old[k])!=E.tostring(new[k])],'new_effect_groups':['face_cast_shadows'],'preserved_original_paths':checks,'face_base_shape_exact':E.tostring(original.find('.//*[@id="face_base_shape"]'))==E.tostring(r.find('.//*[@id="face_base_shape"]')),'face_contour_exact':E.tostring(original.find('.//*[@id="face_base_contour"]'))==E.tostring(r.find('.//*[@id="face_base_contour"]')),'existing_ids_preserved':all(p.get('id') in {e.get('id') for e in r.iter()} for p in original.iter() if p.get('id')),'unique_ids':len([e.get('id') for e in r.iter() if e.get('id')])==len(set(e.get('id') for e in r.iter() if e.get('id'))),'part_count':len(set(g.get('data-part') for g in r.findall(N+'g'))),'unchanged_original_groups':[k for k in old if E.tostring(old[k])==E.tostring(new[k])],'shadow_receivers':['face_base'],'shadow_sources':['hair_front_right','hair_front_left','hair_side_right','hair_side_left','forehead_jewel']}
Path('tmp/refinement-face-color/structure-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='unchanged_original_groups'},ensure_ascii=False,indent=2))
