from pathlib import Path
from copy import deepcopy
import xml.etree.ElementTree as E,hashlib
N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1])
B=Path('refinement/groups/face/5.脸部部件绘制/character.svg');O=Path('refinement/groups/face/6.投影与高光效果');O.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(B.read_bytes()).hexdigest()=='9bbb6f8a09ec4f7bca11a250b046250878f13a45d11ce775052f0daddbbad27b'
r=E.parse(B).getroot();defs=r.find(N+'defs')
def el(tag,attrs={},parent=None,**kw):
 a={k:str(v) for k,v in attrs.items()};a.update({k.replace('_','-'):str(v) for k,v in kw.items()});e=E.Element(N+tag,a)
 if parent is not None:parent.append(e)
 return e
def grad(id,stops,linear=False,**kw):
 g=el('linearGradient' if linear else 'radialGradient',{'id':id},defs,**kw)
 for off,col,op in stops:el('stop',{'offset':off,'stop-color':col,'stop-opacity':op},g)
 return g
def blur(id,sd):
 f=el('filter',{'id':id,'x':'-50%','y':'-50%','width':'200%','height':'200%','color-interpolation-filters':'sRGB'},defs)
 el('feGaussianBlur',{'stdDeviation':sd},f)
for id,sd in [('face6_hair_soft',1.05),('face6_side_soft',.9),('face6_ear_soft',.65),('face6_jewel_soft',.8),('face6_rim_soft',.45)]:blur(id,sd)
# Full target surfaces, without opacity gradients: clipping does not bake effects into the materials.
for part,sourceid in [('face_base','face_base_shape'),('ear_right','ear_right_complete_shape'),('ear_left','ear_left_complete_shape'),('nose','nose_warm_form')]:
 cp=el('clipPath',{'id':'face6_surface_'+part,'data-target-part':part,'clipPathUnits':'userSpaceOnUse'},defs)
 s=deepcopy(r.find('.//*[@id="'+sourceid+'"]'))
 for k in ['id','fill','filter','opacity','stroke','stroke-width']:s.attrib.pop(k,None)
 s.set('fill','white');cp.append(s)
def fx(id,typ,target,title,source=None):
 attrs={'id':id,'data-part':target,'data-kind':'face','data-effect':typ,'data-target-part':target,'clip-path':'url(#face6_surface_'+target+')'}
 if source:attrs['data-source-part']=source
 g=el('g',attrs);el('title',parent=g).text=title
 return g
def insert_after(anchor,gs):
 idx=next(i for i,x in enumerate(r) if x.get('id')==anchor)
 for k,g in enumerate(gs,1):r.insert(idx+k,g)
facefx=[]
# Along the true inner contours of the retained forelocks; hair occludes the hidden continuation.
for side,d in [
 ('right','M 443.5,161.5 C 438,155 435,153 430.4,152.8 C 418.8,151 414.2,164.4 410.5,177 C 408,187.5 404.8,197.1 400,204.8'),
 ('left','M 444,161.8 C 448.1,157.7 453.6,153 459,152.8 C 469,150.7 474.7,162.2 478.7,177.6 C 481.9,189.9 486.5,203 492.5,210')]:
 g=fx('fx_hair_front_'+side+'_on_face','cast-shadow','face_base','前额发片在脸底上的柔和投影','hair_front_'+side)
 grad('face6_front_'+side+'_shade',[(0,'#A7737E',.43),(.35,'#A7737E',.46),(.72,'#A7737E',.34),(1,'#A7737E',.12)],True,gradientUnits='userSpaceOnUse',x1=0,y1=151,x2=0,y2=211)
 el('path',{'id':'fx_hair_front_'+side+'_editable_path','d':d,'fill':'none','stroke':'url(#face6_front_'+side+'_shade)','stroke-width':4.6,'stroke-linecap':'round','filter':'url(#face6_hair_soft)'},g);facefx.append(g)
# Side lock cast shading fades at both ends and is distinct from blush.
for side,d in [('right','M 400.6,200.5 C 397.8,211 398.3,218.7 400.8,228 C 401.7,232.2 403.8,236.6 405.5,239'),('left','M 486.9,200.5 C 489.5,212 489,220 486.7,230 C 485.6,234 484.4,237 483,239')]:
 g=fx('fx_hair_side_'+side+'_on_face','cast-shadow','face_base','侧发在脸侧表面的局部投影','hair_side_'+side)
 grad('face6_side_'+side+'_shade',[(0,'#986E79',0),(.3,'#986E79',.26),(.62,'#986E79',.18),(1,'#986E79',0)],True,gradientUnits='userSpaceOnUse',x1=0,y1=200,x2=0,y2=240)
 el('path',{'id':'fx_hair_side_'+side+'_face_editable_path','d':d,'fill':'none','stroke':'url(#face6_side_'+side+'_shade)','stroke-width':4.4,'stroke-linecap':'round','filter':'url(#face6_side_soft)'},g);facefx.append(g)
