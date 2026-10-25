import * as THREE from 'three';

// Joint bilateral visibility filtering in source texels. It smooths the shadow
// factor, never the artwork, and rejects neighbours on another depth surface.
export const smoothPointShadowGLSL=`
#if defined(USE_SHADOWMAP) && NUM_POINT_LIGHT_SHADOWS > 0
float studioSmoothPointShadow(sampler2D shadowMap,vec2 mapSize,float intensity,float bias,float radius,vec4 coord,float nearPlane,float farPlane){
 if(intensity<=0.0)return 1.0;
 float total=4.0*getPointShadow(shadowMap,mapSize,intensity,bias,radius,coord,nearPlane,farPlane),weight=4.0;
 float depth=textureLod(studioDepth,vUv,0.0).r;
 vec2 texel=1.0/vec2(textureSize(studioDepth,0));
 vec3 p=studioPosition(),n=normalize(cross(dFdx(p),dFdy(p)));if(n.z<0.0)n=-n;
 for(int i=0;i<8;i++){
  float angle=float(i)*0.7853981634;
  vec2 uv=vUv+vec2(cos(angle),sin(angle))*texel*radius*1.5;
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))continue;
  float z=textureLod(studioDepth,uv,0.0).r,diff=abs(z-depth);
  if(diff>0.035)continue;
  float w=1.0-diff/0.035;
  vec3 samplePosition=vec3((uv-0.5)*studioSize,(z-0.5)*studioDepthScale);
  vec4 sampleCoord=studioShadowMatrix*vec4(samplePosition+n*0.012,1.0);
  total+=w*getPointShadow(shadowMap,mapSize,intensity,bias,radius,sampleCoord,nearPlane,farPlane);weight+=w;
 }
 return total/weight;
}
#endif
`;

// Caster and receiver compare the same filtered, per-pixel height. Interpolating
// a coarse triangle's height only in the caster creates self-shadow stripes.
export function surfaceDistanceMaterial(map, depth, scale, deformVertex = false) {
  const material = new THREE.MeshDistanceMaterial({ map, alphaTest: .5, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.surfaceDepth = depth; shader.uniforms.surfaceDepthScale = scale;
    if (deformVertex) shader.vertexShader = 'uniform sampler2D surfaceDepth;uniform float surfaceDepthScale;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z=(texture2D(surfaceDepth,uv).r-0.5)*surfaceDepthScale;');
    const original = 'float dist = length( vWorldPosition - referencePosition );';
    if (!shader.fragmentShader.includes(original)) throw Error('Three.js surface shadow adapter needs review');
    shader.fragmentShader = 'uniform sampler2D surfaceDepth;uniform float surfaceDepthScale;\n' + shader.fragmentShader.replace(original, `float z=(texture2D(surfaceDepth,vMapUv).r-0.5)*surfaceDepthScale;
if(abs(z-vWorldPosition.z)>max(0.00002,0.09*abs(surfaceDepthScale)))discard;
float dist=length(vec3(vWorldPosition.xy,z)-referencePosition);`);
  };
  material.customProgramCacheKey = () => 'astra-surface-distance-1/' + deformVertex;
  return material;
}
