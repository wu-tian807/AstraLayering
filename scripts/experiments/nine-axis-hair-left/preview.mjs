import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';

const [repo, task] = process.argv.slice(2);
const bangsLeft = process.argv[4] === 'bangs-left';
const sideHairLeft = process.argv[4] === 'side-hair-left';
const backHairLeft = process.argv[4] === 'back-hair-left';
const leftOnly = bangsLeft || sideHairLeft || backHairLeft;
if (!repo || !task) throw new Error('Pass repository and task directories.');
const output = join(task, 'nine-axis/step08_hair');
const shared = join(repo, '.agents/skills/live2d-maker/shared');
const three = dirname(fileURLToPath(import.meta.resolve('three')));
const doc = JSON.parse(await readFile(process.argv[6] ?? join(output, 'deformers.json'), 'utf8'));
const frame = bangsLeft ? { x0: 550, y0: 175, width: 335, height: 395 }
  : sideHairLeft || backHairLeft ? { x0: 460, y0: 175, width: 500, height: 570 } : { x0: 444, y0: 155, width: 530, height: 650 };
const width = 572, height = bangsLeft ? 674 : sideHairLeft || backHairLeft ? 652 : 702;
const prefix = process.argv[5] ?? (bangsLeft ? 'left-bangs' : sideHairLeft ? 'left-side-hair' : backHairLeft ? 'left-back-hair' : 'hair-left-right');
if (!/^[a-z0-9-]+$/.test(prefix)) throw new Error('Preview name must use lowercase letters, numbers or hyphens.');
const poseFile = x => join(output, sideHairLeft || backHairLeft ? `${prefix}-x${x}.png` : `preview-x${x}.png`);
const frames = join(output, `workspace/${prefix}-frames`);
await mkdir(frames, { recursive: true });
const origin = 'http://hair-preview.local';
const html = `<!doctype html><html><head><style>
html,body{margin:0}#view{width:${width}px;height:${height}px;background:#2b2e35;
background-image:linear-gradient(45deg,#30333a 25%,transparent 25%,transparent 75%,#30333a 75%),linear-gradient(45deg,#30333a 25%,transparent 25%,transparent 75%,#30333a 75%);
background-size:24px 24px;background-position:0 0,12px 12px}canvas{display:block}
</style><script type="importmap">{"imports":{"three":"/three.module.js"}}</script></head>
<body><div id="view"><canvas></canvas></div><script type="module">
import { HeadNineAxisRenderer, shownParts, createNineAxisBitmap } from '/nine-axis-render.js';
try {
 const {doc,frame,bangsLeft,sideHairLeft,backHairLeft}=await (await fetch('/args.json')).json();
 const images=await Promise.all(doc.parts.map(async(p,i)=>createNineAxisBitmap(await(await fetch('/texture/'+i)).blob())));
 const view=new HeadNineAxisRenderer(document.querySelector('canvas'));
 view.renderer.setPixelRatio(1);view.renderer.setSize(${width},${height},false);view.install(doc,images);
 const shown=shownParts(doc,'hair');
 if(bangsLeft)for(const p of doc.parts)if(p.id.startsWith('hair/')&&p.id!=='hair/bangs')shown.delete(p.id);
 if(sideHairLeft)for(const p of doc.parts)if(p.id==='hair/back_hair'||p.id.startsWith('hair/braid'))shown.delete(p.id);
 if(backHairLeft)for(const p of doc.parts)if(p.id.startsWith('hair/braid'))shown.delete(p.id);
 window.draw=async x=>{view.draw(frame,x,0,shown);await new Promise(requestAnimationFrame)};
 await window.draw(0);window.ready='ok';
}catch(error){window.ready=String(error?.stack??error)}
</script></body></html>`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
 const page = await browser.newPage({ viewport: { width, height } });
 await page.route(origin + '/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/') return route.fulfill({ contentType: 'text/html', body: html });
  if (path === '/args.json') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ doc, frame, bangsLeft, sideHairLeft, backHairLeft }) });
  if (path.startsWith('/texture/')) return route.fulfill({ contentType: 'image/png', body: await readFile(join(output, doc.parts[Number(path.slice(9))].texture)) });
  if (path === '/three.module.js' || path === '/three.core.js') return route.fulfill({ contentType: 'text/javascript', body: await readFile(join(three, path)) });
  if (path === '/nine-axis-render.js' || path === '/nine-axis-model.js') return route.fulfill({ contentType: 'text/javascript', body: await readFile(join(shared, path)) });
  return route.fulfill({ status: 404 });
 });
 await page.goto(origin + '/');
 await page.waitForFunction(() => window.ready, undefined, { timeout: 60_000 });
 const ready = await page.evaluate(() => window.ready);
 if (ready !== 'ok') throw new Error(ready);
 for (const x of leftOnly ? [-30, -15, 0] : [-30, -15, 0, 15, 30]) {
  await page.evaluate(x => window.draw(x), x);
  await page.locator('#view').screenshot({ path: poseFile(x) });
 }
 const count = leftOnly ? 48 : 72;
 const angles = Array.from({ length: count }, (_, i) => leftOnly ? -15 + 15 * Math.cos(2 * Math.PI * i / count) : -30 * Math.sin(2 * Math.PI * i / count));
 await writeFile(join(frames, 'angles.json'), JSON.stringify(angles) + '\n');
 for (const [i, x] of angles.entries()) {
  await page.evaluate(x => window.draw(x), x);
  await page.locator('#view').screenshot({ path: join(frames, `frame${String(i).padStart(3, '0')}.png`) });
 }
} finally { await browser.close(); }
const titles = leftOnly ? ['Reference', 'Neutral', backHairLeft ? 'Left with back hair' : sideHairLeft ? 'Left side hair' : 'Left bangs'] : ['left', 'neutral', 'right'];
const reference = leftOnly ? await sharp(join(output, 'references/left.png')).extract({ left: frame.x0 - 319, top: frame.y0 + 21, width: frame.width, height: frame.height }).resize(width, height).png().toBuffer() : undefined;
const label = Buffer.from(`<svg width="${width * 3}" height="${height + 30}"><g fill="white" font-family="sans-serif" font-size="17">${titles.map((title, i) => `<text x="${width * i + 12}" y="22">${title}</text>`).join('')}</g></svg>`);
await sharp({ create: { width: width * 3, height: height + 30, channels: 4, background: '#20242b' } }).composite([
 { input: reference ?? poseFile(-30), left: 0, top: 30 },
 { input: poseFile(0), left: width, top: 30 },
 { input: poseFile(leftOnly ? -30 : 30), left: width * 2, top: 30 },
 { input: label, left: 0, top: 0 },
]).png().toFile(join(output, `${prefix}.png`));
const run = promisify(execFile);
const input = join(frames, 'frame%03d.png');
await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', input, '-filter_complex', '[0:v]split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0', join(output, `${prefix}.gif`)]);
await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '12', '-i', input, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', join(output, `${prefix}.mp4`)]);
console.log(leftOnly ? 'Rendered the left hair comparison and neutral-to-left model motion.' : 'Rendered the two authored sides and their interpolated model motion.');
