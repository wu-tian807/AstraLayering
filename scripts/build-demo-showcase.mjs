// Documentation plates made from saved reference, composite and native KRA layer pixels.
import { readFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import sharp from 'sharp';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const output = join(root, 'showcase');
const width = 3000, height = 1780;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const text = (x, y, value, size = 22, fill = '#727a8c', attributes = '') => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${size}" fill="${fill}" ${attributes}>${escape(value)}</text>`;
const image = (bytes, x, y, w, h) => `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${bytes.toString('base64')}"/>`;
const cleanName = name => name.replace(/^(?:人物|衣服)\s*\|\s*/, '').replace(/^\d+(?:\.\d+)?\s*(?:\|\s*)?/, '');
const isBody = layer => layer.name.startsWith('衣服 |') ? false : layer.name.startsWith('人物 |') ? true : layer.source ? layer.source === 'body' : /^(hair|face|head_accessories|neck|body|arms|pelvis|legs)(\/|::|$)/.test(cleanName(layer.name));
const cases = [
  { id: 'jianma', title: 'Jianma', source: '.web/showcase-layers/jianma', reference: 'demos/jianma/input/original.png',
    composite: 'demos/jianma/shadow/step01_mask/character-shadowed.png', counts: [69, 48], titles: ['Rear hair', 'Character', 'Inner dress', 'Outer robe', 'Sash & jewelry'],
    classify(layer, name) {
      if (isBody(layer)) return /^hair\/(back_hair|bun|hair_cap)/.test(name) || /crown_ribbon\/(ribbon_tail|ribbon_body)$/.test(name) ? 0 : 1;
      return name.startsWith('inner_long_dress/') ? 2 : /^(outer_robe_body|sleeve_|collar_shoulder_cape)/.test(name) ? 3 : 4;
    } },
  { id: 'pink-doll', title: 'Pink Doll', source: '.web/showcase-layers/pink-doll', reference: 'demos/pink-doll/input/original.jpg',
    composite: 'demos/pink-doll/character-assembly/step01/character-assembled.png', counts: [58, 8], titles: ['Rear hair', 'Character', 'Bodice', 'Tiered skirt', 'Chest bow'],
    classify(layer, name) {
      if (isBody(layer)) return /^hair\/(back_hair|bun)/.test(name) || name === 'head_accessories::root' ? 0 : 1;
      return name.startsWith('skirt/') ? 3 : name === 'chest_bow' ? 4 : 2;
    } },
  { id: 'pink-elf', title: 'Pink Elf', source: '.web/showcase-layers/pink-elf', reference: 'demos/pink-elf/input/original.png',
    composite: 'demos/pink-elf/character-assembly/step01/character-assembled.png', counts: [70, 32], titles: ['Trailing skirt', 'Rear hair', 'Character', 'Dress & sleeves', 'Bow & pendant'],
    classify(layer, name) {
      if (isBody(layer)) return /^hair\/back_hair\/(long_|cap :: (nape|back))/.test(name) ? 1 : 2;
      return name.startsWith('trailing_skirt_') ? 0 : /^(waist_bow|chest_pendant)/.test(name) ? 4 : 3;
    } },
  { id: 'black-white-doll', title: 'Black White Doll', source: '.web/showcase-layers/black-white-doll', reference: 'demos/black-white-doll/input/original.png',
    composite: 'demos/black-white-doll/character-assembly/step01/character-assembled.png', counts: [81, 19],
    titles: ['Rear hair', 'Character', 'Camisole', 'Pleated skirt', 'Chest bow'],
    classify(layer, name) {
      if (isBody(layer)) return /^hair\/(back_hair|ponytail_)/.test(name) ? 0 : 1;
      return name.startsWith('pleated_skirt/') ? 3 : name.startsWith('chest_bow/') ? 4 : 2;
    } },
];

const { values } = parseArgs({ options: { case: { type: 'string' } } });
if (values.case && !cases.some(profile => profile.id === values.case)) throw new Error(`Unknown case: ${values.case}. Choose ${cases.map(profile => profile.id).join(', ')}.`);
await mkdir(output, { recursive: true });
for (const [caseIndex, profile] of cases.entries()) {
  if (!values.case || profile.id === values.case) {
    if (profile.id === 'jianma') await renderJianma(profile);
    await render(profile, caseIndex);
  }
}

async function renderJianma(profile) {
  const images = await Promise.all([profile.reference, profile.composite].map(async file =>
    sharp(join(root, file)).resize(1260, 1580, { fit: 'contain', background: '#f2f4f7' }).flatten({ background: '#f2f4f7' }).png().toBuffer()));
  const label = Buffer.from(`<svg width="${width}" height="${height}">${text(115, 55, 'Jianma · Reference & final', 36)}${text(470, 125, 'Reference', 26)}${text(1900, 125, 'Final', 26)}</svg>`);
  await sharp({ create: { width, height, channels: 4, background: '#f2f4f7' } }).composite([
    { input: images[0], left: 100, top: 150 }, { input: images[1], left: 1640, top: 150 }, { input: label, left: 0, top: 0 },
  ]).png().toFile(join(output, 'jianma-reference-composite.png'));
}

async function render(profile, caseIndex) {
  const source = join(root, profile.source);
  let manifest;
  try { manifest = JSON.parse(await readFile(join(source, 'layers.json'), 'utf8')); }
  catch (error) {
    if (error.code === 'ENOENT') throw new Error(`${profile.id}: run node scripts/export-showcase-layers.ts --krita <Krita executable> before rebuilding the README plates.`, { cause: error });
    throw error;
  }
  if (manifest.order !== 'back-to-front') throw new Error('Expected native back-to-front layer order.');
  if (manifest.sourceKra) {
    const hash = createHash('sha256').update(await readFile(join(root, manifest.sourceKra))).digest('hex');
    if (hash !== manifest.sourceSha256) throw new Error(`${profile.id}: source KRA changed; export its layers again.`);
  }
  const [cw, ch] = manifest.canvas;
  const depths = profile.depths ?? [-280, 0, 245, 505, 775];
  const modules = profile.titles.map((title, index) => ({ title, z: depths[index] * ch / 1536, layers: [] }));
  for (const layer of manifest.layers) {
    if (layer.visible === false || (layer.blend && layer.blend !== 'normal')) throw new Error(`Review source layer: ${layer.name}`);
    const file = join(source, layer.original.file), metadata = await sharp(file).metadata();
    let input = file;
    if (layer.opacity !== undefined && layer.opacity !== 255) {
      const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * layer.opacity / 255);
      input = await sharp(data, { raw: info }).png().toBuffer();
    }
    const group = profile.classify(layer, cleanName(layer.name));
    modules[group].layers.push({ ...layer, input, w: metadata.width, h: metadata.height });
  }
  const actualBody = manifest.layers.filter(isBody).length;
  if (actualBody !== profile.counts[0] || manifest.layers.length - actualBody !== profile.counts[1]) throw new Error(`${profile.id}: unexpected layer counts.`);
  for (const module of modules) {
    if (!module.layers.length) throw new Error(`Empty assembly: ${module.title}`);
    module.x = Math.min(...module.layers.map(l => l.original.x));
    module.y = Math.min(...module.layers.map(l => l.original.y));
    module.w = Math.max(...module.layers.map(l => l.original.x + l.w)) - module.x;
    module.h = Math.max(...module.layers.map(l => l.original.y + l.h)) - module.y;
  }

  // One shared perspective, scaled to fit the right-hand half of the plate.
  const yaw = 48 * Math.PI / 180, pitch = 5 * Math.PI / 180;
  const focal = ch * 2700 / 1536, distance = ch * 3750 / 1536;
  function camera(x, y, z) {
    x -= cw / 2; y -= ch / 2;
    const rx = Math.cos(yaw) * x + Math.sin(yaw) * z;
    const rz = -Math.sin(yaw) * x + Math.cos(yaw) * z;
    const ry = Math.cos(pitch) * y - Math.sin(pitch) * rz;
    const depth = Math.sin(pitch) * y + Math.cos(pitch) * rz;
    const s = focal / (distance - depth);
    return { x: rx * s, y: ry * s };
  }
  const corners = modules.flatMap(m => [[m.x, m.y], [m.x + m.w, m.y], [m.x, m.y + m.h], [m.x + m.w, m.y + m.h]].map(([x,y]) => camera(x,y,m.z)));
  const minX = Math.min(...corners.map(p => p.x)), maxX = Math.max(...corners.map(p => p.x));
  const minY = Math.min(...corners.map(p => p.y)), maxY = Math.max(...corners.map(p => p.y));
  const hero = { x: 1575, y: 440, w: 1325, h: 1065 };
  const scale = Math.min(hero.w / (maxX-minX), hero.h / (maxY-minY));
  const offset = { x: hero.x + (hero.w - (maxX-minX)*scale)/2 - minX*scale, y: hero.y + (hero.h - (maxY-minY)*scale)/2 - minY*scale };
  function project(x,y,z) { const p = camera(x,y,z); return { x: offset.x+p.x*scale, y: offset.y+p.y*scale }; }

  const svg = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
<defs>
 <radialGradient id="paper" cx="65%" cy="35%" r="90%"><stop stop-color="#f3f4f6"/><stop offset="1" stop-color="#dfe3ea"/></radialGradient>
 <radialGradient id="ground"><stop stop-color="#7d88a1" stop-opacity=".15"/><stop offset="1" stop-color="#7d88a1" stop-opacity="0"/></radialGradient>
 <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="8" dy="13" stdDeviation="12" flood-color="#566078" flood-opacity=".14"/></filter>
 <filter id="referenceShadow" x="-20%" y="-20%" width="150%" height="150%"><feDropShadow dx="0" dy="9" stdDeviation="15" flood-color="#586071" flood-opacity=".10"/></filter>
</defs><rect width="3000" height="1780" fill="url(#paper)"/>`];
  svg.push(text(76, 90, 'ASTRALAYERING', 23, '#647184', 'letter-spacing="6"'));
  svg.push(text(76, 188, `${profile.title}. Layer by layer.`, 64, '#303949', 'font-weight="500" letter-spacing="-2"'));
  svg.push(text(76, 238, 'From a single reference to an editable character.', 25));
  svg.push(text(2924, 89, `CHARACTER MATERIALS / 0${caseIndex+1}`, 19, '#7d8796', 'text-anchor="end" letter-spacing="2"'));
  for (const [x, number, title] of [[76, '01', 'Reference'], [800, '02', 'Composite'], [1575, '03', 'Exploded structure']]) {
    svg.push(text(x, 355, number, 20, '#a0a7b3'));
    svg.push(text(x+44, 355, title, 27, '#394456'));
  }
  svg.push('<path d="M76 382 H1424 M1575 382 H2924 M1500 420 V1625" stroke="#acb4c3" stroke-opacity=".3"/>');

  for (const [file, box, trim] of [
    [join(root, profile.reference), { x: 76, y: 445, w: 624, h: 1060 }, false],
    [join(root, profile.composite), { x: 800, y: 445, w: 624, h: 1060 }, true],
  ]) {
    let input = sharp(file);
    if (trim) input = input.trim({ background: '#00000000', threshold: 1 });
    const { data, info } = await input.resize(box.w, box.h, { fit: 'inside' }).png().toBuffer({ resolveWithObject: true });
    svg.push(`<g filter="url(#referenceShadow)">${image(data, box.x+(box.w-info.width)/2, box.y+(box.h-info.height)/2, info.width, info.height)}</g>`);
  }
  svg.push(text(76, 1570, 'Original input', 20));
  svg.push(text(800, 1570, 'Saved KRA composite', 20));
  svg.push('<ellipse cx="2230" cy="1515" rx="650" ry="65" fill="url(#ground)"/>');

  let rendered = 0;
  // A perspective mesh projects each native bitmap; no generative pixels are used.
  for (const [index, module] of modules.entries()) {
    const { x: mx, y: my, w, h } = module;
    const buffer = await sharp({ create: { width: w, height: h, channels: 4, background: '#00000000' } })
      .composite(module.layers.map(l => ({ input: l.input, left: l.original.x-mx, top: l.original.y-my }))).png().toBuffer();
    const id = `module-${index}`;
    svg.push(`<defs><image id="${id}" width="${w}" height="${h}" href="data:image/png;base64,${buffer.toString('base64')}"/></defs><g filter="url(#shadow)">`);
    const columns = 4, rows = 8;
    let triangle = 0;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const x = col*w/columns, y = row*h/rows, dx = w/columns, dy = h/rows;
      for (const points of [[[x,y],[x+dx,y],[x,y+dy]], [[x+dx,y+dy],[x,y+dy],[x+dx,y]]]) {
        const p = points.map(([u,v]) => project(mx+u,my+v,module.z));
        const [[u0,v0],[u1,v1],[u2,v2]] = points;
        const det = (u1-u0)*(v2-v0)-(u2-u0)*(v1-v0);
        const a=((p[1].x-p[0].x)*(v2-v0)-(p[2].x-p[0].x)*(v1-v0))/det;
        const c=((p[2].x-p[0].x)*(u1-u0)-(p[1].x-p[0].x)*(u2-u0))/det;
        const b=((p[1].y-p[0].y)*(v2-v0)-(p[2].y-p[0].y)*(v1-v0))/det;
        const d=((p[2].y-p[0].y)*(u1-u0)-(p[1].y-p[0].y)*(u2-u0))/det;
        const e=p[0].x-a*u0-c*v0, f=p[0].y-b*u0-d*v0;
        const clip=`${id}-${triangle++}`;
        // Overlap clip edges to cover antialias seams between adjacent triangles.
        const center = { x: p.reduce((n,q)=>n+q.x,0)/3, y: p.reduce((n,q)=>n+q.y,0)/3 };
        const expanded = p.map(q => { const r = Math.hypot(q.x-center.x,q.y-center.y); return { x: q.x+(q.x-center.x)*2/r, y: q.y+(q.y-center.y)*2/r }; });
        svg.push(`<clipPath id="${clip}"><path d="M${expanded.map(q=>`${q.x},${q.y}`).join('L')}Z"/></clipPath><g clip-path="url(#${clip})"><use href="#${id}" transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})"/></g>`);
      }
    }
    svg.push('</g>');
    rendered += module.layers.length;
  }
  const axis = modules.map(m => project(cw/2,ch*1.025,m.z));
  const axisMin = Math.min(...axis.map(p => p.y)), axisMax = Math.max(...axis.map(p => p.y));
  const axisY = p => 1530+(p.y-axisMin)*35/(axisMax-axisMin);
  svg.push(`<path d="M${axis.map(p=>`${p.x},${axisY(p)}`).join('L')}" fill="none" stroke="#a7b1c1" stroke-opacity=".6" stroke-width="1.4"/>`);
  for (const [index,p] of axis.entries()) {
    svg.push(`<circle cx="${p.x}" cy="${axisY(p)}" r="3" fill="#7f8ea6"/>`);
    svg.push(text(p.x, axisY(p)+30, `0${index+1}`, 17, '#7f8c9e', 'text-anchor="middle"'));
  }
  const legend = profile.titles.map((title,index)=>`0${index+1} ${title}`);
  if (legend.length > 5) {
    svg.push(text(1575, 1605, legend.slice(0,4).join('   /   '), 20, '#7c8698'));
    svg.push(text(1575, 1640, legend.slice(4).join('   /   '), 20, '#7c8698'));
  } else svg.push(text(1575, 1630, legend.join('   /   '), 20, '#7c8698'));
  svg.push('<path d="M76 1670 H2924" stroke="#adb5c4" stroke-opacity=".3"/>');
  svg.push(text(76, 1720, `${rendered} PAINT LAYERS`, 21, '#546176', 'letter-spacing="2"'));
  svg.push(text(430, 1720, `${profile.counts[0]} character  +  ${profile.counts[1]} clothing`, 21));
  svg.push(text(2924, 1720, `Source KRA pixels / ${modules.length === 5 ? 'five' : modules.length} structural assemblies / perspective projection`, 20, '#8a93a2', 'text-anchor="end"'));
  svg.push('</svg>');
  if (rendered !== manifest.layers.length) throw new Error('Every source layer must appear exactly once.');
  await sharp(Buffer.from(svg.join(''))).png().toFile(join(output, `${profile.id}-reference-composite-exploded.png`));
  console.log(`${profile.id}: ${rendered} source layers, ${modules.length} assemblies; comparison 50% / explosion 50%.`);
}
