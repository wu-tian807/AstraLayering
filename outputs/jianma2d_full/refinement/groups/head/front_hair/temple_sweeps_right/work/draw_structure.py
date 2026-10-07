from pipeline import *
s=load()
rows={
'upper_temple_lock':('M 485.2 181.7 C 494.0 191.8 502.3 207.5 511.6 213.7 C 514.9 216.1 517.0 215.4 517.8 212.7',.44,'从隐藏内根沿发面斜向右下回卷，近底柔灰稍显，向根和右端细化消失，与外弧留一段亮面，不连接成硬槽。'),
'middle_temple_lock':('M 487.7 192.8 C 494.2 207.8 502.9 224.2 512.6 231.4 C 516.1 234.2 519.1 233.3 519.6 230.3',.45,'中片主要圆转弧，从刘海后的同面根延续到紧卷底；中心略实，左右两端渐隐，与外侧边不闭合成黑环，后续明暗柔化接管。'),
'lower_temple_lock':('M 489.2 206.8 C 493.1 222.2 501.1 244.0 509.7 250.0 C 513.6 253.0 517.0 250.4 517.8 247.3',.47,'下宽片内部弧顺右侧参考的紧回卷，内根延续连续，下弧留柔白宽面；线的外侧转暗、面心柔亮，头尾收细不刻出硬沟。'),
'ear_lock':('M 517.7 253.2 C 514.4 261.2 508.9 268.7 503.8 272.5',.37,'耳片短外卷内侧转面，朝本侧较高的下尖弯折；线两端柔淡，不连到根的开口或造成穿孔，最终极淡。')}
for k,(d,w,note) in rows.items():
 name='ear_fold' if k=='ear_lock' else 'inner_sweep';s[k]['strokes'].append({'name':name,'d':d,'width':w,'desc':note})
 add(s,k,'structure_'+name,path('n28_'+k+'_source_'+name,d,k+'：'+note,fill='none',stroke='#939bae',stroke_width='.35',stroke_linecap='round'))
prepare('part_structure',s,'3.2 四片内转面弧按右侧紧卷方向建立，完整隐藏根延续同面结构，不照搬左侧弧长或负形。',line=True)
