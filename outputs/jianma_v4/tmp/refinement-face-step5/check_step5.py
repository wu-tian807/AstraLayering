from pathlib import Path
from copy import deepcopy
import xml.etree.ElementTree as E,hashlib,json,re
N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1])
T=Path('tmp/refinement-face-step5');F=Path('refinement/groups/face/5.脸部部件绘制/character.svg');B=Path('refinement/groups/face/4.肤色与局部层次/character.svg')
a=E.parse(B).getroot();b=E.parse(F).getroot();edited={'brow_left','brow_right','nose','ear_left','ear_right','blush_left','blush_right'}
x={g.get('id'):g for g in a if g.tag==N+'g'};y={g.get('id'):g for g in b if g.tag==N+'g'}
assert set(x)==set(y)
changed=[id for id in x if E.tostring(x[id])!=E.tostring(y[id])]
assert set(changed)==edited,changed
assert E.tostring(x['face_base'])==E.tostring(y['face_base'])
ids=[e.get('id') for e in b.iter() if e.get('id')];assert len(ids)==len(set(ids))
refs=re.findall(r'url\(#([^\)]+)\)',F.read_text());assert all(ref in ids for ref in refs)
old_def={e.get('id'):E.tostring(e) for e in a.find(N+'defs')}
new_def={e.get('id'):E.tostring(e) for e in b.find(N+'defs')}
assert all(new_def[k]==v for k,v in old_def.items())
assert {e.get('data-part') for e in a.iter() if e.get('data-part')}=={e.get('data-part') for e in b.iter() if e.get('data-part')}
for p in edited:
 for e in y[p].iter(N+'g'):assert e.get('data-part')==p and e.get('data-kind')=='face'
order=[g.get('id') for g in b if g.tag==N+'g'];assert order.index('ear_right')<order.index('face_base') and order.index('ear_left')<order.index('face_base')
assert [k for k in x if k not in {'ear_left','ear_right'}]==[k for k in y if k not in {'ear_left','ear_right'}]
for root in (a,b):
 assert all(e.get('display')!='none' and e.get('visibility')!='hidden' for e in root.iter())
def save(name,groups,source=b):
 rt=E.Element(N+'svg',source.attrib);rt.append(deepcopy(source.find(N+'defs')))
 for g in source:
  if g.get('id') in groups:rt.append(deepcopy(g))
 E.ElementTree(rt).write(T/(name+'.svg'),encoding='utf-8',xml_declaration=True)
for p in sorted(edited):save('isolated-'+p,{p})
save('face-clean',{'face_base'})
save('face-clean-before',{'face_base'},a)
save('ears-with-face',{'ear_left','ear_right','face_base'})
save('features-hidden',set(y)-{'brow_left','brow_right','nose','blush_left','blush_right'})
save('all-edited',edited)
mask=E.Element(N+'svg',b.attrib);shape=deepcopy(b.find('.//*[@id="face_base_shape"]'));shape.set('fill','white');mask.append(shape);E.ElementTree(mask).write(T/'face-mask.svg',encoding='utf-8',xml_declaration=True)
result={'input_sha256':hashlib.sha256(B.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256(F.read_bytes()).hexdigest(),'edited_parts':changed,'edited_kinds':['face'],'unchanged_top_groups':len(x)-len(changed),'total_top_groups':len(x),'total_parts':len({e.get('data-part') for e in b.iter() if e.get('data-part')}),'face_base_exactly_preserved':True,'prior_defs_exactly_preserved':True,'unique_ids':len(ids),'all_url_refs_resolved':True,'ear_layer_order':'ear_right, ear_left before face_base; all other relative order preserved','initial_visibility_restored':True}
(T/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
