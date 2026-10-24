import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rename, copyFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { atomicJSON, safePath } from '../artifact-files.ts';
import { ComponentScene } from '../physics-core/component-physics-model.js';
import { configHash, traceWindow, simulationHash } from '../physics-evidence/store.ts';
const hash=(value:Uint8Array|string)=>createHash('sha256').update(value).digest('hex');
const json=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
const put=atomicJSON;
async function optional(path:string){try{return await json(path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}

// Private evidence session uses the same skill-owned renderer as the editor.
// Installed independently, this module needs no frontend or repository files.
export async function renderFingerprint(source:string,catalog:any=undefined){
  catalog??=await json(join(source,'catalog.json'));
  const sourceFiles=[...new Set(catalog.layers.flatMap((l:any)=>[l.original,l.masked,...(l.projection?[l.projection.base,...l.projection.shadows.map((s:any)=>s.original)]:[])]))] as string[];
  const modules=[
    new URL(import.meta.url),
    ...['renderer.js','physics-renderer.js','surface-shadow.js','surface-lighting.js','projection-field.js','lighting-model.js','part-maps.js','harmonic-fill.js'].map(n=>new URL(n,import.meta.url)),
    new URL('../physics-evidence/physics-recorded-frame.js',import.meta.url),
    new URL('../physics-core/component-physics-binding.js',import.meta.url),
    new URL('../../pnpm-lock.yaml',import.meta.url),
    ...['catalog.json','color.png','normal.png','depth.png',...sourceFiles].map(n=>join(source,n))
  ];
  return hash(JSON.stringify(await Promise.all(modules.map(async p=>{try{return hash(await readFile(p));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return null;}}))));
}
export async function renderFrames(config:any, source:string, evidence:string, requests:{test:string;steps:number[];modes:string[];cropSteps?:number[];components?:string[]}[], signal?:AbortSignal) {
  const cdp=process.env.ASTRA_PHYSICS_RENDER_CDP_URL;
  const listenPort=cdp?Number(process.env.ASTRA_PHYSICS_RENDER_PORT):0;
  if(cdp&&(!Number.isInteger(listenPort)||listenPort<1024||listenPort>65535))throw Error('远程物理渲染需要 ASTRA_PHYSICS_RENDER_PORT（1024–65535）及对应隧道');
  const catalog=await json(join(source,'catalog.json')),manifest=await json(join(evidence,'manifest.json'));
  if(manifest.configHash!==configHash(config))throw Error('模拟证据已过期');
  if(manifest.simulationHash!==await simulationHash())throw Error('运行时或输入已改变，请重新模拟再取图');
  const shared=fileURLToPath(new URL('../',import.meta.url)),renderHash=await renderFingerprint(source,catalog);
  if(manifest.renderHash&&manifest.renderHash!==renderHash){
    const archive=join(evidence,'render-backups',manifest.renderHash+'-'+Date.now());await mkdir(archive,{recursive:true});
    const exists=async(path:string)=>{try{await readFile(path);return true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;return false;}};
    for(const name of ['manifest.json','frames.json','viewed.json'])if(await exists(join(evidence,name)))await copyFile(join(evidence,name),join(archive,name));
    for(const run of manifest.runs)for(const kind of ['frames','crops']){const from=join(evidence,run.test,kind);await mkdir(join(archive,run.test),{recursive:true});try{await rename(from,join(archive,run.test,kind));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
  }
  const three=new URL(import.meta.resolve('three'));
  const vendors:Record<string,string>={
    '/vendor/three.module.js':fileURLToPath(three),
    '/vendor/three.core.js':fileURLToPath(new URL('three.core.js',three)),
    '/vendor/mtoon.js':fileURLToPath(import.meta.resolve('@pixiv/three-vrm-materials-mtoon')),
    '/shared/vendor/three.module.js':fileURLToPath(three),
    '/shared/vendor/three.core.js':fileURLToPath(new URL('three.core.js',three))
  };
  const sourceFiles=new Set<string>(['color.png','normal.png','depth.png',...catalog.layers.flatMap((l:any)=>[l.original,l.masked,...(l.projection?[l.projection.base,...l.projection.shadows.map((s:any)=>s.original)]:[])])]);
  const server=createServer(async(req,res)=>{
    try {
      const path=new URL(req.url||'/','http://localhost').pathname;
      if(path==='/') {res.setHeader('Content-Type','text/html');res.end('<script type="importmap">{"imports":{"three":"/vendor/three.module.js","@pixiv/three-vrm-materials-mtoon":"/vendor/mtoon.js"}}</script><div style="width:100vw;height:100vh"><canvas></canvas></div>');return;}
      let file:string|undefined;
      if(vendors[path])file=vendors[path];
      else if(/^\/shared\/(physics-core|physics-evidence|character-render)\/[a-z-]+\.js$/.test(path)||['/shared/physics-core/vendor/psd2live/xpbd.js','/shared/physics-core/vendor/psd2live/pendulum.js','/shared/physics-core/vendor/inochi2d/pendulum.js'].includes(path))file=await safePath(shared,path.slice('/shared/'.length));
      else if(path.startsWith('/source/')&&sourceFiles.has(path.slice('/source/'.length)))file=await safePath(source,path.slice('/source/'.length));
      if(!file)throw Error('无效资源');
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'image/png');res.end(await readFile(file));
    }catch {res.writeHead(404);res.end();}
  });
  await new Promise<void>((r,reject)=>{server.once('error',reject);server.listen(listenPort,'127.0.0.1',r);});const port=(server.address() as any).port;
  let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
  let context:Awaited<ReturnType<NonNullable<typeof browser>['newContext']>>|undefined;
  try {
  browser=cdp?await chromium.connectOverCDP(cdp):await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:Math.min(1400,catalog.canvas.width),height:Math.min(1200,catalog.canvas.height)},deviceScaleFactor:1});
  const page=await context.newPage();
  const sourceScene=new ComponentScene(config);
  const padding=Math.ceil(Math.max(0,...[...sourceScene.bodies.values()].map(b=>b.maxDistance+b.freeLength*.05))+Math.hypot(catalog.canvas.width,catalog.canvas.height)*.04)+2;
  const parentMargin=Math.max(1,...[...sourceScene.bodies.values()].map(b=>b.freeLength))*.05+Math.hypot(catalog.canvas.width,catalog.canvas.height)*.04;
  const cropRects=[...sourceScene.bodies].map(([id,body])=>{const c=body.component,b=Array.from(body.rest) as number[],xs=b.filter((_:number,i:number)=>i%2===0),ys=b.filter((_:number,i:number)=>i%2===1),margin=Math.ceil(c.authoring.freeLength*c.limits.maxTravel+parentMargin)+8;const x=Math.max(-padding,Math.floor(Math.min(...xs))-margin),y=Math.max(-padding,Math.floor(Math.min(...ys))-margin),width=Math.min(catalog.canvas.width+padding-x,Math.ceil(Math.max(...xs))+margin-x),height=Math.min(catalog.canvas.height+padding-y,Math.ceil(Math.max(...ys))+margin-y);return {id,left:x+padding,top:y+padding,width,height};});
  const files:any[]=[],errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+port);
    const renderDevice=await page.evaluate(()=>{const gl=document.createElement('canvas').getContext('webgl2'),debug=gl?.getExtension('WEBGL_debug_renderer_info');return {renderer:debug&&gl?.getParameter(debug.UNMASKED_RENDERER_WEBGL),vendor:debug&&gl?.getParameter(debug.UNMASKED_VENDOR_WEBGL)};});
    const neutralCheck=await page.evaluate(async({config,catalog}:any)=>{
      const render='/shared/character-render/',core='/shared/physics-core/',evidence='/shared/physics-evidence/';
      const {LightingStage,loadImage}=await import(render+'renderer.js');
      const {PhysicsRenderer}=await import(render+'physics-renderer.js');const {ComponentScene}=await import(core+'component-physics-model.js');
      const {extractPartMaps}=await import(render+'part-maps.js');const {applyRecordedFrame}=await import(evidence+'physics-recorded-frame.js');
      const {resolveComponentBindings}=await import(core+'component-physics-binding.js');
      const pixels=(image:any)=>{const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
      const [color,normal,depth]=await Promise.all(['color','normal','depth'].map(async kind=>{try{return await loadImage('/source/'+kind+'.png');}catch{return null;}}));
      const stage=new LightingStage(document.querySelector('canvas'));await stage.load({color,normal,depth});
      const {width:w,height:h}=catalog.canvas,flat=(rgba:number[])=>{const result=new Uint8ClampedArray(w*h*4);for(let i=0;i<result.length;i+=4)result.set(rgba,i);return result;};
      const layers=[];for(const l of catalog.layers){const [a,b]=await Promise.all([l.original,l.masked].map(async f=>pixels(await loadImage('/source/'+f))));for(let i=3;i<a.length;i+=4){a[i]=Math.round(a[i]*l.opacity/255);b[i]=l.visible?Math.round(b[i]*l.opacity/255):0;}let projection=null;if(l.projection){const rgba=pixels(await loadImage('/source/'+l.projection.base));for(let i=3;i<rgba.length;i+=4)rgba[i]=l.visible?Math.round(rgba[i]*l.opacity/255):0;const shadows=[];for(const s of l.projection.shadows){const data=pixels(await loadImage('/source/'+s.original));for(let i=3;i<data.length;i+=4)data[i]=s.visible?Math.round(data[i]*s.opacity/255):0;shadows.push({...s,rgba:data});}projection={...l.projection,rgba,shadows};}layers.push({...l,rgba:a,maskedRgba:b,projection});}
      const maps=extractPartMaps(w,h,layers,normal?pixels(normal):flat([128,128,255,255]),depth?pixels(depth):flat([128,128,128,255]));for(const l of layers)l.map=maps.get(l.id);
      const scene=new ComponentScene(config),bodies=new Map(),bindings=resolveComponentBindings(config,layers);if(bindings.issues.length)throw Error('动态来源映射未完成：'+JSON.stringify(bindings.issues));for(const[id,c]of bindings.assignments){const b=scene.bodies.get(c);if(b)bodies.set(id,b);}
      const renderer=new PhysicsRenderer(stage,layers,bodies,[w,h],scene);
      const neutral=renderer.verifyNeutral(pixels(color));
      (window as any).evidence={stage,scene,renderer,applyRecordedFrame,w,h,layers};
      return {...neutral,padding:renderer.padding,outputSize:renderer.outputSize};
    },{config,catalog});
    for(const request of requests) {
      const run=manifest.runs.find((r:any)=>r.test===request.test);if(!run)throw Error('未知证据测试');
      const maximum=manifest.runs.find((r:any)=>r.test===request.test)?.durationSteps??960;
      const steps=[...new Set(request.steps)].sort((a,b)=>a-b);if(steps.length>600||steps.some(n=>!Number.isInteger(n)||n<0||n>maximum))throw Error('证据帧超出范围');
      const expectedRows=new Map((await traceWindow(evidence,request.test,steps,600)).map((r:any)=>[r.step,r]));
      if(request.modes.some(m=>!['color','lit','normal','depth'].includes(m)))throw Error('无效渲染模式');
      await page.evaluate(()=>{(window as any).evidence.scene.reset();});
      for(const step of steps) {
        signal?.throwIfAborted();
        for(const mode of request.modes) {
          const bytes=await page.evaluate(({mode,expected}:any)=>{
            const e=(window as any).evidence;e.applyRecordedFrame(e.scene,expected);
            e.renderer.update();e.stage.setMode(mode==='color'?'color':mode,false);const[w,h]=e.renderer.outputSize;e.stage.renderer.setSize(w,h,false);e.stage.frame(w,h,true);return e.stage.canvas.toDataURL('image/png').split(',')[1];
          },{mode,expected:expectedRows.get(step)});
          const path=request.test+'/frames/'+String(step).padStart(4,'0')+'-'+mode+'.png';await mkdir(join(evidence,request.test,'frames'),{recursive:true});await writeFile(join(evidence,path),Buffer.from(bytes,'base64'));
          files.push({path,test:request.test,step,mode,configHash:manifest.configHash,renderHash});
          // Fixed source-space crops keep original pixels. Crop margins are
          // motion bounds, not a moving camera that could hide attachment slip.
          for(const {id,left,top,width,height} of cropRects) {
            if(request.cropSteps&&!request.cropSteps.includes(step)||request.components&&!request.components.includes(id))continue;
            if(width<1||height<1)throw Error('组件轮廓不在源画布内');
            const crop=request.test+'/crops/'+hash(id).slice(0,10)+'-'+id.replace(/[^a-zA-Z0-9_-]/g,'_')+'/'+String(step).padStart(4,'0')+'-'+mode+'.png';await mkdir(resolve(join(evidence,crop),'..'),{recursive:true});await sharp(join(evidence,path)).extract({left,top,width,height}).png().toFile(join(evidence,crop));
            files.push({path:crop,test:request.test,step,mode,component:id,rect:{left,top,width,height},configHash:manifest.configHash,renderHash});
          }
        }
      }
    }
    if(errors.length)throw Error('渲染失败：'+errors.join('; '));
    const old=await optional(join(evidence,'frames.json'))||[];
    const all=[...new Map([...old.filter((f:any)=>f.configHash===manifest.configHash&&f.renderHash===renderHash),...files].map(f=>[f.path,f])).values()];await put(join(evidence,'frames.json'),all);
    const completed=manifest.runs.every((r:any)=>Array.from({length:81},(_,i)=>i*12).every(step=>['color','lit'].every(mode=>all.some((f:any)=>f.test===r.test&&f.step===step&&f.mode===mode&&!f.component))));
    delete manifest.replayVerification;delete manifest.inputReplay;
    manifest.surfaceInputs=await optional(join(source,'surface-inputs.json'));manifest.stateRendering='recorded-complete-mesh-pose-velocity-stats';manifest.inputState='recorded-sourcePose-and-airflow';manifest.runtimeReplay='separate-validation';manifest.neutralCheck=neutralCheck;manifest.framePadding=padding;manifest.renderHash=renderHash;manifest.renderDevice={connection:cdp?'cdp':'local',...renderDevice};manifest.renderSource=catalog.previewMode||'assembled';manifest.renderDirectory=relative(evidence,source);manifest.lighting=await page.evaluate(()=>(window as any).evidence.stage.settings);manifest.coverage.render=completed?'completed':'partial';manifest.renderVersion='skill-character-render-3';await put(join(evidence,'manifest.json'),manifest);return files;
  }finally {try{await context?.close();}finally{try{await browser?.close();}finally{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}}}
}