# Small jewel pendant casts a soft downward shadow, retaining a hidden portion beneath the jewel.
g=fx('fx_forehead_jewel_on_face','cast-shadow','face_base','额饰小坠在额头上的下方投影','forehead_jewel')
grad('face6_jewel_shade',[(0,'#956970',.08),(.42,'#956970',.40),(.65,'#956970',.40),(1,'#956970',0)],True,gradientUnits='userSpaceOnUse',x1=0,y1=168,x2=0,y2=181)
el('path',{'id':'fx_forehead_jewel_editable_path','d':'M 441.7,169.5 C 443.5,168 446.5,170.2 446.3,173.5 C 445.8,176.8 445.7,178.6 444.4,180.2 C 442.9,179 442,176 441.7,173.5 Z','fill':'url(#face6_jewel_shade)','filter':'url(#face6_jewel_soft)'},g);facefx.append(g)
# Narrow edge reflection inside the retained jaw contour, not a replacement contour.
g=fx('fx_face_edge_reflection','highlight','face_base','脸颊至下颌内侧的窄幅反光')
grad('face6_face_edge_light',[(0,'#FFFEF5',0),(.25,'#FFFEF5',.72),(.65,'#FFFEF5',.66),(1,'#FFFEF5',.32)],True,gradientUnits='userSpaceOnUse',x1=0,y1=216,x2=0,y2=269)
el('path',{'id':'fx_face_edge_reflection_editable_path','d':'M 400.5,217.2 C 402.7,229 405.1,237.2 412.3,245 C 418.7,252.8 426.3,258.7 438.7,265.9 C 443,268.1 446,268.5 451.7,265.7 C 460.2,260.2 468.4,253.7 474.9,246 C 482.1,237.5 485.5,228.8 487.3,218.2','fill':'none','stroke':'url(#face6_face_edge_light)','stroke-width':1.2,'stroke-linecap':'round','filter':'url(#face6_rim_soft)'},g);facefx.append(g)
insert_after('face_base',facefx)
# Light local cast bands from the face-side locks; no second ear-cavity shadow.
for side,d in [('right','M 389.5,207.8 C 392.5,211.1 395.1,215.8 397.7,220.5'),('left','M 499,208 C 495.8,211.5 492.8,216 490.4,220.4')]:
 target='ear_'+side;g=fx('fx_hair_side_'+side+'_on_ear','cast-shadow',target,'侧发在耳部可见边缘的局部投影','hair_side_'+side)
 grad('face6_ear_'+side+'_shade',[(0,'#805D6B',0),(.35,'#805D6B',.20),(.65,'#805D6B',.23),(1,'#805D6B',0)],True,gradientUnits='userSpaceOnUse',x1=0,y1=207,x2=0,y2=222)
 el('path',{'id':'fx_hair_side_'+side+'_ear_editable_path','d':d,'fill':'none','stroke':'url(#face6_ear_'+side+'_shade)','stroke-width':3.3,'stroke-linecap':'round','filter':'url(#face6_ear_soft)'},g);insert_after(target,[g])
# Nose-tip glint is separate from the nose's own shading and follows the nose surface.
g=fx('fx_nose_tip_highlight','highlight','nose','鼻尖独立暖白亮点')
grad('face6_nose_tip_light',[(0,'#FFFFF6',.85),(.35,'#FFFFF6',.70),(.7,'#FFFFF6',.25),(1,'#FFFFF6',0)])
el('path',{'id':'fx_nose_tip_highlight_editable_path','d':'M 444.15,221.25 C 445.12,221.25 445.65,222.12 445.65,223.35 C 445.65,224.58 445.12,225.45 444.15,225.45 C 443.18,225.45 442.65,224.58 442.65,223.35 C 442.65,222.12 443.18,221.25 444.15,221.25 Z','fill':'url(#face6_nose_tip_light)'},g);insert_after('nose',[g])
E.ElementTree(r).write(O/'character.svg',encoding='utf-8',xml_declaration=True)
print('saved',O/'character.svg',hashlib.sha256((O/'character.svg').read_bytes()).hexdigest())
