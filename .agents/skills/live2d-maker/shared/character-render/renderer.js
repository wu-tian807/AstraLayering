import * as THREE from "three";
import { MToonMaterial } from "@pixiv/three-vrm-materials-mtoon";
import { defaults, reliefGrid, projectionDepth } from "./lighting-model.js";
import { surfaceDistanceMaterial, smoothPointShadowGLSL } from './surface-shadow.js';

function pixels(image) {
  const c = document.createElement("canvas");
  c.width = image.width;
  c.height = image.height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height).data;
}
function texture(bytes, w, h, color = false) {
  const t = new THREE.DataTexture(bytes, w, h, THREE.RGBAFormat);
  t.flipY = true;
  t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
export async function loadImage(url) {
  const i = new Image();
  i.decoding = "async";
  i.src = url;
  await i.decode();
  return i;
}
export class LightingStage {
  constructor(canvas) {
    this.canvas = canvas;
    this.settings = { ...defaults };
    this.mode = "lit";
    this.lightingEnabled = true;
    this.zoom = 1;
    this.pan = [0, 0];
    this.disposed = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20);
    this.camera.position.z = 6;
    this.ambient = new THREE.AmbientLight(0xffffff, Math.PI * 0.16);
    this.scene.add(this.ambient);
    // Finite position with illustration-style exposure: depth changes incident
    // direction and occlusion, while decay=0 keeps lit albedo from blowing out.
    this.light = new THREE.PointLight(0xffffff, Math.PI * 0.84, 0, 0);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    this.light.shadow.radius = 3;
    Object.assign(this.light.shadow.camera, { near: 0.01, far: 24 });
    this.light.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.light);
    this.material = new MToonMaterial({
      map: null,
      normalMapType: THREE.ObjectSpaceNormalMap,
      shadeColorFactor: new THREE.Color(defaults.shade),
      shadingToonyFactor: defaults.toony,
      shadingShiftFactor: defaults.shift,
      giEqualizationFactor: 1,
      alphaTest: 0.01,
      transparent: true,
      side: THREE.FrontSide,
    });
    this.material.toneMapped = false;
    this.material.outlineWidthMode = "none";
    // Reconstruct per-pixel surface position for BOTH point light and shadows.
    // MToon's BRDF and Three's PCF shadow comparison remain upstream code;
    // only the visibility is filtered, with neighbours on other surfaces rejected.
    // Interpolating depth across a hand/face edge creates false striped shadows.
    this.depthUniforms = {
      studioDepth: { value: null },
      studioDepthScale: { value: defaults.depthScale },
      studioLightingMix: { value: defaults.lightingMix },
      studioSize: { value: new THREE.Vector2(1, 2) },
      studioShadowMatrix: { value: new THREE.Matrix4() },
      studioModelView: { value: new THREE.Matrix4() },
    };
    const upstreamCompile = this.material.onBeforeCompile.bind(this.material);
    const upstreamProgramKey = this.material.customProgramCacheKey.bind(this.material);
    this.material.onBeforeCompile = (shader, renderer) => {
      upstreamCompile(shader, renderer);
      if (
        !shader.fragmentShader.includes("vPointShadowCoord[ i ]") ||
        !shader.fragmentShader.includes('gl_FragColor = vec4( col, diffuseColor.a );') ||
        !shader.fragmentShader.includes(
          "vec3 geometryPosition = - vViewPosition;",
        )
      )
        throw new Error(
          "MToon shadow adapter needs review for this library version",
        );
      Object.assign(shader.uniforms, this.depthUniforms);
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <shadowmap_pars_fragment>",
          `#include <shadowmap_pars_fragment>
uniform sampler2D studioDepth;
uniform float studioDepthScale;
uniform float studioLightingMix;
uniform vec2 studioSize;
uniform mat4 studioShadowMatrix;
uniform mat4 studioModelView;
vec3 studioPosition() {
 vec2 xy=(vUv-0.5)*studioSize;
 float z=(textureLod(studioDepth,vUv,0.0).r-0.5)*studioDepthScale;
 return vec3(xy,z);
}
vec4 studioShadowCoord() {
 vec3 p=studioPosition();
 vec3 n=normalize(cross(dFdx(p),dFdy(p)));
 if(n.z<0.0)n=-n;
 // Native-style geometric normal bias, evaluated at the actual receiver.
 return studioShadowMatrix*vec4(p+n*0.012,1.0);
}
${smoothPointShadowGLSL}`,
        )
        .replaceAll('getPointShadow( pointShadowMap[ i ],','studioSmoothPointShadow( pointShadowMap[ i ],')
        .replace('shading = linearstep( -1.0 + shadingToonyFactor, 1.0 - shadingToonyFactor, shading );',
          'float studioRampWidth=max(1.0-shadingToonyFactor,fwidth(shading));\n  shading=smoothstep(-studioRampWidth,studioRampWidth,shading);')
        .replaceAll("vPointShadowCoord[ i ]", "studioShadowCoord()")
        .replace(
          "vec3 geometryPosition = - vViewPosition;",
          "vec3 geometryPosition = (studioModelView * vec4(studioPosition(),1.0)).xyz;",
        )
        .replaceAll(
          'gl_FragColor = vec4( col, diffuseColor.a );',
          // Blend before output encoding; alpha and diagnostics stay unchanged.
          `#ifndef DEBUG_LITSHADERATE
 col = mix(diffuseColor.rgb, col, studioLightingMix);
#endif
 gl_FragColor = vec4( col, diffuseColor.a );`,
        );
    };
    // MToon includes the debug mode and generated defines in its program key.
    // A constant key silently reuses the beauty shader in diagnostic modes.
    this.material.customProgramCacheKey = () => upstreamProgramKey() + "|astra-mtoon-point-receiver-v4";
    this.basic = new THREE.MeshBasicMaterial({
      transparent: true,
      alphaTest: 0.01,
      toneMapped: false,
    });
    // A dedicated cut caster uses Three's standard depth material. colorWrite=false
    // keeps it absent from the beauty pass without disabling shadow participation.
    this.casterMaterial = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      alphaTest: 0.5,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 2), this.material);
    this.mesh.receiveShadow = true;
    this.scene.add(this.mesh);
    this.caster = new THREE.Mesh(this.mesh.geometry, this.casterMaterial);
    this.surfaceDistance=surfaceDistanceMaterial(null,this.depthUniforms.studioDepth,this.depthUniforms.studioDepthScale);
    this.caster.customDistanceMaterial=this.surfaceDistance;
    this.caster.castShadow = true;
    this.caster.renderOrder = -1;
    this.scene.add(this.caster);
    this.textures = [];
    this.observer = new ResizeObserver(() => this.render());
    this.observer.observe(canvas.parentElement);
    this.onLost = (e) => {
      e.preventDefault();
      canvas.dispatchEvent(
        new CustomEvent("studio-error", {
          detail: "GPU 上下文丢失，请刷新重新载入素材。",
        }),
      );
    };
    canvas.addEventListener("webglcontextlost", this.onLost);
  }
  async load(images) {
    const { color, normal, depth } = images,
      w = color.width,
      h = color.height;
    if (
      (normal && (normal.width !== w || normal.height !== h)) ||
      (depth && (depth.width !== w || depth.height !== h))
    )
      throw new Error("原画、法线和深度的尺寸必须完全一致；不会自动拉伸贴图。");
    if (Math.max(w, h) > this.renderer.capabilities.maxTextureSize)
      throw new Error("贴图超出当前 GPU 原生上限，未降低画质。");
    const a = pixels(color);
    const flat = (r, g, b) => {
      const bytes = new Uint8Array(a.length);
      for (let i = 0; i < bytes.length; i += 4) {
        bytes[i] = r;
        bytes[i + 1] = g;
        bytes[i + 2] = b;
        bytes[i + 3] = a[i + 3];
      }
      return bytes;
    };
    const n = normal ? pixels(normal) : flat(128, 128, 255),
      d = depth ? pixels(depth) : flat(128, 128, 128);
    this.textures.forEach((t) => t.dispose());
    this.textures = [];
    this.hasNormal = !!normal;
    this.hasDepth = !!depth;
    this.source = { a, n, d, w, h };
    this.lightingSource=null;this.lightingNormal=null;
    const dn = new Uint8Array(d);
    for (let i = 0; i < a.length; i += 4) dn[i + 3] = a[i + 3];
    this.color = texture(new Uint8Array(a), w, h, true);
    this.depth = texture(dn, w, h);
    this.depth.generateMipmaps = false;
    this.depth.minFilter = THREE.LinearFilter;
    this.textures.push(this.color, this.depth);
    const heights = projectionDepth(d, a, w, h),
      half = new Uint16Array(heights.length);
    for (let i = 0; i < heights.length; i++)
      half[i] = THREE.DataUtils.toHalfFloat(heights[i]);
    const surface = new THREE.DataTexture(
      half,
      w,
      h,
      THREE.RedFormat,
      THREE.HalfFloatType,
    );
    surface.flipY = true;
    surface.magFilter = surface.minFilter = THREE.LinearFilter;
    surface.needsUpdate = true;
    this.textures.push(surface);
    this.depthUniforms.studioDepth.value = surface;
    this.depthUniforms.studioSize.value.set((2 * w) / h, 2);
    this.normal = texture(new Uint8Array(n.length), w, h);
    this.textures.push(this.normal);
    this.updateNormal();
    this.material.map = this.color;
    this.material.shadeMultiplyTexture = this.color;
    this.material.normalMap = this.normal;
    this.material.needsUpdate = true;
    this.casterMaterial.map = this.color;
    this.casterMaterial.needsUpdate = true;
    this.surfaceDistance.map=this.color;this.surfaceDistance.needsUpdate=true;
    this.grid = reliefGrid(heights, a, w, h);
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(this.grid.positions.slice(), 3),
    );
    g.setAttribute("uv", new THREE.BufferAttribute(this.grid.uv, 2));
    // Object-space normal map is the lighting authority. Geometry normals only
    // provide the initial fallback; relief updates compute geometric normals.
    const normals = new Float32Array(this.grid.vertices * 3);
    for (let i = 2; i < normals.length; i += 3) normals[i] = 1;
    g.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    g.setIndex(new THREE.BufferAttribute(this.grid.display, 1));
    this.mesh.geometry.dispose();
    if (this.caster.geometry !== this.mesh.geometry)
      this.caster.geometry.dispose();
    this.mesh.geometry = g;
    const cg = new THREE.BufferGeometry();
    cg.setAttribute("position", g.getAttribute("position"));
    cg.setAttribute("normal", g.getAttribute("normal"));
    cg.setAttribute("uv", g.getAttribute("uv"));
    cg.setIndex(new THREE.BufferAttribute(this.grid.caster, 1));
    this.caster.geometry = cg;
    this.mesh.visible = this.caster.visible = true;
    this.updateRelief();
    this.zoom = 1;
    this.pan = [0, 0];
    this.setMode(this.mode);
    this.apply(this.settings);
    return {
      width: w,
      height: h,
      vertices: this.grid.vertices,
      triangles: this.grid.caster.length / 3,
      maxTextureSize: this.renderer.capabilities.maxTextureSize,
    };
  }
  updateNormal() {
    if (this.deformation) { this.deformation.dirty = true; return; }
    if (!this.source) return;
    const { n, a } = this.source,
      b = this.normal.image.data,
      { normalStrength: s, normalY: y } = this.settings;
    for (let i = 0; i < n.length; i += 4) {
      let x = (n[i] / 127.5 - 1) * s,
        ny = (n[i + 1] / 127.5 - 1) * s * y,
        z = Math.max(0.005, n[i + 2] / 127.5 - 1),
        l = Math.hypot(x, ny, z);
      b[i] = (x / l + 1) * 127.5;
      b[i + 1] = (ny / l + 1) * 127.5;
      b[i + 2] = (z / l + 1) * 127.5;
      b[i + 3] = a[i + 3];
    }
    this.normal.needsUpdate = true;
    if(this.lightingNormal){
      const source=this.lightingSource.normal,out=this.lightingNormal.image.data;
      for(let i=0;i<source.length;i+=4){const x=(source[i]/127.5-1)*s,ny=(source[i+1]/127.5-1)*s*y,z=Math.max(.005,source[i+2]/127.5-1),l=Math.hypot(x,ny,z);out[i]=(x/l+1)*127.5;out[i+1]=(ny/l+1)*127.5;out[i+2]=(z/l+1)*127.5;out[i+3]=a[i+3];}
      this.lightingNormal.needsUpdate=true;
    }
  }
  setLightingFields(fields){
    if(!fields&&!this.lightingSource)return;
    this.lightingSource=fields;
    if(this.lightingNormal){this.lightingNormal.dispose();this.textures=this.textures.filter(t=>t!==this.lightingNormal);this.lightingNormal=null;}
    const {a,n,d,w,h}=this.source;
    if(fields?.inherited.length){this.lightingNormal=texture(new Uint8Array(n.length),w,h);this.textures.push(this.lightingNormal);}
    this.updateNormal();this.material.normalMap=this.lightingNormal||this.normal;
    const heights=projectionDepth(fields?.depth||d,a,w,h),half=this.depthUniforms.studioDepth.value.image.data;
    for(let i=0;i<heights.length;i++)half[i]=THREE.DataUtils.toHalfFloat(heights[i]);
    this.depthUniforms.studioDepth.value.needsUpdate=true;
    this.grid=reliefGrid(heights,a,w,h);
    this.caster.geometry.setIndex(new THREE.BufferAttribute(this.grid.caster,1));
    this.updateRelief();this.material.needsUpdate=true;
  }
  updateRelief() {
    if (this.deformation) { this.deformation.dirty = true; this.renderer.shadowMap.needsUpdate = true; return; }
    if (!this.grid) return;
    const p = this.mesh.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      p.array[i * 3 + 2] =
        this.grid.positions[i * 3 + 2] * this.settings.depthScale;
    p.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingSphere();
    this.caster.geometry.computeBoundingSphere();
    this.renderer.shadowMap.needsUpdate = true;
  }
  apply(next) {
    const prior = this.settings;
    this.settings = { ...next };
    const s = this.settings;
    if (
      prior.normalStrength !== s.normalStrength ||
      prior.normalY !== s.normalY
    )
      this.updateNormal();
    if (prior.depthScale !== s.depthScale) this.updateRelief();
    this.light.position.set(s.lightX, s.lightY, s.lightZ);
    this.light.color.set(s.lightColor);
    this.light.intensity = Math.PI * (1 - s.ambient);
    this.ambient.intensity = Math.PI * s.ambient;
    this.depthUniforms.studioDepthScale.value = s.depthScale;
    this.depthUniforms.studioLightingMix.value = s.lightingMix;
    this.light.shadow.intensity =
      s.shadow && this.hasDepth ? s.shadowStrength : 0;
    this.light.shadow.radius = s.shadowSoftness;
    this.light.shadow.bias = s.bias;
    this.light.shadow.normalBias = 0.012;
    this.material.shadeColorFactor.set(s.shade);
    this.material.shadingToonyFactor = s.toony;
    this.material.shadingShiftFactor = s.shift;
    this.material.parametricRimColorFactor.setScalar(s.rim);
    this.material.parametricRimFresnelPowerFactor = 4;
    this.material.rimLightingMixFactor = 1;
    if (
      ["lightX", "lightY", "lightZ", "depthScale", "shadow"].some(
        (k) => prior[k] !== s[k],
      )
    )
      this.renderer.shadowMap.needsUpdate = true;
    this.render();
  }
  setMode(mode, render = true) {
    this.mode = mode;
    if (!this.color) return;
    if (this.lightingEnabled && (mode === "lit" || mode === "split" || mode === "shading")) {
      this.mesh.material = this.material;
      this.material.debugMode = mode === "shading" ? "litShadeRate" : "none";
    } else {
      this.basic.map =
        mode === "normal"
          ? this.normal
          : mode === "depth"
            ? this.depth
            : this.color;
      this.basic.needsUpdate = true;
      this.mesh.material = this.basic;
    }
    if(render)this.render();
  }
  setLightingEnabled(enabled) {
    this.lightingEnabled = enabled;
    this.setMode(this.mode);
  }
  frame(width, height, exporting = false) {
    // Data views and disabled effects must not rebuild the point-light atlas.
    // Keep its dirty flag so returning to lighting refreshes the current pose.
    this.renderer.shadowMap.enabled=this.lightingEnabled&&this.hasDepth&&this.settings.shadow&&['lit','split','shading'].includes(this.mode);
    this.deformation?.compose();
    const visibleSize=this.deformation?.outputSize||[this.source?.w||1,this.source?.h||1],sourceHeight=this.source?.h||1;
    const aspect = width / height,
      fit = exporting
        ? height/sourceHeight
        : Math.max(
            1.1*visibleSize[1]/sourceHeight,
            (1.1 * visibleSize[0]/sourceHeight) / aspect,
          ),
      scale = fit / (exporting ? 1 : this.zoom);
    this.camera.left = -aspect * scale;
    this.camera.right = aspect * scale;
    this.camera.top = scale;
    this.camera.bottom = -scale;
    this.camera.position.x = exporting ? 0 : this.pan[0];
    this.camera.position.y = exporting ? 0 : this.pan[1];
    this.camera.updateProjectionMatrix();
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.depthUniforms.studioModelView.value.multiplyMatrices(
      this.camera.matrixWorldInverse,
      this.mesh.matrixWorld,
    );
    this.light.shadow.updateMatrices(this.light);
    this.depthUniforms.studioShadowMatrix.value.multiplyMatrices(
      this.light.shadow.matrix,
      this.mesh.matrixWorld,
    );
    this.material.update(0);
    this.renderer.setScissorTest(false);
    this.renderer.setClearColor(0, 0);
    if (this.mode === "split") {
      const previous = this.mesh.material;
      this.basic.map = this.color;
      this.basic.needsUpdate = true;
      this.mesh.material = this.basic;
      this.renderer.render(this.scene, this.camera);
      this.mesh.material = this.lightingEnabled ? this.material : this.basic;
      this.renderer.setScissorTest(true);
      this.renderer.setScissor(width / 2, 0, width / 2, height);
      this.renderer.render(this.scene, this.camera);
      this.renderer.setScissorTest(false);
      this.mesh.material = previous;
    } else this.renderer.render(this.scene, this.camera);
  }
  render() {
    if (this.disposed || !this.source) return;
    const box = this.canvas.parentElement.getBoundingClientRect(),
      ratio = Math.min(window.devicePixelRatio || 1, 2),
      w = Math.max(1, Math.round(box.width * ratio)),
      h = Math.max(1, Math.round(box.height * ratio));
    if (this.canvas.width !== w || this.canvas.height !== h)
      this.renderer.setSize(w, h, false);
    this.frame(w, h);
    this.canvas.style.backgroundColor = this.settings.background;
    this.onRender?.();
  }
  screenToWorld(x, y) {
    const b = this.canvas.getBoundingClientRect();
    return [
      this.camera.position.x +
        this.camera.left +
        (x / b.width) * (this.camera.right - this.camera.left),
      this.camera.position.y +
        this.camera.top -
        (y / b.height) * (this.camera.top - this.camera.bottom),
    ];
  }
  worldToScreen(x, y) {
    const b = this.canvas.getBoundingClientRect();
    return [
      ((x - this.camera.position.x - this.camera.left) /
        (this.camera.right - this.camera.left)) *
        b.width,
      ((this.camera.position.y + this.camera.top - y) /
        (this.camera.top - this.camera.bottom)) *
        b.height,
    ];
  }
  actualSize() {
    const box = this.canvas.getBoundingClientRect(),
      aspect = box.width / box.height;
    const size=this.deformation?.outputSize||[this.source.w,this.source.h];
    const fit = Math.max(1.1*size[1]/this.source.h, (1.1 * size[0]) / this.source.h / aspect);
    this.zoom = (this.source.h * fit) / box.height;
    this.pan = [0, 0];
    this.render();
  }
  viewScale() {
    if (!this.source) return 1;
    return (
      (2 * this.canvas.getBoundingClientRect().height) /
      ((this.camera.top - this.camera.bottom) * this.source.h)
    );
  }
  async exportPNG() {
    if (!this.source) throw new Error("请先载入素材");
    const [w,h] = this.deformation?.outputSize||[this.source.w,this.source.h];
    this.renderer.setSize(w, h, false);
    this.frame(w, h, true);
    const blob = await new Promise((resolve) =>
      this.canvas.toBlob(resolve, "image/png"),
    );
    this.render();
    if (!blob) throw new Error("PNG 导出失败");
    return blob;
  }
  clear() {
    this.surfaceDistance.map=null;
    this.textures.forEach((t) => t.dispose());
    this.textures = [];
    this.source = this.grid = this.color = this.normal = this.depth = null;
    this.lightingSource=this.lightingNormal=null;
    this.material.map =
      this.material.shadeMultiplyTexture =
      this.material.normalMap =
        null;
    this.basic.map =
      this.casterMaterial.map =
      this.depthUniforms.studioDepth.value =
        null;
    this.mesh.geometry.dispose();
    if (this.caster.geometry !== this.mesh.geometry)
      this.caster.geometry.dispose();
    this.mesh.geometry = this.caster.geometry = new THREE.PlaneGeometry(1, 2);
    this.mesh.visible = this.caster.visible = false;
    this.renderer.clear();
  }
  dispose() {
    this.disposed = true;
    this.observer.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.onLost);
    this.textures.forEach((t) => t.dispose());
    this.mesh.geometry.dispose();
    this.caster.geometry.dispose();
    this.material.dispose();
    this.basic.dispose();
    this.casterMaterial.dispose();
    this.surfaceDistance.dispose();
    this.light.shadow.dispose();
    this.renderer.dispose();
  }
}
