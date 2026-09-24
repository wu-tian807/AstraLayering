from pathlib import Path
from copy import deepcopy
import xml.etree.ElementTree as E,hashlib,re,json
N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1]);P=Path('tmp/refinement-face-step6')
B=Path('refinement/groups/face/5.脸部部件绘制/character.svg');F=Path('refinement/groups/face/6.投影与高光效果/character.svg');a=E.parse(B).getroot();b=E.parse(F).getroot()
orig={g.get('id'):g for g in a if g.tag==N+'g'};new={g.get('id'):g for g in b if g.tag==N+'g'}
fx=[g for g in b if g.get('data-effect')];fxids={g.get('id') for g in fx};parts={g.get('data-part') for g in a.iter() if g.get('data-part')}
assert len(fx)==9
assert all(E.tostring(g)==E.tostring(new[id]) for id,g in orig.items())
assert list(orig)==[id for id in new if id not in fxids]
assert parts=={g.get('data-part') for g in b.iter() if g.get('data-part')}
ids=[g.get('id') for g in b.iter() if g.get('id')];assert len(ids)==len(set(ids));refs=re.findall(r'url\(#([^\)]+)\)',F.read_text());assert all(x in ids for x in refs)
od={g.get('id'):E.tostring(g) for g in a.find(N+'defs')};nd={g.get('id'):E.tostring(g) for g in b.find(N+'defs')};assert all(nd[id]==v for id,v in od.items())
assert not list(b.iter(N+'image'))
records=[]
for g in fx:
 id=g.get('id');typ=g.get('data-effect');target=g.get('data-target-part');source=g.get('data-source-part');clipid=g.get('clip-path')[5:-1]
 assert g.get('data-kind')=='face' and target in parts and g.get('data-part')==target
 assert typ in ['highlight','cast-shadow']
 assert (source in parts) if typ=='cast-shadow' else (source is None)
 clip=b.find('.//*[@id="'+clipid+'"]');assert clip is not None and clip.tag==N+'clipPath' and clip.get('data-target-part')==target
 assert len(g.findall(N+'path'))>=1
 records.append({'id':id,'type':typ,'source':source,'target':target,'clip':clipid,'editable_path_ids':[x.get('id') for x in g.findall(N+'path')]})
def save(name,keep,source=b):
 rt=E.Element(N+'svg',source.attrib);rt.append(deepcopy(source.find(N+'defs')))
 for g in source:
  if g.tag==N+'g' and keep(g):rt.append(deepcopy(g))
 E.ElementTree(rt).write(P/(name+'.svg'),encoding='utf-8',xml_declaration=True)
for g in fx:
 id=g.get('id');save('isolate-'+id,lambda x:x.get('id')==id)
 save('off-'+id,lambda x:x.get('id')!=id)
 target=g.get('data-target-part');save('target-with-'+id,lambda x:x.get('id') in [target,id])
for target in {g.get('data-target-part') for g in fx}:
 cp=b.find('.//*[@id="face6_surface_'+target+'"]');rt=E.Element(N+'svg',b.attrib)
 for p in cp:rt.append(deepcopy(p))
 E.ElementTree(rt).write(P/('mask-'+target+'.svg'),encoding='utf-8',xml_declaration=True)
save('effects-off',lambda x:x.get('id') not in fxids)
save('effects-only',lambda x:x.get('id') in fxids)
sources={g.get('data-source-part') for g in fx if g.get('data-source-part')}
for source in sources:
 save('source-and-cast-off-'+source,lambda x:x.get('data-part')!=source and x.get('data-source-part')!=source)
save('all-sources-and-casts-off',lambda x:x.get('data-part') not in sources and x.get('data-effect')!='cast-shadow')
save('clean-face-only',lambda x:x.get('id')=='face_base')
save('clean-face-before',lambda x:x.get('id')=='face_base',a)
result={'group_id':'face','carry_input_sha256':hashlib.sha256(B.read_bytes()).hexdigest(),'output_svg_sha256':hashlib.sha256(F.read_bytes()).hexdigest(),'original_entity_groups_unchanged':len(orig),'original_entity_group_order_unchanged':True,'parts_before':len(parts),'parts_after':len({g.get('data-part') for g in b.iter() if g.get('data-part')}),'effect_groups':len(fx),'cast_shadow_groups':sum(g.get('data-effect')=='cast-shadow' for g in fx),'highlight_groups':sum(g.get('data-effect')=='highlight' for g in fx),'unique_ids':len(ids),'all_url_references_resolved':True,'old_definitions_unchanged':True,'effects':records}
(P/'validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False,indent=2))
