const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='/Users/wutian/Desktop/coding/AstraLayering/rigging/milly',out=path.join(root,'evidence/independent-review',process.env.REVIEW_VERSION||'');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'/Users/wutian/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:1});
await page.route('http://127.0.0.1:8765/',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(out,'reviewed-index.html'))}));await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>window.MillyRig);
const details={};
await page.locator('[data-tab="head"]').click();
const geom=async()=>sha(await page.evaluate(()=>document.getElementById('rig-scene').innerHTML));
await page.evaluate(()=>{MillyRig.reset();MillyRig.set({wind:0,physics:1})});await page.waitForTimeout(500);const calm=await geom();await page.locator('#range-wind').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(500);const windy=await geom();await page.locator('#range-physics').evaluate(el=>{el.value='0';el.dispatchEvent(new Event('input',{bubbles:true}))});await page.waitForTimeout(100);const stopped=await geom();details.windAndPhysics={calm,windy,stopped,windChanges:calm!==windy,physicsChanges:windy!==stopped};
// Directly retain transformed artwork with the original coordinate canvas for same-scale comparison.
const comparison=await browser.newPage({viewport:{width:732,height:700},deviceScaleFactor:1});
async function captureSVG(svg,name,viewBox='325 10 366 350') {await comparison.setContent('<html><style>body{margin:0;background:#fffaf3}svg{display:block;width:732px;height:700px}.skirt-part{display:none}.show-skirt .skirt-part{display:inline}</style><body>'+svg+'</body></html>');await comparison.locator('svg').evaluate((s,v)=>{s.setAttribute('viewBox',v);s.setAttribute('preserveAspectRatio','xMidYMid meet')},viewBox);await comparison.screenshot({path:path.join(out,name+'.png')});}
await captureSVG(fs.readFileSync(path.join(root,'../outputs/milly_v1/step05-base-character/05-2_局部色彩与材质.svg'),'utf8'),'baseline-face');
await page.evaluate(()=>{MillyRig.reset();MillyRig.set({physics:0})});const neutral=await page.locator('#milly-svg').evaluate(e=>e.outerHTML);await captureSVG(neutral,'candidate-neutral-face');
for(const x of [-10,0,10]){await page.evaluate(x=>{MillyRig.reset();MillyRig.set({physics:0,bodyX:x});MillyRig.showView('portrait')},x);await captureSVG(await page.locator('#milly-svg').evaluate(e=>e.outerHTML),'garment-'+x,'380 320 250 465');}
// Fix the neutral gradient values and measure whether the geometry and paint servers co-move.
await page.evaluate(()=>{MillyRig.reset();MillyRig.set({physics:0})});
const paintSnapshot=()=>({gradient:document.getElementById('s52-face-cheek-right').outerHTML,shape:[...document.querySelectorAll('#head-face path')].filter(e=>e.getAttribute('fill')==='url(#s52-face-cheek-right)').map(e=>e.outerHTML),irisGradient:document.getElementById('s52-right-iris-value').outerHTML});
details.paintNeutral=await page.evaluate(paintSnapshot);await page.evaluate(()=>MillyRig.set({headX:30,headY:30,headZ:30}));details.paintExtreme=await page.evaluate(paintSnapshot);
// Check timeline seeking and reference video media metadata in the actual UI.
await page.locator('#timeline').evaluate(el=>{el.value='15';el.dispatchEvent(new Event('input',{bubbles:true}))});details.seek=await page.evaluate(()=>({state:MillyRig.state,headX:MillyRig.parameters.headX}));
await page.locator('#reference-open').click();await page.waitForTimeout(400);details.video=await page.locator('#reference-video').evaluate(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,readyState:v.readyState,error:v.error?.message||null}));await page.locator('#reference-close').click();
details.newMasks=await page.evaluate(()=>[...document.querySelectorAll('#milly-svg mask')].map(e=>e.id));details.castGroups=await page.evaluate(()=>document.querySelectorAll('#milly-svg [data-kind="cast"]').length);
fs.writeFileSync(path.join(out,'details.json'),JSON.stringify(details,null,2));await browser.close();console.log(JSON.stringify(details,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
