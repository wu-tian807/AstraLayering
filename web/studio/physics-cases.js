import { componentDefaults } from '#physics-core/component-physics-schema.js';
import { bindingDefaults } from './physics-model.js';

export const physicsCases = {
  ribbon: { label: '长飘带', note: '上端固定，长条下段连续弯曲摆动', bounds: { x: 438, y: 180, width: 148, height: 650 }, kind: 'ribbon', direction: 'down', color: '#288fb7' },
  skirt: { label: '裙摆布片', note: '腰口固定，宽下摆局部受力', bounds: { x: 262, y: 220, width: 500, height: 590 }, kind: 'cloth', direction: 'down', color: '#ca607d' },
  flag: { label: '横向挂布', note: '左侧固定，自由端上下弯曲', bounds: { x: 220, y: 370, width: 610, height: 245 }, kind: 'cloth', direction: 'right', color: '#339778' },
};
export const physicsProjects = Object.fromEntries(Object.entries(physicsCases).map(([caseId, spec]) =>
  [`example:cloth:${caseId}`, { caseId, label: `示例 · ${spec.label}` }]));

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const blob = c => new Promise((resolve, reject) => c.toBlob(b => b ? resolve(b) : reject(Error('测试贴图生成失败')), 'image/png'));
const rgba = c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data;
const image = (bytes, w, h) => { const c = canvas(w, h); c.getContext('2d').putImageData(new ImageData(bytes, w, h), 0, 0); return c; };

