/** Cache the exact expression SVG. Raster alpha bounds avoid getBBox pollution from hidden guides/defs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {classify} from '../deformer.mjs';
import {prepareArtwork} from './prepare-artwork.mjs';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=process.argv[2];if(!input)throw Error('Usage: node tools/build-atlas.mjs source.svg');
const driver=await import(process.env.ASTRA_PLAYWRIGHT||'playwright'),{chromium}=driver.default??driver;
const rig=JSON.parse(await fs.readFile(path.join(dir,'rig.json'))),source=JSON.parse(await fs.readFile(path.join(dir,'source.json')));
const svg=await fs.readFile(input,'utf8'),inputSha256=createHash('sha256').update(svg).digest('hex');
if(inputSha256!==source.sourceSha256)throw Error('Wrong SVG: head and expression must use the same declared source');
const browser=await chromium.launch({headless:true,...(process.env.ASTRA_CHROMIUM?{executablePath:process.env.ASTRA_CHROMIUM}:{}),args:['--no-sandbox']});
try{
 const [x,y,w,h]=rig.preview.atlasClip,scale=rig.preview.textureScale;
 const page=await browser.newPage({viewport:{width:w*scale,height:h*scale},deviceScaleFactor:1});
 await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block}</style>'+svg);
 await page.addScriptTag({content:'window.prepareArtwork='+prepareArtwork.toString()});
 const preparation=await page.evaluate(()=>prepareArtwork(document.querySelector('svg')));
 const groups=await page.evaluate(()=>[...document.querySelector('svg').children].filter(n=>n.localName==='g').map(n=>n.id));
 for(const id of Object.keys(rig.bindings))if(!groups.includes(id))throw Error('Binding has no source group: '+id);
 const batches=[];
 for(const id of groups){const kind=classify(id,rig),prior=batches.at(-1);if(prior?.kind===kind)prior.groups.push(id);else batches.push({kind,groups:[id]});}
 await fs.mkdir(path.join(dir,'textures'),{recursive:true});const layers=[];
 for(const batch of batches){
  await page.evaluate(({groups,clip,scale})=>{const s=document.querySelector('svg');s.setAttribute('viewBox',clip.join(' '));s.setAttribute('width',clip[2]*scale);s.setAttribute('height',clip[3]*scale);for(const g of s.children)if(g.localName==='g')g.style.display=groups.includes(g.id)?'inline':'none';},{groups:batch.groups,clip:[x,y,w,h],scale});
  const png=await page.screenshot({omitBackground:true});
  const crop=spawnSync('python3',['-c',`import sys,json,io\nfrom PIL import Image\nim=Image.open(io.BytesIO(sys.stdin.buffer.read()));b=im.getchannel('A').getbbox()\nif not b: print('null');sys.exit(0)\nb=(max(0,b[0]-4),max(0,b[1]-4),min(im.width,b[2]+4),min(im.height,b[3]+4));im.crop(b).save(sys.argv[1]);print(json.dumps(b))`,path.join(dir,'textures','pending.png')],{input:png,maxBuffer:1024*1024});
  if(crop.status!==0)throw Error(crop.stderr.toString());const box=JSON.parse(crop.stdout.toString());if(!box)continue;
  const file=`textures/${String(layers.length).padStart(2,'0')}-${batch.kind}.png`;await fs.rename(path.join(dir,'textures','pending.png'),path.join(dir,file));
  layers.push({...batch,file,blend:'normal',box:[x+box[0]/scale,y+box[1]/scale,(box[2]-box[0])/scale,(box[3]-box[1])/scale],scale});
  console.log(layers.length,batch.kind,batch.groups.join(','));
 }
 await fs.writeFile(path.join(dir,'layers.json'),JSON.stringify({schema:'astra.svg-preview-textures.v4',inputSha256,sourcePreserved:true,preparation,clip:rig.preview.atlasClip,layers},null,2)+'\n');
 const retained=new Set(layers.map(l=>path.basename(l.file)));for(const file of await fs.readdir(path.join(dir,'textures')))if(/^\d{2}-[A-Za-z]+\.png$/.test(file)&&!retained.has(file))await fs.unlink(path.join(dir,'textures',file));
}finally{await browser.close();}
