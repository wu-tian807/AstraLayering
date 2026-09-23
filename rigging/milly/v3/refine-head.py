from pathlib import Path
p=Path(__file__).resolve().parent/'rig.js';s=p.read_text()
s=s.replace("if(s.includes('nose'))return{kind:'nose'};", "if(s.includes('nose'))return{kind:'nose'};\n if(id.includes('face-cheek-'))return{kind:'cheek',side:id.includes('-left-')?'left':'right'};\n if(id.includes('face-lid-'))return{kind:'lidWarmth',side:id.includes('-left-')?'left':'right'};")
a=s.index('function headWarp(');b=s.index('function eyeValues(',a)
s=s[:a]+'''// One shallow, curved cranial field serves face colour, contour and features.
// ±30 are rig control units; the visible yaw is limited to roughly ±12 degrees.
function headDepth(x,y,kind){
 const dx=x-505;
 if(kind==='ear')return 6;
 if(kind==='back')return -8;
 if(kind==='hair')return (16+30*smooth(50,115,y))*Math.sqrt(Math.max(.12,1-(dx/148)**2));
 const dome=Math.sqrt(Math.max(.07,1-(dx/94)**2));
 const surface=12+30*dome*(.91+.09*smooth(174,259,y));
 return surface+(kind==='nose'?8:kind==='features'?2:0);
}
function headWarp(x,y,kind='face'){
 const dx=x-505,dy=y-191;
 const yaw=clamp((p.headX+p.bodyX*.06)/30)*.205,pitch=-clamp(p.headY/30)*.20;
 const sy=Math.sin(yaw),cy=Math.cos(yaw),sp=Math.sin(pitch),cp=Math.cos(pitch),depth=headDepth(x,y,kind);
 let xx=dx*cy+depth*sy,zz=depth*cy-dx*sy;
 let yy=dy*cp-zz*sp;
 const perspective=1+clamp((zz*cp+dy*sp-depth)/2100,-.018,.018);
 xx*=perspective;yy*=perspective;
 // Tiny art-directed lower-cheek/jaw correction, without flattening the face.
 if(kind==='face'){
  const lower=smooth(228,291,y),turn=sy/Math.sin(.205);
  xx+=turn*lower*(1.4-.014*Math.abs(dx));
  yy+=smooth(257,299,y)*(p.mouthOpen-.3)*1.2;
 }
 const q=rotate(xx+505,yy+191,505,289,p.headZ*rad*.82);
 return attachHead(q[0],q[1]);
}
const featureFrames=new Map();
function featureWarp(x,y,feature){
 const key=feature.kind+':'+(feature.side||'');let frame=featureFrames.get(key);
 if(!frame){
  let ax=505.6,ay=264.2;
  if(feature.side){ax=feature.side==='left'?463.3:549.1;ay=222.3;}
  if(feature.kind==='brow'){ax=feature.side==='left'?458:552;ay=180;}
  if(feature.kind==='cheek'){ax=feature.side==='left'?454:556;ay=244;}
  if(feature.kind==='lidWarmth'){ax=feature.side==='left'?464:546;ay=207;}
  if(feature.kind==='nose'){ax=505.6;ay=242;}
  const kind=feature.kind==='nose'?'nose':feature.kind==='cheek'?'face':'features';
  const q=headWarp(ax,ay,kind),qx=headWarp(ax+1,ay,kind),qy=headWarp(ax,ay+1,kind);
  let ux=qx[0]-q[0],uy=qx[1]-q[1],vx=qy[0]-q[0],vy=qy[1]-q[1];
  // Use the same surface tangent as the face, bounded to preserve illustration.
  const ulen=Math.hypot(ux,uy),vlen=Math.hypot(vx,vy);
  const uscale=clamp(ulen,.965,1.025)/ulen,vscale=clamp(vlen,.96,1.02)/vlen;
  ux*=uscale;uy*=uscale;vx*=vscale;vy*=vscale;
  frame={ax,ay,q,ux,uy,vx,vy};featureFrames.set(key,frame);
 }
 const {ax,ay,q,ux,uy,vx,vy}=frame;
 return[q[0]+(x-ax)*ux+(y-ay)*vx,q[1]+(x-ax)*uy+(y-ay)*vy];
}
''' +s[b:]
s=s.replace("return bodyWarp(xx,yy,lerp(10,-38,tucked));", "const depth=lerp(clothDepth(x,y,12),lerp(10,-38,tucked),smooth(342,408,y));\n return bodyWarp(xx,yy,depth);")
s=s.replace("if(rig==='face')return feature.kind==='nose'?featureWarp(x,y,feature):headWarp(x,y,'face');", "if(rig==='face')return feature.kind!=='none'?featureWarp(x,y,feature):headWarp(x,y,'face');")
s=s.replace("return bodyWarp(x,y,rig==='legs'?0:clothDepth(x,y,12));", "return bodyWarp(x,y,rig==='legs'?clothDepth(x,y,12)*(1-smooth(690,830,y)):clothDepth(x,y,12));")
s=s.replace("updateDrawingOrder();updateMouth();", "featureFrames.clear();updateDrawingOrder();updateMouth();")
s=s.replace("if(rig==='legs')return 20;", "if(rig==='legs')return 26;")
s=s.replace("out.headX=clamp(out.headX*1.3,-30,30);", "out.headX=clamp(out.headX,-30,30);")
s=s.replace("version:2", "version:3")
p.write_text(s)
p=Path(__file__).resolve().parent/'template.html';s=p.read_text().replace('v2','v3').replace('V2','V3').replace(' / V2',' / V3').replace('姿态驱动物理','轻转向 · 连续衔接').replace('href="../index.html"','href="../v2/index.html"').replace('查看 v1','查看 v2');p.write_text(s)
