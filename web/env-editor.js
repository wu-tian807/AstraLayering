const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups = {llm:'语言模型',image:'生图模型',connection:'模型连接', 'image-api':'生图服务',budget:'图片容量保护',advanced:'运行环境'};
export function createEnvEditor({get,post,toast,render}) {
 let data, pending={}, busy=false, error='', section='llm', checkedPreview=null, checkedChanges='';
 const hasChanges=()=>Object.keys(pending).length>0;
 const value=f=>Object.hasOwn(pending,f.key)?pending[f.key]:f.value;
 function changed(key,next) {
  const field=data.fields.find(f=>f.key===key);
  if(next===field.value)delete pending[key];else pending[key]=next;
  document.querySelectorAll('[data-env-save],[data-env-preview],[data-env-discard]').forEach(b=>b.disabled=busy||!hasChanges());
  const note=document.querySelector('[data-env-count]');if(note)note.textContent=hasChanges()?`${Object.keys(pending).length} 项待保存`:(data.exists?'已与本地配置同步':'当前使用默认配置');
  const preview=document.querySelector('[data-env-file]');if(preview)preview.textContent=localPreview();
 }
 function localPreview() {
  if(!data)return '';
  if(checkedPreview!==null&&checkedChanges===JSON.stringify(pending))return checkedPreview;
  const updates={...pending};
  const lines=data.preview.split('\n').map(line=>{const key=line.split('=')[0];if(!Object.hasOwn(updates,key))return line;const val=updates[key];delete updates[key];return `${key}=${data.fields.find(f=>f.key===key)?.secret&&val?'[已隐藏]':val}`;});
  for(const [key,val] of Object.entries(updates))lines.push(`${key}=${data.fields.find(f=>f.key===key)?.secret&&val?'[已隐藏]':val}`);
  return lines.filter(Boolean).join('\n');
 }
 function applyPreview(next){checkedPreview=next.preview;checkedChanges=JSON.stringify(pending);data={...data,cli:next.cli,models:next.models,issues:next.issues,providers:next.providers,fields:data.fields.map(f=>({...f,effective:next.fields.find(n=>n.key===f.key)?.effective??f.effective}))};}
 function option(v,label,current,disabled=false){return `<option value="${escape(v)}" ${v===current?'selected':''} ${disabled?'disabled':''}>${escape(label)}</option>`;}
 function fieldView(f) {
  const current=value(f), id=`env-${f.key}`, source=f.overridden?'启动环境覆盖':f.source==='file'?'本地 .env':'使用默认值';
  let control;
  if(f.type==='model') {
   const selected=current||f.effective||f.fallback, matched=data.models.find(m=>selected.startsWith(m.id+'-'));
   const effort=matched?selected.slice(matched.id.length+1):f.fallback.split('-').at(-1);
   control=`<div class="env-model-pair"><select id="${id}" data-env-model="${f.key}" aria-label="${escape(f.label)}模型">${option('','继承职责默认值',current?'__explicit':current)}${data.models.map(m=>option(m.id,m.id+(!m.available?` · ${m.harness} CLI 未就绪`:m.allowed?'':' · 未在可用模型列表中'),current&&matched?.id,!m.available||!m.allowed)).join('')}</select><select data-env-effort="${f.key}" aria-label="${escape(f.label)}思考力度">${data.efforts.map(e=>option(e,e,effort)).join('')}</select></div>`;
  } else if(f.type==='image')control=`<select id="${id}" data-env-value="${f.key}" aria-label="${escape(f.label)}">${option('',f.key==='default_image_model'?`使用默认（${f.fallback}）`:'继承默认生图模型',current)}${data.imageModels.map(m=>option(m,m,current)).join('')}</select>`;
  else if(f.type==='boolean'||f.type==='select')control=`<select id="${id}" data-env-value="${f.key}">${[...new Set(['',...(f.options??['false','true'])])].map(v=>option(v,v==='true'?'开启':v==='false'?'关闭':v||(f.fallback?`沿用默认（${f.fallback}）`:'沿用默认'),current)).join('')}</select>`;
  else control=`<div class="env-input-wrap"><input id="${id}" data-env-value="${f.key}" type="${f.secret?'password':f.type==='number'?'number':'text'}" ${f.type==='number'?'min="0" step="any"':''} value="${escape(current)}" autocomplete="off" spellcheck="false" placeholder="${f.secret?(f.configured?'已配置；输入新密钥可替换':'在本机填写密钥'):f.hint?'':escape(f.fallback||'留空沿用默认')}" ${f.secret?'data-env-secret':''}>${f.secret&&f.configured?`<button type="button" class="button" data-env-clear="${f.key}">清除已存值</button>`:''}</div>`;
  return `<div class="env-field"><div class="env-field-title"><label for="${id}">${escape(f.label)}</label><span class="env-source ${f.overridden?'override':''}">${source}</span></div>${control}<small>${escape(f.secret?(Object.hasOwn(pending,f.key)?pending[f.key]?'保存时替换本地密钥':'保存时清除本地密钥':f.overridden?'实际凭据来自启动环境':f.configured?'本地密钥已配置':'可复用现有登录'):f.overridden?`实际生效：${f.effective}`:f.hint||((f.type==='model'||f.type==='image')?`当前生效：${f.effective}`:''))}</small><code>${escape(f.key)}</code></div>`;
 }
 return {
  async load(){if(data&&hasChanges())return;busy=true;error='';try{data=await get('./api/config/environment');pending={};}catch(e){error=e.message;}finally{busy=false;}},
  view(){
   if(!data)return `<section class="env-empty">${escape(error||'正在读取本地模型配置…')}<button class="button" data-env-reload>重新读取</button></section>`;
   return `<section class="env-editor" aria-label="本地环境配置"><div class="env-intro"><div><h2>模型与运行环境</h2><p>在这里选择语言模型与生图模型，保存到这份仓库的 .env。</p></div><div class="env-cli-status">${Object.entries(data.cli).map(([h,c])=>`<span class="${c.available?'ready':'missing'}" title="${escape(c.detail)}">${c.available?'✓':'○'} ${h}</span>`).join('')}</div></div>
   <div class="env-layout"><aside class="env-nav">${Object.entries(groups).map(([id,label])=>`<button data-env-section="${id}" class="${section===id?'active':''}">${label}<small>${data.fields.filter(f=>f.section===id).length}</small></button>`).join('')}<button data-env-file-toggle class="${section==='preview'?'active':''}">.env 预览</button></aside>
   <div class="env-main"><div class="env-section-heading"><div><h3>${groups[section]||'.env 预览'}</h3><p>${section==='preview'?'预览当前草稿，密钥保持隐藏；点击保存后写入本地 .env。':section==='llm'?'人物与衣服共用职责。模型旁的 CLI 提示反映当前服务环境。':section==='image'?'步骤留空时继承默认生图模型。生图服务的凭据在“生图服务”设置。':section==='connection'?'连接留空时复用已有登录。可用模型列表用逗号分隔模型 ID。':section==='budget'?'按实际服务限制配置，留空保持原有行为。':'已有设置逐项保留，只保存你修改的字段。'}</p></div><button class="button" data-env-reload>重新检测</button></div>
   ${error?`<p class="env-error" role="alert">${escape(error)}</p>`:''}
   ${Object.values(data.cli).some(c=>!c.available)&&section==='llm'?`<p class="env-hint">${Object.entries(data.cli).filter(([,c])=>!c.available).map(([h])=>escape(h)).join('、')} CLI 尚未就绪，对应模型会显示提示。可在“模型连接”填写已有 CLI 路径后重新检测。登录与账号模型权限由任务启动时确认。</p>`:''}
   <div class="env-fields">${data.fields.filter(f=>f.section===section).map(fieldView).join('')}</div>
   ${section==='preview'?`<details class="env-preview" open><summary>本地 .env 预览 · 敏感值已隐藏</summary><pre data-env-file>${escape(localPreview())}</pre><small>${escape(data.path)}</small></details>`:''}
   ${data.issues.length?`<details class="env-issues"><summary>启动前需要核对 ${data.issues.length} 项配置</summary><ul>${data.issues.map(issue=>`<li>${escape(issue)}</li>`).join('')}</ul></details>`:''}</div></div>
   <footer class="env-savebar"><div><strong data-env-count>${hasChanges()?`${Object.keys(pending).length} 项待保存`:(data.exists?'已与本地配置同步':'当前使用默认配置')}</strong><span>保存后，新启动或停止后继续的任务读取更新；当前请求继续使用原配置。</span></div><button class="button" data-env-discard ${!hasChanges()||busy?'disabled':''}>放弃修改</button><button class="button" data-env-preview ${!hasChanges()||busy?'disabled':''}>预览生效配置</button><button class="primary" data-env-save ${!hasChanges()||busy?'disabled':''}>${busy?'正在处理…':'保存配置'}</button></footer></section>`;
  },
  bind(){
   if(busy){document.querySelectorAll('.env-editor input,.env-editor select,.env-editor button').forEach(node=>node.disabled=true);return;}
   document.querySelectorAll('[data-env-section]').forEach(b=>b.onclick=()=>{section=b.dataset.envSection;render();document.querySelector('.env-main').scrollTop=0;});
   const fileToggle=document.querySelector('[data-env-file-toggle]');if(fileToggle)fileToggle.onclick=()=>{section='preview';render();document.querySelector('.env-main').scrollTop=0;};
   document.querySelectorAll('[data-env-reload]').forEach(b=>b.onclick=async()=>{busy=true;error='';render();try{if(hasChanges())applyPreview(await post('config/environment/preview',{revision:data.revision,changes:pending}));else await this.load();}catch(e){error=e.message;}finally{busy=false;render();}});
   const discard=document.querySelector('[data-env-discard]');if(discard)discard.onclick=async()=>{pending={};error='';busy=true;render();await this.load();render();};
   document.querySelectorAll('[data-env-model]').forEach(select=>select.onchange=()=>{
    const key=select.dataset.envModel,effort=document.querySelector(`[data-env-effort="${key}"]`).value;
    changed(key,select.value?`${select.value}-${effort}`:'');
   });
   document.querySelectorAll('[data-env-effort]').forEach(select=>select.onchange=()=>{const key=select.dataset.envEffort, control=document.querySelector(`[data-env-model="${key}"]`);let model=control.value;if(!model){const field=data.fields.find(f=>f.key===key);const inherited=data.models.find(m=>field.effective.startsWith(m.id+'-'));if(!inherited?.available)return;model=inherited.id;control.value=model;}changed(key,`${model}-${select.value}`);});
   document.querySelectorAll('[data-env-value]').forEach(input=>{
    const update=()=>{const key=input.dataset.envValue;if(input.hasAttribute('data-env-secret')&&!input.value){changed(key,'');return;}changed(key,input.value);};
    if(input.tagName==='SELECT')input.onchange=update;else input.oninput=update;
   });
   document.querySelectorAll('[data-env-clear]').forEach(button=>button.onclick=()=>{const key=button.dataset.envClear;changed(key,'');pending[key]='';render();});
   const submit=async(save)=>{
    busy=true;error='';render();
    try {const next=await post('config/environment'+(save?'':'/preview'),{revision:data.revision,changes:pending});if(save){data=next;pending={};toast('配置已保存，下一次启动任务时生效');}else {applyPreview(next);section='preview';toast('已预览，配置尚未写入');}}
    catch(e){error=e.message;}finally{busy=false;render();if(!save&&!error)document.querySelector('.env-main').scrollTop=0;}
   };
   const save=document.querySelector('[data-env-save]');if(save)save.onclick=()=>submit(true);
   const preview=document.querySelector('[data-env-preview]');if(preview)preview.onclick=()=>submit(false);
  },
 };
}
