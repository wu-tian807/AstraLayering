import { authoredPoint } from './keyforms.mjs';
// Composed head shell, facial/scalp surfaces, local corrections and attachments.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
export function classify(id,rig){const role=rig.bindings[id];if(!role)throw Error('Unbound SVG group: '+id);return role;}
// Shape-preserving Hermite interpolation: no cosine lens and no flat band at every row.
function curve(knots,values,x){
 const n=knots.length;if(x<=knots[0])return values[0];if(x>=knots[n-1])return values[n-1];
 let i=0;while(x>knots[i+1])i++;
 const slope=j=>{if(j===0)return (values[1]-values[0])/(knots[1]-knots[0]);if(j===n-1)return (values[j]-values[j-1])/(knots[j]-knots[j-1]);const a=(values[j]-values[j-1])/(knots[j]-knots[j-1]),b=(values[j+1]-values[j])/(knots[j+1]-knots[j]);return a*b<=0?0:2*a*b/(a+b);};
 const h=knots[i+1]-knots[i],t=(x-knots[i])/h,t2=t*t,t3=t2*t;
 return (2*t3-3*t2+1)*values[i]+(t3-2*t2+t)*h*slope(i)+(-2*t3+3*t2)*values[i+1]+(t3-t2)*h*slope(i+1);
}
export function validateRig(rig){
 if(rig.schema!=='astra.head-nine-key.v9')throw Error('Unsupported head rig: '+rig.schema);
 for(const axis of ['x','y']){
  const p=rig.parameters?.[axis],extent=rig.keyformExtent?.[axis];
  if(!p||!Number.isFinite(extent)||extent<=0||p.min!==-p.max||p.max<=0||p.max>extent||p.default!==0)throw Error('Invalid head parameter range: '+axis);
 }
 for(const surface of ['face','scalp','bun','earL','earR']){
  const f=rig.keyforms?.[surface];if(!f)throw Error(surface+': missing authored endpoint forms');
  const names=Object.keys(f.landmarks);if(names.length<3)throw Error(surface+': too few landmarks');
  for(const p of Object.values(f.landmarks))if(p.length!==2||!p.every(Number.isFinite))throw Error(surface+': invalid source landmark');
  for(const [x,y] of rig.keyCoordinates){if(!x&&!y)continue;const pose=f.poses[`${x},${y}`];
   if(!pose||Object.keys(pose).length!==names.length||names.some(n=>!pose[n]||pose[n].length!==2||!pose[n].every(Number.isFinite)))throw Error(surface+': incomplete endpoint '+x+','+y);
  }
  if(f.interpolation==='barycentric-cage'&&(!f.triangles?.length||f.triangles.some(t=>t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=names.length))))throw Error(surface+': invalid cage topology');
 }
 const face=rig.keyforms.face,contours=face.contours;
 const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
 if(!contours)throw Error('Missing authored cheek contours');
 for(const side of ['L','R']){
  if(!contours.source?.[side]?.length||contours.source[side].some(c=>c.length!==4||!c.every(point)))throw Error('Invalid source cheek contour');
  for(const [key,pose] of Object.entries(face.poses)){
   const curve=contours.poses?.[key]?.[side];
   if(curve?.length!==4||!curve.every(point))throw Error('Incomplete authored cheek contour');
   for(const [p,q] of [[curve[0],pose['outerEye'+side]],[curve[3],pose.chin]])if(Math.hypot(p[0]-q[0],p[1]-q[1])>1e-6)throw Error('Disconnected authored cheek contour');
  }
 }
 const fringe=rig.physics.fringe;
 if(!fringe||fringe.channels.length!==2||fringe.channels.some(c=>!rig.physics.strands[c]?.driver)||fringe.fadeEndY<=fringe.fadeStartY||fringe.sideFullWidth<=fringe.partPinWidth)throw Error('Invalid fringe physics binding');
 for(const group of fringe.groups)if(!rig.bindings[group])throw Error('Unbound fringe art: '+group);
 for(const [kind,s] of Object.entries(rig.physics.strands)){
  if(!(s.frequency>0&&s.damping>0&&s.damping<1&&s.endY>s.startY&&s.maxOffset>0))throw Error('Invalid strand physics: '+kind);
  if(s.driver&&(!rig.bindings.hair_crown||s.driver.kind!=='fringe'||s.driver.anchor?.length!==2||!s.driver.anchor.every(Number.isFinite)||s.driver.anchor[1]>s.startY))throw Error('Invalid fringe root: '+kind);
  if(s.outputScale&&s.outputScale.some(v=>!Number.isFinite(v)||v<=0||v>1))throw Error('Invalid strand output scale: '+kind);
 }
 const v=rig.volume;
 if(!(v.focalLength>400)||v.pivot.length!==2)throw Error('Invalid common head camera');
 for(const name of ['face','scalp','bun']){
  const s=v[name];if(!(s.radiusX>0)||!(s.roundness>0))throw Error(name+': invalid volume');
  for(const key of ['depth','sideDepth'])if(s[key].length!==s.rows.length||s[key].some(n=>!Number.isFinite(n)))throw Error(name+'.'+key+': one depth per anatomical row required');
  if(s.rows.some((n,i)=>!Number.isFinite(n)||i&&n<=s.rows[i-1]))throw Error(name+': unordered rows');
 }
 for(const [name,f] of Object.entries(rig.features))if(f.parent!=='face')throw Error(name+': missing facial attachment');
 for(const [name,feature] of Object.entries(rig.features)){
  const form=rig.featureForms?.[feature.poseFrame||name];
  if(!form||form.anchor?.length!==2)throw Error(name+': missing local facial form');
  for(const [x,y] of rig.keyCoordinates){if(!x&&!y)continue;const p=form.poses?.[`${x},${y}`];
   if(!p||p.xAxis?.length!==2||p.yAxis?.length!==2||![...p.xAxis,...p.yAxis].every(Number.isFinite)||p.xAxis[0]*p.yAxis[1]-p.xAxis[1]*p.yAxis[0]<=0)throw Error(name+': invalid local facial form');
  }
 }
 if(!rig.occlusion?.behindFaceGroups?.length||!rig.occlusion.foregroundGroups?.length)throw Error('Missing head occlusion ownership');
 for(const name of ['eyeR','eyeL','nose','mouth']){
  const f=rig.features[name];if(![f.strength,...f.core,...f.support].every(Number.isFinite)||f.strength<0||f.core.some((v,i)=>v<0||f.support[i]<=v))throw Error(name+': invalid continuous facial constraint');
 }
 if(rig.neck.socket.length!==3||!rig.neck.socket.every(Number.isFinite))throw Error('Invalid cranial-base socket');

 for(const [name,p] of Object.entries(rig.projections))if(!['face','earL','earR','skin'].includes(p.receiver)||rig.projections[p.caster])throw Error(name+': invalid projection ownership');
}
/** Smooth lateral sections with bounded slope. The source is an orthogonal
 * drawing: lift its points onto the authored volume, then reproject around ONE
 * head pivot. Neutral back-projection preserves every original SVG point. */
