from pathlib import Path
import xml.etree.ElementTree as E,copy,json,statistics
from PIL import Image
P=Path('tmp/refinement-face-color');N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1]);r=E.parse('refinement/groups/face/old-1.4/character.svg').getroot()
variants={'skin-base':['face_base'],'blush':['blush_right','blush_left'],'nose':['nose'],'brows':['brow_right','brow_left'],'ears':['ear_right','ear_left'],'cast-shadows':['face_cast_shadows'],'face-surface-mask':[]}
for name,ids in variants.items():
 out=E.Element(r.tag,r.attrib)
 for c in r:
  if c.tag==N+'defs' or c.get('id') in ids:out.append(copy.deepcopy(c))
 if name=='face-surface-mask':
  p=copy.deepcopy(r.find('.//*[@id="face_base_shape"]'));p.set('fill','#FFFFFF');out.append(p)
 E.ElementTree(out).write(P/(name+'.svg'),encoding='utf-8',xml_declaration=True)
for name,hide in [('no-cast',['face_cast_shadows']),('no-blush',['blush_right','blush_left']),('no-nose',['nose'])]:
 out=copy.deepcopy(r)
 for c in out:
  if c.get('id') in hide:c.set('display','none')
 E.ElementTree(out).write(P/(name+'.svg'),encoding='utf-8',xml_declaration=True)
P.joinpath('registration.json').write_text(json.dumps({'canvas':[941,1672],'transform':'identity; no local alignment','face_crop':[390,148,109,126],'face_scale':8,'head_crop':[355,120,176,190],'head_scale':5,'overlay_alpha':.5,'source':'references/base-subject.png','output':'refinement/groups/face/old-1.4/character.svg'},ensure_ascii=False,indent=2))
# In-reference source pixel probes. Boundary probes are diagnostic only because unchanged marked hair overlaps some of them.
src=Image.open('references/base-subject.png').convert('RGB');out=Image.open('refinement/groups/face/old-1.4/preview.png').convert('RGB');samples=json.loads(P.joinpath('source-samples.json').read_text())
clean=['forehead_l','forehead_r','forehead_middle','midface_l','midface_r','cheek_l_peak','cheek_r_peak','cheek_l_inner','cheek_r_inner','jaw_l_skin','jaw_r_skin','chin_middle','nose_bridge','nose_tip_highlight','nose_tip_warm','nose_under']
for a in samples:
 x,y=a['x'],a['y'];v=[out.getpixel((x+dx,y+dy)) for dx in [-1,0,1] for dy in [-1,0,1]];b=tuple(round(statistics.median(c)) for c in zip(*v));a['render_rgb']=b;a['render_hex']='#%02X%02X%02X'%b;a['delta_rgb']=tuple(b[i]-a['rgb'][i] for i in range(3));a['probe_class']='clean-skin' if a['name'] in clean else 'fine-detail-or-occlusion; not a color-fit score'
P.joinpath('color-probes.json').write_text(json.dumps(samples,ensure_ascii=False,indent=2))
