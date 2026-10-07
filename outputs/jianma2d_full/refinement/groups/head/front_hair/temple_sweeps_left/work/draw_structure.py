from pipeline import *
s=load()
curves={
 'upper_temple_lock':[
 ('inner_sweep','M 388.8 178.8 C 378.8 187.0 369.0 205.2 358.5 213.6 C 355.8 215.8 354.1 215.2 353.4 213.8',.44,'从冠侧隐藏根沿宽发片转面向(358,214)扫下并回卷；中段略实、两端渐隐，左端不接外缘形成硬沟，柔边细灰线，最终保留短淡弧。')],
 'middle_temple_lock':[
 ('inner_sweep','M 383.8 191.1 C 375.8 208.9 366.3 225.3 355.3 232.6 C 351.5 235.1 348.7 233.9 348.2 231.8',.46,'从被上片遮住的同面根延续，沿中片宽度转折至(353,234)；弧底稍实、根和左收笔柔淡，止于外缘内侧并留白。')],
 'lower_temple_lock':[
 ('inner_sweep','M 376.5 207.7 C 372.6 225.2 365.6 244.9 356.9 251.6 C 352.2 255.4 349.2 252.9 348.4 250.3',.48,'下宽发片主转面弧从完整隐藏根下行至卷底；与外缘有可见白面，不画重复封闭底边。弧底略宽、两端极细渐隐，孔位前止住，不连到耳片。')],
 'ear_lock':[
 ('ear_fold','M 350.6 260.2 C 353.9 267.5 359.6 272.4 365.8 276.6',.38,'耳片外弧内侧的转面线，沿短回卷尾向下尖走，两个孔均在此线右上方，不作跨孔桥。中段柔灰、头尾渐隐，最终极淡保留。')]
}
for k,rows in curves.items():
 for name,d,w,note in rows:
  s[k]['strokes'].append({'name':name,'d':d,'width':w,'desc':note})
  add(s,k,'structure_'+name,path('n27_'+k+'_source_'+name,d,k+'：'+note,fill='none',stroke='#939bae',stroke_width='.35',stroke_linecap='round'))
prepare('part_structure',s,'3.2 沿四片参考卷曲方向建立内部转面主弧；在同面隐藏根内延续，外缘旁留白，两孔不连接。每条结构曲线保留独立描述与最终收笔规则。',line=True)
