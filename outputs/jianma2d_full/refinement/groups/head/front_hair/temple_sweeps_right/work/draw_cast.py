from pipeline import *
s=load();s['_raw_after']={}
curves={
'upper_temple_lock':('M 522.9 201.8 C 523.0 206.7 521.6 209.4 518.0 207.5 C 514.0 205.3 510.5 200.1 508.6 197.0 C 498.2 182.6 485.0 172.0 475.0 183.0',6.0),
'middle_temple_lock':('M 521.9 210.8 C 522.0 215.3 521.2 219.1 518.8 220.7 C 516.0 222.5 513.4 221.2 510.9 219.8 C 498.3 208.8 490.2 190.9 482.1 181.1',6.1),
'lower_temple_lock':('M 524.7 229.5 C 525.0 235.1 522.0 241.0 518.9 241.7 C 516.4 242.6 513.5 240.6 511.4 238.3 C 498.9 225.8 491.0 206.3 486.1 192.8',6.2),
'ear_lock':('M 522.8 242.3 C 522.1 249.0 519.2 257.5 514.8 259.1 C 511.8 260.4 509.7 258.6 508.0 257.1 C 504.8 253.9 501.8 249.7 499.1 244.3',6.0)}
for k,(d,w) in curves.items():
 id='right_temple_'+k+'_cast_shadow'
 content=f'<g id="{id}"><desc>右侧独立完整raw投影，owner/receiver为{k}，follow按rendering.json；沿实际遮光边向下约2px延续，源影保留面外余量。无receiver mask，无clipPath，后置stage5合成。</desc><defs><filter id="{id}_soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".66"/></filter></defs>'
 content+=path(id+'_raw_shape',brush(d,w,.65,.1),k+' 外来投影：右侧卷片下的冷蓝灰带；接触段稍实、远端柔化，完整源形保留超出受影面的运动余量。',fill='#7f8ba5',opacity='.42',filter='url(#'+id+'_soft)')+'</g>'
 s['_raw_after'][k]=[content]
prepare('cast_shadow_artwork',s,'4.5.2 四条raw投影分别置于受影part之后、其上遮光片之前；跟随本侧实际边界，向下约2px投移，不复用左侧弧。完整源形与面外余量保留，receiver mask待第5阶段。')
f=BASE/'stages/cast_shadow_artwork';rawids=['right_temple_'+k+'_cast_shadow' for k in IDS]
for name,ids,parts in [('raw-effects',rawids,True),('raw-combination',list(IDS.values())+rawids,False)]:
 cmd=[PY,TOOL,str(f/'candidate.svg'),str(f/(name+'.png')),'--reference','references/base-subject.png','--crop','459','155','76','137','--scale','4','--columns','4']
 for id in ids:
  cmd+=['--only',id]
  if parts:cmd+=['--part',id]
 subprocess.run(cmd,check=True)
cmd=[PY,'../../workflow-next/live2d-layering/tools/rendering.py','check','--groups','structure/groups.json','--rendering','structure/rendering.json','--svg',str(f/'candidate.svg')]
r=subprocess.run(cmd,check=True,capture_output=True,text=True);(f/'rendering-check.json').write_text(r.stdout);print(r.stdout)
