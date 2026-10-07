from pipeline import *
s=init()
curves={
'broad_lock':[
('outer','M 436 174 C 445 148 460 138 473 160 C 484 174 488 192 491 210 C 494 226 499 240 503 252 C 506 262 507 273 499 279',.62,'外侧上根至颊侧自由尖；外部边界明确，隐藏根起笔淡出，末端收尖；完整封闭填色由source_boundary承担。'),
('inner','M 436 194 C 443 190 450 187 455 193 C 463 201 469 210 474 219 C 479 227 484 239 489 249 C 494 260 497 271 499 279',.52,'内根翻折到主片眼侧再到颊尖；此线与细束之间保留肤色缝，内根遮挡下起笔淡，末端尖收，边缘软硬适中。')],
'fine_lock':[
('outer','M 463 196.5 C 465.5 198 466.7 201 468.3 205.5 C 470.5 211 473.5 215.8 476.2 221.6 C 478.5 226.9 480.8 233.3 483.3 240 C 486 246 489.5 253 491.5 259.4',.34,'细束右缘从主片下的完整根部到自由尖；不接主片长尖，轻细笔触，起尾淡出。'),
('inner','M 491.5 259.4 C 488.5 255.6 486.5 250.2 484 245.1 C 481.2 239.7 478.8 233.9 476.3 228.1 C 473.8 222.7 471.1 217 468.9 211.4 C 466.7 205.9 464.3 200.4 463 196.5',.3,'细束眼侧边自自由尖返回隐藏根；与另一侧构成闭合填色，细尖淡出，眉眼前边界保持清楚。')]}
for k in IDS:
 pr='n26_'+k
 add(s,k,'surface',path(pr+'_surface_path',D[k],k+'完整表面；隐藏根与可见段同一闭合形体，后续同等材质完成度。',fill='#fcfbfe',stroke='none'))
 add(s,k,'source_boundary',path(pr+'_source_boundary_path',D[k],k+'完整边界，隐藏根闭合；供编辑和填色，不最终显示重复闭合描边。',fill='none',stroke='#94a0b4',stroke_width='.3'),attrs='display="none"')
 s[k]['curves']=[]
 for name,d,w,note in curves[k]:
  s[k]['curves'].append({'name':name,'d':d,'width':w,'desc':k+'；'+note,'category':'contours'})
 add(s,k,'contours',''.join(path(pr+'_source_'+a['name'],a['d'],a['desc'],fill='none',stroke='#7e8ca5',stroke_width=a['width'],stroke_linecap='round',stroke_linejoin='round') for a in s[k]['curves']))
prepare('part_contours',s,'3.1 外轮廓直接沿获准2.3的完整闭合形体建立。两宽片边线与两细束边线分别保留可编辑中心线和起收说明；隐藏根不截断，束间肤色缝不填实。',gap=True)
