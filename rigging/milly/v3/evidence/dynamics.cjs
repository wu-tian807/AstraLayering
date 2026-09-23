const fs=require('fs');
const {chromium}=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir='rigging/milly/v3/evidence/dynamics';fs.mkdirSync(dir,{recursive:true});
async function sheet(files,name,w=300,columns=6){
 const cells=await Promise.all(files.map(async (file,i)=>{const buffer=await sharp(file).resize({width:w}).toBuffer();const m=await sharp(buffer).metadata();return{input:buffer,left:i%columns*w,top:Math.floor(i/columns)*m.height}}));
 const height=(await sharp(cells[0].input).metadata()).height;
 await sharp({create:{width:w*columns,height:height*Math.ceil(files.length/columns),channels:3,background:'#eee'}}).composite(cells).jpeg({quality:90}).toFile(dir+'/'+name+'.jpg');
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/wutian/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
 await page.goto('http://127.0.0.1:8765/v3/');
 const temporal=await page.evaluate(()=>{
  MillyRig.reset();const log=[];
  for(let frame=0;frame<=360;frame++){
   const time=frame/60,u=Math.min(time/2,1),s=u*u*u*(u*(u*6-15)+10);
   MillyRig.step(1/60,{headX:24*s,headZ:-7*s,headY:13*s,bodyX:6*s,bodyZ:-3*s,bodyY:5*s});
   if(frame%6===0)log.push({time,pose:MillyRig.renderedParameters,hair:MillyRig.physics});
  }
  return log;
 });
 // Identical projected pose, different movement history: visible physics must differ.
 await page.evaluate(()=>{MillyRig.reset();MillyRig.showView('face');});
 const smoothShots=[];
 for(let n=0;n<=18;n++){
  await page.evaluate(n=>{for(let f=0;f<10;f++){const time=(n*10+f)/60,u=Math.min(time/1.8,1),s=u*u*(3-2*u);MillyRig.step(1/60,{headX:26*s,headZ:-9*s,bodyX:6*s,bodyZ:-2*s});}},n);
  const file=dir+'/smooth-'+n.toString().padStart(2,'0')+'.png';await page.locator('#milly-svg').screenshot({path:file});smoothShots.push(file);
 }
 await sheet(smoothShots,'smooth-turn',250,5);
 const sequences=[];
 for(const [name,start,end]of [['turn-a',2.2,3.7],['turn-b',4.3,5.9],['nod',14.7,16.3]]){
  await page.evaluate(start=>{MillyRig.reset();MillyRig.showView('portrait');for(let i=0;i<Math.round(start*60);i++)MillyRig.step(1/60,motionAt(i/60));},start);
  const files=[];
  for(let frame=Math.round(start*60);frame<=Math.round(end*60);frame++){
   await page.evaluate(f=>MillyRig.step(1/60,motionAt(f/60)),frame);
   if(frame%6===0){const file=dir+'/'+name+'-'+(frame/60).toFixed(2)+'.png';await page.locator('#milly-svg').screenshot({path:file});files.push(file);}
  }
  await sheet(files,name,270,6);sequences.push(name);
 }
 const values=await page.evaluate(()=>({paths:MillyRig.paths,parameters:MillyRig.definitions.length,invalid:[...document.querySelectorAll('path[d]')].filter(e=>/NaN|undefined|Infinity/.test(e.getAttribute('d'))).map(e=>e.id)}));
 fs.writeFileSync(dir+'/dynamics.json',JSON.stringify({temporal,sequences,values,errors},null,2));
 const cow=temporal.map(f=>f.hair.find(s=>s.id==='hair-cowlick')),side=temporal.map(f=>f.hair.find(s=>s.id==='rig-hair-left-1'));
 console.log({cowPeak:Math.max(...cow.map(s=>Math.abs(s.tip))),sidePeak:Math.max(...side.map(s=>Math.abs(s.tip))),cowEnd:cow.at(-1),sideEnd:side.at(-1),values,errors});
 await browser.close();
})();
