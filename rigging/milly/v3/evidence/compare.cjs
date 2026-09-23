const fs=require('fs'),sharp=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const{chromium}=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const dir='rigging/milly/v3/evidence';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/wutian/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.addInitScript(()=>window.requestAnimationFrame=()=>0);let metrics=[];
 for(const version of [2,3]){
  await page.goto('http://127.0.0.1:8765/v'+version+'/');
  const cases=[['body-neutral',{},'320 265 380 580'],['body-turn',{bodyX:10,bodyY:10,bodyZ:8},'295 265 430 600'],['body-arms',{armL:-25,armR:-25,elbowL:-15,elbowR:-15},'100 265 800 630'],['left',{headX:-30},'340 22 335 325'],['neutral',{},'340 22 335 325'],['right',{headX:30},'340 22 335 325'],['closed-turn',{headX:30,headY:20,eyeLOpen:0,eyeROpen:0},'340 22 335 325'],['combined',{headX:30,headY:30,headZ:25,bodyX:10,bodyY:10},'290 5 440 410']];
  for(const [name,pose,box]of cases){
   await page.evaluate(({pose,box})=>{MillyRig.reset();MillyRig.set({...pose,physics:0});document.getElementById('milly-svg').setAttribute('viewBox',box)}, {pose,box});
   await page.locator('#milly-svg').screenshot({path:dir+'/v'+version+'-'+name+'.png'});
   if(['left','neutral','right'].includes(name))metrics.push(await page.evaluate(({version,name})=>{const bounds=id=>{const b=document.getElementById(id).getBBox();return{x:b.x,y:b.y,width:b.width,height:b.height}};return{version,name,face:bounds('head-face-contour'),left:bounds('rig-eye-left-aperture'),right:bounds('rig-eye-right-aperture'),mouth:bounds('rig-mouth-upper-lip')};},{version,name}));
  }
 }
 for(const name of ['body-neutral','body-turn','body-arms','closed-turn','combined']){
  const buffers=await Promise.all([2,3].map(v=>sharp(dir+'/v'+v+'-'+name+'.png').resize({width:600}).toBuffer()));const meta=await sharp(buffers[0]).metadata();
  await sharp({create:{width:1200,height:meta.height,channels:3,background:'#faf6f0'}}).composite(buffers.map((input,i)=>({input,left:600*i,top:0}))).png().toFile(dir+'/comparison-'+name+'.png');
 }
 const files=['left','neutral','right'].map(name=>dir+'/v3-'+name+'.png'),buffers=await Promise.all(files.map(f=>sharp(f).resize({width:480}).toBuffer())),meta=await sharp(buffers[0]).metadata();
 await sharp({create:{width:1440,height:meta.height,channels:3,background:'#faf6f0'}}).composite(buffers.map((input,i)=>({input,left:i*480,top:0}))).png().toFile(dir+'/head-range-v3.png');
 fs.writeFileSync(dir+'/face-metrics.json',JSON.stringify(metrics,null,2));console.log(metrics);await browser.close();
})();
