import sys
sys.path.insert(0,'refinement/groups/legs/right_leg/work')
import toolkit as a
a.start_stage('part_volume')
inner='M 484 650 C 485 714 485 768 481 792 C 459 854 462 974 452 1080 C 444 1120 450 1172 453 1228 C 455 1300 469 1424 468 1496 C 468 1551 462 1580 458 1638 L 425 1638 L 425 650 Z'
outer='M 584 650 L 559 690 C 563 760 564 806 554 860 C 544 938 522 1010 506 1080 C 501 1119 503 1160 512 1205 C 527 1270 512 1339 502 1410 C 494 1480 496 1550 500 1604 L 603 1638 L 603 650 Z'
for n in ['thigh','lower_leg']:
 p,g=a.layer(n,'volume');g.set('clip-path','url(#'+a.pid(n)+'_clip)')
 tone=a.gradient(p,'body_cross','linearGradient',{'gradientUnits':'userSpaceOnUse','x1':'438','y1':'1000','x2':'583','y2':'1000'},[(0,'#d5a6a3',.16),(.24,'#fefaf7',.22),(.5,'#fffdfa',.28),(.75,'#f6cfc4',.07),(1,'#daa6a3',.13)])
 a.child(g,'rect',{'x':'430','y':'620','width':'170','height':'1040','fill':tone})
 a.path(g,a.pid(n)+'_outer_volume',outer,'右腿外侧自身转面，沿本侧大腿斜轴至小腿肚弧线连续，8px柔边；双part共享同坐标场，膝重叠不形成假缝。',fill='#e6b1ac',opacity='.14',filter=a.filtered(p,'volume_soft8',8))
 a.path(g,a.pid(n)+'_inner_volume',inner,'右腿内侧自身缓转，6px柔边；隐藏端延续，不按圆帽画明暗封口，不含衣物外来投影。',fill='#dba6a1',opacity='.16',filter=a.filtered(p,'volume_soft6',6))
 for key,transform,color,opacity in [('thigh_front','translate(508 915) rotate(10) scale(46 250)','#fffaf7',.44),('shin_front','translate(485 1400) rotate(-1) scale(26 205)','#fffaf7',.50),('knee_volume','translate(479 1158) rotate(6) scale(33 62)','#dda49f',.24)]:
  grad=a.gradient(p,key,'radialGradient',{'gradientUnits':'userSpaceOnUse','cx':'0','cy':'0','r':'1','gradientTransform':transform},[(0,color,opacity),(.5,color,opacity*.68),(1,color,0)])
  a.child(g,'rect',{'x':'430','y':'620','width':'170','height':'1040','fill':grad})
 a.child(g,'desc',text='4.2前方大范围漫亮、内外侧柔转暗与膝前浅凹均属同一皮肤表面；依据本侧走势调整高光轴和小腿肚，并在两个part完整隐藏面使用同一世界坐标光场。')
 a.before_brush(p,g);a.save(p)
print(a.board('part_volume',adjacent=True))
