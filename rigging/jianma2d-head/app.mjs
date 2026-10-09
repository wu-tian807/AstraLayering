import { Renderer } from './renderer.mjs';
import { clamp, evaluatePoint } from './deformer.mjs';
const $=id=>document.getElementById(id);
let rig,renderer,p={x:0,y:0,z:0},target={...p},playing=false,frame=0,last=0,clock=0,ready=false,frames=0,elapsed=0;
const controls={};
function sync(){
 for(const k of ['x','y','z']){controls[k].input.value=target[k];controls[k].output.value=target[k].toFixed(1);}
 $('dot').style.left=(50+target.x/rig.parameters.x.max*46)+'%';$('dot').style.top=(50-target.y/rig.parameters.y.max*46)+'%';
 for(const b of $('nine').children)b.classList.toggle('active',Math.abs(target.x-Number(b.dataset.x))<.1&&Math.abs(target.y-Number(b.dataset.y))<.1);
 $('pose-label').textContent=Math.abs(target.x)+Math.abs(target.y)+Math.abs(target.z)<.01?'正面 · 原始姿态':`${target.x<-.1?'向左':target.x>.1?'向右':'正向'} · ${target.y<-.1?'低头':target.y>.1?'抬头':'平视'}${Math.abs(target.z)>.1?' · 侧倾':''}`;
 $('play').textContent=playing?'暂停巡览':'连续巡览';
}
function setPose(values,immediate=false){
 playing=false;for(const k of ['x','y','z'])if(values[k]!==undefined)target[k]=clamp(Number(values[k]),rig.parameters[k].min,rig.parameters[k].max);
 if(immediate){p={...target};renderer.resetPhysics(p);}sync();requestDraw();
}
function requestDraw(){if(!frame&&ready&&!document.hidden)frame=requestAnimationFrame(tick);}
function tick(now){
 frame=0;const dt=last?Math.min((now-last)/1000,.06):1/60;last=now;
 if(playing){clock+=dt;target.x=rig.parameters.x.max*Math.sin(clock*.52);target.y=rig.parameters.y.max*Math.sin(clock*.37+.5);target.z=7*Math.sin(clock*.29);sync();}
 let moving=false;const alpha=1-Math.exp(-dt*13);
 for(const k of ['x','y','z']){const d=target[k]-p[k];if(Math.abs(d)>.006){p[k]+=d*alpha;moving=true;}else p[k]=target[k];}
 const start=performance.now();const swinging=renderer.advance(p,dt);renderer.draw(p);drawGuides();const cpu=performance.now()-start;
 if(playing||moving||swinging){frames++;elapsed+=dt;if(elapsed>.75){$('status').textContent=`${Math.round(frames/elapsed)} fps · ${cpu.toFixed(1)} ms`;frames=0;elapsed=0;}}
 else{$('status').textContent='姿态保持';last=0;frames=0;elapsed=0;}
 if(playing||moving||swinging)requestDraw();
}
function drawGuides(){
 const svg=$('guides');svg.replaceChildren();if(!$('grid').checked)return;
 svg.setAttribute('viewBox',renderer.view.join(' '));
 const ns='http://www.w3.org/2000/svg';
 const add=(points,color,width)=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',points.map((q,i)=>(i?'L':'M')+q.map(v=>v.toFixed(2)).join(' ')).join(' '));path.setAttribute('fill','none');path.setAttribute('stroke',color);path.setAttribute('stroke-width',width);path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);};
 const [fx,fy,fw,fh]=rig.head.faceBounds;
 for(let y=fy;y<=fy+fh;y+=20){const points=[];for(let x=fx;x<=fx+fw;x+=4)points.push(evaluatePoint(x,y,'face',p,rig));add(points,'#26728699',1);}
 for(let x=fx;x<=fx+fw;x+=20){const points=[];for(let y=fy;y<=fy+fh;y+=4)points.push(evaluatePoint(x,y,'face',p,rig));add(points,'#26728699',1);}
 const center=[];for(let y=fy;y<=fy+fh;y+=3)center.push(evaluatePoint(rig.head.center[0],y,'face',p,rig));add(center,'#be685be0',1.7);
 const c=document.createElementNS(ns,'circle');c.setAttribute('cx',rig.head.neckPivot[0]);c.setAttribute('cy',rig.head.neckPivot[1]);c.setAttribute('r','2.5');c.setAttribute('fill','#b65a52');svg.append(c);
}
async function start(){
 const [a,b]=await Promise.all([fetch('rig.json'),fetch('layers.json')]);if(!a.ok||!b.ok)throw new Error('无法读取九轴定义或原画图层');
 rig=await a.json();const layers=await b.json();
 for(const k of ['x','y','z']){
  const d=rig.parameters[k],div=document.createElement('div');div.className='control';
  div.innerHTML=`<label for="param-${k}">${k.toUpperCase()} · ${d.label}<output id="value-${k}">0.0</output></label><input id="param-${k}" aria-label="${d.label}" type="range" min="${d.min}" max="${d.max}" step="0.1" value="0">`;
  $('sliders').append(div);controls[k]={input:div.querySelector('input'),output:div.querySelector('output')};controls[k].input.addEventListener('input',()=>setPose({[k]:Number(controls[k].input.value)}));
 }
 const labels=['↖','↑','↗','←','◎','→','↙','↓','↘'];let n=0;
 for(const y of [rig.parameters.y.max,0,rig.parameters.y.min])for(const x of [rig.parameters.x.min,0,rig.parameters.x.max]){const b=document.createElement('button');b.textContent=labels[n++];b.dataset.x=x;b.dataset.y=y;b.title=`X ${x} / Y ${y}`;b.setAttribute('aria-label',`X ${x}，Y ${y}`);b.onclick=()=>setPose({x,y,z:0});$('nine').append(b);}
 renderer=new Renderer($('stage'),rig,layers.layers);await renderer.init();ready=true;
 const resize=()=>{renderer.resize($('closeup').checked);requestDraw();};new ResizeObserver(resize).observe($('stage'));resize();sync();
 $('play').disabled=$('reset').disabled=false;
 $('reset').onclick=()=>setPose({x:0,y:0,z:0});$('play').onclick=()=>{playing=!playing;last=0;sync();requestDraw();};
 $('physics').onchange=()=>{renderer.setPhysics($('physics').checked,p);requestDraw();};
 $('grid').onchange=requestDraw;$('bare').onchange=()=>{renderer.hiddenHair=$('bare').checked;requestDraw();};$('closeup').onchange=resize;
 let drag=false;const move=e=>{const r=$('pad').getBoundingClientRect();setPose({x:clamp(((e.clientX-r.left)/r.width-.5)/.46,-1,1)*rig.parameters.x.max,y:clamp((.5-(e.clientY-r.top)/r.height)/.46,-1,1)*rig.parameters.y.max});};
 $('pad').onpointerdown=e=>{drag=true;$('pad').setPointerCapture(e.pointerId);move(e);};$('pad').onpointermove=e=>{if(drag)move(e);};$('pad').onpointerup=$('pad').onpointercancel=()=>drag=false;
 $('pad').onkeydown=e=>{const map={ArrowLeft:['x',-2],ArrowRight:['x',2],ArrowUp:['y',2],ArrowDown:['y',-2]};if(map[e.key]){e.preventDefault();const [k,v]=map[e.key];setPose({[k]:target[k]+v});}};
 document.addEventListener('visibilitychange',()=>{last=0;renderer.resetPhysics(p);if(document.hidden){cancelAnimationFrame(frame);frame=0;}else requestDraw();});
 $('stage').addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;cancelAnimationFrame(frame);frame=0;$('status').textContent='图形上下文已暂停，等待恢复…';});
 $('stage').addEventListener('webglcontextrestored',async()=>{try{await renderer.init();renderer.resetPhysics(p);ready=true;resize();}catch(e){fail(e);}});
 window.addEventListener('pagehide',e=>{cancelAnimationFrame(frame);frame=0;if(!e.persisted)renderer.destroy();});
 window.addEventListener('pageshow',e=>{if(e.persisted){last=0;resize();}});
 // Bounded inspection API for reproducible geometric and browser acceptance checks.
 window.headRig={setPose:(q)=>setPose(q,true),getPose:()=>({...p}),rig,renderer,ready:true};
 requestDraw();
}
function fail(e){$('status').textContent=e.message;console.error(e);}
start().catch(fail);
