import { loadImage } from '#character-render/renderer.js';
const $ = s => document.querySelector(s);
const canvas = (w,h) => { const c=document.createElement('canvas');c.width=w;c.height=h;return c; };
const pixels = image => { const c=canvas(image.width,image.height),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data; };
const raster = (rgba,w,h) => {const c=canvas(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),w,h),0,0);return c;};
const identity = () => ({x:0,y:0,angle:0,depth:0,visible:true,front:false,replace:''});
export class SurfacePreview {
  constructor({stage,source,session,error,changed}) {
    Object.assign(this,{stage,source,session,error,changed});this.epoch=0;this.poses=new Map();
    $('#surface-prepare').onclick=()=>void this.prepare();
    $('#surface-close').onclick=()=>void this.close();
    $('#surface-part').onchange=()=>this.sync();
    $('#surface-reset').onclick=()=>{this.poses.set($('#surface-part').value,identity());this.sync();this.schedule();};
    for(const key of ['x','y','angle','depth','visible','front','replace']) {
      const el=$('#surface-'+key);el.oninput=()=>{const p=this.poses.get($('#surface-part').value);if(!p)return;if(['visible','front'].includes(key))p[key]=el.checked;else if(key==='replace')p[key]=el.value;else{const value=el.valueAsNumber;if(!Number.isFinite(value))return this.sync();p[key]=Math.max(Number(el.min),Math.min(Number(el.max),value));}this.schedule();};
    }
  }
  sync() {
    const id=$('#surface-part').value,p=this.poses.get(id);if(!p)return;
    for(const key of ['x','y','angle','depth','replace'])$('#surface-'+key).value=p[key];
    for(const key of ['visible','front'])$('#surface-'+key).checked=p[key];
    const g=this.groups.get(id);$('#surface-stats').textContent=`${g.layers.length} 层 · 实测 ${Math.round(g.known/Math.max(1,g.total)*100)}% · 其余为补全或估计`;
  }
  async prepare({allowFlat=false}={}) {
    if(this.active) return true;
    const owner=this.source(),session=this.session();
    if(!allowFlat&&(!owner?.normal||!owner?.depth)) return this.error('请先绑定当前工程的法线与深度');
    if(!owner||!session?.session) return this.error('请等待原生图层就绪后准备');
    const epoch=++this.epoch,controller=new AbortController();this.fetchController=controller;$('#surface-prepare').disabled=true;$('#surface-status').textContent='正在读取部件与补全贴图…';
    try {
      const response=await fetch('./api/studio/layers/surfaces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,projections:owner.shadowBindings?.shadows}),signal:controller.signal}),packet=await response.json();
      if(!response.ok)throw Error(packet.error);
      const w=packet.width,h=packet.height;
      const imageBlob=async file=>{const u=URL.createObjectURL(file);try{return await loadImage(u);}finally{URL.revokeObjectURL(u);}};
      const [baseColor,normalImage,depthImage]=await Promise.all([owner.color,owner.normal,owner.depth].map(b=>b?imageBlob(b):null));
      const flat=(r,g,b)=>{const c=canvas(w,h),ctx=c.getContext('2d');ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fillRect(0,0,w,h);return c;};
      const baseNormal=normalImage||flat(128,128,255),baseDepth=depthImage||flat(128,128,128);
      const read=async (l,kind)=>{
        const u=new URL('./studio-surface-asset',location.href);for(const[k,v]of Object.entries({...session,file:l[kind]}))u.searchParams.set(k,v);
        const response=await fetch(u.href,{signal:controller.signal});if(!response.ok)throw Error(`${l.name}: ${await response.text()}`);
        const blob=await response.blob();let image;
        try{image=await imageBlob(blob);}catch{throw Error(`部件 PNG 无法解码：${l.name} (${kind}, ${blob.size} B)`);}
        if(image.width!==l.bounds.width||image.height!==l.bounds.height)throw Error(`部件 PNG 尺寸不匹配：${l.name} (${kind})`);
        return pixels(image);
      };
      // Bound both network and decoder pressure, retaining every source texel
      // and the native stacking order. Cancelled preparations launch no new work.
      const layers=new Array(packet.layers.length);let next=0,completed=0;
      await Promise.all(Array.from({length:Math.min(4,layers.length)},async()=>{
        while(next<layers.length){
          controller.signal.throwIfAborted();const index=next++,l=packet.layers[index];
          const [rgba,maskedRgba]=await Promise.all([read(l,'original'),read(l,'masked')]);
          for(let p=3;p<rgba.length;p+=4){rgba[p]=Math.round(rgba[p]*l.opacity/255);maskedRgba[p]=l.visible?Math.round(maskedRgba[p]*l.opacity/255):0;}
          let projection=null;
          if(l.projection){const base=await read({...l,original:l.projection.base},'original');for(let p=3;p<base.length;p+=4)base[p]=l.visible?Math.round(base[p]*l.opacity/255):0;
            const shadows=[];for(const s of l.projection.shadows){const data=await read(s,'original');for(let p=3;p<data.length;p+=4)data[p]=s.visible?Math.round(data[p]*s.opacity/255):0;shadows.push({...s,rgba:data});}projection={...l.projection,rgba:base,shadows};}
          layers[index]={...l,rgba,maskedRgba,projection};completed++;
          if(epoch===this.epoch)$('#surface-status').textContent=`正在读取部件 ${completed}/${layers.length}…`;
        }
      }));
      if(epoch!==this.epoch)return;
      $('#surface-status').textContent='正在补全法线与深度…';
      // Validate the snapshot against Krita's native composite before using it.
      const composite=canvas(w,h),ctx=composite.getContext('2d',{willReadFrequently:true});
      for(const l of layers){const rgba=new Uint8ClampedArray(l.rgba);for(let p=3;p<rgba.length;p+=4)rgba[p]=l.maskedRgba[p];ctx.drawImage(raster(rgba,l.bounds.width,l.bounds.height),l.bounds.x,l.bounds.y);}
      const reference=pixels(baseColor),actual=pixels(composite);let rgbError=0,alphaError=0,visible=0;
      for(let p=0;p<reference.length;p+=4){alphaError=Math.max(alphaError,Math.abs(actual[p+3]-reference[p+3]));if(reference[p+3]>40){for(let c=0;c<3;c++)rgbError+=Math.abs(actual[p+c]-reference[p+c]);visible+=3;}}
      if(alphaError>2||rgbError/Math.max(1,visible)>.5)throw Error('此工程的蒙版或合成无法逐层等价重建，保留原生预览；请先整理部件副本');
      const worker=new Worker(new URL('./surface-worker.js',import.meta.url),{type:'module'});this.worker=worker;
      const maps=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('部件贴图准备超时')),120000);this.cancelWorker=()=>{clearTimeout(timer);reject(Error('部件准备已取消'));};const finish=(fn,value)=>{clearTimeout(timer);fn(value);};worker.onmessage=({data})=>data.error?finish(reject,Error(data.error)):finish(resolve,data.maps);worker.onerror=e=>finish(reject,Error(e.message));worker.postMessage({width:w,height:h,layers,normal:pixels(baseNormal),depth:pixels(baseDepth)});});
      worker.terminate();this.worker=null;this.cancelWorker=null;if(epoch!==this.epoch)return;
      this.owner=owner;this.baseline={color:baseColor,normal:normalImage,depth:depthImage};this.size=[w,h];this.layers=layers;this.groups=new Map();this.poses.clear();
      const byId=new Map(maps.map(m=>[m.id,m]));
      for(const l of layers){l.map=byId.get(l.id);const rgba=new Uint8ClampedArray(l.rgba);for(let p=3;p<rgba.length;p+=4)rgba[p]=l.maskedRgba[p];l.color=raster(rgba,l.bounds.width,l.bounds.height);
        let g=this.groups.get(l.partId);if(!g){g={id:l.partId,layers:[],known:0,total:0,bounds:{...l.bounds}};this.groups.set(g.id,g);this.poses.set(g.id,identity());}
        g.layers.push(l);g.known+=l.map.known;g.total+=l.map.known+l.map.inferred;
        const x=Math.min(g.bounds.x,l.bounds.x),y=Math.min(g.bounds.y,l.bounds.y);g.bounds={x,y,width:Math.max(g.bounds.x+g.bounds.width,l.bounds.x+l.bounds.width)-x,height:Math.max(g.bounds.y+g.bounds.height,l.bounds.y+l.bounds.height)-y};
      }
      const options=[...this.groups.values()].map(g=>{const o=document.createElement('option');o.value=g.id;o.textContent=/^[a-f0-9]{8}-/.test(g.id)?g.layers[0].name:g.id;return o;});
      $('#surface-part').replaceChildren(...options);$('#surface-replace').replaceChildren(new Option('原部件',''),...options.map(o=>o.cloneNode(true)));
      $('#surface-controls').hidden=false;$('#surface-close').hidden=false;$('#surface-status').textContent='已准备 · 仅修改预览';this.active=true;this.sync();this.changed(true);
      return true;
    } catch(e){if(epoch===this.epoch){$('#surface-status').textContent=e.message;this.error(e.message);}}
    finally{controller.abort();if(epoch===this.epoch){this.fetchController=null;this.worker?.terminate();this.worker=null;this.cancelWorker=null;$('#surface-prepare').disabled=false;}}
  }
  schedule(){clearTimeout(this.timer);this.timer=setTimeout(()=>void this.update().catch(this.error),100);}
  async update(){
    if(this.stage.deformation)return;
    if(!this.active||this.source()!==this.owner)return;
    const rest=[...this.poses.values()].every(p=>!p.x&&!p.y&&!p.angle&&!p.depth&&p.visible&&!p.front&&!p.replace);
    const zoom=this.stage.zoom,pan=[...this.stage.pan];
    if(rest){await this.stage.load(this.baseline);this.stage.zoom=zoom;this.stage.pan=pan;this.stage.render();return;}
    const [w,h]=this.size,color=canvas(w,h),normal=canvas(w,h),depth=canvas(w,h);
    const contexts=[color,normal,depth].map(c=>c.getContext('2d'));
    contexts[1].fillStyle='rgb(128,128,255)';contexts[1].fillRect(0,0,w,h);
    contexts[2].fillStyle='rgb(128,128,128)';contexts[2].fillRect(0,0,w,h);
    const ordered=this.layers.map(l=>({l,p:this.poses.get(l.partId)})).sort((a,b)=>Number(a.p.front)-Number(b.p.front));
    const replacementDone=new Set();
    for(const{l,p}of ordered){if(!p.visible)continue;
      const target=this.groups.get(l.partId),donor=p.replace&&this.groups.get(p.replace);
      if(donor&&replacementDone.has(target.id))continue;
      if(donor)replacementDone.add(target.id);
      const pieces=donor?donor.layers:[l],g=donor||target,b=target.bounds,center=[b.x+b.width/2,b.y+b.height/2],sourceCenter=[g.bounds.x+g.bounds.width/2,g.bounds.y+g.bounds.height/2];
      const angle=p.angle*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
      for(const piece of pieces){const n=new Uint8ClampedArray(piece.rgba.length),d=new Uint8ClampedArray(n.length);
        for(let q=0;q<n.length;q+=4){const m=piece.map.data,nx=m[q]/127.5-1,ny=(m[q+1]/127.5-1)*this.stage.settings.normalY,alpha=piece.maskedRgba[q+3];n[q]=(cos*nx+sin*ny+1)*127.5;n[q+1]=((-sin*nx+cos*ny)*this.stage.settings.normalY+1)*127.5;n[q+2]=m[q+2];n[q+3]=alpha;d[q]=d[q+1]=d[q+2]=Math.max(0,Math.min(255,m[q+3]+p.depth*2.55));d[q+3]=alpha;}
        const images=[piece.color,raster(n,piece.bounds.width,piece.bounds.height),raster(d,piece.bounds.width,piece.bounds.height)];
        for(let i=0;i<3;i++){const ctx=contexts[i];ctx.save();ctx.translate(center[0]+p.x,center[1]+p.y);ctx.rotate(angle);ctx.drawImage(images[i],piece.bounds.x-sourceCenter[0],piece.bounds.y-sourceCenter[1]);ctx.restore();}
      }
    }
    await this.stage.load({color,normal,depth});this.stage.zoom=zoom;this.stage.pan=pan;this.stage.render();
  }
  async close(){const baseline=this.baseline,owner=this.owner;this.clear();if(baseline&&this.source()===owner){const zoom=this.stage.zoom,pan=[...this.stage.pan];await this.stage.load(baseline);this.stage.zoom=zoom;this.stage.pan=pan;this.stage.render();}}
  clear(){this.epoch++;clearTimeout(this.timer);this.fetchController?.abort();this.fetchController=null;this.worker?.terminate();this.cancelWorker?.();this.worker=null;this.cancelWorker=null;this.active=false;this.poses.clear();this.layers=this.groups=this.baseline=this.owner=null;$('#surface-controls').hidden=true;$('#surface-close').hidden=true;$('#surface-prepare').disabled=false;$('#surface-status').textContent='依据原始图层叠加补全贴图';this.changed(false);}
  diagnostics(){return{active:!!this.active,parts:this.groups?[...this.groups.values()].map(g=>({id:g.id,layers:g.layers.map(l=>l.name),known:g.known,total:g.total})):[],poses:Object.fromEntries(this.poses)};}
}
