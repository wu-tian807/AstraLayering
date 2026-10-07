from pipeline import *
s=load()
rows={
'upper_temple_lock':[('root_fiber','M 485.6 182.0 C 491.5 187.3 497.7 195.1 501.8 201.9',.26,'完整冠下根的疏细方向线，随右下转弧延长；中央微显、根和尾渐隐，不连接成硬发缝。'),('tip_fiber','M 508.1 208.0 C 512.0 212.3 515.1 213.1 516.5 211.3',.22,'卷底亮面内短纹，右收稍上扬，两端低压、外侧留白，不触轮廓。')],
'middle_temple_lock':[('root_fiber','M 489.5 197.0 C 494.1 205.5 500.4 216.8 505.4 222.9',.25,'中片隐藏根沿同一银发方向延续稀疏细纹；浅冷灰、软细尖，不重复主转面深线。')],
'lower_temple_lock':[('root_fiber','M 493.3 218.6 C 498.0 230.5 503.0 240.6 507.5 244.7',.25,'下片长纹从完整根沿右下紧卷方向，亮面保持疏密和留白；中段淡显、两端消失。'),('tip_fiber','M 509.8 247.4 C 512.5 249.4 514.8 248.6 515.8 247.0',.22,'下片回卷底短纹，两端收尖、不与边缘闭合成环。')],
'ear_lock':[('ear_fiber','M 513.9 258.8 C 511.1 264.4 507.5 268.4 505.4 270.1',.21,'耳侧末束短纤维顺左下尖，稀疏浅灰、两端渐隐，内沿不刻洞。')]}
for k,lines in rows.items():
 for name,d,w,note in lines:
  s[k]['strokes'].append({'name':name,'d':d,'width':w,'desc':note})
  add(s,k,'detail_'+name,path('n28_'+k+'_source_'+name,d,k+'：'+note,fill='none',stroke='#a7afbe',stroke_width='.23',stroke_linecap='round'))
prepare('part_detail_lines',s,'3.4 按右侧银发参考的疏淡密度加六条方向纹，完整根同面连续；纹理不跨接界、不复制左侧孔或长弧。',line=True)
