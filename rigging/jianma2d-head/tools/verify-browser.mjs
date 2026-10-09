import {strict as assert} from 'node:assert';
import fs from 'node:fs/promises';
const driver=await import(process.env.ASTRA_PLAYWRIGHT||'playwright');
const {chromium}=driver.default??driver;
const base=process.argv[2]||'http://127.0.0.1:8796/rigging/jianma2d-head/';
const out=process.argv[3]||'/tmp/jianma-head-evidence';await fs.mkdir(out,{recursive:true});
const b=await chromium.launch({headless:true,...(process.env.ASTRA_CHROMIUM?{executablePath:process.env.ASTRA_CHROMIUM}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const p=await b.newPage({viewport:{width:1360,height:880}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await p.goto(base);await p.waitForFunction(()=>window.headRig?.ready);await p.waitForTimeout(60);
 const initial=await p.evaluate(()=>({pose:headRig.getPose(),storage:JSON.stringify(localStorage)}));assert.deepEqual(initial.pose,{x:0,y:0,z:0});
 for(const y of [30,0,-30])for(const x of [-30,0,30]){
  await p.evaluate(q=>headRig.setPose(q),{x,y,z:0});await p.waitForTimeout(60);
  await p.locator('.viewport').screenshot({path:`${out}/pose-${x}-${y}.png`});
  const pose=await p.evaluate(()=>headRig.getPose());assert.deepEqual(pose,{x,y,z:0});
 }
 await p.locator('#nine button').nth(0).click();await p.waitForTimeout(1000);
 assert.ok(await p.evaluate(()=>Math.abs(headRig.getPose().x+30)<.01&&Math.abs(headRig.getPose().y-30)<.01));
 await p.locator('#reset').click();await p.waitForTimeout(1000);
 assert.deepEqual(await p.evaluate(()=>headRig.getPose()),{x:0,y:0,z:0});
 await p.locator('#pad').focus();await p.keyboard.press('ArrowRight');await p.waitForTimeout(700);
 assert.ok(await p.evaluate(()=>Math.abs(headRig.getPose().x-2)<.01));
 for(const id of ['grid','bare','closeup'])await p.locator('#'+id).check();
 await p.evaluate(()=>headRig.setPose({x:30,y:-30,z:20}));await p.waitForTimeout(60);await p.locator('.viewport').screenshot({path:out+'/bare-corner.png'});
 assert.ok(await p.locator('#guides path').count()>10);
 for(const id of ['grid','bare','closeup'])await p.locator('#'+id).uncheck();
 await p.evaluate(()=>headRig.setPose({x:-30,y:0,z:0}));
 await p.locator('#nine button').nth(5).click();await p.waitForTimeout(250);
 assert(await p.evaluate(()=>headRig.renderer.physics.energy>1),'hair must continue behind the head');
 await p.waitForFunction(()=>headRig.renderer.physics.energy===0);
 await p.locator('#physics').uncheck();assert.equal(await p.evaluate(()=>headRig.renderer.physics.enabled),false);
 await p.locator('#physics').check();
 await p.locator('#play').click();const before=await p.evaluate(()=>headRig.getPose());await p.waitForTimeout(400);const after=await p.evaluate(()=>headRig.getPose());assert.notDeepEqual(before,after);await p.locator('#play').click();
 // The renderer must recover after WebGL context eviction, common on mobile/Safari.
 await p.evaluate(()=>{const ext=headRig.renderer.gl.getExtension('WEBGL_lose_context');window.testRestore=ext;ext.loseContext();});await p.waitForTimeout(100);await p.evaluate(()=>testRestore.restoreContext());await p.waitForFunction(()=>document.getElementById('status').textContent!=='图形上下文已暂停，等待恢复…');
 await p.evaluate(()=>headRig.setPose({x:0,y:0,z:0}));await p.waitForTimeout(80);
 const drawn=await p.evaluate(()=>{const r=headRig.renderer;r.draw(headRig.getPose());const gl=r.gl,a=new Uint8Array(r.canvas.width*r.canvas.height*4);gl.readPixels(0,0,r.canvas.width,r.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-234)+Math.abs(a[i+1]-230)+Math.abs(a[i+2]-223)>35)n++;return n;});assert.ok(drawn>2000,'Character must remain rendered after restore');
 await p.setViewportSize({width:390,height:760});await p.waitForTimeout(100);await p.locator('footer').scrollIntoViewIfNeeded();
 const layout=await p.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,scrollY,footer:document.querySelector('footer').getBoundingClientRect().bottom,storage:JSON.stringify(localStorage)}));assert.ok(layout.scrollWidth<=layout.width);assert.ok(layout.scrollY>0);assert.ok(layout.footer<=762);assert.equal(layout.storage,initial.storage);
 await p.screenshot({path:out+'/mobile-controls.png'});assert.deepEqual(errors,[]);
 await fs.writeFile(out+'/browser.json',JSON.stringify({passed:true,checks:['nine endpoints','smooth boundary click','neutral reset','keyboard XY','guides','bare head','closeup','continuous tour','inertia lag and settling','physics comparison toggle','WebGL restoration','mobile scroll','no storage writes','no JS/HTTP errors'],drawnPixels:drawn,layout,errors,browser:await b.version()},null,2));
 console.log('Browser checks passed; evidence:',out);
}finally{await b.close();}
