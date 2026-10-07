from pipeline import *
s=init()
rows={
 'upper_temple_lock':[('hook_edge','M 519.1 201.0 C 520.2 207.4 520.7 212.4 520.7 216.7 C 518.8 222.5 514.6 220.9 510.9 217.8 C 498.3 206.8 490.2 188.9 482.1 179.1',.65,'本片右可见前缘至紧回卷底，再向左上隐藏根淡出；中段稍实，底弧连续圆转不留黑结，根部不画横切口，冷灰柔边。')],
 'middle_temple_lock':[('hook_edge','M 523.4 224.3 C 523.9 228.7 523.8 232.1 522.985875 235.369625 C 520.2 242.6 515.8 240.5 511.4 236.3 C 498.9 223.8 491.0 204.3 486.1 190.8',.64,'右侧到中片卷底外缘；上段被前片遮住，卷底灰线稍实，往刘海后根变淡，头尾收尖，保持自身完整闭合填面。')],
 'lower_temple_lock':[('hook_edge','M 523.0 239.0 C 522.5 242.4 521.8 245.6 521 248 C 518.1 257.0 513.2 260.6 508.0 255.1 C 496.8 244.7 490.8 217.7 485.7 199.4',.64,'下片右侧到耳前宽回卷弧底，向左上完整内根变细渐隐。连续内缘无孔，不复制左侧缺口；圆弧柔灰，转底稍实而两端淡。')],
 'ear_lock':[('outer_edge','M 520.5 249.4 C 516.4 261.5 509.5 271.4 499 279',.65,'耳片下段外弧至(499,279)下尖，细灰线随外弧稍实而尖端收笔；上根处于中下片遮挡内，完整闭合源边只作辅助，不作可见切根。'),('inner_edge','M 499 279 C 503.7 273.2 501.2 260.8 496.1 246.2',.36,'耳片内收边在前刘海后，有动作露出可能；当前极淡、两端收尖，隐藏根不横断。右侧完整同面内缘无孔、无背壁分割。')]
}
# Use the approved cubic segments verbatim for outer-edge source curves.
for k,stop in {'upper_temple_lock':' C 475.6','middle_temple_lock':' C 482.8','lower_temple_lock':' C 483.2','ear_lock':' C 506'}.items():
 name,_,w,note=rows[k][0];rows[k][0]=(name,D[k].split(stop)[0],w,note)
for k in IDS:
 pr='n28_'+k
 add(s,k,'base',path(pr+'_base_shape',D[k],k+' 完整填色边界逐字沿用独立PASS的guide；中性浅色仅供线稿查看，隐藏根与可见面连续，无左侧孔。',fill='#e9ecf2',stroke='none'))
 add(s,k,'source_boundary',path(pr+'_boundary_curve',D[k],k+' 完整闭合填色辅助边界；最终隐藏，尤其隐藏根上边不得显成截口。',fill='none',stroke='#b2b6c4',stroke_width='.3',stroke_dasharray='2 2'))
 s[k]['strokes']=[]
 for name,d,w,note in rows[k]:
  s[k]['strokes'].append({'name':name,'d':d,'width':w,'desc':note})
  add(s,k,'contour_'+name,path(pr+'_source_'+name,d,k+'：'+note+'；当前细线定位，3.5用显式压力实现。',fill='none',stroke='#798194',stroke_width='.45',stroke_linecap='round',stroke_linejoin='round'))
prepare('part_contours',s,'3.1 建立右侧四片完整源边及可见回卷轮廓。所有填色D逐字沿用批准guide；各隐藏根保持完整，源闭合线只作辅助。右耳内缘连续，不造左侧孔。',gap=True,line=True)
