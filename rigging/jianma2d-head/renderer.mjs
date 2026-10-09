import { clamp, boundaryPoint, rollWeight, rollBend, poseWeights, clampPose, isHanging, evaluateRoot, inertiaWeights, fringeWeights, motionKind, validateRig, layerOpacity } from './deformer.mjs';
import { HeadPhysics } from './physics.mjs';
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
layout(location=1) in float aWeight;
${Array.from({length:9},(_,i)=>`layout(location=${i+2}) in vec2 aK${i};`).join('\n')}
layout(location=11) in float aBend;
layout(location=12) in vec2 aInertia;
layout(location=13) in vec2 aFringeR;
layout(location=14) in vec2 aFringeL;
uniform vec4 uInertia;uniform vec4 uFringeR;uniform vec4 uFringeL;
uniform float uKeys[9];uniform vec4 uView;uniform vec2 uPivot;uniform float uRoll;
uniform bool uSkin;uniform float uSkinRadius;uniform bool uHanging;uniform vec2 uRoot;
out vec2 vUV;
vec2 rotate(vec2 v,float a){float c=cos(a),s=sin(a);return vec2(v.x*c-v.y*s,v.x*s+v.y*c);}
void main(){
 vec2 p=${Array.from({length:9},(_,i)=>`aK${i}*uKeys[${i}]`).join('+')};
 if(uHanging){vec2 d=uRoot-uPivot;p+=(rotate(d,uRoll)-d)*aWeight;vec2 local=${Array.from({length:9},(_,i)=>`aK${i}*uKeys[${i}]`).join('+')}-uRoot;p+=rotate(local,uRoll*aBend)-local;}
 else{vec2 d=p-uPivot;if(uSkin)d.x=clamp(d.x,-uSkinRadius,uSkinRadius);p+= (rotate(d,uRoll)-d)*aWeight;}
 p+=aInertia.x*uInertia.xy+aInertia.y*uInertia.zw;
 p+=aFringeR.x*uFringeR.xy+aFringeR.y*uFringeR.zw+aFringeL.x*uFringeL.xy+aFringeL.y*uFringeL.zw;
 vec2 q=(p-uView.xy)/uView.zw;
 gl_Position=vec4(q.x*2.-1.,1.-q.y*2.,0.,1.);vUV=aUV;
}`;
const FRAG=`#version 300 es
precision highp float;
in vec2 vUV;uniform sampler2D uTexture;
uniform bool uMask;uniform float uOpacity;out vec4 color;
void main(){vec4 t=texture(uTexture,vUV);if(uMask&&t.a*uOpacity<.15)discard;color=t*uOpacity;}`;
function shader(gl,kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const hairKinds=new Set(['rearL','rearR','sideL','sideR','ribbonL','ribbonR','fringe','bun','crown','halo','ornamentL','ornamentR','forehead','earringL','earringR']);
export function orderedLayers(meshes,rig){
 const o=rig.occlusion,behind=meshes.filter(m=>m.layer.groups.some(g=>o.behindFaceGroups.includes(g)));
 const ordered=meshes.filter(m=>!behind.includes(m)),index=ordered.findIndex(m=>m.layer.kind===o.faceKind);
 if(behind.length){if(index<0)throw Error('Head occlusion owner is absent');ordered.splice(index,0,...behind);}
 return ordered;
}
/** Every layer samples the same source-space lattice and diagonal. Shared
 * continuous fields must also share tessellation, or their raster edges split. */
export function meshGeometry(layer,rig){
 const [x,y,w,h]=layer.box,kind=motionKind(layer.kind,rig);
 const facial=rig.features[kind]||['face','faceBare','faceDetail','faceShadow','earL','earR'].includes(kind);
 const step=facial?(rig.preview.faceMeshStep||rig.preview.meshStep):rig.preview.meshStep;
 const [ox,oy]=rig.projections[layer.kind]?.sourceOffset||[0,0];
 const left=Math.floor((x-ox)/step)*step+ox,top=Math.floor((y-oy)/step)*step+oy;
 const nx=Math.ceil((x+w-left)/step),ny=Math.ceil((y+h-top)/step),stride=28;
 const data=new Float32Array((nx+1)*(ny+1)*stride);
 for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
  const px=left+i*step,py=top+j*step,k=(j*(nx+1)+i)*stride;
  data[k]=(px-x)/w;data[k+1]=(py-y)/h;data[k+2]=rollWeight(px,py,kind,rig);data[k+21]=rollBend(px,py,kind,rig);data.set(inertiaWeights(py,kind,rig),k+22);data.set(fringeWeights(px,py,layer.groups,rig),k+24);
  rig.keyCoordinates.forEach(([kx,ky],n)=>data.set(boundaryPoint(px,py,layer.kind,kx,ky,rig),k+3+n*2));
 }
 if((nx+1)*(ny+1)>65535)throw Error('Head mesh exceeds index budget: '+layer.file);
 const indices=new Uint16Array(nx*ny*6);let k=0;
 for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;indices.set([a,b,c,b,d,c],k);k+=6;}
 return {data,indices,stride,nx,ny,left,top,step};
}
export class Renderer {
 constructor(canvas,rig,layers){validateRig(rig);this.canvas=canvas;this.rig=rig;this.layers=layers;this.meshes=[];this.view=rig.preview.viewBox.slice();this.hiddenHair=false;this.physics=new HeadPhysics(rig);}
 async init(overrides={}){
  const gl=this.canvas.getContext('webgl2',{alpha:false,antialias:true,stencil:true,preserveDrawingBuffer:false});
  if(!gl)throw new Error('此例需要 WebGL 2。请开启浏览器硬件加速后重试。');this.gl=gl;
  const vs=shader(gl,gl.VERTEX_SHADER,VERT),fs=shader(gl,gl.FRAGMENT_SHADER,FRAG),program=gl.createProgram();
  gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
  this.program=program;gl.useProgram(program);this.uniforms=Object.fromEntries(['uInertia','uFringeR','uFringeL','uSkin','uSkinRadius','uKeys','uView','uPivot','uRoll','uTexture','uHanging','uRoot','uMask','uOpacity'].map(n=>[n,gl.getUniformLocation(program,n)]));
  const images=await Promise.all(this.layers.map(l=>overrides[l.file]||new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('无法加载 '+l.file));im.src=new URL(l.file,import.meta.url).href;})));
  this.meshes=this.layers.map((layer,i)=>this.createMesh(layer,images[i]));
  gl.enable(gl.BLEND);gl.disable(gl.DEPTH_TEST);gl.uniform1i(this.uniforms.uTexture,0);gl.uniform2fv(this.uniforms.uPivot,this.rig.head.neckPivot);
 }
 createMesh(layer,image){
  const gl=this.gl,{data,indices,stride}=meshGeometry(layer,this.rig);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  for(let n=0;n<15;n++){const size=n===1||n===11?1:2,off=n===0?0:n===1?2:n===11?21:n>=12?22+(n-12)*2:3+(n-2)*2;gl.enableVertexAttribArray(n);gl.vertexAttribPointer(n,size,gl.FLOAT,false,stride*4,off*4);}
  const indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return {vao,buffer,indexBuffer,texture,count:indices.length,layer,width:image.width,height:image.height};
 }
 /** The expression evaluator paints only changed facial layers in source space.
  * Their boxes/meshes stay fixed across all keyforms; head motion stays on GPU. */
 updateTextures(sources){
  const gl=this.gl;if(!gl||gl.isContextLost())return;
  const updates=Object.entries(sources).map(([file,image])=>{
   const mesh=this.meshes.find(m=>m.layer.file===file);
   if(!mesh||mesh.width!==image.width||mesh.height!==image.height)throw Error('Expression texture bounds changed: '+file);
   return {mesh,image};
  });
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  for(const {mesh,image} of updates){gl.bindTexture(gl.TEXTURE_2D,mesh.texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,image);}
 }
 resize(faceOnly=false){
  const c=this.canvas,dpr=Math.min(devicePixelRatio||1,2),r=c.getBoundingClientRect();
  c.width=Math.max(1,Math.round(r.width*dpr));c.height=Math.max(1,Math.round(r.height*dpr));
  let [x,y,w,h]=faceOnly?this.rig.preview.closeup:this.rig.preview.viewBox;
  const aspect=c.width/c.height;if(w/h<aspect){const next=h*aspect;x-=(next-w)/2;w=next;}else{const next=w/aspect;y-=faceOnly?(next-h)/2:(next-h);h=next;}
  this.view=[x,y,w,h];
 }
 drawMesh(m,p,{mask=false}={}) {
  const gl=this.gl,u=this.uniforms,kind=motionKind(m.layer.kind,this.rig),hanging=isHanging(kind,this.rig);
  gl.uniform1i(u.uSkin,kind==='skin'?1:0);gl.uniform1f(u.uSkinRadius,this.rig.neck.rollRadius);gl.uniform1i(u.uHanging,hanging?1:0);if(hanging)gl.uniform2fv(u.uRoot,evaluateRoot(kind,p,this.rig));
  gl.uniform4fv(u.uInertia,this.physics.outputs[kind]||[0,0,0,0]);
  gl.uniform1i(u.uMask,mask?1:0);gl.uniform1f(u.uOpacity,layerOpacity(m.layer.kind,p,this.rig));
  gl.blendFunc(m.layer.blend==='multiply'?gl.DST_COLOR:gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(m.vao);gl.bindTexture(gl.TEXTURE_2D,m.texture);gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,0);
 }
 draw(p){
  const gl=this.gl;if(!gl||gl.isContextLost())return;
  p=clampPose(p,this.rig);
  gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.stencilMask(255);gl.disable(gl.STENCIL_TEST);gl.clearColor(.918,.902,.875,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.STENCIL_BUFFER_BIT);gl.useProgram(this.program);
  gl.uniform1fv(this.uniforms.uKeys,poseWeights(p,this.rig));gl.uniform1f(this.uniforms.uRoll,clamp(p.z,-20,20)*Math.PI/180);gl.uniform4fv(this.uniforms.uView,this.view);
  gl.uniform4fv(this.uniforms.uFringeR,this.physics.outputs[this.rig.physics.fringe.channels[0]]);gl.uniform4fv(this.uniforms.uFringeL,this.physics.outputs[this.rig.physics.fringe.channels[1]]);
  // Four independent live receiver masks. No projected shadow carries a baked
  // face/ear/neck silhouette; it follows the caster, then intersects this mask.
  const bits={face:1,earR:2,earL:4,skin:8};
  gl.enable(gl.STENCIL_TEST);gl.colorMask(false,false,false,false);
  for(const [kind,bit] of Object.entries(bits)){
   gl.stencilMask(bit);gl.stencilFunc(gl.ALWAYS,bit,bit);gl.stencilOp(gl.KEEP,gl.KEEP,gl.REPLACE);
   for(const m of this.meshes)if(m.layer.kind===kind)this.drawMesh(m,p,{mask:true});
  }
  gl.colorMask(true,true,true,true);gl.stencilMask(0);gl.stencilOp(gl.KEEP,gl.KEEP,gl.KEEP);
  // Side hair volume and ear pendants lie behind the facial plane. The long
  // front locks remain in front of both. Moving silhouettes determine coverage;
  // no draw-order flip at X=0, horizontal strand cut or face-shaped pendant hole.
  if(this.orderSource!==this.meshes){this.order=orderedLayers(this.meshes,this.rig);this.orderSource=this.meshes;}
  const ordered=this.order;
  for(const m of ordered){
   const kind=m.layer.kind,projection=this.rig.projections[kind];
   if(this.hiddenHair&&(hairKinds.has(kind)||projection&&projection.caster!=='face'))continue;
   let bit=projection?bits[projection.receiver]:0,inside=true;
   if(kind==='faceDetail'||this.rig.features[kind])bit=bits.face;
   if(bit){gl.enable(gl.STENCIL_TEST);gl.stencilFunc(gl.EQUAL,inside?bit:0,bit);}else gl.disable(gl.STENCIL_TEST);
   this.drawMesh(m,p);
  }
  gl.disable(gl.STENCIL_TEST);gl.bindVertexArray(null);
 }
 advance(p,dt){return this.physics.advance(clampPose(p,this.rig),dt);}
 resetPhysics(p){this.physics.reset(clampPose(p,this.rig));}
 setPhysics(value,p){this.physics.enabled=value;this.resetPhysics(p);}
 destroy(){const gl=this.gl;if(!gl)return;for(const m of this.meshes){gl.deleteTexture(m.texture);gl.deleteBuffer(m.buffer);gl.deleteBuffer(m.indexBuffer);gl.deleteVertexArray(m.vao);}gl.deleteProgram(this.program);this.meshes=[];}
}
