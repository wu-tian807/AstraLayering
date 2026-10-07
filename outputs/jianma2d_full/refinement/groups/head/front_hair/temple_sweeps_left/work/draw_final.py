from pipeline import *
s=load()
for k in IDS:
 pr='n27_'+k
 newdefs=[]
 for d in s[k]['defs']:
  if '_ink_fade_' in d:
   fine=any(x in d for x in ['root_fiber','tip_fiber','flow_fiber','ear_fiber'])
   internal=any(x in d for x in ['inner_sweep','ear_fold'])
   col='#bdc4d2' if fine else '#aab5c9' if internal else '#8d9bb3'
   d=d.replace('#7c8699',col)
   if fine:d=d.replace('stop-opacity=".74"','stop-opacity=".48"').replace('stop-opacity=".9"','stop-opacity=".53"')
   elif internal:d=d.replace('stop-opacity=".74"','stop-opacity=".43"').replace('stop-opacity=".9"','stop-opacity=".52"')
  newdefs.append(d)
 s[k]['defs']=newdefs
 for n in s[k]['nodes']:
  if n['name']=='ridge_light':n['content']=n['content'].replace('opacity=".73"','opacity=".57"').replace('opacity=".48"','opacity=".43"')
  if n['name']=='brush_lines':n['content']=n['content'].replace('0.055px滤镜单独软化边缘。','0.055px滤镜单独软化边缘。4.7线色融合：可见外缘蓝灰、内部转面浅蓝灰、细纤维更淡；沿原渐变保持端部消隐和固定压力轮廓。')
prepare('part_rendered',s,'4.7 对照参考减弱内部转面/细纤维线对比，外缘保留蓝灰；宽亮脊降低到柔银白，避免整齐硬亮带。完整根保持同一材质完成度，独立raw原样保存；最终跨组顺序与receiver裁切留阶段5。',gap=True)
f=BASE/'stages/part_rendered'
subprocess.run([PY,TOOL,str(f/'candidate.svg'),str(f/'preview-white.png'),'--scale','1'],check=True)
# 检视专用邻接顺序：本组移到此前左刘海前方原始源片段之前，让前刘海遮住根；不写回成稿、不装蒙版。
t=(f/'candidate.svg').read_text();chunk=t[t.index(START):t.index(END)+len(END)];without=t.replace(chunk,'')
marker=re.search(r'<!--[^>]*n25[^>]*start[^>]*-->',without)
assert marker,'existing n25 marker required'
t=without[:marker.start()]+chunk+without[marker.start():]
(f/'neighbor-inspection-only.svg').write_text(t)
cmd=[PY,TOOL,str(f/'neighbor-inspection-only.svg'),str(f/'neighbor-surfaces.png'),'--reference','references/base-subject.png','--crop','337','199','80','89','--scale','5','--columns','3']
for id in ['head_face_face_skin','head_face_ear_left']+list(IDS.values())+['part-head-front-hair-fringe-left-broad-lock','part-head-front-hair-fringe-left-fine-lock']:cmd+=['--only',id]
subprocess.run(cmd,check=True)
(f/'neighbor-inspection-note.md').write_text('只为4.7邻接色面检查生成临时SVG，将n27完整片段移到n25片段之前，按参考前刘海遮根。未改变任何几何/色面/物理身份，也未装receiver mask；此临时序列不写回标准成稿。邻接图只独显物理面，不含raw投影，投影完整实看在4.5.2。参考接界：浅银白鬓发与稍冷灰前刘海连贯，二者均明显亮于露肤暖色；卷底灰带为独立投影，不要求自身基色变深。\n')
cmd=[PY,'../../workflow-next/live2d-layering/tools/rendering.py','check','--groups','structure/groups.json','--rendering','structure/rendering.json','--svg',str(f/'candidate.svg')]
r=subprocess.run(cmd,check=True,capture_output=True,text=True);(f/'rendering-check.json').write_text(r.stdout)