export function depthAt(x,y,s){
 const u=Math.min(1,Math.abs((x-s.centerX)/s.radiusX)),r=s.roundness;
 const lateral=(Math.sqrt(u*u+r*r)-r)/(Math.sqrt(1+r*r)-r);
 const middle=curve(s.rows,s.depth,y),side=curve(s.rows,s.sideDepth,y);
 return middle+(side-middle)*lateral;
}
export function projectHead(x,y,z,kx,ky,rig){
 if(!kx&&!ky)return [x,y];
 const v=rig.volume,[cx,cy]=v.pivot,F=v.focalLength;
 const X=(x-cx)*(F-z)/F,Y=(y-cy)*(F-z)/F;
 const a=kx*v.yawRadians,b=ky*(ky>0?v.upRadians:v.downRadians),ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
 // Local pitch first, followed by yaw. No part has its own rotation centre.
 const yy=Y*cb-z*sb,zz=Y*sb+z*cb,xx=X*ca+zz*sa,depth=-X*sa+zz*ca;
 const f=F/(F-depth);
 return [cx+xx*f,cy+yy*f-Math.max(0,-ky)*v.downLift];
}
// One continuous field owns the skin, shading and facial features. Local
// tangent constraints fade into that same field, never into detached quads.
export function faceDepth(x,y,rig){
 const base=depthAt(x,y,rig.volume.face);let sum=0,delta=0;
 for(const kind of ['eyeR','eyeL','nose','mouth']){
  const f=rig.features[kind],[cx,cy]=f.anchor,[rx,ry]=f.support,[ix,iy]=f.core;
  const tx=smooth(ix,rx,Math.abs(x-cx)),ty=smooth(iy,ry,Math.abs(y-cy)),w=(1-tx)*(1-ty)*f.strength;
  if(!w)continue;
  const side=Math.sign(rig.head.center[0]-cx),plane=depthAt(cx,cy,rig.volume.face)+f.depthOffset+side*(x-cx)*f.tangentX+(y-cy)*f.tangentY;
  delta+=(plane-base)*w;sum+=w;
 }
 return base+delta/(1+sum);
}
export function faceSurfacePoint(x,y,kx,ky,rig){return projectHead(x,y,faceDepth(x,y,rig),kx,ky,rig);}
export function scalpPoint(x,y,kx,ky,rig){
 const box=rig.keyforms?.scalp?.support,px=box?clamp(x,box[0],box[2]):x,py=box?clamp(y,box[1],box[3]):y;
 const authored=authoredPoint(px,py,"scalp",kx,ky,rig);if(authored)return [authored[0]+x-px,authored[1]+y-py];
 const s=rig.volume.scalp,q=projectHead(x,y,depthAt(x,y,s),kx,ky,rig);
 if(kx){
  // A turned cranium reveals its near-side silhouette. Retarget that contour
  // from the complete hidden hair cap instead of squeezing the entire front
  // patch into a thin strip. Interior parting/strands still follow the volume.
  const sign=Math.sign(kx),u=(x-s.centerX)/s.radiusX,edgeX=s.centerX-sign*s.radiusX;
  const edge=projectHead(edgeX,y,depthAt(edgeX,y,s),kx,ky,rig);
  const wanted=edgeX+kx*s.silhouetteShift;
  q[0]+=(wanted-edge[0])*smooth(0,1,-u*sign)*Math.abs(kx);
 }
 return q;
}
function bunPoint(x,y,kx,ky,rig){
 const authored=authoredPoint(x,y,"bun",kx,ky,rig);if(authored)return authored;
 const s=rig.volume.bun,base=rig.surfaces.bun.anchor[1];
 const height=1+Math.abs(ky)*((ky>0?s.upHeight:s.downHeight)-1);
 return projectHead(x,base+(y-base)*height,depthAt(x,y,s),kx,ky,rig);
}
export function headPoint(x,y,kx,ky,rig){
 const authored=authoredPoint(x,y,"face",kx,ky,rig);if(authored)return authored;
 const q=faceSurfacePoint(x,y,kx,ky,rig);
 q[1]-=Math.max(0,ky)*rig.volume.face.upChinLift*smooth(235,270,y)*Math.exp(-(((x-rig.head.center[0])/35)**2));
 return q;
}
export function featureLocalPoint(x,y,kind,kx,ky,rig){return [x,y,faceDepth(x,y,rig)];}
function featurePoint(x,y,kind,kx,ky,rig){
 const f=rig.featureForms?.[rig.features[kind]?.poseFrame||kind],p=f?.poses[`${kx},${ky}`];if(!p)return headPoint(x,y,kx,ky,rig);
 const u=x-f.anchor[0],v=y-f.anchor[1],center=headPoint(...f.anchor,kx,ky,rig);return center.map((c,i)=>c+u*p.xAxis[i]+v*p.yAxis[i]);
}
function earPoint(x,y,kind,kx,ky,rig){return authoredPoint(x,y,kind,kx,ky,rig)||headPoint(x,y,kx,ky,rig);}
export function motionKind(kind,rig){return rig.projections?.[kind]?.caster||kind;}
export function attachment(kind,rig){return rig.surfaces[kind]?.anchor;}
export function isHanging(kind,rig){return Boolean(rig.surfaces[kind]?.guides)||kind.startsWith('earring');}
const skinWeight=(y,rig)=>1-smooth(rig.neck.followY,rig.neck.fixedY,y);
function guideAt(y,s){const rows=s.guides,knots=rows.map(r=>r[0]);return [1,2,3].map(i=>curve(knots,rows.map(r=>r[i]),y));}
export function rollWeight(x,y,kind,rig){if(kind==='body')return 0;if(kind==='skin')return skinWeight(y,rig);if(kind==='collar')return (1-smooth(rig.collar.followY,rig.collar.fixedY,y))*rig.collar.rollFollow;const s=rig.surfaces[kind];return s?.guides?guideAt(y,s)[1]:1;}
export function rollBend(x,y,kind,rig){const s=rig.surfaces[kind];return kind.startsWith('earring')?0:s?.guides?1-smooth(s.anchor[1]+12,s.bendEndY,y):1;}
function planeDepth(x,y,s,rig){
 const v=rig.volume,[cx,cy]=v.pivot,F=v.focalLength,[ax,ay]=s.anchor;
 const za=s.anchorSurface?depthAt(ax,ay,v[s.anchorSurface])+(s.depthOffset||0):s.depth;
 const [tx,ty]=s.depthSlope||[0,0],Xa=(ax-cx)*(F-za)/F,Ya=(ay-cy)*(F-za)/F;
 const intercept=za-tx*Xa-ty*Ya,t=tx*(x-cx)+ty*(y-cy);
 return (intercept+t)/(1+t/F);
}
function ornamentPoint(x,y,kind,kx,ky,rig){
 const q=projectHead(x,y,planeDepth(x,y,rig.surfaces[kind],rig),kx,ky,rig);
 const rootKind=kind==='forehead'?'forehead':'crown',root=rig.surfaces[rootKind], [ax,ay]=root.anchor;
 const target=authoredPoint(ax,ay,'scalp',kx,ky,rig);
 if(target){const base=projectHead(ax,ay,planeDepth(ax,ay,root,rig),kx,ky,rig);q[0]+=target[0]-base[0];q[1]+=target[1]-base[1];}
 return q;
}
export function rootPoint(kind,kx,ky,rig){
 const s=rig.surfaces[kind],[x,y]=s.anchor;
 if(s.parent)return boundaryPoint(x,y,s.parent,kx,ky,rig);
 if(kind==='bun')return bunPoint(x,y,kx,ky,rig);
 if(Number.isFinite(s.depth)||s.anchorSurface)return ornamentPoint(x,y,kind,kx,ky,rig);
 return kind.startsWith('earring')?earPoint(x,y,kind==='earringR'?'earR':'earL',kx,ky,rig):scalpPoint(x,y,kx,ky,rig);
}
function planePoint(x,y,kind,kx,ky,rig){
 if(kind.startsWith('earring')){
  const s=rig.surfaces[kind],q=rootPoint(kind,kx,ky,rig),[ax,ay]=s.anchor;
  // Gravity keeps the drop hanging; only the earlobe socket inherits head pitch.
  const width=Math.cos(kx*rig.volume.yawRadians);
  return [q[0]+(x-ax)*width,q[1]+y-ay];
 }
 return ornamentPoint(x,y,kind,kx,ky,rig);
}
// Neck attaches to the cranial base, behind the projecting chin. Its shoulder
// boundary remains fixed; yaw changes the column width only slightly.
function neckPoint(x,y,kx,ky,rig){
 const n=rig.neck,[cx,cy,depth]=n.socket,q=projectHead(cx,cy,depth,kx,ky,rig),w=skinWeight(y,rig);
 const hidden=(n.hiddenYawLift*kx*kx+n.hiddenPitchLift*ky*ky)*(1-smooth(237,270,y));
 return [x+((q[0]-cx)+(x-cx)*(n.yawWidth-1)*kx*kx)*w,y+(q[1]-cy)*w-hidden];
}
export function boundaryPoint(x,y,kind,kx,ky,rig){
 const projection=rig.projections[kind];
 if(projection?.sourceOffset){const [dx,dy]=projection.sourceOffset,p=boundaryPoint(x-dx,y-dy,projection.caster,kx,ky,rig);return [p[0]+dx,p[1]+dy];}
 kind=motionKind(kind,rig);
 if(kind==='body'||(!kx&&!ky))return [x,y];
 if(rig.features[kind])return featurePoint(x,y,kind,kx,ky,rig);
 if(['face','faceBare','faceDetail','faceShadow'].includes(kind))return headPoint(x,y,kx,ky,rig);
 if(kind==='earL'||kind==='earR')return earPoint(x,y,kind,kx,ky,rig);
 if(kind==='fringe')return scalpPoint(x,y,kx,ky,rig);
 if(kind==='bun')return bunPoint(x,y,kx,ky,rig);
 if(kind==='skin')return neckPoint(x,y,kx,ky,rig);
 if(kind==='collar'){
  const q=neckPoint(x,y,kx,ky,rig),w=(1-smooth(rig.collar.followY,rig.collar.fixedY,y))*rig.collar.headFollow;
  return [x+(q[0]-x)*w,y+(q[1]-y)*w+(x-rig.head.center[0])*kx*rig.collar.twist*w];
 }
 const s=rig.surfaces[kind];if(!s)throw Error('Unbound head surface: '+kind);
 const [ax,ay]=s.anchor,q=rootPoint(kind,kx,ky,rig);
 if(isHanging(kind,rig)){
  if(kind.startsWith('earring'))return planePoint(x,y,kind,kx,ky,rig);
  const [spine,follow,width]=guideAt(y,s),hanging=[x+(q[0]-ax)*follow+(x-spine)*(-.07*Math.abs(kx))*width*smooth(ay,ay+50,y),y+(q[1]-ay)*follow];
  if(s.rootBlend){const top=scalpPoint(x,y,kx,ky,rig),t=smooth(...s.rootBlend,y);return top.map((v,i)=>v+(hanging[i]-v)*t);}
  return hanging;
 }
 return planePoint(x,y,kind,kx,ky,rig);
}
// Independently authored endpoint drawings must not extrapolate through a
// negative key weight. C1 quadrant interpolation preserves the key envelope.
export function weights(x,y){const b=t=>{const u=clamp(Math.abs(t)),s=u*u*(3-2*u);return t<0?[s,1-s,0]:[0,1-s,s];},a=b(x),c=b(y);return c.flatMap(v=>a.map(u=>u*v));}
// The authoring envelope stays fixed when the live range is narrowed. A live
// value of 15 keeps its existing shape; it does not become the old 30 endpoint.
export function poseWeights(p,rig){return weights(p.x/rig.keyformExtent.x,p.y/rig.keyformExtent.y);}
export function clampPose(p,rig){return Object.fromEntries(['x','y','z'].map(k=>{if(!Number.isFinite(p[k]))throw Error('Invalid head pose: '+k);return [k,clamp(p[k],rig.parameters[k].min,rig.parameters[k].max)];}));}
function mixPoint(x,y,kind,p,rig){const w=poseWeights(p,rig),q=[0,0];rig.keyCoordinates.forEach(([kx,ky],i)=>{const a=boundaryPoint(x,y,kind,kx,ky,rig);q[0]+=a[0]*w[i];q[1]+=a[1]*w[i];});return q;}
export function evaluateRoot(kind,p,rig){const w=poseWeights(p,rig),q=[0,0];rig.keyCoordinates.forEach(([kx,ky],i)=>{const a=rootPoint(kind,kx,ky,rig);q[0]+=a[0]*w[i];q[1]+=a[1]*w[i];});return q;}
export function evaluatePoint(x,y,kind,p,rig){
 const sourceKind=kind;kind=motionKind(kind,rig);
 const q=mixPoint(x,y,sourceKind,p,rig),a=clamp(p.z,-20,20)*Math.PI/180,[cx,cy]=rig.head.neckPivot,w=rollWeight(x,y,kind,rig);
 if(isHanging(kind,rig)){
  const root=evaluateRoot(kind,p,rig),dx=root[0]-cx,dy=root[1]-cy,b=a*rollBend(x,y,kind,rig),u=q[0]-root[0],v=q[1]-root[1];
  return [q[0]+(dx*Math.cos(a)-dy*Math.sin(a)-dx)*w+u*Math.cos(b)-v*Math.sin(b)-u,q[1]+(dx*Math.sin(a)+dy*Math.cos(a)-dy)*w+u*Math.sin(b)+v*Math.cos(b)-v];
 }
 const dx=kind==='skin'?clamp(q[0]-cx,-rig.neck.rollRadius,rig.neck.rollRadius):q[0]-cx,dy=q[1]-cy;
 return [q[0]+(dx*Math.cos(a)-dy*Math.sin(a)-dx)*w,q[1]+(dx*Math.sin(a)+dy*Math.cos(a)-dy)*w];
}
export function inertiaWeights(y,kind,rig){const s=rig.physics.strands[kind];if(!s)return [0,0];const t=clamp((y-s.startY)/(s.endY-s.startY));return [3*t*t*(1-t),t*t*t];}

export function layerOpacity(kind,p,rig){
 // Visibility comes from the posed foreground silhouette, not an ear fade.
 return 1;
}

// A continuous two-sided field keeps the crown, parting and jewellery fixed.
// Only the declared fringe art and its cast shadows receive this extra motion.
export function fringeWeights(x,y,groups,rig){
 const f=rig.physics.fringe;
 if(!groups.some(g=>f.groups.includes(g)))return [0,0,0,0];
 const side=smooth(f.partPinWidth,f.sideFullWidth,Math.abs(x-f.partX)),tail=1-smooth(f.fadeStartY,f.fadeEndY,y);
 const weights=[0,0,0,0],index=x<f.partX?0:1,b=inertiaWeights(y,f.channels[index],rig);
 weights[index*2]=b[0]*side*tail;weights[index*2+1]=b[1]*side*tail;return weights;
}
export function physicsAnchor(kind,rig){const s=rig.physics.strands[kind];return s.driver?.anchor||rig.surfaces[kind].anchor;}
