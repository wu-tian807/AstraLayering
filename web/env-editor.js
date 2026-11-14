import { parseModelPatterns } from './model-patterns.js';
const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups = {llm:'语言模型',image:'生图模型',video:'视频模型',connection:'模型连接','image-api':'生图服务','video-api':'视频服务',budget:'图片容量保护',advanced:'运行环境'};
export function createEnvEditor({get,post,toast,render}) {
 let data, pending={}, busy=false, error='', section='llm', checkedPreview=null, checkedChanges='';
 const ruleErrors=()=>data?data.fields.filter(f=>f.key.endsWith('_models')).flatMap(f=>{try{parseModelPatterns(value(f),f.label);return [];}catch(e){return [e.message];}}):[];
 const hasChanges=()=>Object.keys(pending).length>0;
 const value=f=>Object.hasOwn(pending,f.key)?pending[f.key]:f.value;
 function changed(key,next) {
  const field=data.fields.find(f=>f.key===key);
  if(next===field.value)delete pending[key];else pending[key]=next;
  document.querySelectorAll('[data-env-save],[data-env-preview],[data-env-discard]').forEach(b=>b.disabled=busy||!hasChanges()||(b.hasAttribute('data-env-save')||b.hasAttribute('data-env-preview'))&&ruleErrors().length>0);
  const note=document.querySelector('[data-env-count]');if(note)note.textContent=hasChanges()?`${Object.keys(pending).length} 项待保存`:(data.exists?'已与本地配置同步':'当前使用默认配置');
  const validation=document.querySelector('[data-env-rule-errors]');if(validation){validation.textContent=ruleErrors().join(' ');validation.hidden=!ruleErrors().length;}
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
 function applyPreview(next){checkedPreview=next.preview;checkedChanges=JSON.stringify(pending);data={...data,cli:next.cli,models:next.models,imageModels:next.imageModels,videoModels:next.videoModels,issues:next.issues,providers:next.providers,connections:next.connections,fields:data.fields.map(f=>{const fresh=next.fields.find(n=>n.key===f.key);return fresh?{...fresh,value:f.value,configured:f.configured}:f;})};}
 function option(v,label,current,disabled=false){return `<option value="${escape(v)}" ${v===current?'selected':''} ${disabled?'disabled':''}>${escape(label)}</option>`;}
 function defaultLabel(f){const fallback=f.optionLabels?.[f.fallback]??(f.fallback==='true'?'开启':f.fallback==='false'?'关闭':f.fallback);return fallback?`使用默认（${fallback}）`:'使用默认';}
 function sourceLabel(f){return f.source==='environment'?'来自启动环境':f.source==='file'?'本地 .env':f.source==='cli'?(f.connectionMode==='account'?'账号登录／订阅':f.connectionMode==='cli-api'?'CLI 原有 API 认证':'CLI 原有连接'):'使用默认值';}
 function connectionView(){
  const modes={api:['API 密钥连接','使用管线解析出的 API 密钥与服务地址。'],account:['账号登录／订阅','已检测到 CLI 账号凭据；套餐、权限及登录有效性由 CLI 在启动时确认。'],'cli-api':['CLI 原有 API 认证','使用 CLI 原有 API 认证；凭据内容不显示。'],cli:['CLI 原有连接（类型未确认）','可能使用订阅账号或原有 API 配置；尚未确认认证类型，启动时由 CLI 确认。'],invalid:['配置需修正','请先处理下方配置问题，再确认实际连接方式。']};
  return `<div class="env-connections">${Object.entries(data.connections||{}).map(([h,c])=>{const [label,detail]=modes[c.mode]||modes.cli;return `<article data-env-connection="${h}"><strong>${{codex:'Codex',claude:'Claude Code',agv:'Antigravity'}[h]||escape(h)}</strong><span data-env-connection-mode>${label}</span><p>${detail}</p>${c.mode==='api'||c.mode==='cli-api'?`<small>${sourceLabel(c)}${c.sourceKey?` · ${escape(c.sourceKey)}`:''} · ${c.configured?'密钥已配置（内容已隐藏）':'尚未确认凭据'}</small>`:''}</article>`;}).join('')}</div>`;
 }
 function fieldView(f) {
  const current=value(f), id=`env-${f.key}`, source=sourceLabel(f);
  const description=f.hint?`<p class="env-field-description" id="${id}-description"><em>${escape(f.hint)}</em></p>`:'';
  const describedBy=f.hint?`aria-describedby="${id}-description"`:'';
  let control;
  if(f.type==='model') {
   const selected=current||f.effective||f.fallback,index=selected.lastIndexOf('-'),model=selected.slice(0,index),effort=selected.slice(index+1);
   control=`<div class="env-model-pair"><input id="${id}" list="${id}-models" data-env-model="${f.key}" aria-label="${escape(f.label)}模型" ${describedBy} value="${escape(current?model:'')}" placeholder="${escape(defaultLabel(f))}" autocomplete="off" spellcheck="false"><datalist id="${id}-models">${data.models.map(m=>`<option value="${escape(m.id)}">${escape(m.harness+(!m.available?' · CLI 未就绪':m.allowed?'':' · 未在可用模型列表中'))}</option>`).join('')}</datalist><select data-env-effort="${f.key}" aria-label="${escape(f.label)}思考力度" ${describedBy}>${data.efforts.map(e=>option(e,e,effort)).join('')}</select></div>`;
  } else if(f.type==='image'||f.type==='video') {
   const presets=f.type==='image'?data.imageModels:data.videoModels;
   control=`<input id="${id}" data-env-value="${f.key}" list="${id}-presets" ${describedBy} value="${escape(current)}" placeholder="${escape(defaultLabel(f))}" autocomplete="off" spellcheck="false"><datalist id="${id}-presets">${presets.map(model=>`<option value="${escape(model)}"></option>`).join('')}</datalist>`;
  }
  else if(f.type==='boolean'||f.type==='select')control=`<select id="${id}" data-env-value="${f.key}" ${describedBy}>${[...new Set(['',...(f.options??['false','true'])])].map(v=>option(v,f.optionLabels?.[v]??(v==='true'?'开启':v==='false'?'关闭':v||defaultLabel(f)),current)).join('')}</select>`;
  else control=`<div class="env-input-wrap"><input id="${id}" data-env-value="${f.key}" type="${f.secret?'password':f.type==='number'?'number':'text'}" ${describedBy} ${f.type==='number'?'min="0" step="any"':''} value="${escape(current)}" autocomplete="off" spellcheck="false" placeholder="${f.secret?(f.configured?'已配置；输入新密钥可替换':'在本机填写密钥'):f.hint?'':escape(f.fallback||'留空使用默认')}" ${f.secret?'data-env-secret':''}>${f.secret&&f.configured?`<button type="button" class="button" data-env-clear="${f.key}">清除已存值</button>`:''}</div>`;
  const configured=f.effectiveConfigured??f.configured;
  const status=f.secret?(Object.hasOwn(pending,f.key)?pending[f.key]?'保存时替换本地密钥':'保存时清除本地密钥':f.source==='cli'?(f.connectionMode==='account'?'使用账号凭据，无需在此填写 API 密钥':configured?'CLI 凭据已配置（内容已隐藏）':'未确认 CLI 凭据'):configured?'密钥已配置（内容已隐藏）':'尚未配置 API 密钥'):f.overridden?`实际生效：${f.effective}`:(f.type==='model'||f.type==='image'||f.type==='video')?`当前生效：${f.effective}`:'';
  const origin=f.sourceKey&&f.sourceKey!==f.key?`<small>实际来源：${escape(f.sourceKey)}</small>`:'';
  return `<div class="env-field"><div class="env-field-title"><label for="${id}">${escape(f.label)}</label><span class="env-source ${f.overridden?'override':''}">${source}</span></div>${description}${control}${status?`<small>${escape(status)}</small>`:''}${origin}${f.key.endsWith('_models')?`<small>生效规则：${escape(f.effective)}</small>`:''}<code>${escape(f.key)}</code></div>`;
 }
 return {
  async load(){if(data&&hasChanges())return;busy=true;error='';try{data=await get('./api/config/environment');pending={};}catch(e){error=e.message;}finally{busy=false;}},
  view(){
   if(!data)return `<section class="env-empty">${escape(error||'正在读取本地模型配置…')}<button class="button" data-env-reload>重新读取</button></section>`;
   return `<section class="env-editor" aria-label="本地环境配置"><div class="env-intro"><div><h2>模型与运行环境</h2><p>配置模型与服务，保存到本地 .env。</p></div><div class="env-cli-status">${Object.entries(data.cli).map(([h,c])=>`<span class="${c.available?'ready':'missing'}" title="${escape(c.detail)}">${c.available?'✓':'○'} ${h}</span>`).join('')}</div></div>
   <div class="env-layout"><aside class="env-nav">${Object.entries(groups).map(([id,label])=>`<button data-env-section="${id}" class="${section===id?'active':''}">${label}<small>${data.fields.filter(f=>f.section===id).length}</small></button>`).join('')}<button data-env-file-toggle class="${section==='preview'?'active':''}">.env 预览</button></aside>
   <div class="env-main"><div class="env-section-heading"><div><h3>${groups[section]||'.env 预览'}</h3><p>${section==='preview'?'预览当前草稿，密钥保持隐藏；点击保存后写入本地 .env。':section==='llm'?'选择预设或输入模型 ID；自定义名称需匹配服务规则。留空使用默认。':section==='image'?'步骤未单独选择时，使用本页的默认生图模型。接口与密钥在“生图服务”设置。':section==='connection'?'配置服务连接与模型匹配规则；留空使用启动环境或已有登录。':section==='video'?'选择预设或输入视频模型 ID；地址与密钥在“视频服务”设置。':section==='video-api'?'选择服务类型，填写地址与密钥。':section==='budget'?'按服务限制设置阈值，留空使用默认。':'已有设置逐项保留，只保存你修改的字段。'}</p></div><button class="button" data-env-reload>重新检测</button></div>
   <p class="env-error" role="alert" data-env-rule-errors ${ruleErrors().length?'':'hidden'}>${escape(ruleErrors().join(' '))}</p>
   ${error?`<p class="env-error" role="alert">${escape(error)}</p>`:''}
   ${Object.values(data.cli).some(c=>!c.available)&&section==='llm'?`<p class="env-hint">${Object.entries(data.cli).filter(([,c])=>!c.available).map(([h])=>escape(h)).join('、')} CLI 尚未就绪，对应模型会显示提示。可在“模型连接”填写已有 CLI 路径后重新检测。登录与账号模型权限由任务启动时确认。</p>`:''}
   ${section==='connection'?connectionView():''}
   <div class="env-fields">${data.fields.filter(f=>f.section===section).map(fieldView).join('')}</div>
   ${section==='preview'?`<details class="env-preview" open><summary>本地 .env 预览 · 敏感值已隐藏</summary><pre data-env-file>${escape(localPreview())}</pre><small>${escape(data.path)}</small></details>`:''}
   ${data.issues.length?`<details class="env-issues"><summary>启动前需要核对 ${data.issues.length} 项配置</summary><ul>${data.issues.map(issue=>`<li>${escape(issue)}</li>`).join('')}</ul></details>`:''}</div></div>
   <footer class="env-savebar"><div><strong data-env-count>${hasChanges()?`${Object.keys(pending).length} 项待保存`:(data.exists?'已与本地配置同步':'当前使用默认配置')}</strong><span>非空 .env 优先，留空使用启动环境或默认值。保存后新启动或继续的任务读取更新。</span></div><button class="button" data-env-discard ${!hasChanges()||busy?'disabled':''}>放弃修改</button><button class="button" data-env-preview ${!hasChanges()||busy||ruleErrors().length?'disabled':''}>预览生效配置</button><button class="primary" data-env-save ${!hasChanges()||busy||ruleErrors().length?'disabled':''}>${busy?'正在处理…':'保存配置'}</button></footer></section>`;
  },
  bind(){
   if(busy){document.querySelectorAll('.env-editor input,.env-editor select,.env-editor button').forEach(node=>node.disabled=true);return;}
   document.querySelectorAll('[data-env-section]').forEach(b=>b.onclick=()=>{section=b.dataset.envSection;render();document.querySelector('.env-main').scrollTop=0;});
   const fileToggle=document.querySelector('[data-env-file-toggle]');if(fileToggle)fileToggle.onclick=()=>{section='preview';render();document.querySelector('.env-main').scrollTop=0;};
   document.querySelectorAll('[data-env-reload]').forEach(b=>b.onclick=async()=>{busy=true;error='';render();try{if(hasChanges())applyPreview(await post('config/environment/preview',{revision:data.revision,changes:pending}));else await this.load();}catch(e){error=e.message;}finally{busy=false;render();}});
   const discard=document.querySelector('[data-env-discard]');if(discard)discard.onclick=async()=>{pending={};error='';busy=true;render();await this.load();render();};
   document.querySelectorAll('[data-env-model]').forEach(input=>{const update=()=>{const key=input.dataset.envModel,effort=document.querySelector(`[data-env-effort="${key}"]`).value;changed(key,input.value.trim()?`${input.value.trim()}-${effort}`:'');};input.oninput=update;input.onchange=update;});
   document.querySelectorAll('[data-env-effort]').forEach(select=>select.onchange=()=>{const key=select.dataset.envEffort, control=document.querySelector(`[data-env-model="${key}"]`);let model=control.value;if(!model){const field=data.fields.find(f=>f.key===key);const inherited=data.models.find(m=>field.effective.startsWith(m.id+'-'));if(!inherited?.available)return;model=inherited.id;control.value=model;}changed(key,`${model}-${select.value}`);});
   document.querySelectorAll('[data-env-value]').forEach(input=>{
    const update=()=>{const key=input.dataset.envValue;if(input.hasAttribute('data-env-secret')&&!input.value){changed(key,'');return;}changed(key,input.value);};
    if(input.tagName==='SELECT')input.onchange=update;else input.oninput=update;
   });
   document.querySelectorAll('[data-env-clear]').forEach(button=>button.onclick=()=>{const key=button.dataset.envClear;changed(key,'');pending[key]='';render();});
   const submit=async(save)=>{
    if(ruleErrors().length)return;
    busy=true;error='';render();
    try {const next=await post('config/environment'+(save?'':'/preview'),{revision:data.revision,changes:pending});if(save){data=next;pending={};toast('配置已保存，下一次启动任务时生效');}else {applyPreview(next);section='preview';toast('已预览，配置尚未写入');}}
    catch(e){error=e.message;}finally{busy=false;render();if(!save&&!error)document.querySelector('.env-main').scrollTop=0;}
   };
   const save=document.querySelector('[data-env-save]');if(save)save.onclick=()=>submit(true);
   const preview=document.querySelector('[data-env-preview]');if(preview)preview.onclick=()=>submit(false);
  },
 };
}
