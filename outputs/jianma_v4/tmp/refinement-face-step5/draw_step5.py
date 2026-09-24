from pathlib import Path
from copy import deepcopy
import hashlib, xml.etree.ElementTree as E
BASE=Path('refinement/groups/face/4.肤色与局部层次/character.svg')
OUT=Path('refinement/groups/face/5.脸部部件绘制');OUT.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(BASE.read_bytes()).hexdigest()=='2e4d985553cd0bc0c757c20021442e6204b723dd929b68c55d52c84d80fce10f'
N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1]);r=E.parse(BASE).getroot();defs=r.find(N+'defs')
def el(tag,attrs={},parent=None,**kw):
 a={k:str(v) for k,v in attrs.items()};a.update({k.replace('_','-'):str(v) for k,v in kw.items()});e=E.Element(N+tag,a)
 if parent is not None:parent.append(e)
 return e
def grad(id,stops,linear=False,**kw):
 e=el('linearGradient' if linear else 'radialGradient',{'id':id},defs,**kw)
 for off,col,op in stops:el('stop',{'offset':off,'stop-color':col,'stop-opacity':op},e)
 return e
def group(p,id,role,**kw):return el('g',{'id':id,'data-part':p,'data-kind':'face','data-role':role},**kw)
def reset(p,title):
 g=next(x for x in r if x.get('id')==p);g.attrib.pop('fill',None)
 for c in list(g):g.remove(c)
 el('title',parent=g).text=title
 return g
def blur(id,sd):
 f=el('filter',{'id':id,'x':'-30%','y':'-150%','width':'160%','height':'400%','color-interpolation-filters':'sRGB'},defs)
 el('feGaussianBlur',{'stdDeviation':sd},f)
blur('face5_brow_edge',.40)
# One complete pigment unit per brow. The cap lies beneath the retained forelock.
brows={
'brow_right':('角色右眉 · 整眉柔色与发下补全','M 405.7,182.0 C 414.7,181.7 427.5,183.4 434.2,187.8 C 425.6,186.5 416.1,185.2 406.3,185.1 C 404.7,184.7 403.8,183.9 402.9,182.8 C 403.8,182.2 404.7,182 405.7,182 Z',403,434,[(0,'#B3A0AD',1),(.25,'#A18E9F',1),(.6,'#ADA4B7',1),(1,'#C3ADB5',.75)]),
'brow_left':('角色左眉 · 整眉柔色与发下补全','M 454.1,188.1 C 460.4,183.5 472.0,181.7 482.0,181.9 C 483.4,181.9 484.8,182.2 485.6,182.8 C 484.7,183.9 483.6,184.8 482.3,185.1 C 472.8,185.2 462.6,186.1 454.1,188.1 Z',454,486,[(0,'#C3ADB6',.75),(.4,'#B0A4B2',1),(.8,'#9AA0B1',1),(1,'#A099AE',1)])}
for p,(title,d,x1,x2,stops) in brows.items():
 g=reset(p,title);grad('face5_'+p+'_color',stops,True,gradientUnits='userSpaceOnUse',x1=x1,y1=184,x2=x2,y2=184)
 u=group(p,p+'_pigment','complete-brow-pigment');g.append(u)
 el('path',{'id':p+'_complete_shape','d':d,'fill':'url(#face5_'+p+'_color)','filter':'url(#face5_brow_edge)'},u)
# Each blush is one transparent diffuse field; the face mask affects composition only.
for p,cx,cy,rx,ry,color,stops in [
 ('blush_right',409.5,216,18.5,19.5,'#F3ACA9',[(0,.34),(.3,.23),(.55,.105),(.8,.025),(1,0)]),
 ('blush_left',478.5,215.5,18.5,19.5,'#F5B8B2',[(0,.30),(.3,.235),(.55,.13),(.82,.025),(1,0)])]:
 g=reset(p,('角色右' if p.endswith('right') else '角色左')+'脸颊 · 透明扩散红晕')
 g.set('clip-path','url(#face_clean_skin_clip)')
 grad('face5_'+p+'_diffusion',[(off,color,op) for off,op in stops])
 u=group(p,p+'_diffusion','diffuse-blush');g.append(u)
 el('ellipse',{'id':p+'_field','cx':cx,'cy':cy,'rx':rx,'ry':ry,'fill':'url(#face5_'+p+'_diffusion)'},u)
