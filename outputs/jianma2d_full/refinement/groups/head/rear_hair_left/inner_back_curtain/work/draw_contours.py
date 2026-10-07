from n29_art import *
s=initialize()
for k in KEYS:
 a=s['parts'][k];a['geometry']=[]
 def add(name,d,final,desc,width=.55):a['geometry'].append({'name':name,'d':d,'role':'contour','final':final,'desc':GROUP+'/'+k+'；'+desc,'width':width,'color':'#74809A' if final=='visible' else '#A5AEC3','opacity':.7 if final=='visible' else .38,'dash':None if final=='visible' else '3 3'})
 if k=='nape_back_sheet':
  add('ear_opening','M 358 284 C 350 301 342 317 343 330 C 343 334 344 337 345 340 M 352.2 302.7 C 351.7 310 349 319.5 346 332.8','visible','耳后两条细孔边从(358,284)/(352.2,302.7)至下尖(345,340)/(346,332.8)，实际透明槽由闭合填面负形和耳孔裁片保留；细软0.45px，中段较实、两尖淡出，不把孔封口描粗。',.45)
  add('nape_shoulder','M 347 333 L 327 381 L 357 379','visible','耳后下垂(347,333)接肩上落点(327,381)至前发遮住的(357,379)，发面与肩相接的外缘；转折保留，前发覆盖后淡出留白，约0.55px柔边，填面按完整宽幕闭合。')
  seg=re.findall(r'[A-Za-z][^A-Za-z]*',a['d']);add('backing_continuity','M 375.307291499 374.807145014 '+''.join(seg[5:16]),'guide-only','从耳颈接点到肩腰/膝后承接边并回到(390,1205.7)，运动后预期露出4px的同面余量；检查完整连续填面，最终不保留贯穿暗轮廓，后续同样延续材质和发流，非露出区域可简化。',.4)
  add('hidden_inner_closure','M 443 306 L 443 1223 L 440 1226','guide-only','身体后的中央闭合边，上下均被头面/躯干/腿挡住；仅确认填面闭合，不画最终硬边，细虚线全程低强度。',.35)
 else:
  d=a['d'];at=d.index(' C 339 1414');outer=d[:at];inner='M 360 1423'+d[at:];inner=inner.rsplit(' Z',1)[0]
  add('long_outer_edge',outer,'visible','(371,264)耳后接根沿肩外弧、腰部内折、髋外和膝侧至(360,1423)完整单尖；隐藏根轻起，肩腰被前发/身体覆盖处细软，不截成碎段，下端自由外缘清楚并渐尖。对应整条闭合长束左外边。',.62)
  add('long_inner_edge',inner,'visible','从(360,1423)尖梢回到耳后根，低端内勾是可见轮廓，其上为侧束与宽幕/身体相叠；尖端极轻，中长段0.55px，根部留白。运动余量随同一表面延续，禁止把隐藏接界画成横切线。',.55)
prepare('part_contours',s,'3.1 为两个完整物理part建立闭合填色面、耳孔及开放描边。nape的遮挡背面闭合边仅作guide-only；side左右边从根连续到单尖。全部源线含起终点、归属、最终显影及笔压/软硬说明。沿用2.3完整范围，其他part和33效果原文保留。',line=True)
