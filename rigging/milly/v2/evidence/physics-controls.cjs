const fs=require('fs');
const {chromium}=require('/Users/wutian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/Users/wutian/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.addInitScript(()=>window.requestAnimationFrame=()=>0);await page.goto('http://127.0.0.1:8765/v2/');
 const dynamics=await page.evaluate(()=>{
  function run(options){MillyRig.reset();MillyRig.set(options);const result=[];for(let i=0;i<240;i++){const t=i/60,u=Math.min(t/1.2,1),s=u*u*(3-2*u);MillyRig.step(1/60,{headX:24*s,bodyX:5*s,headZ:8*s});if(i%6===0)result.push(MillyRig.physics.find(h=>h.id==='hair-cowlick').tip)}return result}
  const values={soft:run({hairStiffness:.2}),firm:run({hairStiffness:1}),lowDamping:run({hairDamping:.2}),highDamping:run({hairDamping:1})};
  const delta=(a,b)=>Math.max(...a.map((v,i)=>Math.abs(v-b[i])));
  MillyRig.reset();for(let i=0;i<60;i++)MillyRig.step(1/60,{headX:25*i/60,headY:15*i/60,bodyX:6*i/60});
  const path=()=>document.getElementById('hair-cowlick-shape').getAttribute('d');const withPhysics=path();p.physics=0;render();const withoutPhysics=path();
  const root=d=>d.match(/[-+]?\d*\.?\d+/g).slice(0,2).map(Number);
  const rootA=root(withPhysics),rootB=root(withoutPhysics);
  const posture={...p};MillyRig.reset();for(let i=0;i<120;i++){const v=i/119;MillyRig.step(1/60,{bodyX:8*v,bodyY:6*v,bodyZ:4*v})}const bodyDriven=MillyRig.physics.find(h=>h.id==='hair-cowlick');
  return{stiffnessDifference:delta(values.soft,values.firm),dampingDifference:delta(values.lowDamping,values.highDamping),rootDrift:Math.hypot(rootA[0]-rootB[0],rootA[1]-rootB[1]),shapeDiffers:withPhysics!==withoutPhysics,bodyDriven,loopDifference:Math.max(...MillyRig.definitions.map(d=>Math.abs(motionAt(30)[d[0]]-motionAt(0)[d[0]]))),values};
 });
 const live=await browser.newPage({viewport:{width:1440,height:1000}});await live.goto('http://127.0.0.1:8765/v2/');await live.locator('[data-tab="head"]').click();await live.locator('#range-hairStiffness').fill('0.85');await live.locator('#range-hairStiffness').dispatchEvent('input');await live.waitForTimeout(1000);
 const settingsDuringPlayback=await live.evaluate(()=>({mode:MillyRig.state.mode,playing:MillyRig.state.playing,value:MillyRig.renderedParameters.hairStiffness,fps:window.millyFPS}));
 await live.locator('#reset').click();await live.locator('#follow').click();const box=await live.locator('#stage').boundingBox();await live.mouse.move(box.x+box.width*.9,box.y+box.height*.3);await live.waitForTimeout(80);
 const follow=await live.evaluate(()=>({target:MillyRig.parameters,current:MillyRig.renderedParameters}));await live.waitForTimeout(1400);const settled=await live.evaluate(()=>MillyRig.renderedParameters);
 const defs=await live.evaluate(()=>MillyRig.definitions);fs.writeFileSync('rigging/milly/v2/parameter-map.json',JSON.stringify(defs.map(([key,label,min,max,defaultValue,group])=>({key,label,min,max,default:defaultValue,group})),null,2));
 const report={dynamics,settingsDuringPlayback,follow,settled,pass:dynamics.stiffnessDifference>.1&&dynamics.dampingDifference>.1&&dynamics.rootDrift===0&&dynamics.shapeDiffers&&Math.abs(dynamics.bodyDriven.tip)>.3&&settingsDuringPlayback.value===.85&&settingsDuringPlayback.playing&&follow.current.headX/follow.target.headX>follow.current.bodyX/follow.target.bodyX&&Math.abs(settled.bodyX-follow.target.bodyX)<.02};
 fs.writeFileSync('rigging/milly/v2/evidence/physics-controls.json',JSON.stringify(report,null,2));console.log({pass:report.pass,dynamics:{...dynamics,values:undefined},settingsDuringPlayback,followRatios:[follow.current.headX/follow.target.headX,follow.current.bodyX/follow.target.bodyX]});await browser.close();
})();
