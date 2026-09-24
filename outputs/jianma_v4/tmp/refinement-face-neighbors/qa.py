from pathlib import Path
import xml.etree.ElementTree as E,copy,json
P=Path('tmp/refinement-face-neighbors');N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1]);r=E.parse('refinement/groups/face/3.关联部件校准/character.svg').getroot();q=json.loads((P/'structure-check.json').read_text());changed=[x['part'] for x in q['changed']]
for name,parts in [('changed-parts',changed),('eyes-brows',['eye_left','eye_right','brow_left','brow_right']),('nose-mouth',['nose','mouth']),('jewel',['forehead_jewel']),('earring-right',['earring_right']),('face-base',['face_base'])]:
 out=E.Element(r.tag,r.attrib)
 for g in r:
  if g.tag==N+'defs' or g.get('data-part') in parts:out.append(copy.deepcopy(g))
 E.ElementTree(out).write(P/(name+'.svg'),encoding='utf-8',xml_declaration=True)
(P/'registration.json').write_text(json.dumps({'canvas':[941,1672],'transform':'identity; no local alignment','head_crop':[355,120,176,225],'head_display_scale':4,'face_crop':[390,175,111,78],'face_display_scale':8,'overlay_alpha':.5,'preview':'white background rendered from the final saved SVG','reference':'references/base-subject.png','input':'refinement/groups/face/2.脸型校准与绘制/character.svg','output':'refinement/groups/face/3.关联部件校准/character.svg'},ensure_ascii=False,indent=2))