# Simplified nose: a self-shadow and two marks, without a bridge outline or glint.
g=reset('nose','鼻子 · 简化标记与独立自身暖影')
shadow=group('nose','nose_self_shadow','intrinsic-nose-shading');shadow.set('clip-path','url(#face_clean_skin_clip)');g.append(shadow)
grad('face5_nose_warmth',[(0,'#E9B5B5',.36),(.35,'#E9B5B5',.28),(.75,'#E9B5B5',.085),(1,'#E9B5B5',0)])
el('ellipse',{'id':'nose_warm_form','cx':443.7,'cy':229.5,'rx':8.5,'ry':9,'fill':'url(#face5_nose_warmth)'},shadow)
marks=group('nose','nose_marks','simplified-nose-marks');marks.set('opacity','.83');g.append(marks)
grad('face5_nose_mark_color',[(0,'#946F72',1),(.35,'#946F72',.98),(.7,'#A17B7D',.4),(1,'#B98D8D',0)])
for id,cx,cy,rx,ry,rotation in [('nose_mark_right',440.2,229.45,1.55,1.4,28),('nose_mark_left',446.65,229.35,1.50,1.5,-25)]:
 el('ellipse',{'id':id,'cx':cx,'cy':cy,'rx':rx,'ry':ry,'fill':'url(#face5_nose_mark_color)','transform':f'rotate({rotation} {cx} {cy})'},marks)
# Normal ears, completed into the face behind it. Only visible outer arcs get ink.
ear_specs={
'ear_right':('M 395,209 C 390,204 385,209 387,215 C 388,220 392.5,224.5 397.1,223.8 C 399.2,224.1 403,223.6 404.5,221 C 405.3,217 404.5,212.5 402.5,210 C 399.7,208.6 397.3,208.2 395,209 Z',391.5,214.5,'M 391,207 C 387.5,207.2 386,210.3 387.3,214.7 C 389,220 392.5,223.4 396.4,223.4','M 390.4,209.8 C 389.4,212.6 390.7,216.3 393,220'),
'ear_left':('M 493,209 C 498,204 503,209 501.5,215 C 500.5,220 497,224 492,223.5 C 489.3,224 485,223 483.7,220.5 C 482.9,216.8 484,211.8 486.5,210 C 488.8,208.5 491.5,208.3 493,209 Z',497.4,214.2,'M 498,207 C 501.5,208 503,211 501.5,215 C 500,220 496.3,223.3 492.2,223.4','M 499.5,210 C 500.7,213 498.9,217.5 496.8,220.4')}
for p,(d,cx,cy,rim,fold) in ear_specs.items():
 g=reset(p,('角色右' if p.endswith('right') else '角色左')+'人耳 · 连续耳底、耳窝与浅内线')
 cp=el('clipPath',{'id':'face5_'+p+'_clip'},defs);el('path',{'d':d},cp)
 grad('face5_'+p+'_skin',[(0,'#AE8B96',1),(.4,'#D3ABA8',1),(.8,'#E3BEB7',1),(1,'#B28B94',1)],True,gradientUnits='userSpaceOnUse',x1=0,y1=207,x2=0,y2=224)
 base=group(p,p+'_base','complete-ear-base');g.append(base);el('path',{'id':p+'_complete_shape','d':d,'fill':'url(#face5_'+p+'_skin)'},base)
 interior=group(p,p+'_interior','ear-recess-color');g.append(interior);interior.set('clip-path','url(#face5_'+p+'_clip)')
 grad('face5_'+p+'_recess',[(0,'#94727F',.36),(.45,'#94727F',.23),(1,'#94727F',0)])
 el('ellipse',{'id':p+'_recess','cx':cx,'cy':cy,'rx':4.4,'ry':7.2,'fill':'url(#face5_'+p+'_recess)'},interior)
 contour=group(p,p+'_contour','visible-ear-lines');g.append(contour)
 grad('face5_'+p+'_line_fade',[(0,'#967783',0),(.2,'#967783',.48),(.65,'#967783',.6),(1,'#967783',.2)],True,gradientUnits='userSpaceOnUse',x1=0,y1=207,x2=0,y2=224)
 el('path',{'id':p+'_visible_rim','d':rim,'fill':'none','stroke':'url(#face5_'+p+'_line_fade)','stroke-width':.6,'stroke-linecap':'round'},contour)
 el('path',{'id':p+'_inner_fold','d':fold,'fill':'none','stroke':'url(#face5_'+p+'_line_fade)','stroke-width':.45,'stroke-linecap':'round','opacity':.6},contour)
for p in ['ear_right','ear_left']:
 g=next(x for x in r if x.get('id')==p);r.remove(g);idx=next(i for i,x in enumerate(r) if x.get('id')=='face_base');r.insert(idx,g)
E.ElementTree(r).write(OUT/'character.svg',encoding='utf-8',xml_declaration=True)
print('saved',OUT/'character.svg',hashlib.sha256((OUT/'character.svg').read_bytes()).hexdigest())
