from pathlib import Path
from PIL import Image, ImageDraw
import xml.etree.ElementTree as ET, copy, json, re, numpy as np
P=Path('tmp/refinement-face');N='{http://www.w3.org/2000/svg}';ET.register_namespace('',N[1:-1])
root=ET.parse('refinement/groups/face/2.脸型校准与绘制/character.svg').getroot()
face=next(g for g in root if g.get('id')=='face_base')
for name,role in [('face-isolated',None),('fill-isolated','base-color'),('contour-isolated','visible-contour')]:
 r=ET.Element(root.tag,root.attrib)
 for de in root.findall(N+'defs'):r.append(copy.deepcopy(de))
 if role is None:r.append(copy.deepcopy(face))
 else:r.append(copy.deepcopy(next(e for e in face if e.get('data-role')==role)))
 ET.ElementTree(r).write(P/(name+'.svg'),encoding='utf-8',xml_declaration=True)
# Review contour in reference coordinates, with no movement or independent fitting of the image.
r=copy.deepcopy(root)
for ch in list(r):
 if ch.tag!=N+'defs':r.remove(ch)
g=ET.SubElement(r,N+'g',{'fill':'none','stroke':'#ed258d','stroke-width':'0.6','stroke-linecap':'round'})
d=next(face.iter(N+'path'))
line=next(e for e in face.iter(N+'path') if e.get('id')=='face_visible_outline')
ET.SubElement(g,N+'path',{'d':line.get('d')})
ET.ElementTree(r).write(P/'contour-diagnostic.svg',encoding='utf-8',xml_declaration=True)
# Save the original-canvas registration and the manual source-line landmarks used for curve QA.
pts=[float(x) for x in re.findall(r'-?\d+(?:\.\d+)?',line.get('d'))];start=np.array(pts[:2]);curves=[]
for i in range(2,len(pts),6):
 cp=np.array([start,pts[i:i+2],pts[i+2:i+4],pts[i+4:i+6]])
 t=np.linspace(0,1,4001)[:,None];b=(1-t)**3*cp[0]+3*(1-t)**2*t*cp[1]+3*(1-t)*t*t*cp[2]+t**3*cp[3]
 curves.append(b);start=cp[3]
p=np.vstack(curves)
landmarks={'left':[(220,399.8),(225,401.1),(230,402.8),(235,404.6),(240,407.5),(245,410.8),(250,415.2),(255,420.6),(260,426.6),(265,433.1)],'right':[(220,488.1),(225,486.4),(230,485.2),(235,483.2),(240,480.6),(245,477.2),(250,472.8),(255,467.1),(260,460.9),(265,454.5)]}
qa=[]
for side,lms in landmarks.items():
 a=p[p[:,0]<(444) if side=='left' else p[:,0]>444]
 for y,x in lms:
  idx=np.argmin(abs(a[:,1]-(y+.5))); v=float(a[idx,0]);qa.append({'side':side,'source_row':y,'approx_source_center_x':x,'curve_x':round(v,3),'delta_x':round(v-x,3)})
(P/'registration.json').write_text(json.dumps({'canvas':[941,1672],'head_crop':[355,120,176,190],'same_scale':5,'transform':'identity; no local alignment','manual_landmarks':qa,'mean_absolute_horizontal_delta':round(float(np.mean([abs(q['delta_x']) for q in qa])),3),'max_absolute_horizontal_delta':round(max(abs(q['delta_x']) for q in qa),3),'interpretation':'Manual contour-center checks from the 1x color reference. Approximate within source antialiasing; these do not measure all facial anatomy.'},ensure_ascii=False,indent=2))
print((P/'registration.json').read_text())
