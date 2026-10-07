from pipeline import *
s=load()
rows={
 'upper_temple_lock':[('root_fiber','M 362.2 194.4 C 368.0 187.4 375.7 180.6 383.1 177.1',.28,'冠侧完整根的轻发丝，短而疏，中段微显、两端尖细渐隐，不串成硬分缝。'),('tip_fiber','M 355.2 217.2 C 360.1 216.7 364.8 211.8 368.4 207.2',.24,'回卷亮面内短纹，随弧朝右上扬，左端不触外边；很浅且与主转面线留白。')],
 'middle_temple_lock':[('root_fiber','M 359.1 215.9 C 366.7 207.4 373.0 196.9 378.4 189.5',.27,'被前片覆盖的同面发丝依参考走向延续，细疏、软边、两端淡出，移动后不成为空白根。')],
 'lower_temple_lock':[('flow_fiber','M 350.1 246.3 C 351.1 249.4 353.5 250.3 356.9 248.1',.24,'下宽片卷底短纤维，左起略隐、中心微实、末端收尖，与孔和边缘断开。'),('root_fiber','M 359.4 232.3 C 365.6 221.2 370.5 207.5 374.1 195.8',.26,'长发纹仅一条疏淡方向辅助，延续隐藏根，与主亮脊平行但间隔，最终极淡显影。')],
 'ear_lock':[('ear_fiber','M 355.0 264.7 C 357.9 268.7 361.8 272.0 365.2 273.5',.23,'耳片短纤维朝尾端转，淡灰细尖，两孔下方留白，不向孔内填线。')]
}
for k,lines in rows.items():
 for name,d,w,note in lines:
  s[k]['strokes'].append({'name':name,'d':d,'width':w,'desc':note})
  add(s,k,'detail_'+name,path('n27_'+k+'_source_'+name,d,k+'：'+note,fill='none',stroke='#a7afbe',stroke_width='.24',stroke_linecap='round'))
prepare('part_detail_lines',s,'3.4 按参考稀疏银发纹理只加必要方向细纹，完整隐藏根保留同密度；耳片与孔附近不堆线。',line=True)
