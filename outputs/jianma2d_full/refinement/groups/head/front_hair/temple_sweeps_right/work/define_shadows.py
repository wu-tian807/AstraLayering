from pipeline import *
f=BASE/'stages/cast_shadow_relations';f.mkdir(parents=True,exist_ok=True)
shutil.copyfile('refinement/character.svg',f/'candidate.svg')
relations=[]
for k,(caster,curve) in load()['_shadow_boundaries'].items():
 note=f'右侧参考中{caster}下缘向{k}投下冷灰接触带；两片可相对运动，因此独立完整raw。owner为当前直属受影part，follow为实际遮光片，clip_to为完整受影part。'
 if caster=='crown_sweeps':note+='crown_sweeps仍是组n51；完成后第5步按实际末端短扫片细化follow。'
 note+='源影保留轮廓外运动余量，此阶段不装receiver mask；右内沿连续，不添加左侧耳孔。'
 relations.append({'id':'right_temple_'+k+'_cast_shadow','type':'shadow','owner':'head/front_hair/temple_sweeps_right/'+k,'follow':'head/front_hair/temple_sweeps_right/'+caster,'clip_to':['head/front_hair/temple_sweeps_right/'+k],'note':note})
(f/'relationships.json').write_text(json.dumps({'layers':relations},ensure_ascii=False,indent=2)+'\n')
shutil.copyfile('structure/rendering.json',f/'rendering.before.json')
cmd=[PY,'../../workflow-next/live2d-layering/tools/rendering.py','merge','--groups','structure/groups.json','--rendering','structure/rendering.json','--scope','head/front_hair/temple_sweeps_right','--patch',str(f/'relationships.json'),'--out','structure/rendering.json']
r=subprocess.run(cmd,check=True,capture_output=True,text=True);(f/'merge.json').write_text(r.stdout);(f/'command.json').write_text(json.dumps(cmd,ensure_ascii=False,indent=2)+'\n')
(f/'说明.md').write_text('4.5.1 读取四part tone_cast_boundary desc并对应此前4.4已实看同候选彩参；新增四个独立影关系。此节点SVG字节不变，原29关系保留。\n')
print(r.stdout)
