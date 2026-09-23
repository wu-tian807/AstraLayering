from pathlib import Path
P=Path(__file__).parent
s=(P/'build.py').read_text()
s=s.replace('# Assign motion domains, preserving source-local labels and IDs.', '''# Upper/lower arms are separate drawing domains, with overlap through the elbow.
for side in ['left','right']:
 arm=find('arm-'+side);idx=r.index(arm);r.remove(arm)
 for segment,top,bottom in [('upper',315,549),('lower',541,860)]:
  group=el('g',f'rig-arm-{side}-{segment}',data_rig='limb-'+side,data_segment=segment,data_part='arm-'+side)
  clip=el('clipPath',f'rig-armcut-{side}-{segment}',clipPathUnits='userSpaceOnUse');path(clip,f'rig-armcut-path-{side}-{segment}',f'M250 {top} L770 {top} L770 {bottom} L250 {bottom} Z','white');group.append(clip)
  art=copy.deepcopy(arm)
  for n in art.iter():
   if n.get('id'):n.set('id',segment+'-'+n.get('id'))
  art.set('clip-path',f'url(#rig-armcut-{side}-{segment})');group.append(art);r.insert(idx+(segment=='lower'),group)
# Assign motion domains, preserving source-local labels and IDs.''')
s=s.replace("r.set('data-stage','06-animation-rig')", "r.set('data-stage','06-animation-rig-v2')")
(P/'build.py').write_text(s)
s=(P/'rig.js').read_text()
s=s.replace("['mouthOpen','嘴巴开闭',0,1,.45", "['mouthOpen','嘴巴开闭',0,1,.3")
s=s.replace("['hairBangs','刘海摆动',-1,1,0,'head'],['hairLeft','左侧发摆动',-1,1,0,'head'],['hairRight','右侧发摆动',-1,1,0,'head'],['hairBack','后发摆动',-1,1,0,'head'],['cowlick','呆毛摆动',-1,1,0,'head'],", "['hairStiffness','发束刚度',.2,1,.48,'head'],['hairDamping','发束阻尼',.2,1,.48,'head'],")
s=s.replace("let p={...defaults};", "let p={...defaults},manualTarget={...defaults};")
s=s.replace("{x:0,v:0,index:i}", "{x:0,v:0,tip:0,tv:0,lift:0,lv:0,index:i}")
s=s.replace("const hiddenParts=new Set();", "const hiddenParts=new Set();let physicsClock=0,physicsLast=null,physicsVelocity=0,layerSignature='';let motionTest=false;")
start=s.index('function bodyWarp(');end=s.index('function eyeValues(',start)
s=s[:start]+'''// Elliptical torso sections, a flexible spine and separate head attachment.
// Front / side / back surfaces rotate in depth, not as parallel sheets.
function bodyWarp(x,y,depth=0){
 const upper=1-smooth(610,1270,y),chest=1-smooth(510,680,y);
 const yaw=p.bodyX*rad*(.6+1.55*chest),pitch=p.bodyY*rad*.82*upper;
 const dx=x-506,cy=570,dy=y-cy;
 const z=depth+Math.exp(-(((y-428)/90)**2))*p.breath*1.1;
 let xx=dx*Math.cos(yaw)+z*Math.sin(yaw);
 const rz=z*Math.cos(yaw)-dx*Math.sin(yaw);
 let yy=cy+dy*Math.cos(pitch)-rz*Math.sin(pitch);
 const breathShape=Math.exp(-(((y-409)/126)**2));
 xx*=1+p.breath*.014*breathShape;
 // Lumbar sway and shoulder counterbalance have distinct weights.
 xx+=p.bodyX*(.34*chest-.15*(1-chest))*upper;
 yy-=p.breath*3.5*upper;
 yy+=Math.sin(yaw)*dx*.075*chest;
 const a=p.bodyZ*rad*(.32+.78*chest)*upper;
 let point=rotate(xx+506,yy,506,642,a);
 point[0]+=p.bodyZ*.75*chest-p.bodyZ*.25*smooth(650,870,y)*(1-smooth(950,1350,y));
 return point;
}
function attachHead(x,y){
 const neck=bodyWarp(505,295,18);
 const q=rotate(x,y,505,295,p.bodyZ*rad*.84);
 return[q[0]+neck[0]-505,q[1]+neck[1]-295];
}
function headWarp(x,y,kind='face'){
 const dx=x-505,dy=y-190;
 const yaw=(p.headX+p.bodyX*.18)*rad, pitch=p.headY*rad*.77;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 let depth,depth0;
 if(kind==='face'){
  // Chin and lower jaw turn further than the side of the cranium.
  depth=11+34*smooth(208,299,y);depth0=depth;
 }else if(kind==='features'||kind==='nose'){
  const r=78,z=64*Math.sqrt(Math.max(.09,1-(dx/r)**2));
  depth=z+(kind==='nose'?13:0);depth0=depth;
 }else if(kind==='ear'){depth=-8;depth0=depth;
 }else{
  const crown=smooth(56,135,y),surface=25+35*crown;
  depth=surface*Math.sqrt(Math.max(.13,1-(dx/151)**2));
  if(kind==='back')depth=-depth*.68;depth0=depth;
 }
 let xx=dx*cy+depth*sy;
 let zz=depth*cy-dx*sy;
 let yy=dy*cp-zz*sp;
 // Gentle camera projection makes the near eye/cheek larger than the far eye.
 const zr=zz*cp+dy*sp;
 const perspective=1+clamp((zr-depth0)/950,-.07,.07);
 xx*=perspective;yy*=perspective;
 if(kind==='face')yy+=smooth(253,299,y)*(p.mouthOpen-.3)*1.9;
 const q=rotate(xx+505,yy+190,505,289,p.headZ*rad*.82);
 return attachHead(q[0],q[1]);
}
''' +s[end:]
start=s.index('function limbWarp(');end=s.index('function clothDepth(',start)
s=s[:start]+'''function limbWarp(x,y,side){
 const ch=side==='left'?'R':'L',sign=side==='left'?-1:1;
 const sx=side==='left'?407:605,ex=side==='left'?384:630,wx=side==='left'?329:682;
 let xx=x,yy=y;
 if(y>730){const k=smooth(739,788,y),h=p['hand'+ch];xx=lerp(xx,wx+(xx-wx)*(.94-.12*h),Math.abs(h)*k);yy-=h*11*k;
  [xx,yy]=rotate(xx,yy,wx,732,p['wrist'+ch]*rad*sign*smooth(713,754,y));}
 [xx,yy]=rotate(xx,yy,ex,548,p['elbow'+ch]*rad*sign*.86*smooth(515,585,y));
 [xx,yy]=rotate(xx,yy,sx,359,p['arm'+ch]*rad*sign*.82*smooth(336,390,y));
 // Positive fold angles tuck the forearm behind the torso, negative ones open it.
 const tucked=smooth(6,23,p['arm'+ch])*smooth(8,24,p['elbow'+ch]);
 return bodyWarp(xx,yy,lerp(10,-38,tucked));
}
function hairWarp(x,y,spec){
 const hair=spec.hair,i=spec.index;
 let spring=springs.get(spec.group.id);
 if(hair==='hair-clips')spring=springs.get('rig-hair-right-1');
 const rigid=hair==='hair-crown'||hair==='hair-underlap';
 const root=hair==='hair-bangs'?88:hair==='hair-cowlick'?58:100;
 const extent=hair==='hair-bangs'?112:195,k=clamp((y-root)/extent,0,1);
 const mid=(spring?.x||0)*p.physics,tip=(spring?.tip||0)*p.physics;
 let dx=rigid?0:mid*Math.sin(Math.PI*k)*.5+tip*k*k;
 let dy=rigid?0:(spring?.lift||0)*p.physics*k*k;
 if(hair==='hair-cowlick'){
  const k2=clamp((505-x)/128,0,1);dx=tip*.28*k2;dy=(mid*.45+tip)*k2;
 }
 if(hair==='hair-clips'){
  // A hard clip follows its attachment; it never bends like the strand.
  const k0=.3;dx=mid*Math.sin(Math.PI*k0)*.5+tip*k0*k0;dy=(spring?.lift||0)*p.physics*k0*k0;
 }
 if(hair==='hair-left'||hair==='hair-right')dy+=dx*(x-(hair==='hair-left'?430:584))*.0019*k;
 if(hair==='hair-back'){
  const front=headWarp(x+dx,y+dy,'hair'),rear=headWarp(x+dx,y+dy,'back'),blend=smooth(154,265,y);
  return[lerp(front[0],rear[0],blend),lerp(front[1],rear[1],blend)];
 }
 return headWarp(x+dx,y+dy,'hair');
}
''' +s[end:]
# Body depth and maximum pitch now use volume instead of flat translations.
s=s.replace("if(rig==='body'&&y<326){const a=1-smooth(273,326,y),base=bodyWarp(x,y,5),head=headWarp(x,y,'face');return[lerp(base[0],head[0],a),lerp(base[1],head[1],a)]}", "if(rig==='body'&&y<330){const a=1-smooth(274,330,y),base=bodyWarp(x,y,18),head=headWarp(x,y,'face');return[lerp(base[0],head[0],a),lerp(base[1],head[1],a)]}")
s=s.replace("const corner=cy-f*1.7,up=cy-1.5-o*1.8,low=cy+o*25+.15,mid=cy+f*1.5;", "const mid=cy+f*1.3,corner=cy-f*1.5,up=lerp(mid,cy-1.4-o*.8,smooth(0,.23,o)),low=cy+o*(f<-.5?17:13)+.1;")
s=s.replace("${o<.03?mid:up}","${up}")
s=s.replace("const bottom=`M${cx-w} ${corner} Q${cx-w*.8} ${low} ${cx} ${low} Q${cx+w*.8} ${low} ${cx+w} ${corner}`;", "const bottom=o<.01?top:`M${cx-w} ${corner} Q${cx-w*.8} ${low} ${cx} ${low} Q${cx+w*.8} ${low} ${cx+w} ${corner}`;")
s=s.replace("function render(){\n updateMouth();", "function render(){\n updateDrawingOrder();updateMouth();")
start=s.index('function updateSprings(');end=s.index('function sampleTrack(',start)
s=s[:start]+'''function updateDrawingOrder(){
 const lTucked=p.armR>7&&p.elbowR>9,rTucked=p.armL>7&&p.elbowL>9;
 const near=p.bodyX>=0?'left':'right',signature=[near,lTucked,rTucked].join(':');if(signature===layerSignature)return;layerSignature=signature;
 function rank(g){
  const rig=g.dataset.rig,id=g.id;
  if(rig.startsWith('limb-')){
   const side=rig.slice(5),tucked=side==='left'?lTucked:rTucked;
   if(tucked)return 12;
   if(g.dataset.segment==='upper'&&side!==near&&Math.abs(p.bodyX)>1)return 14;
   return g.dataset.segment==='upper'?43:45;
  }
  if(rig==='hair'&&g.dataset.hair==='hair-back')return 8;
  if(id==='rig-hair-crown')return 10;
  if(rig==='garment-back'||rig==='skirt-back')return 17;
  if(rig==='legs')return 20;
  if(rig==='body')return 25;
  if(rig.startsWith('garment-side'))return 29;
  if(rig==='garment-front')return 31;
  if(rig==='skirt-front')return 35;
  return 60;
 }
 const ordered=partGroups.map((g,i)=>({g,i,r:rank(g)})).sort((a,b)=>a.r-b.r||a.i-b.i);
 for(const {g}of ordered)scene.append(g);
}
function physicsDriver(){
 const anchor=bodyWarp(505,290,18);
 return{angle:p.headZ*.76+p.headX*.3+p.bodyZ*.78,x:anchor[0]+Math.sin(p.headZ*rad)*91+Math.sin(p.headX*rad)*28,y:anchor[1]-Math.sin(p.headY*rad)*36};
}
function updateSprings(elapsed,reset=false){
 const current=physicsDriver();
 if(reset||!physicsLast){for(const sp of springs.values()){sp.x=sp.v=sp.tip=sp.tv=sp.lift=sp.lv=0}physicsLast=current;physicsVelocity=0;return}
 const interval=Math.max(.001,elapsed),velocity=clamp((current.angle-physicsLast.angle)/interval,-160,160);
 const vx=clamp((current.x-physicsLast.x)/interval,-210,210),vy=clamp((current.y-physicsLast.y)/interval,-180,180);
 const acceleration=clamp((velocity-physicsVelocity)/interval,-450,450);physicsVelocity=velocity;physicsLast=current;
 // Two masses per strand: a firmer middle and a softer tip, semi-implicit fixed substeps.
 const steps=Math.max(1,Math.ceil(Math.min(elapsed,.14)/(1/120))),dt=Math.min(elapsed,.14)/steps;
 for(let step=0;step<steps;step++){
  physicsClock+=dt;
  for(const g of hairGroups){
   const sp=springs.get(g.id),i=sp.index,h=g.dataset.hair;
   if(h==='hair-crown'||h==='hair-underlap'||h==='hair-clips')continue;
   const isBang=h==='hair-bangs',isCow=h==='hair-cowlick';
   const massScale=isBang?.54:isCow?1.32:1;
   const elastic=(22+p.hairStiffness*57)*(1+(i%4)*.06);
   const damping=2.6+p.hairDamping*8.2;
   const inertial=(-velocity*.105-vx*.075-acceleration*.0028)*massScale;
   const gravity=(-p.headZ*.13-p.bodyZ*.09)*massScale;
   const target=clamp(inertial+gravity+p.wind*10,-12,12);
   sp.v+=((target-sp.x)*elastic-sp.v*damping)*dt;sp.x=clamp(sp.x+sp.v*dt,-14,14);
   const tipTarget=sp.x*1.15+inertial*.27;
   sp.tv+=((tipTarget-sp.tip)*elastic*.56-sp.tv*damping*.72)*dt;sp.tip=clamp(sp.tip+sp.tv*dt,-16,16);
   const liftTarget=clamp(-vy*.026*massScale,-4,4);
   sp.lv+=((liftTarget-sp.lift)*elastic*.6-sp.lv*damping*.8)*dt;sp.lift=clamp(sp.lift+sp.lv*dt,-5,5);
  }
 }
}
''' +s[end:]
# Cardinal cubic interpolation across samples avoids a velocity cusp every 1/15 sec.
start=s.index('function sampleTrack(');end=s.index('function motionAt(',start)
s=s[:start]+'''function sampleTrack(key,time){
 const a=MOTION.tracks[key],u=clamp(time*MOTION.fps,0,a.length-1),i=Math.floor(u),f=u-i;
 const b=a[i],c=a[Math.min(i+1,a.length-1)],l=a[Math.max(i-1,0)],r=a[Math.min(i+2,a.length-1)];
 const value=.5*((2*b)+(-l+c)*f+(2*l-5*b+4*c-r)*f*f+(-l+3*b-3*c+r)*f*f*f);
 return clamp(value,Math.min(b,c),Math.max(b,c));
}
''' +s[end:]
s=s.replace("out.armR=out.armL*.45;out.elbowR=out.elbowL*.35;out.wristR=out.wristL*.35;out.handR=out.handL*.45;", """out.armR=sampleTrack('armL',Math.max(0,time-.08))*.91;out.elbowR=sampleTrack('elbowL',Math.max(0,time-.10))*.9;out.wristR=out.wristL*.92;out.handR=out.handL*.9;
 // Preserve observed gestures, add the subtle asynchronous torso/head relationship
 // missing when torso Y is treated as translation. No autonomous hair animation is added.
 const lagZ=sampleTrack('headZ',Math.max(0,time-.16))+.6522;
 const lagX=sampleTrack('headX',Math.max(0,time-.2))+.6522;
 out.bodyZ=clamp(out.bodyZ*1.3+lagZ*.17,-10,10);
 out.bodyX=clamp(out.bodyX*1.12+lagX*.11,-10,10);
 out.bodyY=clamp(out.bodyY*1.08,-10,10);
 out.headX=clamp(out.headX*1.3,-30,30);
 out.headY=clamp(out.headY*.9,-30,30);
 out.mouthOpen=Math.pow(out.mouthOpen,.92)*.78;""")
