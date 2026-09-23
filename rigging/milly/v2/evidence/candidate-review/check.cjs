const fs=require('fs'), path=require('path');
const {chromium}=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=__dirname, html=fs.readFileSync(path.join(out,'reviewed-index.html'),'utf8');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Users/wutian/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 await page.route('http://127.0.0.1:8765/v2/',r=>r.fulfill({status:200,contentType:'text/html',body:html}));
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:8765/v2/');await page.waitForFunction(()=>window.MillyRig);
 const records={errors,statics:[],dynamics:[],pointer:[]};
 const poses=[['neutral',{}],['face-xplus',{headX:30}],['face-xminus',{headX:-30}],['face-bothplus',{headX:30,bodyX:10}],['face-bothminus',{headX:-30,bodyX:-10}],['face-down',{headY:30,bodyY:10}],['face-up',{headY:-30,bodyY:-10}],['face-combination',{headX:30,headY:30,headZ:30,bodyX:10,bodyY:10}],['arms-open',{armL:-15,armR:-15,elbowL:-15,elbowR:-15}],['arms-front-left',{armL:-30,elbowL:-30,bodyX:10}],['arms-front-right',{armR:-30,elbowR:-30,bodyX:-10}],['arms-back',{armL:30,armR:30,elbowL:30,elbowR:30}],['arm-back-turn',{armL:25,elbowL:30,armR:25,elbowR:30,bodyX:10}],['eyes-closed',{eyeLOpen:0,eyeROpen:0}],['eye-left',{eyeLOpen:0,headX:30}],['eye-right',{eyeROpen:0,headX:-30}],['mouth-max',{mouthOpen:1,mouthForm:1}]];
 for(const[name,p]of poses){await page.evaluate(({name,p})=>{MillyRig.reset();MillyRig.set({...p,physics:0});MillyRig.showView(name.startsWith('arms')||name.startsWith('arm-')?'portrait':'face')},{name,p});await page.locator('#stage').screenshot({path:path.join(out,name+'.png')});records.statics.push({name,p});}
 for(const time of[.5,1,3,6,12,15.3]){await page.evaluate(t=>{MillyRig.seek(t);MillyRig.showView('portrait')},time);await page.locator('#stage').screenshot({path:path.join(out,'at-'+time+'.png')});records.statics.push({time,params:await page.evaluate(()=>MillyRig.parameters)});}
 for(const [name,start,stamps]of[['turn-a',2.35,[2.6,2.8,3.0,3.2,3.5]],['turn-b',4.35,[4.6,4.8,5.0,5.2,5.4,5.6]],['nod',14.85,[15.1,15.2,15.3,15.4,15.5,15.7]]]){
  await page.evaluate(s=>{MillyRig.reset();MillyRig.seek(s);MillyRig.showView('portrait');document.querySelector('#play').click()},start);
  for(const target of stamps){await page.waitForFunction(t=>MillyRig.state.time>=t,target);const info=await page.evaluate(()=>({state:MillyRig.state,p:MillyRig.renderedParameters,physics:MillyRig.physics}));await page.locator('#stage').screenshot({path:path.join(out,`${name}-${target}.png`)});records.dynamics.push({name,target,...info});}
 }
 await page.evaluate(()=>{MillyRig.reset();MillyRig.showView('portrait');MillyRig.set({wind:0,headX:-25,headZ:-12,bodyX:-7});});await page.waitForTimeout(200);await page.evaluate(()=>MillyRig.set({headX:25,headZ:12,bodyX:7},{smooth:true}));
 for(let i=0;i<9;i++){const info=await page.evaluate(()=>({state:MillyRig.state,p:MillyRig.renderedParameters,physics:MillyRig.physics}));await page.locator('#stage').screenshot({path:path.join(out,`smooth-${i}.png`)});records.dynamics.push({name:'smooth',i,...info});await page.waitForTimeout(130);}
 await page.evaluate(()=>{MillyRig.reset();MillyRig.showView('portrait');document.querySelector('#follow').click()});const box=await page.locator('#stage').boundingBox();await page.mouse.move(box.x+box.width*.9,box.y+box.height*.7);for(let i=0;i<6;i++){records.pointer.push(await page.evaluate(()=>({p:MillyRig.renderedParameters,target:MillyRig.parameters})));await page.waitForTimeout(50);}
 for(const width of[390,320]){await page.setViewportSize({width,height:844});await page.evaluate(()=>MillyRig.reset());await page.screenshot({path:path.join(out,`mobile-${width}.png`),fullPage:true});records['mobile'+width]=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,innerWidth,scrollHeight:document.documentElement.scrollHeight}));}
 fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(records,null,2));await browser.close();console.log('done');
})();
