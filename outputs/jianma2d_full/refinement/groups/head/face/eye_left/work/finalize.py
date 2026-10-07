from eye import *
base=E.parse(T/'baseline-artwork.svg').getroot();cur=E.parse(ART).getroot();new_ids=set(IDS.values())|{'eye_left_upper_lid_cast_shadow','eye_left_corneal_highlight'}
assert base.attrib==cur.attrib
old=[(e.get('id'),E.tostring(e,encoding='unicode').strip()) for e in base]
kept=[(e.get('id'),E.tostring(e,encoding='unicode').strip()) for e in cur if e.get('id') not in new_ids]
assert old==kept,'unrelated artwork changed'
assert sha('structure/groups.json')==sha(T/'baseline-groups.json')
old_rel=json.loads((T/'baseline-rendering.json').read_text())['layers'];cur_rel=json.loads(Path('structure/rendering.json').read_text())['layers'];assert len(old_rel)==23 and len(cur_rel)==25 and cur_rel[:23]==old_rel
for key in PARTS:
 p=part(key);surfaces=[e.get('d') for e in p if e.tag.endswith('path') and re.fullmatch(re.escape(IDS[key])+r'_surface_\d+',e.get('id',''))];assert surfaces==paths(key)
 clips=[e.get('d') for e in p.iter() if e.tag.endswith('path') and re.fullmatch(re.escape(IDS[key])+r'_clip_\d+',e.get('id',''))];assert clips==paths(key)
 source=next(e for e in p if e.get('id')==IDS[key]+'_source_curves');assert source.get('display')=='none'
def geometry_only(file):
 rt=E.parse(file).getroot()
 for p in rt.iter():
  for c in list(p):
   if c.tag.rsplit('}',1)[-1]=='desc':p.remove(c)
 return [(e.tag,sorted(e.attrib.items())) for e in rt.iter()]
assert geometry_only(P/'2.直属拆分与色块/2.3.运动露出补齐/input/guide.svg')==geometry_only(GUIDE)
ids=[e.get('id') for e in cur.iter() if e.get('id')];assert len(ids)==len(set(ids))
binding=json.loads((P/'2.直属拆分与色块/2.2.直属轮廓色块/input/binding.json').read_text());assert sha('references/base-subject.png')==binding['input_sha256']['references/base-subject.png']
r=subprocess.run([str(PY),str(S/'tools/rendering.py'),'check','--groups','structure/groups.json','--rendering','structure/rendering.json','--svg',str(ART)],capture_output=True,text=True,env=ENV);print(r.stdout,r.stderr);assert r.returncode==0
report={'status':'pass','old_artwork_root_count':len(old),'old_artwork_ids_payload_order_preserved':True,'old_rendering_records_preserved':23,'new_layer_count':2,'physical_tree_unchanged':True,'guide_non_desc_geometry_unchanged':True,'two_part_surface_and_clip_paths_exactly_match_guide':True,'all_auxiliary_source_curves_hidden':True,'unique_svg_ids':len(ids),'rendering_structural_check':json.loads(r.stdout),'candidate_sha256':sha(ART),'rendering_sha256':sha('structure/rendering.json'),'groups_sha256':sha('structure/groups.json'),'guide_sha256':sha(GUIDE),'reference_sha256':sha('references/base-subject.png'),'line_reference_sha256':sha('references/line-reference.png'),'worker_id':'/root/workflow_runner/arm_right','worker':'group:head/face/eye_left','new_independent_context':False}
(T/'final-integrity.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
finish('part_rendered','part_highlights',f'本轮sclera/lower_eyelid完整Rendering Stack逐node完成并实看；左眼外角短暖褐、中央淡、鼻侧收尖，完整眼白和肤色隐藏搭接保留。原{len(old)}个根级元素payload/order及旧23关系完整保持；新增shadow/highlight共25条。guide几何、物理树和源轮廓不变。上睑n48、iris n49、交叉发丝/face与raw效果最终裁切尚待后续，详见appearance-review，不声称完整眼部组合验收。',preview=True,extra={'rendering_sha256':sha('structure/rendering.json'),'integrity':'work/final-integrity.json','appearance':'4.rendering stack/4.7.线色融合与材质细化/appearance-review.json'})
receipt={'artwork_sha256':sha(CAN),'preview_sha256':sha('refinement/preview.png'),'same_svg_rendered':True,'rendering_sha256':sha('structure/rendering.json'),'guide_sha256':sha(GUIDE),'state':json.loads(Path('structure/groups.dispatch.json').read_text())['active'],'last_successful_node':'part_rendered','complete_next_reopen_called':False,'actual_view':'views/part_rendered.png','raw_glint_view':'views/part_highlights.png','scope':['head/face/eye_left/sclera','head/face/eye_left/lower_eyelid'],'worker_id':'/root/workflow_runner/arm_right','worker':'group:head/face/eye_left','new_independent_context':False}
(T/'delivery-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n');print(json.dumps(receipt,ensure_ascii=False))
