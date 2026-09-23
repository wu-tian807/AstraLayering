const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='/Users/wutian/Desktop/coding/AstraLayering/rigging/milly',out=path.join(root,'evidence/independent-review');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
  const versions={checkedAt:new Date().toISOString(),files:{}};
  for(const f of ['index.html','milly-animation.svg','rig.js','build.py','motion-tracks.json','rig-manifest.json']){const b=fs.readFileSync(path.join(root,f));versions.files[f]=sha(b);fs.writeFileSync(path.join(out,'reviewed-'+f),b)}
  for(const f of ['step05-base-character/05-2_局部色彩与材质.svg','references/base-character.png','references/line-art.png','step03-base-character/03-1_头型与发型.svg'])versions.files[f]=sha(fs.readFileSync(path.join(root,'../outputs/milly_v1',f)));
  fs.writeFileSync(path.join(out,'versions.json'),JSON.stringify(versions,null,2));
  const browser=await chromium.launch({headless:true,executablePath:'/Users/wutian/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:8765/',r=>r.fulfill({status:200,contentType:'text/html',body:fs.readFileSync(path.join(out,'reviewed-index.html'))}));
  await page.goto('http://127.0.0.1:8765/');await page.waitForFunction(()=>window.MillyRig);
  const defs=await page.evaluate(()=>window.MillyRig.definitions);const tracks=Object.keys(JSON.parse(fs.readFileSync(path.join(root,'motion-tracks.json'))).tracks);
  const results={errors,definitions:defs,trackKeys:tracks,parameters:[],screens:[]};
  async function pose(name,params={},view='face',full=false){await page.evaluate(({params,view})=>{MillyRig.reset();MillyRig.setOutfit(false);MillyRig.set({physics:0,...params});MillyRig.showView(view)}, {params,view});await page.waitForTimeout(50);await (full?page:page.locator('#stage')).screenshot({path:path.join(out,name+'.png')});results.screens.push({name,params,view});}
  await pose('neutral-ui',{},'portrait',true);
  for(const [name,params] of [['neutral',{}],['head-x-minus',{headX:-30}],['head-x-plus',{headX:30}],['head-y-minus',{headY:-30}],['head-y-plus',{headY:30}],['head-z-minus',{headZ:-30}],['head-z-plus',{headZ:30}],['head-all-minus',{headX:-30,headY:-30,headZ:-30}],['head-all-plus',{headX:30,headY:30,headZ:30}],['close-character-left',{eyeLOpen:0}],['close-character-right',{eyeROpen:0}],['close-both-smile',{eyeLOpen:0,eyeROpen:0,eyeLSmile:1,eyeRSmile:1}],['mouth-closed',{mouthOpen:0,mouthForm:0}],['mouth-open-wide',{mouthOpen:1,mouthForm:1}],['mouth-open-round',{mouthOpen:1,mouthForm:-1}],['hair-plus',{hairBangs:1,hairLeft:1,hairRight:1,hairBack:1,cowlick:1}],['hair-minus',{hairBangs:-1,hairLeft:-1,hairRight:-1,hairBack:-1,cowlick:-1}]])await pose(name,params);
  for(const [name,params] of [['body-x-minus',{bodyX:-10}],['body-x-plus',{bodyX:10}],['body-all-plus',{bodyX:10,bodyY:10,bodyZ:10}],['arms-extreme',{armL:30,armR:30,elbowL:30,elbowR:30,wristL:10,wristR:10,handL:1,handR:1}]])await pose(name,params,'full');
  // Read actual UI values and rendered paths after changing every visible control.
  for(const d of defs){
    await page.locator(`[data-tab="${d[5]}"]`).click();
    await page.evaluate(()=>{MillyRig.reset();MillyRig.set({physics:0});});
    const hashes=[];
    for(const value of [d[2],d[3]]){
      await page.locator('#range-'+d[0]).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))},value);
      await page.waitForTimeout(d[0]==='wind'||d[0]==='physics'?350:20);
      const state=await page.evaluate(key=>({actual:MillyRig.parameters[key],mode:MillyRig.state.mode,geometry:[...document.querySelectorAll('#rig-scene path')].map(n=>n.getAttribute('d')).join('|'),html:document.getElementById('rig-scene').innerHTML,nonFinite:[...document.querySelectorAll('#rig-scene path')].filter(n=>/NaN|Infinity|undefined/.test(n.getAttribute('d'))).map(n=>n.id)}),d[0]);
      hashes.push({value,actual:state.actual,mode:state.mode,geometryHash:sha(state.geometry),htmlHash:sha(state.html),nonFinite:state.nonFinite});
    }
    results.parameters.push({key:d[0],label:d[1],endpoints:hashes,geometryChanges:hashes[0].geometryHash!==hashes[1].geometryHash,renderChanges:hashes[0].htmlHash!==hashes[1].htmlHash});
  }
  await page.locator('[data-tab="layers"]').click();await page.locator('#back-only').check();await page.locator('#diagnostic').check();await pose('back-only-neutral',{},'portrait');await pose('back-only-plus',{bodyX:10},'portrait');await page.locator('#back-only').uncheck();await page.locator('#diagnostic').uncheck();
  for(const size of [{width:390,height:844},{width:320,height:740}]){
    await page.setViewportSize(size);await page.locator('[data-tab="face"]').click();await pose('mobile-'+size.width,{},'portrait',true);await page.screenshot({path:path.join(out,'mobile-'+size.width+'-full.png'),fullPage:true});
    results['mobile'+size.width]=await page.evaluate(()=>({viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,elements:[...document.querySelectorAll('header,main,.workspace,.right-panel,.canvas-wrap,.playback,.transport,.header-right,.brand')].map(e=>({selector:e.tagName+'.'+e.className,rect:(()=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right}})()}))}));
    await page.locator('[data-tab="body"]').click();await page.locator('#range-skirt3').evaluate(el=>{el.value='1';el.dispatchEvent(new Event('input',{bubbles:true}))});results['mobile'+size.width].controlWorks=await page.evaluate(()=>MillyRig.parameters.skirt3===1);await page.locator('#range-skirt3').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'mobile-'+size.width+'-controls.png')});
  }
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(results,null,2));await browser.close();console.log(JSON.stringify({version:versions.files['index.html'],parameterCount:defs.length,tracks,nonChanging:results.parameters.filter(x=>!x.renderChanges).map(x=>x.key),mobile390:results.mobile390,mobile320:results.mobile320,errors},null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
