'use strict';
const $=id=>document.getElementById(id), NS='http://www.w3.org/2000/svg';
const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const rad=Math.PI/180;
const rotate=(x,y,cx,cy,a)=>{const c=Math.cos(a),s=Math.sin(a),u=x-cx,v=y-cy;return[cx+u*c-v*s,cy+u*s+v*c]};
// Parameter L/R names follow the character; the source SVG left/right IDs follow the image.
const defs=[
 ['eyeLOpen','左眼开闭',0,1,1,'face'],['eyeROpen','右眼开闭',0,1,1,'face'],['eyeLSmile','左眼微笑',0,1,0,'face'],['eyeRSmile','右眼微笑',0,1,0,'face'],
 ['gazeX','视线左右',-1,1,0,'face'],['gazeY','视线上下',-1,1,0,'face'],['pupil','眼珠缩放',.6,1.4,1,'face'],['highlight','眼部高光',0,1,1,'face'],
 ['mouthOpen','嘴巴开闭',0,1,.3,'face'],['mouthForm','嘴巴变形',-1,1,.3,'face'],
 ['browLY','左眉上下',-1,1,0,'face'],['browLX','左眉左右',-1,1,0,'face'],['browLForm','左眉变形',-1,1,0,'face'],['browLAngle','左眉角度',-1,1,0,'face'],
 ['browRY','右眉上下',-1,1,0,'face'],['browRX','右眉左右',-1,1,0,'face'],['browRForm','右眉变形',-1,1,0,'face'],['browRAngle','右眉角度',-1,1,0,'face'],
 ['headX','头部 X · 左右转头',-30,30,0,'head'],['headY','头部 Y · 俯仰',-30,30,0,'head'],['headZ','头部 Z · 侧倾',-30,30,0,'head'],
 ['hairStiffness','发束刚度',.2,1,.48,'head'],['hairDamping','发束阻尼',.2,1,.48,'head'],['wind','风力',-1,1,0,'head'],['physics','物理强度',0,1,1,'head'],
 ['bodyX','身体 X · 左右转身',-10,10,0,'body'],['bodyY','身体 Y · 俯仰',-10,10,0,'body'],['bodyZ','身体 Z · 摆动',-10,10,0,'body'],['breath','呼吸',0,1,0,'body'],
 ['armL','左大臂转',-30,30,0,'body'],['elbowL','左小臂转',-30,30,0,'body'],['wristL','左手转',-10,10,0,'body'],['handL','左手变形',-1,1,0,'body'],
 ['armR','右大臂转',-30,30,0,'body'],['elbowR','右小臂转',-30,30,0,'body'],['wristR','右手转',-10,10,0,'body'],['handR','右手变形',-1,1,0,'body'],
 ['skirt1','裙子物理 1 · 横摆',-1,1,0,'body'],['skirt2','裙子物理 2 · 扭转',-1,1,0,'body'],['skirt3','裙子物理 3 · 开合',-1,1,0,'body']
];
const defaults=Object.fromEntries(defs.map(d=>[d[0],d[4]]));let p={...defaults},manualTarget={...defaults};
const physicsKeys=['hairStiffness','hairDamping','wind','physics'];let physicsSettings=Object.fromEntries(physicsKeys.map(k=>[k,defaults[k]]));
function resetPhysicsSettings(){for(const k of physicsKeys)physicsSettings[k]=defaults[k]}
let mode='motion',playing=true,t=0,speed=1,activeTab='face',view='portrait',follow=false,showSkirt=false,showBackOnly=false,diagnostic=false;
let autoBlink=false,autoBreath=false,dragging=false,zoom=1,last=performance.now(),fpsFrames=0,fpsTime=0,lastHead=0,headVelocity=0;
const svg=$('milly-svg');
const scene=document.createElementNS(NS,'g');scene.id='rig-scene';
for(const child of [...svg.children])if(child.tagName.toLowerCase()==='g')scene.append(child);
svg.append(scene);svg.setAttribute('preserveAspectRatio','xMidYMid meet');
const partGroups=[...scene.children];
// Each arm surface is drawn behind the torso and, through a moving depth window,
// in front. The same live surface supplies both passes; no opacity dissolve or
// whole-arm layer swap occurs when a shoulder moves through the torso plane.
const limbLayers=[];
for(const g of [...partGroups].filter(g=>g.dataset.rig.startsWith('limb-'))){
 const surface=document.createElementNS(NS,'g');surface.id='rig-surface-'+g.id;
 for(const attr of ['fill','stroke','stroke-width','fill-rule','stroke-linecap','stroke-linejoin'])if(g.hasAttribute(attr))surface.setAttribute(attr,g.getAttribute(attr));
 while(g.firstChild)surface.append(g.firstChild);g.append(surface);
 const back=document.createElementNS(NS,'g');back.id='rig-rear-'+g.id;back.dataset.rig=g.dataset.rig;back.dataset.rearPass='true';
 const use=document.createElementNS(NS,'use');use.setAttribute('href','#'+surface.id);back.append(use);scene.append(back);partGroups.push(back);
 limbLayers.push({front:g,back,side:g.dataset.rig.slice(5),segment:g.dataset.segment});
}
const hairGroups=partGroups.filter(g=>g.dataset.rig==='hair');
const springs=new Map(hairGroups.map((g,i)=>[g.id,{x:0,v:0,tip:0,tv:0,lift:0,lv:0,index:i}]));
const hiddenParts=new Set();let physicsClock=0,physicsLast=null,physicsVelocity=0,layerSignature='';let motionTest=false;
const pathSpecs=[];
function parse(d){const toks=d.match(/[MLCQZ]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];return toks.map(v=>/[MLCQZ]/.test(v)?v:Number(v))}
function featureFor(e){
 const ancestry=[];let n=e;while(n&&n!==scene){if(n.id)ancestry.push(n.id);n=n.parentElement}const s=ancestry.join(' '),id=e.id;
 let side=s.includes('eye-left')?'left':s.includes('eye-right')?'right':null;
 if(side){
  let kind='eye';if(s.includes('-iris')||s.includes('-pupil')||s.includes('-highlight'))kind='iris';
  if(id.includes('aperture'))kind='aperture';
  if(id.includes('lash-ink')||id.includes('lid-crease'))kind='upperLid';
  if(id.includes('lower-lid-ink'))kind='lowerLid';
  return{kind,side};
 }
 if(s.includes('eyebrow-left'))return{kind:'brow',side:'left'};
 if(s.includes('eyebrow-right'))return{kind:'brow',side:'right'};
 if(s.includes('mouth'))return{kind:'mouth'};
 if(s.includes('nose'))return{kind:'nose'};
 return{kind:'none'};
}
for(const group of partGroups){
 for(const node of group.querySelectorAll('path[d]')){
  pathSpecs.push({node,tokens:parse(node.getAttribute('d')),group,rig:group.dataset.rig,hair:group.dataset.hair,index:Number(group.dataset.index||0),feature:featureFor(node)});
 }
}
// Each moving surface owns a gradient copy. Keep colour fields attached to the same
// local deformation, including independent iris gaze and head perspective.
const paintDefs=document.createElementNS(NS,'defs');paintDefs.id='rig-live-gradients';svg.insertBefore(paintDefs,scene);
for(const layer of limbLayers){
 const clip=document.createElementNS(NS,'clipPath');clip.id='rig-depth-window-'+layer.front.id;clip.setAttribute('clipPathUnits','userSpaceOnUse');
 const path=document.createElementNS(NS,'path');clip.append(path);paintDefs.append(clip);layer.mask=path;layer.front.setAttribute('clip-path','url(#'+clip.id+')');
}
const paintSpecs=[];
for(const spec of pathSpecs){
 const coords=spec.tokens.filter(v=>typeof v==='number'),xs=coords.filter((_,i)=>i%2===0),ys=coords.filter((_,i)=>i%2===1);
 const cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2;
 for(const attr of ['fill','stroke']){
  const value=spec.node.getAttribute(attr)||'',match=value.match(/^url\(#([^)]*)\)$/);if(!match)continue;
  const original=$(match[1]);if(!original||!original.tagName.toLowerCase().includes('gradient'))continue;
  const clone=original.cloneNode(true);clone.id='rig-moving-paint-'+paintSpecs.length;paintDefs.append(clone);
  spec.node.setAttribute(attr,'url(#'+clone.id+')');
  paintSpecs.push({node:clone,transform:original.getAttribute('gradientTransform')||'',cx,cy,spec});
 }
}
// Elliptical torso sections, a flexible spine and separate head attachment.
// Front / side / back surfaces rotate in depth, not as parallel sheets.
function bodyWarp(x,y,depth=0){
 const upper=1-smooth(610,1270,y),chest=1-smooth(510,680,y);
 const yaw=p.bodyX*rad*(.6+1.55*chest),pitch=-p.bodyY*rad*.82*upper;
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
 const yaw=Math.tanh((p.headX+p.bodyX*.08)/33)*.52, pitch=-Math.tanh(p.headY/37)*.42;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch);
 let depth,depth0;
 if(kind==='face'){
  // Chin and lower jaw turn further than the side of the cranium.
  depth=18+12*smooth(208,299,y);depth0=depth;
 }else if(kind==='features'||kind==='nose'){
  depth=kind==='nose'?57:38;depth0=depth;
 }else if(kind==='ear'){depth=-8;depth0=depth;
 }else{
  const crown=smooth(56,135,y),surface=25+35*crown;
  depth=surface*Math.sqrt(Math.max(.13,1-(dx/151)**2));
  if(kind==='back')depth=-12;depth0=depth;
 }
 let xx=dx*cy+depth*sy;
 let zz=depth*cy-dx*sy;
 let yy=dy*cp-zz*sp;
 // Gentle camera projection makes the near eye/cheek larger than the far eye.
 const zr=zz*cp+dy*sp;
 const perspective=1+clamp((zr-depth0)/1550,-.035,.035);
 xx*=perspective;yy*=perspective;
 if(kind==='face')yy+=smooth(253,299,y)*(p.mouthOpen-.3)*1.9;
 const q=rotate(xx+505,yy+190,505,289,p.headZ*rad*.82);
 return attachHead(q[0],q[1]);
}
function featureWarp(x,y,feature){
 // Art-directed limits: preserve the eye and mouth shapes while moving their
 // anchors over the face. This prevents far eyes from collapsing into slivers.
 let ax=505.6,ay=264.2;
 if(feature.side){ax=feature.side==='left'?463.3:549.1;ay=222.3;if(feature.kind==='brow'){ax=feature.side==='left'?458:552;ay=180}}
 if(feature.kind==='nose'){ax=505.6;ay=242}
 const yaw=Math.tanh((p.headX+p.bodyX*.08)/33)*.52,turn=Math.sin(yaw)/Math.sin(.385);
 const far=clamp((ax-505)/45,-1,1)*turn;
 const sx=1-.055*Math.abs(turn)-.065*far,sy=1-.025*Math.abs(p.headY)/30;
 const anchor=headWarp(ax,ay,feature.kind==='nose'?'nose':'features');
 const roll=(p.headZ*.82+p.bodyZ*.84)*rad;
 const d=rotate((x-ax)*sx,(y-ay)*sy,0,0,roll);
 return[anchor[0]+d[0],anchor[1]+d[1]];
}
function eyeValues(side){const ch=side==='left'?'R':'L';return[p['eye'+ch+'Open'],p['eye'+ch+'Smile']]}
function eyePoint(x,y,feature,id){
 const side=feature.side,cx=side==='left'?463.3:549.1;
 let [open,smile]=eyeValues(side);open=clamp(open*(1-smile*.08),0,1);
 const u=(x-cx)/23.8;
 const closed=224.2-(smile*10.5+.8)*(1-clamp(u*u,0,1.4));
 if(feature.kind==='aperture'||feature.kind==='eye'){y=lerp(closed,y,open)}
 if(feature.kind==='upperLid'){
  const upper=208.4+10.8*u*u;
  y+=(1-open)*(closed-upper);
  if(id.includes('lid-crease'))y+=(1-open)*-1.8;
 }
 if(feature.kind==='lowerLid'){
  const lower=238-18*u*u;y+=(1-open)*(closed-lower);
 }
 if(feature.kind==='iris'){
  const ic=side==='left'?465.3:545.3;
  x=ic+(x-ic)*p.pupil+p.gazeX*7.5;y=222.3+(y-222.3)*p.pupil-p.gazeY*5.2;
 }
 return[x,y];
}
function browPoint(x,y,side){
 const ch=side==='left'?'R':'L',sgn=side==='left'?-1:1,cx=side==='left'?458:552;
 x+=sgn*p['brow'+ch+'X']*5.5;y-=p['brow'+ch+'Y']*8;
 y-=p['brow'+ch+'Form']*5*(1-((x-cx)/22)**2);
 const [open]=eyeValues(side);y+=(1-open)*1.8;
 return rotate(x,y,cx,180,-sgn*p['brow'+ch+'Angle']*.2);
}
function limbWarp(x,y,side){
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
  const k2=clamp((505-x)/128,0,1);dx=tip*.28*k2;dy=(mid*.45+tip*1.35+(spring?.lift||0)*p.physics*2)*k2;
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
function clothDepth(x,y,depth){
 // Front and rear surfaces meet around a shared side contour instead of sliding apart.
 const rows=[[330,79],[410,84],[455,91],[540,69],[555,70],[610,102],[650,111],[710,38],[754,18]];
 let radius=rows[0][1];
 for(let i=1;i<rows.length;i++){if(y<=rows[i][0]){radius=lerp(rows[i-1][1],rows[i][1],smooth(rows[i-1][0],rows[i][0],y));break}radius=rows[i][1]}
 // Back and side returns sew into the same shoulder seam as the front.
 if(depth<29&&depth!==12)depth=lerp(29,depth,smooth(343,391,y));
 const u=clamp(Math.abs(x-506)/radius,0,1);return depth*Math.sqrt(Math.max(0,1-u*u));
}
function mapPoint(x,y,spec){
 const {rig,feature}=spec;
 if(rig==='features'){
  if(feature.kind==='brow')[x,y]=browPoint(x,y,feature.side);
  else if(feature.side)[x,y]=eyePoint(x,y,feature,spec.node.id);
  return featureWarp(x,y,feature);
 }
 if(rig==='face')return feature.kind==='nose'?featureWarp(x,y,feature):headWarp(x,y,'face');
 if(rig==='ear-left'||rig==='ear-right')return headWarp(x,y,'ear');
 if(rig==='hair')return hairWarp(x,y,spec);
 if(rig==='limb-left'||rig==='limb-right')return limbWarp(x,y,rig.split('-')[1]);
 if(rig==='skirt-front'||rig==='skirt-back'){
  const k=smooth(559,811,y),back=rig==='skirt-back'?-1:1;
  x+=p.skirt1*30*k+(p.skirt2*18*k*back)+(x-506)*p.skirt3*.13*k;
  y+=p.skirt2*10*k*(x-506)/130+p.skirt3*5*k;
  return bodyWarp(x,y,back*27);
 }
 if(rig==='garment-front')return bodyWarp(x,y,clothDepth(x,y,29));
 if(rig==='garment-back')return bodyWarp(x,y,clothDepth(x,y,-25));
 if(rig==='garment-side-left'||rig==='garment-side-right')return bodyWarp(x,y,clothDepth(x,y,8));
 // Neck blends to the head at the jaw; shoulders stay on the body.
 if(rig==='body'&&y<330){const a=1-smooth(274,330,y),base=bodyWarp(x,y,18),head=headWarp(x,y,'face');return[lerp(base[0],head[0],a),lerp(base[1],head[1],a)]}
 return bodyWarp(x,y,rig==='legs'?0:clothDepth(x,y,12));
}
let mouthCustom={};
function updateMouth(){
 const o=p.mouthOpen,f=p.mouthForm,cx=505.6,w=11.7+f*2.1+o*1.2,cy=264.2;
 const mid=cy+f*1.3,corner=cy-f*1.5,up=lerp(mid,cy-1.4-o*.8,smooth(0,.23,o)),low=cy+o*(13+4*smooth(.4,1,-f))+.1;
 const top=`M${cx-w} ${corner} Q${cx} ${up} ${cx+w} ${corner}`;
 const bottom=o<.01?top:`M${cx-w} ${corner} Q${cx-w*.8} ${low} ${cx} ${low} Q${cx+w*.8} ${low} ${cx+w} ${corner}`;
 const aperture=`${top} Q${cx+w*.8} ${low} ${cx} ${low} Q${cx-w*.8} ${low} ${cx-w} ${corner} Z`;
 mouthCustom={'rig-mouth-aperture':parse(aperture),'rig-mouth-upper-lip':parse(top),'rig-mouth-lower-lip':parse(bottom),
 'rig-mouth-upper-teeth':parse(`M481 256 L532 256 L532 ${cy+.7} Q506 ${cy+2} 481 ${cy+.7} Z`),
 'rig-mouth-tongue':parse(`M482 ${low-3} Q505 ${low-10} 531 ${low-3} L531 ${low+8} L482 ${low+8} Z`),
 'rig-mouth-lower-teeth':parse(`M486 ${low+1.5} Q506 ${low-.2} 529 ${low+1.5} L529 ${low+8} L486 ${low+8} Z`)};
 $('rig-mouth-interior').style.opacity=o<.018?'0':'1';
}
function render(){
 updateDrawingOrder();updateLimbOcclusion();updateMouth();
 for(const spec of pathSpecs){
  const a=mouthCustom[spec.node.id]||spec.tokens;let s='';
  for(let i=0;i<a.length;i++){
   if(typeof a[i]==='string'){s+=a[i]+' ';continue;}
   const q=mapPoint(a[i],a[++i],spec);s+=q[0].toFixed(2)+' '+q[1].toFixed(2)+' ';
  }
  spec.node.setAttribute('d',s);
 }
 for(const paint of paintSpecs){
  const q=mapPoint(paint.cx,paint.cy,paint.spec),qx=mapPoint(paint.cx+1,paint.cy,paint.spec),qy=mapPoint(paint.cx,paint.cy+1,paint.spec);
  const a=qx[0]-q[0],b=qx[1]-q[1],c=qy[0]-q[0],d=qy[1]-q[1],e=q[0]-a*paint.cx-c*paint.cy,f=q[1]-b*paint.cx-d*paint.cy;
  paint.node.setAttribute('gradientTransform',`matrix(${a} ${b} ${c} ${d} ${e} ${f}) ${paint.transform}`);
 }
 for(const side of ['left','right'])$('rig-eye-'+side+'-highlight').style.opacity=String(p.highlight);
 svg.classList.toggle('show-skirt',showSkirt);$('mini-svg').classList.toggle('show-skirt',showSkirt);
 // Styles belong to the shared scene too, so <use> mirrors outfit and visibility faithfully.
 scene.classList.toggle('show-skirt',showSkirt);
 scene.classList.toggle('diagnostic',diagnostic);
 for(const g of partGroups){const rear=g.dataset.rig==='garment-back'||g.dataset.rig.startsWith('garment-side');g.style.opacity=(hiddenParts.has(g.id)||(showBackOnly&&!rear))?'0':'1'}
}
function updateDrawingOrder(){
 if(layerSignature==='continuous-depth')return;layerSignature='continuous-depth';
 function rank(g){
  const rig=g.dataset.rig,id=g.id;
  if(rig.startsWith('limb-')){
   if(g.dataset.rearPass)return 12;
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
function updateLimbOcclusion(){
 for(const layer of limbLayers){
  const ch=layer.side==='left'?'R':'L';
  const fold=smooth(3,18,p['arm'+ch])*smooth(5,21,p['elbow'+ch]);
  const far=layer.segment==='upper'?smooth(1.5,9.5,p.bodyX*(layer.side==='left'?-1:1)):0;
  const cut=lerp(905,344,Math.max(fold,far));
  // A shallow curved cross-section advances continuously along the arm as it
  // folds behind the torso. Outside its silhouette the rear pass stays visible.
  const center=layer.side==='left'?390:625,points=[[200,280],[820,280]];
  for(let x=820;x>=200;x-=10)points.push([x,cut+Math.min(16,((x-center)/18)**2*2)]);
  layer.mask.setAttribute('d',points.map(([x,y],i)=>{const q=limbWarp(x,y,layer.side);return(i?'L':'M')+q[0].toFixed(2)+' '+q[1].toFixed(2)}).join(' ')+' Z');
 }
}
function physicsDriver(){
 // Actual crown position includes yaw, nod, roll, neck motion and torso lean.
 const anchor=headWarp(505,80,'hair');
 return{angle:p.headZ*.76+p.headX*.3+p.bodyZ*.78,x:anchor[0],y:anchor[1]};
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
   const massScale=isBang?.54:isCow?1.8:1;
   const elastic=(22+p.hairStiffness*57)*(1+(i%4)*.06)*(isCow?.58:1);
   const damping=(2.6+p.hairDamping*8.2)*(isCow?.72:1);
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
function sampleTrack(key,time){
 const a=MOTION.tracks[key],u=clamp(time*MOTION.fps,0,a.length-1),i=Math.floor(u),f=u-i;
 const b=a[i],c=a[Math.min(i+1,a.length-1)],l=a[Math.max(i-1,0)],r=a[Math.min(i+2,a.length-1)];
 const value=.5*((2*b)+(-l+c)*f+(2*l-5*b+4*c-r)*f*f+(-l+3*b-3*c+r)*f*f*f);
 return clamp(value,Math.min(b,c),Math.max(b,c));
}
function motionAt(time){
 const out={...defaults,...physicsSettings};
 for(const key in MOTION.tracks){out[key]=sampleTrack(key,time)}
 // The demo's displayed eye/ mouth tracks run from open/smile at the left to closed at the right.
 // Normalize our controls to standard user-facing 0=closed, 1=open semantics.
 for(const k of ['eyeLOpen','eyeROpen','eyeLSmile','eyeRSmile','mouthOpen'])out[k]=clamp(1-(out[k]-.027)/.93,0,1);
 out.mouthForm=-out.mouthForm;
 // Offset raster marker centers so center detents are exactly zero.
 for(const k of ['headX','headY','headZ'])out[k]=clamp(out[k]+.6522,-30,30);
 for(const k of ['bodyX','bodyY','bodyZ'])out[k]=clamp(out[k]+.3261,-10,10);
 out.browRY=out.browLY;out.browRX=out.browLX;out.browRForm=out.browLForm;out.browRAngle=out.browLAngle;
 out.armR=sampleTrack('armL',Math.max(0,time-.08))*.91;out.elbowR=sampleTrack('elbowL',Math.max(0,time-.10))*.9;out.wristR=out.wristL*.92;out.handR=out.handL*.9;
 // Preserve observed gestures, add the subtle asynchronous torso/head relationship
 // missing when torso Y is treated as translation. No autonomous hair animation is added.
 const lagZ=sampleTrack('headZ',Math.max(0,time-.16))+.6522;
 const lagX=sampleTrack('headX',Math.max(0,time-.2))+.6522;
 out.bodyZ=clamp(out.bodyZ*1.3+lagZ*.17,-10,10);
 out.bodyX=clamp(out.bodyX*1.12+lagX*.11,-10,10);
 out.bodyY=clamp(out.bodyY*1.08,-10,10);
 out.headX=clamp(out.headX*1.3,-30,30);
 out.headY=clamp(out.headY*.9,-30,30);
 out.mouthOpen=Math.pow(out.mouthOpen,.92)*.78;
 out.gazeX=Math.sin(time*.85)*.08;out.gazeY=Math.sin(time*1.15)*.05;
 // Ease back into the first pose at the loop boundary, without resetting inertia.
 if(time>MOTION.duration-.45){const start=motionAt(0),blend=smooth(MOTION.duration-.45,MOTION.duration,time);for(const d of defs)out[d[0]]=lerp(out[d[0]],start[d[0]],blend)}
 return out;
}
function applyView(){
 const views={portrait:[287,-2,444,650],face:[325,10,366,350],full:[245,0,530,1510]},v=views[view];
 const w=v[2]/zoom,h=v[3]/zoom;svg.setAttribute('viewBox',`${v[0]+(v[2]-w)/2} ${v[1]+(v[3]-h)/2} ${w} ${h}`);
 document.querySelector('.small-preview').classList.toggle('hidden',view==='full');
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
function setMode(next,shouldPlay=false){if(next==='manual'&&mode!=='manual')manualTarget={...p};mode=next;playing=shouldPlay;if(mode==='manual'){$('stage-state').textContent='手动姿态 · 参数实时生效'}else{$('stage-state').textContent='参考动作 · 30 秒循环'}
 $('mode-motion').classList.toggle('active',mode==='motion');$('mode-manual').classList.toggle('active',mode==='manual');updatePlay();}
function updatePlay(){ $('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('clip-label').textContent=mode==='motion'?'参考轨迹 · 24 路参数 · 发束惯性':'手动姿态 · 调参保留 · 可导出 / 载入';}
function notify(s){$('toast').textContent=s;$('toast').classList.remove('hidden');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('toast').classList.add('hidden'),2400)}
function inputParam(key,value){const d=defs.find(d=>d[0]===key);if(!d||!Number.isFinite(value))return;value=clamp(value,d[2],d[3]);if(physicsKeys.includes(key)){physicsSettings[key]=p[key]=manualTarget[key]=value;syncInputs();return}setMode('manual',false);manualTarget[key]=value;if(key.startsWith('skirt'))setSkirt(true);syncInputs();render();}
function setSkirt(on){showSkirt=on;$('outfit').classList.toggle('active',on);$('outfit').textContent=on?'裙摆测试 ✓':'裙摆测试层';scene.classList.toggle('show-skirt',on);svg.classList.toggle('show-skirt',on);}
function syncInputs(){for(const d of defs){const r=$('range-'+d[0]),n=$('number-'+d[0]);const value=mode==='manual'?manualTarget[d[0]]:p[d[0]];if(r)r.value=value;if(n&&document.activeElement!==n)n.value=value.toFixed(d[3]>2?1:2)}
 $('timeline').value=t;$('time').textContent=`00:${Math.floor(t).toString().padStart(2,'0')} / 00:30`;}
const presets={
 neutral:{...defaults,mouthOpen:0,mouthForm:0},smile:{...defaults,eyeLOpen:0,eyeROpen:0,eyeLSmile:1,eyeRSmile:1,mouthOpen:.62,mouthForm:1,headZ:-7,browLY:.15,browRY:.15},
 wink:{...defaults,eyeROpen:0,eyeRSmile:1,mouthOpen:.5,mouthForm:1,headZ:8},sad:{...defaults,eyeLOpen:.65,eyeROpen:.65,mouthOpen:0,mouthForm:-1,browLAngle:-.55,browRAngle:-.55,browLForm:-.7,browRForm:-.7},
 surprised:{...defaults,eyeLOpen:1,eyeROpen:1,mouthOpen:.8,mouthForm:-.65,browLY:.75,browRY:.75,pupil:.8},sleepy:{...defaults,eyeLOpen:.32,eyeROpen:.32,mouthOpen:.05,mouthForm:-.4,browLY:-.35,browRY:-.35,headY:8}
};
function buildControls(){
 const root=$('controls');root.innerHTML='';
 if(activeTab==='layers'){
  root.innerHTML='<div class="section-caption"><span>PART INSPECTOR</span><span>独立部件 / 遮挡关系</span></div><div class="control-note">关闭前层可检查隐藏补全。背片与侧片跟随身体 X 产生深度错位；头发由 16 片独立发束与一束呆毛驱动。</div><label class="toggle-row">只看服装背片 / 侧片<input id="back-only" type="checkbox"></label><label class="toggle-row">补全部件着色检查<input id="diagnostic" type="checkbox"></label><label class="toggle-row">显示裙摆测试层<input id="skirt-toggle" type="checkbox"></label><div class="layer-list" id="layers"></div><p class="footer-note">SVG 保留 05-2 的颜色与材质。新增眼口遮挡蒙版，不制作动态投影。裙摆为动画测试件，可随时关闭。</p>';
  $('back-only').checked=showBackOnly;$('diagnostic').checked=diagnostic;$('skirt-toggle').checked=showSkirt;
  $('back-only').onchange=e=>{showBackOnly=e.target.checked;render()};$('diagnostic').onchange=e=>{diagnostic=e.target.checked;render()};$('skirt-toggle').onchange=e=>{setSkirt(e.target.checked);render()};
  const sets=[['前发 / 7 束',g=>g.dataset.hair==='hair-bangs'],['人物左侧发 / 3 束',g=>g.dataset.hair==='hair-right'],['人物右侧发 / 3 束',g=>g.dataset.hair==='hair-left'],['后发 / 3 片',g=>g.dataset.hair==='hair-back'],['呆毛',g=>g.id==='hair-cowlick'],['发夹',g=>g.id==='hair-clips'],['脸部底形',g=>g.id==='head-face'],['五官与眼口内部',g=>g.id==='head-face-features'],['服装正面',g=>g.dataset.rig==='garment-front'],['服装背片',g=>g.dataset.rig==='garment-back'],['服装侧片',g=>g.dataset.rig.startsWith('garment-side')],['躯干',g=>g.id==='body-core']];
  for(const [label,test]of sets){const groups=partGroups.filter(test);const row=document.createElement('label');row.innerHTML=`<input type="checkbox" ${groups.every(g=>!hiddenParts.has(g.id))?'checked':''}>${label}`;row.querySelector('input').onchange=e=>{for(const g of groups)e.target.checked?hiddenParts.delete(g.id):hiddenParts.add(g.id);render()};$('layers').append(row)}return;
 }
 const caption=document.createElement('div');caption.className='section-caption';caption.innerHTML=`<span>${{face:'EXPRESSION',head:'HEAD & HAIR',body:'BODY & CLOTH'}[activeTab]}</span><span>拖动滑杆 · 双击数值行复位</span>`;root.append(caption);
 if(activeTab==='face'){
  const presetsEl=document.createElement('div');presetsEl.className='presets';for(const [key,label]of [['smile','⌣ 闭眼笑'],['wink','◡ 单眼眨眼'],['surprised','○ 惊讶'],['sleepy','— 半睁眼']]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{setMode('manual');manualTarget={...presets[key],...physicsSettings};syncInputs();render()};presetsEl.append(b)}root.append(presetsEl);
 }
 if(activeTab==='head')root.insertAdjacentHTML('beforeend','<div class="control-note">头发由头部与身体姿态自动驱动。发根固定，中段和末端分别计算惯性、弹性与阻尼；平滑转动时也会滞后和回弹。风力默认 0。</div>');
 if(activeTab==='body')root.insertAdjacentHTML('beforeend','<div class="control-note">转身会露出服装背片与侧片。调节裙子参数时自动显示测试裙摆；基础服仍完整保留。</div>');
 for(const d of defs.filter(d=>d[5]===activeTab)){
  const row=document.createElement('div');row.className='slider-row';row.innerHTML=`<div class="slider-top"><label for="range-${d[0]}">${d[1]}</label><input id="number-${d[0]}" class="number" type="number" aria-label="${d[1]}数值" min="${d[2]}" max="${d[3]}" step="${d[3]>2?.1:.01}"></div><div class="range-line"><small>${d[2]}</small><input id="range-${d[0]}" type="range" min="${d[2]}" max="${d[3]}" step="${d[3]>2?.1:.01}" aria-label="${d[1]}"><small>${d[3]}</small></div>`;
  root.append(row);$('range-'+d[0]).oninput=e=>inputParam(d[0],Number(e.target.value));$('number-'+d[0]).oninput=e=>{if(e.target.value!=='')inputParam(d[0],Number(e.target.value))};row.ondblclick=e=>{if(e.target.tagName!=='INPUT')inputParam(d[0],d[4])};
 }
 const auto=document.createElement('div');auto.innerHTML='<label class="toggle-row">自动眨眼<input id="auto-blink" type="checkbox"></label><label class="toggle-row">自动呼吸<input id="auto-breath" type="checkbox"></label>';root.append(auto);$('auto-blink').checked=autoBlink;$('auto-breath').checked=autoBreath;$('auto-blink').onchange=e=>{autoBlink=e.target.checked;if(!autoBlink){manualTarget.eyeLOpen=manualTarget.eyeROpen=1;syncInputs()}};$('auto-breath').onchange=e=>autoBreath=e.target.checked;syncInputs();
}
$('play').onclick=()=>{if(mode==='manual')setMode('motion',true);else playing=!playing;updatePlay()};
$('mode-motion').onclick=()=>{setMode('motion',true)};$('mode-manual').onclick=()=>setMode('manual',false);
$('timeline').oninput=e=>{t=Number(e.target.value);setMode('motion',false);p=motionAt(t);updateSprings(.016,true);render();syncInputs()};
$('speed').onchange=e=>speed=Number(e.target.value);
$('reset').onclick=()=>{resetPhysicsSettings();setMode('manual');p={...defaults};manualTarget={...p};hiddenParts.clear();showBackOnly=false;diagnostic=false;follow=false;autoBlink=false;autoBreath=false;$('follow').classList.remove('active');updateSprings(.016,true);buildControls();render();notify('已恢复 05-2 中性姿态')};
$('outfit').onclick=()=>{setSkirt(!showSkirt);render();if(activeTab==='layers')buildControls()};
$('follow').onclick=()=>{follow=!follow;$('follow').classList.toggle('active',follow);if(follow)setMode('manual')};
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{activeTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(q=>q.classList.toggle('active',q===b));buildControls()};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{view=b.dataset.view;zoom=1;applyView()};
function followPointer(e){if(!follow&&!dragging)return;const box=$('stage').getBoundingClientRect(),x=clamp((e.clientX-box.left)/box.width*2-1),y=clamp(1-(e.clientY-box.top)/box.height*2);manualTarget.headX=x*30;manualTarget.headY=-y*25;manualTarget.gazeX=x*.35;manualTarget.gazeY=y*.25;manualTarget.bodyX=x*5.8;manualTarget.bodyY=-y*4.2;manualTarget.bodyZ=-x*1.65;syncInputs();}
$('stage').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;dragging=true;setMode('manual');$('stage').setPointerCapture(e.pointerId);followPointer(e)});
$('stage').addEventListener('pointermove',followPointer);$('stage').addEventListener('pointerup',()=>dragging=false);$('stage').addEventListener('pointercancel',()=>dragging=false);
$('stage').addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom-e.deltaY*.0008,.7,1.75);applyView()},{passive:false});
function download(name,obj){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
$('export').onclick=()=>download('milly-pose.json',{format:'milly-svg-pose-v1',parameters:mode==='manual'?manualTarget:p,showSkirt,time:t});
$('import').onclick=()=>$('import-file').click();$('import-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;const data=JSON.parse(await file.text());if(data.format!=='milly-svg-pose-v1'||!data.parameters)throw Error();const next={...defaults};for(const d of defs){const v=data.parameters[d[0]];if(typeof v==='number'&&Number.isFinite(v))next[d[0]]=clamp(v,d[2],d[3])}p=next;manualTarget={...p};for(const k of physicsKeys)physicsSettings[k]=p[k];setSkirt(!!data.showSkirt);setMode('manual');updateSprings(.016,true);syncInputs();render();notify('姿态已载入')}catch{notify('无法读取该文件，请选择导出的 Milly 参数 JSON')}e.target.value=''};
let modalWasPlaying=false;
$('reference-open').onclick=()=>{modalWasPlaying=playing;playing=false;updatePlay();$('reference-modal').classList.remove('hidden');$('reference-video').currentTime=t;$('reference-close').focus()};
function closeModal(){$('reference-modal').classList.add('hidden');$('reference-video').pause();playing=modalWasPlaying;updatePlay();$('reference-open').focus()}
$('reference-close').onclick=closeModal;$('reference-modal').onclick=e=>{if(e.target===$('reference-modal'))closeModal()};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('reference-modal').classList.contains('hidden'))closeModal();if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)&&$('reference-modal').classList.contains('hidden')){e.preventDefault();$('play').click()}});
let lastSync=0;
function frame(now){
 const elapsed=Math.max(.001,(now-last)/1000);last=now;
 // Wall-clock playback is independent of physics integration and rendering load.
 if(mode==='motion'&&playing){t=(t+elapsed*speed)%MOTION.duration;p=motionAt(t)}
 if(mode==='manual'){
  const dt=Math.min(elapsed,.15);
  for(const d of defs){const key=d[0],rate=key.startsWith('body')?5.8:/head|arm|elbow|wrist/.test(key)?13:27;p[key]=lerp(p[key],manualTarget[key],1-Math.exp(-rate*dt));}
  if(autoBlink){const phase=(now/1000)%4.3,blink=phase<.21?Math.abs(phase-.105)/.105:1;p.eyeLOpen=p.eyeROpen=blink}
  if(autoBreath)p.breath=(Math.sin(now/1000*1.5)+1)/2;
 }
 updateSprings(elapsed);render();
 if(now-lastSync>90){syncInputs();lastSync=now}
 fpsFrames++;fpsTime+=elapsed;if(fpsTime>1){window.millyFPS=fpsFrames/fpsTime;fpsTime=fpsFrames=0}
 requestAnimationFrame(frame);
}
// Public bridge for reproducible pose checks and later face-capture input.
window.MillyRig={get parameters(){return{...(mode==='manual'?manualTarget:p)}},get renderedParameters(){return{...p}},definitions:defs,
 set(values,options={}){setMode('manual');for(const d of defs){if(Number.isFinite(values[d[0]])){manualTarget[d[0]]=clamp(values[d[0]],d[2],d[3]);if(physicsKeys.includes(d[0]))physicsSettings[d[0]]=manualTarget[d[0]]}}if(!options.smooth){p={...manualTarget};updateSprings(.016,true)}syncInputs();render()},
 seek(seconds){t=clamp(seconds,0,MOTION.duration);setMode('motion',false);p=motionAt(t);updateSprings(.016,true);syncInputs();render()},
 setOutfit:setSkirt,showView(name){view=name;zoom=1;applyView()},reset(){resetPhysicsSettings();setMode('manual');p={...defaults};manualTarget={...p};updateSprings(.016,true);syncInputs();render()},
 get physics(){return [...springs].map(([id,s])=>({id,mid:s.x,tip:s.tip,velocity:s.tv,lift:s.lift}))},
 step(seconds,values){setMode('manual');Object.assign(p,values);Object.assign(manualTarget,p);updateSprings(seconds);render()},
 render,paths:pathSpecs.length,parts:partGroups.length,get state(){return{mode,playing,time:t,showSkirt,view,version:2}}};
applyView();buildControls();p=motionAt(0);render();requestAnimationFrame(frame);
