import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const [repo, task] = process.argv.slice(2);
if (!repo || !task) throw new Error('Pass repository and task directories.');
const output = join(task, 'nine-axis/step08_hair');
const shared = join(repo, '.agents/skills/live2d-maker/shared');
const three = dirname(fileURLToPath(import.meta.resolve('three')));
const doc = JSON.parse(await readFile(join(output, 'deformers.json'), 'utf8'));
const origin = 'http://edge-overlay.local';
const html = `<!doctype html><html><head><style>html,body{margin:0}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"/three.module.js"}}</script></head>
<body><canvas width="774" height="774"></canvas><script type="module">
import {HeadNineAxisRenderer,shownParts,createNineAxisBitmap} from '/nine-axis-render.js';
try {
 const doc=await(await fetch('/model.json')).json();
 const images=await Promise.all(doc.parts.map(async(p,i)=>createNineAxisBitmap(await(await fetch('/texture/'+i)).blob())));
 const canvas=document.querySelector('canvas'), view=new HeadNineAxisRenderer(canvas);
 view.renderer.setPixelRatio(1);view.renderer.setSize(774,774,false);view.install(doc,images);
 const shown=shownParts(doc,'hair');
 for(const p of doc.parts)if(p.id==='hair/back_hair'||p.id.startsWith('hair/braid'))shown.delete(p.id);
 view.draw({x0:319,y0:-21,width:774,height:774},-30,0,shown);
 window.png=canvas.toDataURL('image/png');window.ready='ok';
} catch(error){window.ready=String(error?.stack??error)}
</script></body></html>`;
const browser = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:774,height:774}});
 await page.route(origin+'/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/')return route.fulfill({contentType:'text/html',body:html});
  if(path==='/model.json')return route.fulfill({contentType:'application/json',body:JSON.stringify(doc)});
  if(path.startsWith('/texture/'))return route.fulfill({contentType:'image/png',body:await readFile(join(output,doc.parts[Number(path.slice(9))].texture))});
  if(path==='/three.module.js'||path==='/three.core.js')return route.fulfill({contentType:'text/javascript',body:await readFile(join(three,path))});
  if(path==='/nine-axis-render.js'||path==='/nine-axis-model.js')return route.fulfill({contentType:'text/javascript',body:await readFile(join(shared,path))});
  return route.fulfill({status:404});
 });
 await page.goto(origin+'/');
 await page.waitForFunction(()=>window.ready,undefined,{timeout:60000});
 const ready=await page.evaluate(()=>window.ready);
 if(ready!=='ok')throw Error(ready);
 const png=await page.evaluate(()=>window.png);
 await writeFile(join(output,'workspace/new-edge-source.png'),Buffer.from(png.split(',')[1],'base64'));
 console.log('Rendered New at reference canvas coordinates with a transparent background.');
} finally {await browser.close()}