s=s.replace("if(mode==='manual'){$('stage-state')", "if(next==='manual'&&mode!=='manual')manualTarget={...p};if(mode==='manual'){$('stage-state')") # replaced below to ensure copy precedes assignment
s=s.replace("function setMode(next,shouldPlay=false){mode=next;playing=shouldPlay;if(next==='manual'&&mode!=='manual')manualTarget={...p};", "function setMode(next,shouldPlay=false){if(next==='manual'&&mode!=='manual')manualTarget={...p};mode=next;playing=shouldPlay;")
s=s.replace("p[key]=clamp(value,d[2],d[3]);", "manualTarget[key]=clamp(value,d[2],d[3]);")
s=s.replace("if(r)r.value=p[d[0]];if(n&&document.activeElement!==n)n.value=p[d[0]].toFixed", "const value=mode==='manual'?manualTarget[d[0]]:p[d[0]];if(r)r.value=value;if(n&&document.activeElement!==n)n.value=value.toFixed")
s=s.replace("p={...presets[key]};syncInputs();render()", "manualTarget={...presets[key]};syncInputs();render()")
s=s.replace("mouthOpen:.95", "mouthOpen:.8")
s=s.replace("mouthOpen:.65", "mouthOpen:.62")
s=s.replace('X 为左右转头，Y 为俯仰，Z 为侧倾。发束根部固定，末端保留独立位移与回弹。', '头发由头部与身体姿态自动驱动。发根固定，中段和末端分别计算惯性、弹性与阻尼；平滑转动时也会滞后和回弹。风力默认 0。')
s=s.replace("$('reset').onclick=()=>{p={...defaults};setMode('manual');", "$('reset').onclick=()=>{setMode('manual');p={...defaults};manualTarget={...p};")
s=s.replace("p.headX=x*30;p.headY=y*25;p.gazeX=x*.35;p.gazeY=y*.25;", "manualTarget.headX=x*30;manualTarget.headY=y*25;manualTarget.gazeX=x*.35;manualTarget.gazeY=y*.25;")
s=s.replace("p=next;setSkirt", "p=next;manualTarget={...p};setSkirt")
s=s.replace("if(!autoBlink){p.eyeLOpen=p.eyeROpen=1;syncInputs()}", "if(!autoBlink){manualTarget.eyeLOpen=manualTarget.eyeROpen=1;syncInputs()}")
start=s.index('function frame(now){');end=s.index('// Public bridge',start)
s=s[:start]+'''function frame(now){
 const elapsed=Math.max(.001,(now-last)/1000);last=now;
 // Wall-clock playback is independent of physics integration and rendering load.
 if(mode==='motion'&&playing){t=(t+elapsed*speed)%MOTION.duration;p=motionAt(t)}
 if(mode==='manual'){
  const dt=Math.min(elapsed,.15);
  for(const d of defs){const key=d[0],rate=/head|body|arm|elbow|wrist/.test(key)?13:27;p[key]=lerp(p[key],manualTarget[key],1-Math.exp(-rate*dt));}
  if(autoBlink){const phase=(now/1000)%4.3,blink=phase<.21?Math.abs(phase-.105)/.105:1;p.eyeLOpen=p.eyeROpen=blink}
  if(autoBreath)p.breath=(Math.sin(now/1000*1.5)+1)/2;
 }
 updateSprings(elapsed);render();
 if(now-lastSync>90){syncInputs();lastSync=now}
 fpsFrames++;fpsTime+=elapsed;if(fpsTime>1){window.millyFPS=fpsFrames/fpsTime;fpsTime=fpsFrames=0}
 requestAnimationFrame(frame);
}
''' +s[end:]
start=s.index('window.MillyRig=');s=s[:start]+'''window.MillyRig={get parameters(){return{...(mode==='manual'?manualTarget:p)}},get renderedParameters(){return{...p}},definitions:defs,
 set(values,options={}){setMode('manual');for(const d of defs){if(Number.isFinite(values[d[0]]))manualTarget[d[0]]=clamp(values[d[0]],d[2],d[3])}if(!options.smooth){p={...manualTarget};updateSprings(.016,true)}syncInputs();render()},
 seek(seconds){t=clamp(seconds,0,MOTION.duration);setMode('motion',false);p=motionAt(t);updateSprings(.016,true);syncInputs();render()},
 setOutfit:setSkirt,showView(name){view=name;zoom=1;applyView()},reset(){setMode('manual');p={...defaults};manualTarget={...p};updateSprings(.016,true);syncInputs();render()},
 get physics(){return [...springs].map(([id,s])=>({id,mid:s.x,tip:s.tip,velocity:s.tv,lift:s.lift}))},
 step(seconds,values){setMode('manual');Object.assign(p,values);Object.assign(manualTarget,p);updateSprings(seconds);render()},
 render,paths:pathSpecs.length,parts:partGroups.length,get state(){return{mode,playing,time:t,showSkirt,view,version:2}}};
applyView();buildControls();p=motionAt(0);render();requestAnimationFrame(frame);
'''
(P/'rig.js').write_text(s)
t=(P/'template.html').read_text().replace('Milly · 动态拆分实验室','Milly v2 · 动态拆分实验室').replace('MOTION STUDY 06','MOTION STUDY 06 / V2').replace('本地矢量驱动','V2 · 姿态驱动物理').replace('<h1>Milly ', '<h1>Milly <small style="font-size:11px;color:#c17d52">v2</small> ').replace('头发 / 头部','头部 / 物理')
t=t.replace('<span class="pill"><i class="dot"></i>', '<a href="../index.html" style="color:#967a60;font-size:11px;text-decoration:none">查看 v1 ↗</a><span class="pill"><i class="dot"></i>')
(P/'template.html').write_text(t)
print('v2 implementation written')