// Analytic engineering fixtures, not generated character art or pipeline outputs.
// Pixels, known normal/depth and authoring limits are created deterministically.
export async function createPhysicsCase(id) {
  const spec = physicsCases[id]; if (!spec) throw Error('未知物理测试');
  const size = [1024, 1024], b = spec.bounds, c = canvas(b.width, b.height), ctx = c.getContext('2d');
  const outline = new Path2D();
  if (id === 'ribbon') { outline.moveTo(8, 0); outline.lineTo(b.width - 8, 0); outline.lineTo(b.width - 30, b.height - 30); outline.lineTo(b.width / 2, b.height); outline.lineTo(30, b.height - 30); }
  else if (id === 'skirt') { outline.moveTo(110, 0); outline.lineTo(b.width - 110, 0); outline.lineTo(b.width, b.height - 24); for (let x = b.width; x >= 0; x -= 25) outline.lineTo(x, b.height - 24 + Math.sin(x / b.width * Math.PI * 6) * 16); }
  else { outline.moveTo(0, 0); outline.lineTo(b.width, 18); outline.lineTo(b.width - 40, b.height / 2); outline.lineTo(b.width, b.height - 18); outline.lineTo(0, b.height); }
  outline.closePath(); ctx.save(); ctx.clip(outline); ctx.fillStyle = spec.color; ctx.fillRect(0, 0, b.width, b.height);
  const cell = 38;
  for (let y = 0; y < b.height; y += cell) for (let x = 0; x < b.width; x += cell) if ((x / cell + y / cell) % 2 === 0) { ctx.fillStyle = '#ffffff50'; ctx.fillRect(x, y, cell, cell); }
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffffffb0';
  for (let x = 0; x <= b.width; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, b.height); ctx.stroke(); }
  for (let y = 0; y <= b.height; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(b.width, y); ctx.stroke(); }
  // A yellow source-UV marker makes albedo movement measurable with lighting off.
  const marker = id === 'flag' ? { x: b.width * .84, y: b.height * .25, width: 16, height: b.height * .5 }
    : { x: b.width * .2, y: b.height * .86, width: b.width * .6, height: 16 };
  ctx.fillStyle = '#ffe15a'; ctx.fillRect(marker.x, marker.y, marker.width, marker.height);
  ctx.restore(); ctx.lineWidth = 5; ctx.strokeStyle = '#183747'; ctx.stroke(outline);
  const makeLayer = (key, name, bounds, color, fixedDepth) => {
    const bytes = rgba(color), data = new Uint8Array(bytes.length);
    for (let y = 0; y < bounds.height; y++) for (let x = 0; x < bounds.width; x++) {
      const q = (y * bounds.width + x) * 4, nx = fixedDepth !== undefined ? 0 : (x / bounds.width - .5) * .75, ny = fixedDepth !== undefined ? 0 : .06 * Math.sin(y / bounds.height * Math.PI);
      data[q] = Math.round((nx + 1) * 127.5); data[q + 1] = Math.round((ny + 1) * 127.5); data[q + 2] = Math.round((Math.sqrt(1 - nx * nx - ny * ny) + 1) * 127.5); data[q + 3] = fixedDepth ?? Math.round(180 + y / bounds.height * 35);
    }
    return { uuid: `${id}:${key}`, contentHash: 'fixture', id: `${id}:${key}`, partId: `${id}:${key}`, name, bounds, rgba: bytes, maskedRgba: bytes, color, map: { data, known: bytes.length / 4, inferred: 0 }, visible: true, opacity: 255 };
  };
  const cloth = makeLayer('cloth', spec.label, b, c);
  const anchorBounds = id === 'flag' ? { x: b.x - 20, y: b.y - 30, width: 42, height: b.height + 60 }
    : { x: b.x - 25, y: b.y - 18, width: b.width + 50, height: 38 };
  const anchor = canvas(anchorBounds.width, anchorBounds.height), a = anchor.getContext('2d');
  a.fillStyle = '#273b50'; a.fillRect(0, 0, anchor.width, anchor.height); a.strokeStyle = '#90a6bb'; a.lineWidth = 4; a.strokeRect(3, 3, anchor.width - 6, anchor.height - 6);
  // A real receiver behind the cloth makes occlusion visible. Its albedo has
  // no painted shadow; all projected darkness comes from the shared renderer.
  const receiverBounds = { x: 60, y: 70, width: 904, height: 884 }, receiver = canvas(receiverBounds.width, receiverBounds.height), r = receiver.getContext('2d');
  r.fillStyle = '#d9d8d3'; r.fillRect(0, 0, receiver.width, receiver.height);
  r.strokeStyle = '#c9c8c3'; r.lineWidth = 1;
  for (let x = 0; x < receiver.width; x += 64) { r.beginPath(); r.moveTo(x, 0); r.lineTo(x, receiver.height); r.stroke(); }
  for (let y = 0; y < receiver.height; y += 64) { r.beginPath(); r.moveTo(0, y); r.lineTo(receiver.width, y); r.stroke(); }
  const layers = [makeLayer('receiver', '投影底板', receiverBounds, receiver, 105), cloth, makeLayer('anchor', '固定夹具', anchorBounds, anchor, 230)];
  const color = canvas(...size), normal = canvas(...size), depth = canvas(...size);
  for (const l of layers) {
    const n = new Uint8ClampedArray(l.rgba.length), d = new Uint8ClampedArray(n.length);
    for (let q = 0; q < n.length; q += 4) { n.set(l.map.data.subarray(q, q + 3), q); d[q] = d[q + 1] = d[q + 2] = l.map.data[q + 3]; n[q + 3] = d[q + 3] = l.rgba[q + 3]; }
    for (const [target, source] of [[color, l.color], [normal, image(n, l.bounds.width, l.bounds.height)], [depth, image(d, l.bounds.width, l.bounds.height)]]) target.getContext('2d').drawImage(source, l.bounds.x, l.bounds.y);
  }
  const binding = { ...bindingDefaults(spec.kind), enabled: true, direction: spec.direction, fixed: id === 'skirt' ? .16 : .12, transition: .16, maxAngle: 32, maxTravel: .26, stretch: .025, stiffness: 1.8, damping: 1.4 };
  const [colorBlob, normalBlob, depthBlob] = await Promise.all([color, normal, depth].map(blob));
  const fixed=id==='flag'?[[b.x,b.y],[b.x+b.width*.12,b.y],[b.x+b.width*.12,b.y+b.height],[b.x,b.y+b.height]]:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height*.12],[b.x,b.y+b.height*.12]];
  const freeLength=(id==='flag'?b.width:b.height)*.88;
  const authoring={freeLength,fixedRegions:[fixed],transitionPixels:freeLength*.16,contour:[[b.x,b.y],[b.x+b.width,b.y],[b.x+b.width,b.y+b.height],[b.x,b.y+b.height]],subdivisions:3};
  if(id!=='ribbon')authoring.controlGrid=[4,8];
  if(id==='ribbon'){authoring.centerline=Array.from({length:13},(_,i)=>[b.x+b.width/2,b.y+b.height*i/12]);authoring.widths=authoring.centerline.map(()=>b.width);}
  const componentPhysics={kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',source:{canvas:{width:size[0],height:size[1]}},components:[{id:cloth.id,name:spec.label,kind:id==='ribbon'?'strand':'cloth',priority:'primary',enabled:true,sourcePartIds:[cloth.id],layerRefs:[{uuid:cloth.uuid,contentHash:cloth.contentHash}],supports:[{id:'fixture',at:id==='flag'?[b.x,b.y+b.height/2]:[b.x+b.width/2,b.y]}],authoring,...componentDefaults(id==='ribbon'?'strand':'cloth')}],review:{status:'fixture'}};
  return { name: `物理测试 · ${spec.label}.png`, file: colorBlob, color: colorBlob, normal: normalBlob, depth: depthBlob,
    project: { name: `example:cloth:${id}`, displayName: `示例 · ${spec.label}`, kind: 'example', previewMode: 'normal-depth',
      files: { document: { available: true }, normal: { available: true }, depth: { available: true } } },
    layers: layers.map(l => ({ id: l.id, name: l.name, opacity: 1, visible: true, depth: 0, type: 'paintlayer', blend: 'normal', inheritAlpha: false, passThrough: null })),
    componentPhysics,
    physicsCase: { id, label: spec.label, note: spec.note, layers, size, bindings: { [cloth.id]: binding }, marker: { ...marker, x: marker.x + b.x, y: marker.y + b.y } },
  };
}
