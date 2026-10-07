from pipeline import *
s=load();s['_raw_after']={}
curves={
 'upper_temple_lock':('M 343.5 204.7 C 344.7 214.6 350.5 218.3 358.6 208.8 C 370.0 194.1 386.3 175.7 402.1 171.1',7.0),
 'middle_temple_lock':('M 349.8 198.8 C 348.4 207.0 348.0 216.0 349.0 219.0 C 351.0 225.2 357.1 221.0 362.5 216.3 C 375.0 204.1 385.5 186.2 394.0 176.3',6.5),
 'lower_temple_lock':('M 346.6 221.0 C 344.4 228.0 342.8 237.6 344.1 240.0 C 347.0 246.3 353.6 242.1 359.4 236.8 C 372.1 223.5 383.8 200.0 388.7 190.0',6.5),
 'ear_lock':('M 343.8 242.0 C 344.5 250.1 346.9 258.8 351.1 261.1 C 355.0 264.0 360.2 258.8 366.1 253.2',6.2)}
for k,(d,w) in curves.items():
 id='left_temple_'+k+'_cast_shadow'
 content=f'<g id="{id}"><desc>独立完整原始投影，owner/receiver为{k}，follow按rendering.json；延伸到受影范围外，无receiver mask、无clipPath。比源遮光边向下轻移形成冷灰接触带，原始余量与软边留供阶段5组合。</desc><defs><filter id="{id}_soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation=".66"/></filter></defs>'
 content+=path(id+'_raw_shape',brush(d,w,.65,.1),k+' 外来投影：深灰蓝，接触端略实、远端柔化；完整原始色面，不烘入物理part。当前raw延续越出受影面用于运动余量。',fill='#7f8ba5',opacity='.42',filter='url(#'+id+'_soft)')+'</g>'
 s['_raw_after'][k]=[content]
prepare('cast_shadow_artwork',s,'4.5.2 四条原始投影放在受影part之后、下一遮光片之前；完整宽度和越界余量保留，无receiver mask。冠侧影重核实际crown_sweeps下弧(346.7,211.5)后修正可见边界定位，沿实际冠片边而非沿旧辅助线猜测。',gap=True)
f=BASE/'stages/cast_shadow_artwork'
rawids=['left_temple_'+k+'_cast_shadow' for k in IDS]
cmd=[PY,TOOL,str(f/'candidate.svg'),str(f/'raw-effects.png'),'--reference','references/base-subject.png','--crop','337','155','82','137','--scale','4','--columns','4']
for id in rawids:cmd+=['--only',id,'--part',id]
subprocess.run(cmd,check=True)
cmd=[PY,TOOL,str(f/'candidate.svg'),str(f/'raw-combination.png'),'--reference','references/base-subject.png','--crop','337','155','82','137','--scale','4','--columns','3']
for id in list(IDS.values())+rawids:cmd+=['--only',id]
subprocess.run(cmd,check=True)
cmd=[PY,'../../workflow-next/live2d-layering/tools/rendering.py','check','--groups','structure/groups.json','--rendering','structure/rendering.json','--svg',str(f/'candidate.svg')]
r=subprocess.run(cmd,check=True,capture_output=True,text=True);(f/'rendering-check.json').write_text(r.stdout)
print(r.stdout)
