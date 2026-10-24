// Starting parameters extracted from the accepted secondary-motion case.
// They do not decide which layers move, author attachment geometry, or grant review.
// Source/method: tutorial/live2d-guidance/formal/14-physics-initialization-and-targets.md
export const motionPresetVersion = 'astra-motion-presets-1';
const fabric = {stretchCompliance:1e-9,shearCompliance:.0005,compressionCompliance:.0005,bendCompliance:.0006,shapeCompliance:.00065};
const hair = {stretchCompliance:1e-8,shearCompliance:.0006,bendCompliance:.0004,shapeCompliance:.0005};
export const motionPresets = [
  {id:'long-hair',kind:'strand',length:1200,response:{frequencyHz:.8,dampingRatio:.28,inputGain:1,windGain:.22,outputGain:1.4},material:hair,parallel:.8},
  {id:'free-hair-lock',kind:'strand',length:500,response:{frequencyHz:1.2,dampingRatio:.28,inputGain:1,windGain:.36,outputGain:1.4},material:hair,parallel:.8},
  {id:'front-hair',kind:'strand',length:180,response:{frequencyHz:1.35,dampingRatio:.23,inputGain:2,windGain:.33,outputGain:3.2},material:hair,parallel:.8},
  {id:'long-ribbon',kind:'strand',length:730,response:{frequencyHz:.82,dampingRatio:.22,inputGain:1.3,windGain:.65,outputGain:1.7},material:hair,parallel:.15},
  {id:'tassel',kind:'strand',length:300,response:{frequencyHz:1.4,dampingRatio:.55,inputGain:.35,windGain:.1,outputGain:.4},material:hair,parallel:.3},
  {id:'hanging-cloth',kind:'cloth',response:{frequencyHz:1.1,dampingRatio:.48,inputGain:1.5},material:fabric},
  {id:'skirt',kind:'cloth',response:{frequencyHz:1.25,dampingRatio:.55,inputGain:1.5},material:{...fabric,shearCompliance:.0002,compressionCompliance:.0002,shapeCompliance:.00045}},
  {id:'robe-panel',kind:'cloth',response:{frequencyHz:1.1,dampingRatio:.48,inputGain:.65},material:fabric},
  {id:'hanging-ornament',kind:'pendant',response:{frequencyHz:1.15,dampingRatio:.32,inputGain:1.5,windGain:.15,outputFrequencyHz:.85},material:{stretchCompliance:0,shearCompliance:0,bendCompliance:0,shapeCompliance:0}},
];
export function suggestedMotionPreset(component) {
  const paths=component.sourcePartIds.join('/');
  if(component.kind==='pendant')return 'hanging-ornament';
  if(component.kind==='cloth')return /skirt/.test(paths)?'skirt':/front_panel/.test(paths)?'robe-panel':'hanging-cloth';
  if(/side_hair|front_hair|bang/.test(paths))return 'front-hair';
  if(/hair/.test(paths))return /lock/.test(paths)?'free-hair-lock':'long-hair';
  return /tassel/.test(paths)?'tassel':'long-ribbon';
}
export function initializeMotionParameters(component, presetId=suggestedMotionPreset(component)) {
  const preset=motionPresets.find(p=>p.id===presetId);
  if(!preset||preset.kind!==component.kind)throw Error('运动初始配方与组件类型不符：'+presetId);
  const next=structuredClone(component),response={...preset.response};
  // Pendulum period scales with sqrt(length); geometry, masks, and limits remain authored.
  if(preset.length)response.frequencyHz=Math.max(.6,Math.min(2.4,response.frequencyHz*Math.sqrt(preset.length/next.authoring.freeLength)));
  next.response={...next.response,...response};next.material={...next.material,...preset.material};
  if(preset.parallel!==undefined)next.authoring.swing={...next.authoring.swing,parallel:preset.parallel};
  return next;
}
export function initializeConfigParameters(config, presets) {
  if (presets !== undefined) {
    if (!presets || Array.isArray(presets) || typeof presets !== 'object') throw Error('presets 必须是组件 ID 到配方 ID 的映射');
    for (const id of Object.keys(presets)) if (!config.components.some(c => c.id === id)) throw Error('未知初始化组件：'+id);
  }
  const next=structuredClone(config);
  next.components=next.components.map(c => presets === undefined || Object.hasOwn(presets,c.id) ? initializeMotionParameters(c,presets?.[c.id]) : c);
  return next;
}
