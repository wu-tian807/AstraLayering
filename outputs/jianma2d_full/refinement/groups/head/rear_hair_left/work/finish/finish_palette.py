from pathlib import Path
import sys,copy,json,hashlib,xml.etree.ElementTree as E
sys.path.insert(0,str(Path('outputs/jianma2d_full/refinement/groups/head/rear_hair_left/work')))
from rear_left_ops import W,G,A,IDS,group,put_groups,byid,elem,note,snapshot
D=G/'4.rendering stack/4.7.线色融合与材质细化';D.mkdir(exist_ok=True)
C=D/'candidate.svg';C.write_bytes(A.read_bytes());gs=[group(i) for i in IDS]
colors=[['#B6BAD1','#C8CBDF','#CFD2E4','#C1C5DC','#ADB2CC','#A9AEC8'],['#B9C3D9','#D1D8E9','#D8DEED','#C8D1E3','#ACB8D1']]
for idx,g in enumerate(gs):
 id=IDS[idx];defs=next(e for e in g if e.tag.endswith('defs'))
 for stop,color in zip(list(byid(g,id+'_volume'))[:len(colors[idx])],colors[idx]): stop.set('stop-color',color)
 for stop in byid(g,id+'_cool_transition'): stop.set('stop-color','#C4C9E3' if idx==0 else '#CDD2EA')
 for n in g.iter():
  if n.get('data-base-color'):n.set('data-base-color','#C5C8DE' if idx==0 else '#D2D9E9')
 for role,stops in [('contour',[(0,'#8791A8'),(.35,'#98A1B8'),(.7,'#8592AD'),(1,'#AAB4C9')]),('structure',[(0,'#99A1B9'),(.32,'#A6AEC5'),(.66,'#909DB8'),(1,'#B3BBCF')]),('detail',[(0,'#ABB2C8'),(.3,'#A3AEC7'),(.7,'#A1AEC7'),(1,'#BDC4D7')])]:
  gradid=id+'_finished_'+role+'_color';grad=elem('linearGradient',{'id':gradid,'gradientUnits':'userSpaceOnUse','x1':0,'y1':225 if idx==0 else 812,'x2':0,'y2':382 if idx==0 else 1310})
  for offset,color in stops:grad.append(elem('stop',{'offset':offset,'stop-color':color}))
  defs.append(grad)
  for n in g.iter():
   if n.get('data-brush') and n.get('data-role')==role:n.set('fill','url(#'+gradid+')')
 note(g,'4.7材质复核：保留全部Geometry、perfect-freehand笔触边界/粗细/压力/起收笔/opacity及原有局部模糊；可见笔触改为同材质灰蓝的纵向颜色渐变，明处稍淡，转暗处稍实。辅助线、tone-only和隐藏闭合保持隐藏。'+('参考耳后发面为略紫冷银灰，比浅银鬓发更暗，比皮肤冷；体积色轻微去蓝，浅沟线融入发面，已有柔亮脊保留。' if idx==0 else '参考中央尾束受光中心为灰蓝银色；压低此前偏白中间调，保留中心窄亮脊和两侧自身转暗。上端完整隐根至膝间收窄及单尖连续着色，不添加劈叉或贯穿中线。'))
put_groups(gs,C);snapshot(D/'parts.svg',gs)
(D/'说明.md').write_text('参考接界记录（修正前实际参考/组合对照）：\n- 耳后发面为略带紫的冷银灰，较前方亮银鬓发暗；与暖粉皮肤有冷暖分离，脸颈贴边有蓝灰投影，向发面柔化。发沟应是浅弱顺流细线，宽面留白。\n- 中央尾束是连续的灰蓝银发单束；腿内侧压暗，中心有柔亮脊，中心不是纯白，末尖线应融入同色系。\n\n本次修正：后脑体积和过渡色轻微去蓝，尾束中间调从偏白降低到冷银灰；9条可见笔触的填色改为纵向灰蓝渐变，沿光照在浅面淡、转面略实。几何d、宽度、压力、透明度、软边、留白、隐藏辅助线全部不变。未追加发丝密度，未改其他part和17个独立渲染层。原始投影保留，诊断apply仅在本目录。\n')
print(C)
