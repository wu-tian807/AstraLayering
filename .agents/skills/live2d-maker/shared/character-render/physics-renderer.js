import * as THREE from 'three';
import { projectionField } from './projection-field.js';
import { projectionDepth } from './lighting-model.js';
import { surfaceDistanceMaterial } from './surface-shadow.js';
import { surfaceLightingMaps } from './surface-lighting.js';
const raster = (data, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0); return c; };
const pixels = c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
function tex(data, w, h, color = false) {
  const t = new THREE.DataTexture(new Uint8Array(data), w, h); t.flipY = true;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
function colorTex(data,w,h){
  // Premultiply before filtering, retaining fractional channel values rather
  // than quantizing them back to 8 bits. Source PNGs stay unchanged.
  const values=new Uint16Array(data.length);
  for(let q=0;q<data.length;q+=4){const a=data[q+3]/255;for(let k=0;k<3;k++)values[q+k]=THREE.DataUtils.toHalfFloat(data[q+k]/255*a);values[q+3]=THREE.DataUtils.toHalfFloat(a);}
  const t=new THREE.DataTexture(values,w,h,THREE.RGBAFormat,THREE.HalfFloatType);t.flipY=true;t.minFilter=t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
function surfaceTexture(layer){
  const {width:w,height:h}=layer.bounds,raw=new Uint8Array(layer.map.data.length);
  for(let q=0;q<raw.length;q+=4)raw[q]=layer.map.data[q+3];
  const heights=projectionDepth(raw,layer.maskedRgba,w,h),half=new Uint16Array(heights.length);
  for(let i=0;i<heights.length;i++)half[i]=THREE.DataUtils.toHalfFloat(heights[i]);
  const t=new THREE.DataTexture(half,w,h,THREE.RedFormat,THREE.HalfFloatType);t.flipY=true;t.minFilter=t.magFilter=THREE.LinearFilter;t.needsUpdate=true;return t;
}
const vertex = `varying vec2 sourceUV; varying vec2 restPixel; varying vec2 currentPixel; varying vec2 displacement;
attribute vec2 rest;
void main(){sourceUV=uv;restPixel=rest;currentPixel=position.xy;displacement=position.xy-rest;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const fragment = `uniform sampler2D colorMap; uniform sampler2D dataMap;
uniform sampler2D surfaceMap;
uniform int pass; uniform float strength; uniform float normalY;
uniform vec4 sourceBounds; uniform vec2 canvasOrigin;
varying vec2 displacement;
void main(){
 // Interpolate the small deformation residual, not large source coordinates.
 // Thin triangles otherwise lose several texels of precision even at rest.
 vec2 currentPixel=vec2(gl_FragCoord.x+canvasOrigin.x,canvasOrigin.y-gl_FragCoord.y);
 vec2 restPixel=currentPixel-displacement;
 vec2 sourceUV=(restPixel-sourceBounds.xy)/sourceBounds.zw;sourceUV.y=1.0-sourceUV.y;
 if(any(lessThan(sourceUV,vec2(0.0)))||any(greaterThan(sourceUV,vec2(1.0))))discard;
 vec4 color=texture2D(colorMap,sourceUV);float alpha=color.a;if(alpha<0.001)discard;
 vec4 m=texture2D(dataMap,sourceUV);vec3 rgb=color.rgb/max(alpha,0.000001);
 if(pass==1){
  vec3 n=vec3((m.xy*2.0-1.0)*strength,m.z*2.0-1.0);n.y*=normalY;n.z=max(n.z,0.005);
  vec2 a=dFdx(restPixel),b=dFdy(restPixel),c=dFdx(currentPixel),d=dFdy(currentPixel);
  float det=a.x*b.y-a.y*b.x;
  if(abs(det)>0.000001){
   float j00=(c.x*b.y-d.x*a.y)/det,j01=(-c.x*b.x+d.x*a.x)/det;
   float j10=(c.y*b.y-d.y*a.y)/det,j11=(-c.y*b.x+d.y*a.x)/det;
   float jd=j00*j11-j01*j10;
   if(jd>0.000001){vec2 g=vec2(n.x,-n.y);g=vec2(j11*g.x-j10*g.y,-j01*g.x+j00*g.y)/jd;n.xy=vec2(g.x,-g.y);}
  }
  rgb=normalize(n)*0.5+0.5;
 }
 if(pass==2)rgb=vec3(m.a,m.a,texture2D(surfaceMap,sourceUV).r);
 gl_FragColor=vec4(rgb*alpha,alpha);
}`;
// Cache consecutive static layers, preserving their exact place between moving
// pieces. Only the moving meshes and cached strata are drawn each frame.
function staticPiece(layers) {
  if (layers.length === 1) return layers[0];
  let x = Infinity, y = Infinity, right = 0, bottom = 0;
  for (const l of layers) { x = Math.min(x, l.bounds.x); y = Math.min(y, l.bounds.y); right = Math.max(right, l.bounds.x + l.bounds.width); bottom = Math.max(bottom, l.bounds.y + l.bounds.height); }
  const w = right - x, h = bottom - y, canvases = Array.from({ length: 3 }, () => raster(new Uint8ClampedArray(w * h * 4), w, h));
  for (const l of layers) {
    const n = new Uint8ClampedArray(l.rgba.length), d = new Uint8ClampedArray(n.length), color = new Uint8ClampedArray(l.rgba);
    for (let q = 0; q < n.length; q += 4) { const m = l.map.data; color[q + 3] = n[q + 3] = d[q + 3] = l.maskedRgba[q + 3]; n.set(m.subarray(q, q + 3), q); d[q] = d[q + 1] = d[q + 2] = m[q + 3]; }
    for (const [i, bytes] of [color, n, d].entries()) canvases[i].getContext('2d').drawImage(raster(bytes, l.bounds.width, l.bounds.height), l.bounds.x - x, l.bounds.y - y);
  }
  const rgba = pixels(canvases[0]), normal = pixels(canvases[1]), depth = pixels(canvases[2]), data = new Uint8Array(rgba.length);
  for (let q = 0; q < data.length; q += 4) { data.set(normal.subarray(q, q + 3), q); data[q + 3] = depth[q]; }
  return { bounds: { x, y, width: w, height: h }, rgba, maskedRgba: rgba, map: { data } };
}
export class PhysicsRenderer {
  constructor(stage, layers, bodies, size,poseSource) {
    this.stage = stage; this.bodies = bodies; this.size = size; this.poseSource=poseSource;this.items = []; this.groups=[]; this.dirty = true;
    const [w, h] = size;
    stage.setLightingFields(surfaceLightingMaps(w,h,layers,new Map(layers.map(l=>[l.id,l.map])),stage.source.n,stage.source.d));
    this.padding=poseSource?Math.ceil(Math.max(0,...[...bodies.values()].map(b=>b.maxDistance+b.freeLength*.05))+Math.hypot(w,h)*.04)+2:0;
    const pad=this.padding,ow=w+pad*2,oh=h+pad*2;this.outputSize=[ow,oh];
    if (Math.max(ow, oh) > stage.renderer.capabilities.maxTextureSize) throw Error('含运动余量的贴图超出 GPU 上限，未降低精度');
    this.scene = new THREE.Scene(); this.camera = new THREE.OrthographicCamera(-pad, w+pad, -pad, h+pad, .1, 10); this.camera.position.z = 1;
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
    this.scratch = new THREE.WebGLRenderTarget(ow, oh, {...opts,stencilBuffer:true});
    this.targets = Array.from({ length: 3 }, () => new THREE.WebGLRenderTarget(ow, oh, opts));
    this.surfaceTarget=new THREE.WebGLRenderTarget(ow,oh,{...opts,format:THREE.RedFormat});
    this.targets[0].texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.resolveScene = new THREE.Scene(); this.resolveCamera = new THREE.Camera();
    this.resolveMaterial = new THREE.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { source: { value: this.scratch.texture }, pass: { value: 0 } },
      vertexShader: 'varying vec2 coord;void main(){coord=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: 'uniform sampler2D source;uniform int pass;varying vec2 coord;void main(){vec4 c=texture2D(source,coord);vec3 rgb=c.a>0.00001?c.rgb/c.a:vec3(0.0);if(pass==0)rgb=mix(rgb/12.92,pow((rgb+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),rgb));if(pass==2)rgb=vec3(rgb.r);if(pass==3)rgb=vec3(rgb.b);gl_FragColor=vec4(rgb,c.a);}' });
    this.resolveQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.resolveMaterial); this.resolveScene.add(this.resolveQuad);
    let pending = [];
    const parentBody=l=>{if(!poseSource)return;const b=l.bounds,rest=new Float64Array([b.x,b.y,b.x+b.width,b.y,b.x,b.y+b.height,b.x+b.width,b.y+b.height]),positions=new Float64Array(rest);return {rest,positions,update(){for(let i=0;i<rest.length/2;i++)positions.set(poseSource.sourcePoint([rest[i*2],rest[i*2+1]]),i*2);}};};
    const flush = () => { if (pending.length) {const l=staticPiece(pending);this.add(l,parentBody(l)); pending = []; } };
    const byUuid=new Map();for(const l of layers){const b=bodies.get(l.id);if(b)for(const uuid of [l.uuid,...(l.sourceLayerUuids||[])])byUuid.set(uuid,b);}
    for (const l of layers) { if(l.projection&&(bodies.has(l.id)||l.projection.shadows.some(s=>s.casterLayerUuids.some(id=>byUuid.has(id))))){flush();this.addProjection(l,bodies.get(l.id)||parentBody(l),byUuid,opts);}else if (bodies.has(l.id)) { flush(); this.add(l, bodies.get(l.id)); } else pending.push(l); } flush();
    this.saved = { color: stage.color, normal: stage.normal, lightingNormal:stage.lightingNormal, depth: stage.depth, surface: stage.depthUniforms.studioDepth.value,
      geometry: stage.mesh.geometry, caster: stage.caster.geometry, distance: stage.caster.customDistanceMaterial,size:stage.depthUniforms.studioSize.value.clone() };
    this.displayGeometry = new THREE.PlaneGeometry(2 * ow / h, 2*oh/h);
    this.casterGeometry = new THREE.PlaneGeometry(2 * ow / h, 2*oh/h, Math.round(256 * ow / oh), 256);
    const uniforms = { movingDepth: { value: this.surfaceTarget.texture }, movingScale: { value: stage.settings.depthScale } };
    this.distance=surfaceDistanceMaterial(this.targets[0].texture,uniforms.movingDepth,uniforms.movingScale,true);this.distanceUniforms = uniforms;
    this.baseNormalKey = `${stage.settings.normalStrength}/${stage.settings.normalY}`; this.baseDepthScale = stage.settings.depthScale;
    stage.deformation = this; stage.setMode(stage.mode);
  }
  bindOutputs(neutral) {
    if(this.usingBaseline===neutral)return;
    const stage=this.stage,saved=this.saved;
    stage.color=neutral?saved.color:this.targets[0].texture;
    stage.normal=neutral?saved.normal:this.targets[1].texture;
    stage.depth=neutral?saved.depth:this.targets[2].texture;
    stage.depthUniforms.studioDepth.value=neutral?saved.surface:this.surfaceTarget.texture;
    stage.depthUniforms.studioSize.value.copy(neutral?saved.size:new THREE.Vector2(2*this.outputSize[0]/this.size[1],2*this.outputSize[1]/this.size[1]));
    stage.mesh.geometry=neutral?saved.geometry:this.displayGeometry;
    stage.caster.geometry=neutral?saved.caster:this.casterGeometry;
    stage.caster.customDistanceMaterial=neutral?saved.distance:this.distance;
    stage.material.map=stage.material.shadeMultiplyTexture=stage.color;stage.material.normalMap=neutral?(saved.lightingNormal||saved.normal):stage.normal;
    stage.casterMaterial.map=stage.color;
    stage.basic.map=stage.mode==='normal'?stage.normal:stage.mode==='depth'?stage.depth:stage.color;
    stage.basic.needsUpdate=stage.casterMaterial.needsUpdate=stage.material.needsUpdate=true;
    stage.renderer.shadowMap.needsUpdate=true;
    this.usingBaseline=neutral;
  }
  add(l, body) {
    const b = l.bounds, rest = body?.rest || new Float64Array([b.x, b.y, b.x + b.width, b.y, b.x, b.y + b.height, b.x + b.width, b.y + b.height]);
    const g = new THREE.BufferGeometry(), pos = new Float32Array(rest.length / 2 * 3), uv = new Float32Array(rest.length);
    for (let i = 0; i < rest.length / 2; i++) { pos[i * 3] = rest[i * 2]; pos[i * 3 + 1] = rest[i * 2 + 1]; uv[i * 2] = (rest[i * 2] - b.x) / b.width; uv[i * 2 + 1] = 1 - (rest[i * 2 + 1] - b.y) / b.height; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(rest), 2)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(body?.indices || new Uint32Array([0, 1, 2, 1, 3, 2]), 1));
    const color = new Uint8ClampedArray(l.rgba); for (let q = 3; q < color.length; q += 4) color[q] = l.maskedRgba[q];
    // Composite in source sRGB, matching Krita/Canvas alpha blending. Decode
    // once in the resolve pass before handing the texture to MToon.
    const c = colorTex(color, b.width, b.height), m = tex(l.map.data, b.width, b.height),surface=surfaceTexture(l);
    const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment,
      transparent: true, premultipliedAlpha: true, side: THREE.DoubleSide, depthTest: false, depthWrite: false,
      stencilWrite:true,stencilRef:1,stencilFunc:THREE.NotEqualStencilFunc,stencilZPass:THREE.ReplaceStencilOp,
      uniforms: { colorMap: { value: c }, dataMap: { value: m },surfaceMap:{value:surface}, pass: { value: 0 }, strength: { value: 1 }, normalY: { value: 1 }, sourceBounds:{value:new THREE.Vector4(b.x,b.y,b.width,b.height)},canvasOrigin:{value:new THREE.Vector2(-this.padding,this.size[1]+this.padding)} } });
    const mesh = new THREE.Mesh(g, material); mesh.frustumCulled = false; mesh.renderOrder = this.items.length;
    // Artwork opacity applies once per source layer. GPU subpixel rounding at
    // very thin shared edges must not blend the same translucent texel twice.
    mesh.onBeforeRender=renderer=>renderer.clearStencil();
    this.scene.add(mesh); this.items.push({ mesh, body, c, m,surface });
    return this.items.at(-1);
  }
  addProjection(l,body,byUuid,opts){
    const [w,h]=this.outputSize,pad=this.padding,scene=new THREE.Scene(),target=new THREE.WebGLRenderTarget(w,h,{...opts,stencilBuffer:true}),clip=new THREE.WebGLRenderTarget(w,h,{...opts,stencilBuffer:true});
    const base=this.add({...l,rgba:l.projection.rgba,maskedRgba:l.projection.rgba},body);this.scene.remove(base.mesh);scene.add(base.mesh);
    const shadows=[];
    for(const s of l.projection.shadows){
      const casters=[...new Set(s.casterLayerUuids.map(id=>byUuid.get(id)).filter(Boolean))];if(casters.length>1)throw Error('投影源包含不同运动场：'+s.id);
      const field=projectionField(s.bounds,casters[0],this.poseSource),item=this.add({...s,maskedRgba:s.rgba,map:{data:new Uint8Array(s.rgba.length)}},field);
      this.scene.remove(item.mesh);scene.add(item.mesh);item.mesh.renderOrder=shadows.length+1;
      item.mesh.material.dispose();item.mesh.material=new THREE.ShaderMaterial({vertexShader:vertex,
        fragmentShader:`uniform sampler2D colorMap;uniform sampler2D clipMap;uniform vec2 canvasSize;uniform float padding;uniform int multiply;varying vec2 sourceUV;varying vec2 currentPixel;
        void main(){vec4 c=texture2D(colorMap,sourceUV);float a=texture2D(clipMap,vec2((currentPixel.x+padding)/canvasSize.x,1.0-(currentPixel.y+padding)/canvasSize.y)).a;if(c.a<.001||a<.001)discard;gl_FragColor=vec4(c.rgb*(multiply==1?1.0:a),c.a);}`,
        uniforms:{colorMap:{value:item.c},clipMap:{value:clip.texture},canvasSize:{value:new THREE.Vector2(w,h)},padding:{value:pad},multiply:{value:s.blendMode==='multiply'?1:0}},
        transparent:true,premultipliedAlpha:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false,blending:THREE.CustomBlending,
        blendSrc:s.blendMode==='multiply'?THREE.DstColorFactor:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquation:THREE.AddEquation,
        blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,blendEquationAlpha:THREE.AddEquation});
      shadows.push(item);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array([-pad,-pad,0,w-pad,-pad,0,-pad,h-pad,0,w-pad,h-pad,0]),3));geometry.setAttribute('uv',new THREE.BufferAttribute(new Float32Array([0,1,1,1,0,0,1,0]),2));geometry.setIndex([0,1,2,1,3,2]);
    const material=new THREE.ShaderMaterial({vertexShader:'varying vec2 sourceUV;void main(){sourceUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform sampler2D source;varying vec2 sourceUV;void main(){gl_FragColor=texture2D(source,sourceUV);}',uniforms:{source:{value:target.texture}},transparent:true,premultipliedAlpha:true,side:THREE.DoubleSide,depthTest:false,depthWrite:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.renderOrder=this.items.length;this.scene.add(mesh);this.items.push({mesh});
    this.groups.push({scene,target,clip,base,shadows,mesh,opacity:l.opacity/255});
  }
  update() {
    for (const { mesh, body } of this.items) if (body) { body.update?.();const p = mesh.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) { p.array[i * 3] = body.positions[i * 2]; p.array[i * 3 + 1] = body.positions[i * 2 + 1]; } p.needsUpdate = true; }
    this.dirty = true;
  }
  verifyNeutral(reference){
    this.update();this.compose(true);const[w,h]=this.size,[ow,oh]=this.outputSize,pad=this.padding,values=new Uint16Array(ow*oh*4);this.stage.renderer.readRenderTargetPixels(this.targets[0],0,0,ow,oh,values);
    let alphaError=0,rgbError=0,count=0,alphaPoint=null;const srgb=v=>v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const q=(y*w+x)*4,p=((oh-1-y-pad)*ow+x+pad)*4,a=THREE.DataUtils.fromHalfFloat(values[p+3])*255,error=Math.abs(a-reference[q+3]);if(error>alphaError){alphaError=error;alphaPoint={x,y,expected:reference[q+3],actual:a};}if(reference[q+3]>40){for(let c=0;c<3;c++)rgbError+=Math.abs(srgb(THREE.DataUtils.fromHalfFloat(values[p+c]))*255-reference[q+c]);count+=3;}}
    this.dirty=true;this.compose();const result={alphaError,rgbMeanError:rgbError/Math.max(1,count),alphaPoint};
    if(alphaError>3||result.rgbMeanError>1)throw Error('动态合成与原生中性画面不等价：'+JSON.stringify(result));return result;
  }
  compose(force=false) {
    const stage = this.stage, s = stage.settings, key = `${s.normalStrength}/${s.normalY}`;
    const neutral=!force&&!Object.values(this.poseSource?.sourcePose||{}).some(v=>Math.abs(v)>.00001)&&[...this.bodies.values()].every(b=>b.positions.every((v,i)=>Math.abs(v-b.rest[i])<.015));
    this.bindOutputs(neutral);
    // Rest and reset use the original textures and original filtered relief.
    // Preparing physics therefore preserves the exact neutral rendering and
    // does not incur an unnecessary full-frame composition.
    if(neutral){
      stage.deformation=null;
      try{if(this.baseNormalKey!==key){stage.updateNormal();this.baseNormalKey=key;}
        if(this.baseDepthScale!==s.depthScale){stage.updateRelief();this.baseDepthScale=s.depthScale;}}
      finally{stage.deformation=this;}
      return;
    }
    this.distanceUniforms.movingScale.value = s.depthScale;
    if (!this.dirty && this.settingsKey === key) return;
    this.settingsKey = key;
    const renderer = stage.renderer, target = renderer.getRenderTarget(), clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha(), scissor = renderer.getScissorTest();
    renderer.setScissorTest(false);
    try {
      for (let pass = 0; pass < 3; pass++) {
        this.resolveMaterial.uniforms.pass.value = pass;
        for (const { mesh } of this.items) { const u = mesh.material.uniforms; if(u.pass){u.pass.value = pass; u.strength.value = s.normalStrength; u.normalY.value = s.normalY;} }
        for(const g of this.groups){
          g.mesh.visible=pass===0;
          if(pass!==0){this.scene.add(g.base.mesh);g.base.mesh.renderOrder=g.mesh.renderOrder;continue;}
          g.scene.add(g.base.mesh);g.base.mesh.renderOrder=0;
          for(const i of g.shadows)i.mesh.visible=false;
          renderer.setRenderTarget(g.clip);renderer.setClearColor(0,0);renderer.clear();renderer.render(g.scene,this.camera);
          for(const i of g.shadows)i.mesh.visible=pass===0;
          renderer.setRenderTarget(g.target);renderer.setClearColor(0,0);renderer.clear();renderer.render(g.scene,this.camera);
        }
        renderer.setRenderTarget(this.scratch);
        renderer.setClearColor(pass === 0 ? new THREE.Color(0, 0, 0) : pass === 1 ? new THREE.Color(.5, .5, 1) : new THREE.Color(.5, .5, .5), pass === 0 ? 0 : 1);
        renderer.clear(); renderer.render(this.scene, this.camera);
        renderer.setRenderTarget(this.targets[pass]); renderer.setClearColor(0, 0); renderer.clear(); renderer.render(this.resolveScene, this.resolveCamera);
        if(pass===2){this.resolveMaterial.uniforms.pass.value=3;renderer.setRenderTarget(this.surfaceTarget);renderer.clear();renderer.render(this.resolveScene,this.resolveCamera);}
      }
    } finally {for(const g of this.groups){g.scene.add(g.base.mesh);g.base.mesh.renderOrder=0;g.mesh.visible=true;}renderer.setRenderTarget(target); renderer.setClearColor(clear, alpha); renderer.setScissorTest(scissor); }
    this.dirty = false; stage.renderer.shadowMap.needsUpdate = true;
  }
  dispose() {
    const stage = this.stage, saved = this.saved;
    if (stage.deformation === this) {
      stage.deformation = null;
      Object.assign(stage, { color: saved.color, normal: saved.normal, depth: saved.depth });
      stage.mesh.geometry = saved.geometry; stage.caster.geometry = saved.caster; stage.caster.customDistanceMaterial = saved.distance;
      stage.depthUniforms.studioDepth.value = saved.surface;
      stage.depthUniforms.studioSize.value.copy(saved.size);
      stage.material.map = stage.material.shadeMultiplyTexture = saved.color; stage.material.normalMap = saved.lightingNormal||saved.normal;
      stage.casterMaterial.map = saved.color; stage.casterMaterial.needsUpdate = stage.material.needsUpdate = true;
      stage.updateNormal(); stage.updateRelief(); stage.setMode(stage.mode);
    }
    this.scratch.dispose();this.surfaceTarget.dispose(); for (const t of this.targets) t.dispose();
    for(const g of this.groups){g.target.dispose();g.clip.dispose();}
    this.displayGeometry.dispose(); this.casterGeometry.dispose();
    for (const i of this.items) { i.mesh.geometry.dispose(); i.mesh.material.dispose(); i.c?.dispose(); i.m?.dispose();i.surface?.dispose(); }
    this.resolveQuad.geometry.dispose(); this.resolveMaterial.dispose(); this.distance.dispose();
  }
}
