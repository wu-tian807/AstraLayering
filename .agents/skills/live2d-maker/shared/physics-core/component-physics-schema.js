export const componentSchemaVersion = 1;
export const componentPhysicsVersion = 'astra-component-physics-1';
export const reviewCriteria = ['attachment', 'shape', 'response', 'limits', 'layers', 'surfaces'];
export const reviewTests = ['neutral', 'tip-impulse', 'support-release', 'support-reverse', 'sustained', 'extreme', 'combined', 'light-brush', 'airflow'];
export const componentDefaults = kind => ({
  response: { frequencyHz: kind === 'pendant' ? 1.2 : .9, dampingRatio: .24, inputGain: .65 },
  material: { stretchCompliance: 1e-7, shearCompliance: .002, bendCompliance: .0004, shapeCompliance: .0008 },
  limits: { maxTravel: .12, maxAngle: 18, maxStretch: .025, maxCompression: .15, maxShear: 18, minAreaRatio: .55 },
});
const object = (v, message) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error(message); };
const text = (v, name) => { if (typeof v !== 'string' || !v.trim() || v.length > 2000) throw Error(name + ' 无效'); };
const number = (v, low, high, name) => { if (!Number.isFinite(v) || v < low || v > high) throw Error(name + ' 超出范围'); };
export function validatePoint(p, canvas) {
  if (!Array.isArray(p) || p.length !== 2) throw Error('控制点必须是 [x,y] 源画布像素');
  number(p[0], -canvas.width, canvas.width * 2, '控制点 x'); number(p[1], -canvas.height, canvas.height * 2, '控制点 y');
}
function polygon(p, canvas) {
  if (!Array.isArray(p) || p.length < 3 || p.length > 100) throw Error('轮廓至少三个、最多一百个控制点');
  p.forEach(v => validatePoint(v, canvas));
}
export function validateComponent(c, canvas, authoringRequired = true) {
  object(c, '组件无效'); text(c.id, '组件 ID'); text(c.name, '组件名称');
  if (!['strand', 'cloth', 'pendant'].includes(c.kind) || !['primary', 'secondary'].includes(c.priority) || typeof c.enabled !== 'boolean') throw Error('组件类型、优先级或开关无效');
  if (!Array.isArray(c.layerRefs) || !c.layerRefs.length || c.layerRefs.length > 200) throw Error('组件必须明确关联源图层');
  for (const r of c.layerRefs) { text(r.uuid, '源 UUID'); text(r.contentHash, '源像素指纹'); }
  if (!Array.isArray(c.sourcePartIds) || !c.sourcePartIds.length) throw Error('组件必须关联源 part');
  if (!Array.isArray(c.supports) || !c.supports.length || c.supports.length > 16) throw Error('组件必须有实际支撑');
  for (const s of c.supports) { text(s.id, '支撑 ID'); validatePoint(s.at, canvas); if (s.componentId !== undefined) text(s.componentId, '父组件 ID'); }
  if (!authoringRequired) return c;
  object(c.authoring, '缺少作者绑定'); const a = c.authoring;
  if(a.contour)polygon(a.contour,canvas);if(a.holes){if(!Array.isArray(a.holes)||a.holes.length>16)throw Error('孔洞数量超出范围');a.holes.forEach(p=>polygon(p,canvas));}
  if(a.simulationSubdivisions!==undefined&&(!Number.isInteger(a.simulationSubdivisions)||a.simulationSubdivisions<0||a.simulationSubdivisions>1))throw Error('控制网格细分必须为 0 或 1');
  if(a.controlGrid!==undefined&&(c.kind!=='cloth'||!Array.isArray(a.controlGrid)||a.controlGrid.length!==2||a.controlGrid.some(n=>!Number.isInteger(n)||n<2||n>16)))throw Error('布片控制格必须为 [列数,行数]，各为 2–16');
  number(a.freeLength, 1, Math.hypot(canvas.width, canvas.height) * 3, '自由长度');
  if (c.kind === 'pendant') { validatePoint(a.pivot, canvas); polygon(a.contour, canvas); }
  else {
    if (!Array.isArray(a.fixedRegions) || !a.fixedRegions.length || a.fixedRegions.length > 8) throw Error('缺少固定区域');
    a.fixedRegions.forEach(p => polygon(p, canvas)); number(a.transitionPixels, 1, a.freeLength, '过渡宽度');
    if (c.kind === 'strand') {
      if (!Array.isArray(a.centerline) || a.centerline.length < 3 || a.centerline.length > 40) throw Error('中心线需要 3–40 个控制节');
      a.centerline.forEach(p => validatePoint(p, canvas));
      if (!Array.isArray(a.widths) || a.widths.length !== a.centerline.length) throw Error('每节需要对应宽度');
      a.widths.forEach(w => number(w, .5, Math.max(canvas.width, canvas.height), '横截面宽度'));
    } else { polygon(a.contour, canvas); (a.holes || []).forEach(p => polygon(p, canvas)); number(a.subdivisions ?? 2, 0, 4, '网格细分');if(!Number.isInteger(a.subdivisions??2))throw Error('网格细分必须为整数'); }
  }
  if(a.swing!==undefined){object(a.swing,'发束弯曲设置无效');if(c.kind!=='strand')throw Error('分段弯曲只用于发束和软带');number(a.swing.parallel,0,1,'截面保持');}
  const limits = { maxTravel: [.01, .3], maxAngle: [1, 45], maxStretch: [.005, .08], maxCompression: [0, .3], maxShear: [1, 30], minAreaRatio: [.3, .95] };
  const response = { frequencyHz: [.15, 6], dampingRatio: [.03, 1.5], inputGain: [0, 2] };
  for (const [group, ranges] of Object.entries({ limits, response })) {
    object(c[group], '缺少 ' + group); for (const [key, range] of Object.entries(ranges)) number(c[group][key], ...range, key);
  }
  if(c.response.outputFrequencyHz!==undefined){
    if(c.kind!=='pendant')throw Error('角度过渡仅用于刚性挂件');
    number(c.response.outputFrequencyHz,.15,6,'角度过渡');
  }
  if(c.response.windGain!==undefined)number(c.response.windGain,0,4,'风力响应');
  if(c.response.parentGain!==undefined){if(c.kind!=='pendant')throw Error('牵动惯性仅用于刚性挂件');number(c.response.parentGain,0,2,'牵动惯性');}
  if(c.response.parentVelocityLimit!==undefined){if(c.kind!=='pendant')throw Error('惯性限速仅用于刚性挂件');number(c.response.parentVelocityLimit,.1,20,'惯性限速（自由长度每秒）');}
  if(c.response.outputGain!==undefined){if(!['strand','pendant'].includes(c.kind))throw Error('输出倍率只用于发束、软带和刚性挂件');number(c.response.outputGain,0,8,'输出倍率');}
  object(c.material, '缺少材质参数'); for (const key of ['stretchCompliance','shearCompliance','bendCompliance','shapeCompliance']) number(c.material[key], 0, .1, key);
  return c;
}
export function validatePhysicsConfig(value, { requireReview = false } = {}) {
  object(value, '物理配置无效');
  if (value.kind !== 'astra-component-physics' || value.version !== componentSchemaVersion || value.solver !== componentPhysicsVersion) throw Error('物理配置类型或版本不支持');
  object(value.source, '缺少来源'); const canvas = value.source.canvas;
  object(canvas, '缺少原画布'); number(canvas.width, 1, 16000, '画布宽'); number(canvas.height, 1, 16000, '画布高');
  if (!Array.isArray(value.components) || value.components.length > 250) throw Error('组件列表无效');
  const ids = new Set(),sources=new Set(); for (const c of value.components) { validateComponent(c, canvas); if (ids.has(c.id)) throw Error('组件 ID 重复'); ids.add(c.id);for(const ref of c.layerRefs){if(sources.has(ref.uuid))throw Error('同一源层不能绑定多个独立运动区域');sources.add(ref.uuid);} }
  for (const c of value.components) for (const s of c.supports) if (s.componentId && !ids.has(s.componentId)) throw Error('组件支撑不存在');
  if (requireReview && value.review?.status !== 'accepted') throw Error('物理配置尚未完成模拟与视觉复核');
  return value;
}
