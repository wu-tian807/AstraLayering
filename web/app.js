import { pipelineSteps as stepTemplates, groupLayers, groupPhases, stepArtifacts, groupArtifacts } from './progress.js';

const icons = {
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12 4 4L19 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m5 9 7 7 7-7"/>',
 play:'<path d="m8 4 12 8-12 8V4Z"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>', refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.2 6.3a8 8 0 0 1 13.2 2M4.6 15.7a8 8 0 0 0 13.2 2"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
 file:'<path d="M13 3H5v18h14V9l-6-6Z"/><path d="M13 3v6h6M8 13h8M8 17h5"/>',
 code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
 branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10M18 7v2a5 5 0 0 1-5 5H6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor"/><circle cx="15" cy="17" r="3" fill="currentColor"/>',
 dot:'<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>',
 expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 history:'<path d="M3 3v6h6M4 8a9 9 0 1 1-1 7M12 7v5l4 2"/>',
 cube:'<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 9 9-4M12 12 3 8m9 4v10"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
 };
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.file}</svg>`;
const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function get(path) { const response = await fetch(path); const value = await response.json(); if(!response.ok) throw new Error(value.error); return value; }
const initial = await get('./api/tasks');
let tasks = initial.tasks, data = { files:[], pipelines:[] }, pipelineSteps = structuredClone(stepTemplates);
const state = {
 page:new URLSearchParams(location.search).get('page')||'project', name:new URLSearchParams(location.search).get('name')||tasks[0]?.name||'',
 stage:0, selectedStep:'preparation', inspect:false, compare:false, asset:null, zoom:null, canvasLeft:0, canvasTop:0,
 directory:initial.directory, ref:'worktree', file:'shared/tools/update_occlusion/description.md', diff:false, configFilter:'', uploaded:null,
 collapsedPipelines:new Set(), collapsedSteps:new Set(), collapsedPhases:new Set(),
 details:new Map(),
};
const stages = [
 {name:'人物分块',id:'part-layering'}, {name:'人物绘制',id:'raster-layering'},
 {name:'衣服分块',id:'clothing-part-layering'}, {name:'衣服绘制',id:'clothing-raster-layering'},
 {name:'穿戴组装',id:'character-assembly'},
];
async function post(path, value) {
 const response = await fetch('./api/'+path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dir:state.directory,...value})});
 const result = await response.json(); if(!response.ok)throw new Error(result.error); return result;
}
const requestedStage = Number(new URLSearchParams(location.search).get('stage') ?? 3);
if (Number.isInteger(requestedStage) && requestedStage >= 0 && requestedStage < stages.length) {
 state.stage = requestedStage;
 state.selectedStep = requestedStage === 0 || requestedStage === 2 ? 'layers' : requestedStage === 4 ? 'step01' : 'step02';
}
const taskParams = () => new URLSearchParams({name:state.name,dir:state.directory});
const artifact = path => './artifact?'+new URLSearchParams({name:state.name,dir:state.directory,path,v:data.fileVersions?.[path]||''});
function flat(nodes) { return nodes.flatMap(node=>[node,...flat(node.groups||[])]); }
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),4000); }

function header() {
 return `<header class="app-header"><a class="brand" href="./"><span class="brand-mark">${icon('layers')}</span><span>Astra<span class="brand-light">Layering</span></span></a>
 <nav class="global-tabs" aria-label="工作台页面"><button data-page="project" class="${state.page==='project'?'active':''}">${icon('branch')}制作流程</button><button data-page="config" class="${state.page==='config'?'active':''}">${icon('code')}管线配置</button></nav>
 <span class="demo-badge">实时任务 · 每 4 秒同步</span></header>`;
}
const taskStatusNames = {ready:'待启动', running:'运行中', completed:'所选路线已完成', failed:'执行失败', interrupted:'已中断', untracked:'无总控记录'};
function pageHeading() {
 return `<div class="page-heading"><div class="task-heading"><select id="task-select" aria-label="选择任务"><option value="" ${!state.name?'selected':''}>选择任务</option>${tasks.map(task=>`<option value="${esc(task.name)}" ${task.name===state.name?'selected':''}>${esc(task.name)} · ${taskStatusNames[task.status]||task.status}</option>`).join('')}</select><button class="directory-button" data-action="directory" title="${esc(state.directory)}">${icon('folder')}工作目录 ${icon('down')}</button>${state.name?`<span class="task-status">${esc(taskStatusNames[data.status]||data.status||'正在读取')}</span>`:''}</div><div class="heading-actions"><button class="button" data-action="new">${icon('plus')}新建任务</button>${state.name?`<button class="button" data-action="files">${icon('folder')}全部产物</button>${data.canStop?`<button class="button" data-action="stop">停止</button>`:''}<button class="primary" data-action="run" ${data.runnerAlive||data.lockHeld?'disabled':''}>${icon('play')}运行 / 续跑</button>`:''}</div></div>`;
}
let archivedFiles = new Set();
const assetLookup = new Map();
const groupViews = {0:{selected:'',depth:-1,search:'',open:false,expanded:new Set()},2:{selected:'',depth:-1,search:'',open:false,expanded:new Set()}};
const pipelineTree = index => data.pipelines?.[index]?.groups||[];
const available = items => (items||[]).flatMap(item=> {
 if(archivedFiles.has(item.path))return [item];
 if(/(?:simplified|base)-subject\.png$/.test(item.path)) {
  const path = data.files.find(path=>path.replace(/\.(jpg|jpeg|webp)$/i,'.png')===item.path);
  if(path)return [{...item,path}];
 }
 return [];
});
function applySnapshot(next) {
 data=next; archivedFiles=new Set(data.files); assetLookup.clear();
 if(state.asset?.path.endsWith('.draft.svg')&&!archivedFiles.has(state.asset.path)) {
  const published=state.asset.path.replace(/\.draft\.svg$/,'.svg');
  if(archivedFiles.has(published))state.asset={...state.asset,path:published,label:state.asset.label.replace('草稿 · 未落稿','正式稿 · 已落稿')};
 }
 pipelineSteps=structuredClone(stepTemplates);
 for(const [index,stage] of stages.entries()) {
  stage.status=data.pipelines[index]?.status||'pending';
  const mark=steps=>steps.forEach(step=>{step.status=data.pipelines[index]?.states[step.id]||'pending';mark(step.children);});
  mark(pipelineSteps[index]);
 }
 for(const index of [0,2]) {
  const roots=pipelineTree(index),view=groupViews[index];
  if(!flat(roots).some(node=>node.id===view.selected)){view.selected=roots[0]?.id||'';view.expanded=new Set(roots[0]?[roots[0].id]:[]);}
 }
}
let refreshVersion=0, lastSnapshot='';
async function refreshTask(force=false) {
 const version=++refreshVersion;
 const listing=await get('./api/tasks');
 if(version!==refreshVersion)return;
 if(listing.directory!==state.directory){state.directory=listing.directory;state.name='';force=true;}
 tasks=listing.tasks;
 if(!tasks.some(task=>task.name===state.name))state.name=tasks[0]?.name||'';
 const next=state.name?await get('./api/task?'+taskParams()):{files:[],pipelines:[]};
 if(version!==refreshVersion)return;
 const fingerprint=JSON.stringify({next,tasks});
 if(!force&&(document.querySelector('dialog[open]')||document.activeElement?.matches('input,select')||document.querySelector('.panning')))return;
 if(fingerprint!==lastSnapshot||force){
  const selected=state.asset;
  if(selected?.kind==='file'&&next.fileVersions?.[selected.path]!==data.fileVersions?.[selected.path]) {
   const response=await fetch(artifact(selected.path));
   const text=response.ok?await response.text():'此产物暂时不可读取';
   if(version!==refreshVersion)return;
   if(state.asset===selected)selected.text=text;
  }
  lastSnapshot=fingerprint;applySnapshot(next);if(document.querySelector('.app-header')&&(state.page==='project'||force))render();
 }
}
function artifacts(items, index, stepId, className='') {
 const list=available(items);
 if(!list.length)return '';
 return `<div class="step-artifacts ${className}">${list.map(item=>{
  assetLookup.set(item.path,item);
  if(item.path.endsWith('.kra'))return `<a class="artifact-file" href="${artifact(item.path)}" target="_blank" rel="noopener">${icon('layers')}${esc(item.label)} ${icon('arrow')}</a>`;
  return `<button class="${item.kind==='image'?'artifact-image':'artifact-file'} ${item.path.endsWith('.draft.svg')?'draft-artifact':''}" data-asset="${esc(item.path)}" data-asset-stage="${index}" data-asset-step="${stepId}" title="${esc(item.path)}">${item.kind==='image'?`<img loading="lazy" src="${artifact(item.path)}" alt="${esc(item.label)}">`:icon('file')}<span>${esc(item.label)}</span>${item.kind==='image'&&data.fileVersions?.[item.path]?`<small>更新于 ${esc(new Date(Number(data.fileVersions[item.path].split(':')[0])).toLocaleTimeString())}</small>`:''}${item.kind==='file'?icon('chevron'):''}</button>`;
 }).join('')}</div>`;
}
function inlineTreeRows(nodes,index,depth=0,flatView=false) {
 const view=groupViews[index];
 return nodes.map(node=>{
  const branch=!!node.groups?.length,open=branch&&view.expanded.has(node.id)&&!flatView;
  const status=groupSummary(node);
  return `<div class="tree-row ${view.selected===node.id?'selected':''}" style="--depth:${depth}" title="${esc(node.id+' · '+status.text)}">${branch&&!flatView?`<button class="tree-toggle" data-tree-expand="${esc(node.id)}" data-tree-stage="${index}" aria-label="${open?'收起':'展开'} ${esc(node.id)}" aria-expanded="${open}">${icon(open?'down':'chevron')}</button>`:'<span class="tree-toggle"></span>'}<button class="tree-label" data-tree-group="${esc(node.id)}" data-tree-stage="${index}">${statusMark(status.status)}<span>${esc(node.id.split('/').at(-1))}</span><small>${esc(status.text)}</small></button></div>${open?inlineTreeRows(node.groups,index,depth+1):''}`;
 }).join('');
}
function groupSummary(group) {
 const running=groupPhases.find(([id])=>group.webPhases?.[id]==='running');
 if(running)return {status:'running',text:group.webMessages?.[running[0]]||running[1]};
 if(groupPhases.every(([id])=>group.webPhases?.[id]==='done'))return {status:'done',text:'本组已完成'};
 const latest=[...groupPhases].reverse().find(([id])=>['done','available'].includes(group.webPhases?.[id]));
 return latest?{status:group.webPhases[latest[0]],text:group.webMessages?.[latest[0]]||latest[1]}:{status:'pending',text:'待执行'};
}
function groupCycle(index) {
 const roots=pipelineTree(index), view=groupViews[index], layers=groupLayers(roots), all=flat(roots);
 const group=all.find(node=>node.id===view.selected)||roots[0];
 if(!group)return '<p class="empty-tree">尚无分组记录。分组生成后，这里会展示实际树结构和各部件的六个处理环节。</p>';
 const prefix=stages[index].id;
 const depth=layers.findIndex(nodes=>nodes.includes(group)), phaseFiles=groupArtifacts(prefix,group,depth);
 const candidates=view.depth>=0?layers[view.depth]||[]:view.search?all:roots;
 const nodes=view.search?candidates.filter(node=>node.id.toLowerCase().includes(view.search.toLowerCase())):candidates;
 return `<div class="group-cycle" data-cycle="${index}"><p class="cycle-rule">每层轮廓与复核齐备 → 同层去重 → 补全、检查、直属拆分 → 下一层</p>
 <div class="cycle-context"><span>第 ${depth+1} 层</span><b title="${esc(group.id)}">${esc(group.id)}</b><button class="button group-expand" data-group-toggle="${index}" aria-expanded="${view.open}">${icon(view.open?'chevron':'expand')}${view.open?'收起详情':'横向展开'}</button></div>
 <div class="group-workspace ${view.open?'expanded':''}">
 <div class="inline-tree"><div class="inline-tree-heading">${icon('branch')}group / part 树<small>${all.length} 个节点</small></div>
 <div class="tree-controls"><select data-tree-depth="${index}" aria-label="${stages[index].name}拆分树深度"><option value="-1">完整层级</option>${layers.map((nodes,i)=>`<option value="${i}" ${view.depth===i?'selected':''}>第 ${i+1} 层 · ${nodes.length} 个节点</option>`).join('')}</select><button class="icon-button" data-expand-all="${index}" title="展开全部层级">${icon('expand')}</button></div>
 <div class="tree-search">${icon('search')}<input data-tree-search="${index}" aria-label="搜索${stages[index].name}部件" placeholder="搜索部件" value="${esc(view.search)}"></div>
 <div class="inline-tree-rows" data-tree-scroll="${index}">${inlineTreeRows(nodes,index,0,view.depth>=0||!!view.search)||'<p class="empty-tree">没有匹配的部件</p>'}</div>
 <p class="tree-note">点击部件，向右展开它的六个环节。</p>
 ${artifacts([{path:`${prefix}/groups.json`,label:'完整 groups.json',kind:'file'}],index,'layers')}
 </div>
 ${view.open?`<div class="group-detail"><p class="group-note">${esc(group.note||'')}</p><div class="cycle-phases">${groupPhases.map(([id,label],i)=>{
  const key=`${index}:${id}`,closed=state.collapsedPhases.has(key),status=group.webPhases?.[id]||'pending';
  return `<section class="cycle-phase ${closed?'collapsed':''}" data-phase="${key}"><button data-phase-toggle="${key}" aria-expanded="${!closed}" aria-label="${closed?'展开':'收起'}${label}"><span class="cycle-number">${i+1}</span><b>${esc(label)}</b>${statusMark(status)}${icon(closed?'chevron':'down')}</button>${closed?'':`<p class="phase-state ${status}">${esc(group.webMessages?.[id]||statusNames[status])}</p>${artifacts(phaseFiles[id],index,id,'phase-artifacts')}${!available(phaseFiles[id]).length?'<span class="phase-explanation">尚无本步骤产物</span>':''}`}</section>`;
 }).join('')}</div></div>`:`<div class="group-compact"><p>${statusMark(groupSummary(group).status)}${esc(groupSummary(group).text)}</p><div class="compact-phases">${groupPhases.map(([id,label])=>`<button data-group-toggle="${index}" aria-label="展开 ${esc(group.id)} 的${label}">${statusMark(group.webPhases?.[id]||'pending')}${label}</button>`).join('')}</div>${artifacts([...phaseFiles.completion,...phaseFiles.reduction,...phaseFiles.outline].filter(item=>item.kind==='image'&&archivedFiles.has(item.path)).slice(0,1),index,'layers')}</div>`}
 </div></div>`;
}
const statusNames = {done:'已完成',running:'进行中',pending:'待执行',failed:'失败',interrupted:'需续跑',available:'已有产物',skipped:'无需执行',unconfirmed:'待确认 / 可续跑'};
function statusMark(status) {
 return `<span class="phase-mark ${status}" title="${statusNames[status]}" aria-label="${statusNames[status]}">${status==='done'?icon('check'):status==='running'?'<i></i>':icon(status==='available'?'image':status==='failed'?'info':status==='skipped'?'check':'clock')}</span>`;
}
function selectedStep() {
 const all=nodes=>nodes.flatMap(node=>[node,...all(node.children)]);
 return all(pipelineSteps[state.stage]).find(step=>step.id===state.selectedStep)||pipelineSteps[state.stage][0];
}
function stepNode(index,step,nested=false) {
 const selected=state.inspect&&state.stage===index&&state.selectedStep===step.id;
 const key=`${index}:${step.id}`, closed=state.collapsedSteps.has(key);
 const context=step.id==='layers'?groupCycle(index):step.children.length?`<div class="step-children">${step.children.map(child=>stepNode(index,child,true)).join('')}</div>`:'';
 return `<section class="step-node ${nested?'nested':''} ${step.children.length?'step-container':''} ${step.status} ${selected?'selected':''}" data-node="${index}:${step.id}">
 <div class="section-heading"><button class="step-node-heading" data-step="${index}:${step.id}">${statusMark(step.status)}<h3>${esc(step.title)}</h3>${step.id.startsWith('step')?`<small>${step.id}</small>`:''}</button><button class="icon-button" data-section-toggle="${key}" aria-label="${closed?'展开':'收起'}${esc(step.title)}" aria-expanded="${!closed}">${icon(closed?'chevron':'down')}</button></div>
 ${closed?'':`
 ${step.note&&step.id!=='layers'?`<p class="step-summary">${esc(step.note)}</p>`:''}
 ${step.id==='standard'&&!available(stepArtifacts[index][step.id]).some(item=>item.kind==='image')?'<p class="archive-gap">尚无 standard.png；旧任务保留此空位，人物准备阶段执行后展示。</p>':''}
 ${context}
 ${artifacts(stepArtifacts[index][step.id],index,step.id)}
 ${data.pipelines[index]?.messages[step.id]?`<p class="status-error">${esc(data.pipelines[index].messages[step.id])}</p>`:''}
 ${step.id.startsWith('step')?processArtifacts(index,step.id):''}
 `}
 </section>`;
}
function processArtifacts(index, stepId) {
 const prefix=stages[index].id+'/'+stepId+'/';
 const known=new Set(Object.values(stepArtifacts[index]).flat().map(item=>item.path));
 const items=data.files.filter(path=>path.startsWith(prefix)&&!known.has(path));
 if(!items.length)return '';
 return `<details class="process-files" data-details="process:${index}:${stepId}"><summary>${items.length} 个过程文件</summary>${artifacts(items.map(path=>({path,label:path.slice(prefix.length),kind:/\.(png|jpe?g|webp|svg)$/i.test(path)?'image':'file'})),index,stepId)}</details>`;
}
function flowCard(index) {
 const stage=stages[index],closed=state.collapsedPipelines.has(index),wide=!closed&&groupViews[index]?.open&&!state.collapsedSteps.has(`${index}:layers`);
 return `<section class="pipeline-lane ${stage.status} ${closed?'collapsed':''} ${wide?'group-expanded':''}" data-pipeline="${index}"><div class="pipeline-heading"><button data-stage="${index}" aria-label="查看${stage.name}交付"><span class="node-number">${String(index+1).padStart(2,'0')}</span><h2>${stage.name}</h2>${statusMark(stage.status)}</button><button class="icon-button" data-pipeline-toggle="${index}" aria-label="${closed?'展开':'收起'}${stage.name}栏目" aria-expanded="${!closed}">${icon(closed?'chevron':'down')}</button></div>${closed?`<p class="lane-summary">${esc(statusNames[stage.status])}</p>`:`<div class="pipeline-steps">${pipelineSteps[index].map(step=>stepNode(index,step)).join('')}<button class="button pipeline-run" data-run-stage="${index}" ${data.runnerAlive||data.lockHeld?'disabled':''}>${icon('play')}运行 / 恢复${stage.name}</button>${data.pipelines[index]?.threadId?`<small class="thread-id" title="${esc(data.pipelines[index].threadId)}">thread · ${esc(data.pipelines[index].threadId)}</small>`:''}</div>`}</section>`;
}
function inspector() {
 const stage=stages[state.stage],step=selectedStep(),item=state.asset;
 const image=item?.kind==='image';
 return `<aside class="output-inspector" aria-label="产物放大查看"><header class="output-heading"><div><small>${esc(stage.name)} · ${esc(step.title)}</small><h2>${esc(item?.label||step.title)}</h2></div><button class="icon-button" data-action="close-inspector" aria-label="关闭产物面板">${icon('close')}</button></header><div class="output-scroll">
 ${image?`<div class="output-caption"><span>当前任务产物</span><label><input type="checkbox" id="compare-reference" ${state.compare?'checked':''}>对照参考</label></div><div class="output-image ${state.compare?'compare':''}">${state.compare&&data.reference?`<figure><img src="${artifact(data.reference)}" alt="简化角色参考"><figcaption>简化角色参考</figcaption></figure>`:''}<figure><a href="${artifact(item.path)}" target="_blank" rel="noopener"><img loading="lazy" src="${artifact(item.path)}" alt="${esc(item.label)}"></a><figcaption>点击打开原尺寸</figcaption></figure></div>`:item?`<pre class="artifact-text">${esc(item.text??'正在读取…')}</pre>`:`<p class="step-note">${esc(step.note||'此步骤的过程和已有产物直接展示在画布中。')}</p>`}
 ${item?`<a class="artifact-source" href="${artifact(item.path)}" target="_blank" rel="noopener">${esc(item.path)} ${icon('arrow')}</a>`:''}</div>
 <footer class="output-footer"><button class="button" data-action="single">${icon('play')}运行 / 恢复${esc(stage.name)}</button></footer></aside>`;
}
function graph() {
 if(!state.name)return `${pageHeading()}<section class="empty-workspace"><h2>开始一次角色制作</h2><p>新建任务并提供一张角色图，或选择已有任务所在的运行目录。</p><p>${esc(state.directory)}</p><button class="primary" data-action="new">新建任务</button></section>`;
 return `${pageHeading()}${runNotice()}<section class="workflow-shell"><div class="flow-area"><div class="flow-toolbar"><span>完整流程 · 中间步骤与产物</span><div class="flow-legend"><span>${statusMark('done')}完成</span><span>${statusMark('running')}进行中</span><span>${statusMark('pending')}等待</span><span>${statusMark('available')}已有产物</span><span>${statusMark('failed')}失败</span></div><div class="canvas-tools"><button data-action="zoom-out" aria-label="缩小画布">−</button><button data-action="zoom-reset" id="zoom-label">100%</button><button data-action="zoom-in" aria-label="放大画布">＋</button><button data-action="zoom-fit">适合宽度</button></div></div>
 <div class="flow-scroll" tabindex="0" aria-label="完整流程画布，可滚动和平移"><div class="flow-size"><div class="flow-world"><svg class="flow-connectors" aria-hidden="true"></svg><div class="flow-input">${data.original?`<a href="${artifact(data.original)}" target="_blank" rel="noopener"><img src="${artifact(data.original)}" alt="原始输入图"></a>`:icon('image')}<span><b>输入角色图</b><small>original → standard</small></span></div><div class="flow-grid">${stages.map((_,i)=>flowCard(i)).join('')}</div></div></div></div>
 <footer class="flow-footnote">按 01 → 05 顺序执行 · 点击 group 横向展开，栏目与环节均可收起 · 草稿未落稿；正式稿与复核分别显示 · 按文件和报告展示，续跑资格由管线校验</footer></div>${state.inspect?inspector():''}</section>`;
}
function runNotice() {
 const message=data.run?.error||data.lastLogMessage||data.run?.lastMessage||'尚无总调度执行记录，可选择单条管线读取已有上游产物。';
 return `<details data-details="run-notice" class="run-notice ${data.status==='failed'?'error':''}" ${data.status==='failed'?'open':''}><summary>${icon(data.status==='failed'?'info':'clock')}<span>${esc(message.split('\n')[0])}</span><small>运行记录与日志</small></summary><div>${data.errors.length?`<pre class="status-error">${esc(data.errors.join('\n'))}</pre>`:''}<pre>${esc(message)}</pre><pre class="live-log">${esc(data.logs||'暂无日志')}</pre><small>日志：${esc(data.logPath||data.directory)}${data.logUpdatedAt?' · 日志更新：'+esc(new Date(data.logUpdatedAt).toLocaleString()):''}${data.run?.updatedAt?' · 状态保存：'+esc(new Date(data.run.updatedAt).toLocaleString()):''}</small></div></details>`;
}
let flowObserver;
function connectFlow() {
 const world=document.querySelector('.flow-world');
 if(!world)return;
 const viewport=document.querySelector('.flow-scroll');
 state.zoom??=Math.min(1,Math.max(.65,(viewport.clientWidth-8)/world.offsetWidth));
 world.style.transform=`scale(${state.zoom})`;
 const size=document.querySelector('.flow-size');
 size.style.width=`${world.offsetWidth*state.zoom}px`;size.style.height=`${world.offsetHeight*state.zoom}px`;
 document.querySelector('#zoom-label').textContent=Math.round(state.zoom*100)+'%';
 const bounds=world.getBoundingClientRect();
 const box=selector=>{const r=world.querySelector(selector).getBoundingClientRect();return {x:(r.left-bounds.left)/state.zoom,y:(r.top-bounds.top)/state.zoom,w:r.width/state.zoom,h:r.height/state.zoom};};
 const input=box('.flow-input'),cards=stages.map((_,i)=>box(`[data-pipeline="${i}"] .pipeline-heading`));
 const svg=world.querySelector('.flow-connectors'),paths=[];
 const path=(d,label,x,y,status='done')=>paths.push(`<path class="${status}" d="${d}" marker-end="url(#flow-arrow-${status})"/>${label?`<text x="${x}" y="${y}">${label}</text>`:''}`);
 path(`M${input.x+input.w/2} ${input.y+input.h} V${cards[0].y-6}`,'',0,0);
 for(const [a,b,label,status] of [[cards[0],cards[1],'parts',stages[0].status==='done'?'done':'pending'],[cards[2],cards[3],'parts',stages[2].status==='done'?'done':'pending'],[cards[3],cards[4],'衣服 KRA',stages[3].status==='done'?'done':'pending']]){
  const y=a.y+a.h/2;path(`M${a.x+a.w} ${y} H${b.x-6}`,label,(a.x+a.w+b.x)/2,y-10,status);
 }
 for(const [a,b,y,label,status] of [[cards[0],cards[2],106,'简化角色参考',data.reference?'done':'pending'],[cards[1],cards[4],54,'人物素体 KRA',stages[1].status==='done'?'done':'pending']]){
  const x1=a.x+a.w*.72,x2=b.x+b.w*.45;
  path(`M${x1} ${a.y} V${y} H${x2} V${b.y-6}`,label,(x1+x2)/2,y-10,status);
 }
 svg.setAttribute('viewBox',`0 0 ${world.offsetWidth} ${world.offsetHeight}`);
 svg.innerHTML=`<defs>${['done','pending'].map(status=>`<marker id="flow-arrow-${status}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="${status==='done'?'#86b7a8':'#a7b3c0'}"/></marker>`).join('')}</defs>${paths.join('')}`;
}
function zoomCanvas(value,fit=false) {
 const viewport=document.querySelector('.flow-scroll'),previous=state.zoom;
 const centerX=viewport.scrollLeft+viewport.clientWidth/2,centerY=viewport.scrollTop+viewport.clientHeight/2;
 state.zoom=Math.min(1.5,Math.max(.4,value));connectFlow();
 viewport.scrollLeft=fit?0:centerX*state.zoom/previous-viewport.clientWidth/2;
 viewport.scrollTop=fit?0:centerY*state.zoom/previous-viewport.clientHeight/2;
}
async function openAsset(item,index,stepId) {
 state.stage=index;state.selectedStep=stepId;state.inspect=true;state.asset={...item};
 const selected=state.asset;render();
 if(item.kind==='file') {
  try{const response=await fetch(artifact(item.path));if(!response.ok)throw new Error('无法读取产物');selected.text=await response.text();}
  catch(error){selected.text=error.message;}
  if(state.asset===selected&&state.inspect)render();
 }
}
let versions, configFiles=[], configText='', schemaText='', diffText='', configBusy=false;
function setConfigBusy(busy) {
 configBusy=busy;
 document.querySelectorAll('.version-bar input,.version-bar select,.config-workspace button,.config-workspace input,[data-action=history]').forEach(node=>{node.disabled=busy;});
}
async function refreshConfigFile() {
 setConfigBusy(true);
 try {await loadConfigFile();render();} catch(error) {toast(error.message);} finally {setConfigBusy(false);}
}
async function loadConfig() {
 setConfigBusy(true);
 try {
  versions=await get('./api/config/versions?ref='+encodeURIComponent(state.ref));
  const snapshot=await get('./api/config/files?ref='+encodeURIComponent(state.ref)); configFiles=snapshot.paths;
  if(!configFiles.includes(state.file)) state.file=configFiles[0]||'';
  await loadConfigFile();
 } catch(error) { toast(error.message); } finally {setConfigBusy(false);}
}
async function loadConfigFile() {
 if(!state.file) {configText='这个版本没有可浏览的管线配置。';schemaText='';return;}
 const q=`?ref=${encodeURIComponent(state.ref)}&path=${encodeURIComponent(state.file)}`;
 configText=(await get('./api/config/content'+q)).text; schemaText=''; diffText='';
 const sibling=state.file.replace(/description\.md$/,'schema.json');
 if(sibling!==state.file&&configFiles.includes(sibling)) schemaText=(await get('./api/config/content'+`?ref=${encodeURIComponent(state.ref)}&path=${encodeURIComponent(sibling)}`)).text;
 if(state.diff) diffText=(await get('./api/config/diff'+q+'&base='+encodeURIComponent(state.base||'HEAD~2'))).text;
}
function markdown(text) {
 // The prototype renders text, headings and code; it never inserts source HTML.
 let inCode=false;
 return text.split('\n').map(line=> {
  if(line.startsWith('```')) {inCode=!inCode;return inCode?'<pre>':'</pre>';}
  if(inCode) return esc(line)+'\n';
  if(!line.trim()) return '';
  const heading=line.match(/^(#{1,4})\s+(.+)/);
  const content=esc(heading?heading[2]:line).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  if(heading) return `<h${heading[1].length+1}>${content}</h${heading[1].length+1}>`;
  return `<p${/^[-*] /.test(line)?' class="md-bullet"':''}>${content}</p>`;
 }).join('');
}
function jsonLines(text) {
 return text.split('\n').map((line,i)=>`<div class="code-line"><span class="line-number">${i+1}</span><code>${esc(line).replace(/(&quot;.*?&quot;)(\s*:)?/g,(_,str,colon)=>`<span class="${colon?'json-key':'json-string'}">${str}</span>${colon||''}`).replace(/\b(false|true|null)\b/g,'<span class="json-value">$1</span>')}</code></div>`).join('');
}
function configTree() {
 const families=[['part-layering','人物分块'],['raster-layering','人物绘制'],['clothing-part-layering','衣服分块'],['clothing-raster-layering','衣服绘制'],['character-assembly','穿戴组装'],['shared','公共工具']];
 return families.map(([prefix,label])=> {
  const files=configFiles.filter(file=>file.startsWith(prefix+'/')&&(!state.configFilter||file.toLowerCase().includes(state.configFilter.toLowerCase())));
  if(!files.length)return '';
  const active=state.file.startsWith(prefix+'/');
  let content=files;
  if(prefix==='shared'&&!state.configFilter) {
   const activeTool=state.file.split('/')[2];
   const tools=[...new Set(files.map(f=>f.split('/')[2]))].sort((a,b)=>a===activeTool?-1:b===activeTool?1:a.localeCompare(b));
   content=tools.flatMap(tool=>tool===activeTool?files.filter(f=>f.startsWith(`shared/tools/${tool}/`)):[files.find(f=>f===`shared/tools/${tool}/description.md`)||files.find(f=>f.startsWith(`shared/tools/${tool}/`))]);
  }
  return `<details class="config-family" ${active||state.configFilter?'open':''}><summary>${icon('chevron')}${icon(prefix==='shared'?'code':'folder')}<span>${label}</span><small>${files.length}</small></summary><div>${content.map(file=>`<button data-config-file="${esc(file)}" class="config-file ${state.file===file?'active':''}" title="${esc(file)}">${icon(file.endsWith('.json')?'code':'file')}<span>${esc(prefix==='shared'?(file.split('/')[2]===state.file.split('/')[2]?file.split('/')[2]+' / '+file.split('/').at(-1):file.split('/')[2]):file.split('/').at(-1))}</span></button>`).join('')}</div></details>`;
 }).join('');
}
function configPage() {
 const isTool=state.file.includes('/tools/'), currentFile=state.file.split('/').at(-1)||'', toolName=isTool?state.file.split('/').at(-2):currentFile;
 const sourceRefs=['worktree',...new Set(['origin/main','upstream/main',...(versions?.branches||[])])];
 return `<div class="page-heading config-heading"><div><div class="breadcrumb">工作空间 ${icon('chevron')}<span>配置浏览</span></div><h1>管线配置 <span class="subtitle-tag">只读</span></h1><p>查看提示词与工具协议，沿 Git 版本回溯每一次变化。</p></div><button class="button" data-action="history">${icon('history')}提交历史</button></div>
 <div class="version-bar"><span class="version-label">${icon('branch')}配置来源</span><select id="config-ref" aria-label="配置版本">${sourceRefs.map(ref=>`<option value="${esc(ref)}" ${ref===state.ref?'selected':''}>${ref==='worktree'?'本地工作区':esc(ref)}</option>`).join('')}${versions?.commits?.filter(c=>c.sha===state.ref).map(c=>`<option selected value="${c.sha}">${c.short}</option>`).join('')||''}</select><span class="version-sha">${versions?.commits?.[0]?.short||'…'}</span><span class="version-description">${state.ref==='worktree'?'包含尚未提交的本地修改':'固定版本快照'}</span><span class="spacer"></span><label class="diff-toggle"><input type="checkbox" id="config-diff" ${state.diff?'checked':''}>查看差异</label><select id="config-base" aria-label="对比基准">${(versions?.commits||[]).slice(1).map((c,i)=>`<option value="${c.sha}" ${(state.base?state.base===c.sha:i===1)?'selected':''}>对比 ${c.short} · ${esc(c.title.slice(0,32))}</option>`).join('')}</select></div>
 <div class="config-workspace"><aside class="config-tree"><div class="pane-title"><h3>配置目录</h3><span class="count-badge">${configFiles.length}</span></div><div class="tree-search">${icon('search')}<input id="config-search" value="${esc(state.configFilter)}" placeholder="搜索提示词或工具" aria-label="搜索配置"></div><div class="config-tree-scroll">${configTree()}</div><div class="config-tree-footer">${icon('lock')}切换版本不会修改工作区</div></aside>
 <section class="config-content"><div class="config-file-heading"><div class="config-file-icon">${icon(isTool?'code':'file')}</div><div><h2>${esc(toolName)}</h2><code>${esc(state.file.replace(/\/description\.md$/,''))}</code></div><span class="spacer"></span><span class="small-tag">${isTool?'TOOL DEFINITION':'MARKDOWN'}</span></div><div class="config-tabs"><button class="active">${icon(state.diff?'branch':'eye')}${state.diff?'版本差异':'配置预览'}</button><span>所选版本的实际文件</span></div>
 ${state.diff?`<div class="diff-content">${diffText?diffText.split('\n').map(line=>`<pre class="${line.startsWith('+')?'addition':line.startsWith('-')?'deletion':''}">${esc(line)}</pre>`).join(''):`<div class="empty-diff">${icon('check')}这个文件在两个版本之间没有变化。</div>`}</div>`:`<div class="config-pair"><article class="markdown-panel"><header><span>${icon('file')}${currentFile.endsWith('.json')?'Schema JSON':currentFile}</span><small>${currentFile.endsWith('.json')?'JSON':'MARKDOWN'}</small></header><div class="markdown-body">${currentFile.endsWith('.json')?`<pre>${esc(configText)}</pre>`:markdown(configText)}</div></article>${schemaText?`<article class="schema-panel"><header><span>${icon('code')}schema.json</span><small>JSON SCHEMA</small></header><div class="code-body">${jsonLines(schemaText)}</div></article>`:''}</div>`}
 <div class="config-content-footer">${icon('info')}description 与 schema 来自同一版本；预览不会影响正在运行的 agent。</div></section></div>`;
}
function render() {
 const previous=document.querySelector('.flow-scroll');
 if(previous){state.canvasLeft=previous.scrollLeft;state.canvasTop=previous.scrollTop;}
 const treeScroll=Object.fromEntries([...document.querySelectorAll('[data-tree-scroll]')].map(node=>[node.dataset.treeScroll,node.scrollTop]));
 const outputScroll=document.querySelector('.output-scroll')?.scrollTop||0;
 document.querySelectorAll('[data-details]').forEach(node=>state.details.set(node.dataset.details,node.open));
 flowObserver?.disconnect();
 document.querySelector('#app').innerHTML=header()+`<main class="main ${state.page==='config'?'config-page':''}">${state.page==='config'?configPage():graph()}</main>`;
 bind();setConfigBusy(configBusy);
 document.querySelectorAll('[data-details]').forEach(node=>{if(state.details.has(node.dataset.details))node.open=state.details.get(node.dataset.details);});
 const output=document.querySelector('.output-scroll');if(output)output.scrollTop=outputScroll;
 if(state.page==='project'&&state.name) {
  connectFlow();
  const viewport=document.querySelector('.flow-scroll');viewport.scrollLeft=state.canvasLeft;viewport.scrollTop=state.canvasTop;
  document.querySelectorAll('[data-tree-scroll]').forEach(node=>{node.scrollTop=treeScroll[node.dataset.treeScroll]||0;});
  flowObserver=new ResizeObserver(connectFlow);flowObserver.observe(document.querySelector('.flow-world'));
 }
}
function showNew(single=false, existing=false) {
 const dialog=document.querySelector('#new-task'); state.uploaded=null;
 dialog.innerHTML=`<div class="modal-heading"><div><span class="eyebrow">${existing?'CONTINUE CREATION':'NEW CREATION'}</span><h2>${existing?'运行 / 续跑 '+esc(state.name):'开始一次新的制作'}</h2><p>${existing?'沿用已有产物、完成标记与绘制 thread。':'提供一张角色图，制作分层素材。'}</p></div><button class="icon-button" data-close>${icon('close')}</button></div><form id="new-task-form"><div class="new-task-columns"><div>${!existing?`<label class="field-label">输入参考图</label><label class="upload-zone" id="upload-zone"><input id="image-input" type="file" accept="image/png,image/jpeg,image/webp" hidden><span class="upload-icon">${icon('upload')}</span><b>选择或拖入角色图片</b><p>PNG、JPG、WebP · 最大 20 MB</p></label><label class="field-label">或填写服务器上的图片路径</label><input name="image" placeholder="绝对路径；相对路径基于任务目录">`:data.original?`<img class="resume-reference" src="${artifact(data.original)}" alt="已保存的原图">`:'<p>从该任务已有的上游产物继续。</p>'}<div class="input-note">${icon('folder')}${esc(state.directory)}</div></div><div class="task-form-fields"><label class="field-label" for="task-name">任务名称</label><input id="task-name" name="name" value="${existing?esc(state.name):''}" ${existing?'readonly':''} placeholder="例如 character-03" required><label class="field-label">执行范围</label><div class="scope-options"><label class="${!single?'selected':''}"><input type="radio" name="scope" value="all" ${!single?'checked':''}>整条流程<span>五条管线依次执行</span></label><label class="${single?'selected':''}"><input type="radio" name="scope" value="single" ${single?'checked':''}>单条管线<span>读取本任务已有上游产物</span></label></div><select name="stage" id="new-stage" ${!single?'hidden':''}>${stages.map((s,i)=>`<option value="${i}" ${i===state.stage?'selected':''}>${s.name} · ${s.id}</option>`).join('')}</select><label class="standard-option"><div><b>标准化人物姿态</b><p>先判断是否需要调整，再按需生图。</p></div><input type="checkbox" name="standard" ${existing&&data.run?.standard?'checked':''} role="switch" aria-label="标准化人物姿态"></label><div class="standard-detail">嘴部张大、眼睛张开，正视站立，双手放在身体两侧。仅人物准备阶段使用。</div><label class="field-label">Krita 可执行文件</label><input name="krita" value="${existing?esc(data.run?.krita||''):''}" placeholder="例如 /usr/bin/krita；已记录时可留空"><small>绘制与组装管线需要 Krita。未安装时，请先由 agent 协助安装桌面版或配置无桌面显示环境。</small><label class="field-label">调度并发 jobs</label><input name="jobs" type="number" min="1" value="${existing?data.run?.jobs||3:3}"></div></div><p class="form-error" role="alert"></p><div class="modal-footer"><span>操作由服务器执行，关闭网页仍会继续。</span><button type="button" class="button" data-close>取消</button><button class="primary" type="submit">${icon('play')}开始${existing?' / 续跑':'制作'}</button></div></form>`;
 dialog.showModal();dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
 if(!existing) {
  let previewURL;
  const upload=file=>{if(!file?.type.startsWith('image/'))return toast('请选择图片文件');if(file.size>20*1024*1024)return toast('图片最大 20 MB');state.uploaded=file; if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);const zone=dialog.querySelector('#upload-zone');zone.classList.add('has-image');zone.style.backgroundImage=`url("${previewURL}")`;zone.querySelector('b').textContent=file.name;};
  dialog.querySelector('#image-input').onchange=e=>upload(e.target.files[0]);const zone=dialog.querySelector('#upload-zone');zone.ondragover=e=>e.preventDefault();zone.ondrop=e=>{e.preventDefault();upload(e.dataTransfer.files[0]);};
  dialog.addEventListener('close',()=>{if(previewURL)URL.revokeObjectURL(previewURL);},{once:true});
 }
 const updateScope=()=>{
  const form=dialog.querySelector('form'),single=form.elements.scope.value==='single';
  form.elements.stage.hidden=!single;
  form.elements.standard.disabled=single&&Number(form.elements.stage.value)!==0;
  dialog.querySelectorAll('.scope-options label').forEach(l=>l.classList.toggle('selected',l.querySelector('input').checked));
 };
 dialog.querySelectorAll('[name=scope],[name=stage]').forEach(r=>r.onchange=updateScope); updateScope();
 let created=existing;
 dialog.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const form=e.target,fields=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;form.querySelector('.form-error').textContent='';
  try {
   const single=fields.get('scope')==='single',index=Number(fields.get('stage'));
   const payload={name:fields.get('name').trim(),krita:fields.get('krita'),jobs:Number(fields.get('jobs')),from:single?stages[index].id:stages[0].id,to:single?stages[index].id:stages[4].id};
   if(!single||index===0)payload.standard=fields.get('standard')==='on';
   if(!created) {
    payload.image=fields.get('image');
    if(state.uploaded)payload.upload=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(state.uploaded);});
    await post('tasks',payload);created=true;form.elements.name.readOnly=true;delete payload.upload;delete payload.image;
   }
   state.name=payload.name;button.textContent='正在启动…';await post('start',payload);dialog.close();await refreshTask(true);toast('任务已在后台启动');
  } catch(error){form.querySelector('.form-error').textContent=error.message;if(created){button.textContent='重新启动';await refreshTask(true);}}
  finally{button.disabled=false;}
 };
}
function showDirectory() {
 const dialog=document.querySelector('#directory-dialog');dialog.innerHTML=`<div class="modal-heading"><div><h2>追踪运行目录</h2><p>自动发现该目录下的任务，选择保存在服务器。</p></div><button class="icon-button" data-close>${icon('close')}</button></div><form><label class="field-label">目录绝对路径</label><input name="directory" value="${esc(state.directory)}" required><p class="dialog-note">仓库默认：&lt;仓库&gt;/.run<br>独立安装 skill：&lt;skill 上一级&gt;/.run<br>切换目录不会停止已运行的任务。</p><p class="form-error"></p><div class="modal-footer"><button class="primary">保存目录</button></div></form>`;
 dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await post('settings',{directory:new FormData(e.target).get('directory').trim()});dialog.close();await refreshTask(true);}catch(error){dialog.querySelector('.form-error').textContent=error.message;}};
}
function showFiles() {
 const dialog=document.querySelector('#directory-dialog');dialog.innerHTML=`<div class="modal-heading"><div><h2>${esc(state.name)} · 全部产物</h2><p>按任务实际目录浏览、预览或下载。</p></div><button class="icon-button" data-close>${icon('close')}</button></div><input id="file-filter" placeholder="筛选路径" aria-label="筛选产物"><div class="all-files"></div>`;
 const listing=filter=>{
  dialog.querySelector('.all-files').innerHTML=data.files.filter(path=>path.toLowerCase().includes(filter.toLowerCase())).map(path=>`<button data-open-file="${esc(path)}">${icon(path.endsWith('.kra')?'layers':'file')}<span>${esc(path)}</span></button>`).join('')||'<p>尚无产物</p>';
  dialog.querySelectorAll('[data-open-file]').forEach(button=>button.onclick=()=>{const path=button.dataset.openFile,index=Math.max(0,stages.findIndex(stage=>path.startsWith(stage.id+'/')));dialog.close();if(path.endsWith('.kra'))window.open(artifact(path),'_blank','noopener');else openAsset({path,label:path.split('/').at(-1),kind:/\.(png|jpe?g|webp|svg)$/i.test(path)?'image':'file'},index,'step01');});
 };
 dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('#file-filter').oninput=e=>listing(e.target.value);listing('');
}
function showHistory() {
 const dialog=document.querySelector('#directory-dialog');dialog.innerHTML=`<div class="modal-heading"><div><h2>提交历史</h2><p>选择一次提交，浏览当时的管线配置。</p></div><button class="icon-button" data-close>${icon('close')}</button></div><div class="commit-list">${(versions?.commits||[]).map((c,i)=>`<button data-commit="${c.sha}"><span class="commit-node">${icon('branch')}</span><div><b>${esc(c.title)}</b><small>${c.short}${i===0?' · 当前分支最新提交':''}</small></div>${icon('chevron')}</button>`).join('')}</div>`;dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelectorAll('[data-commit]').forEach(b=>b.onclick=async()=>{state.ref=b.dataset.commit;dialog.close();await loadConfig();render();});
}
function selectStage(index) {
 const stepId=index===0||index===2?'merge':index===1?'step03':index===3?'step02':'step01';
 const item=available(stepArtifacts[index][stepId])[0];
 if(item)openAsset(item,index,stepId);
 else{state.stage=index;state.selectedStep=stepId;state.asset=null;state.inspect=true;render();}
}
function bind() {
 const select=document.querySelector('#task-select');if(select)select.onchange=async()=>{state.name=select.value;state.inspect=false;state.asset=null;state.canvasLeft=0;state.canvasTop=0;const url=new URL(location.href);url.searchParams.set('name',state.name);history.replaceState(null,'',url);await refreshTask(true);};
 document.querySelectorAll('[data-run-stage]').forEach(b=>b.onclick=()=>{state.stage=Number(b.dataset.runStage);showNew(true,true);});
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=async()=>{state.page=b.dataset.page;if(state.page==='config')await loadConfig();render();});
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>selectStage(Number(b.dataset.stage)));
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const [index,step]=b.dataset.step.split(':'),i=Number(index);const item=available(stepArtifacts[i][step])[0];if(item)openAsset(item,i,step);else{state.stage=i;state.selectedStep=step;state.asset=null;state.inspect=true;render();}});
 document.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>openAsset(assetLookup.get(b.dataset.asset),Number(b.dataset.assetStage),b.dataset.assetStep));
 const toggle=(set,key)=>{set.has(key)?set.delete(key):set.add(key);render();};
 document.querySelectorAll('[data-pipeline-toggle]').forEach(b=>b.onclick=()=>toggle(state.collapsedPipelines,Number(b.dataset.pipelineToggle)));
 document.querySelectorAll('[data-section-toggle]').forEach(b=>b.onclick=()=>toggle(state.collapsedSteps,b.dataset.sectionToggle));
 document.querySelectorAll('[data-phase-toggle]').forEach(b=>b.onclick=()=>toggle(state.collapsedPhases,b.dataset.phaseToggle));
 const revealGroup=index=>{
  const viewport=document.querySelector('.flow-scroll'),node=document.querySelector(`[data-node="${index}:layers"]`);
  const bounds=node.getBoundingClientRect(),view=viewport.getBoundingClientRect();
  viewport.scrollLeft+=bounds.left-view.left-20;viewport.scrollTop+=bounds.top-view.top-20;
 };
 document.querySelectorAll('[data-tree-group]').forEach(b=>b.onclick=()=>{const index=b.dataset.treeStage;groupViews[index].selected=b.dataset.treeGroup;groupViews[index].open=true;state.inspect=false;render();revealGroup(index);});
 document.querySelectorAll('[data-group-toggle]').forEach(b=>b.onclick=()=>{const index=b.dataset.groupToggle;groupViews[index].open=!groupViews[index].open;render();if(groupViews[index].open)revealGroup(index);});
 document.querySelectorAll('[data-tree-expand]').forEach(b=>b.onclick=()=>{const view=groupViews[b.dataset.treeStage],id=b.dataset.treeExpand;view.expanded.has(id)?view.expanded.delete(id):view.expanded.add(id);render();});
 document.querySelectorAll('[data-expand-all]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.expandAll),view=groupViews[i];view.depth=-1;view.search='';view.expanded=new Set(flat(pipelineTree(i)).filter(node=>node.groups?.length).map(node=>node.id));render();});
 document.querySelectorAll('[data-tree-depth]').forEach(select=>select.onchange=()=>{groupViews[select.dataset.treeDepth].depth=Number(select.value);render();});
 document.querySelectorAll('[data-tree-search]').forEach(input=>input.oninput=()=>{const i=input.dataset.treeSearch,position=input.selectionStart;groupViews[i].search=input.value;render();const next=document.querySelector(`[data-tree-search="${i}"]`);next.focus({preventScroll:true});next.setSelectionRange(position,position);});
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=> {
  const action=b.dataset.action;
  if(action==='new')showNew();
  else if(action==='run')showNew(false,true);
  else if(action==='files')showFiles();
  else if(action==='stop')post('stop',{name:state.name}).then(result=>toast(result.message)).catch(error=>toast(error.message));
  else if(action==='single')showNew(true,true);
  else if(action==='directory')showDirectory();
  else if(action==='history')showHistory();
  else if(action==='close-inspector'){state.inspect=false;render();}
  else if(action==='zoom-in')zoomCanvas(state.zoom+.1);
  else if(action==='zoom-out')zoomCanvas(state.zoom-.1);
  else if(action==='zoom-reset')zoomCanvas(1);
  else if(action==='zoom-fit')zoomCanvas(Math.min(1,(document.querySelector('.flow-scroll').clientWidth-8)/document.querySelector('.flow-world').offsetWidth),true);
 });
 const compare=document.querySelector('#compare-reference');if(compare)compare.onchange=()=>{state.compare=compare.checked;render();};
 const viewport=document.querySelector('.flow-scroll');if(viewport){
  let drag;
  viewport.onpointerdown=e=>{if(e.button!==0||e.pointerType==='touch'||e.target.closest('button,a,input,select,summary,.inline-tree-rows'))return;drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};viewport.setPointerCapture(e.pointerId);viewport.classList.add('panning');};
  viewport.onpointermove=e=>{if(drag){viewport.scrollLeft=drag.left+drag.x-e.clientX;viewport.scrollTop=drag.top+drag.y-e.clientY;}};
  const end=()=>{drag=null;viewport.classList.remove('panning');};viewport.onpointerup=end;viewport.onpointercancel=end;
 }
 document.querySelectorAll('[data-config-file]').forEach(b=>b.onclick=async()=>{state.file=b.dataset.configFile;await refreshConfigFile();});
 const source=document.querySelector('#config-ref');if(source)source.onchange=async()=>{state.ref=source.value;state.base=undefined;await loadConfig();render();};
 const diff=document.querySelector('#config-diff');if(diff)diff.onchange=async()=>{state.diff=diff.checked;state.base=document.querySelector('#config-base').value;await refreshConfigFile();};
 const base=document.querySelector('#config-base');if(base)base.onchange=async()=>{state.base=base.value;if(state.diff){await refreshConfigFile();}};
 const filter=document.querySelector('#config-search');if(filter)filter.oninput=()=>{state.configFilter=filter.value;document.querySelector('.config-tree-scroll').innerHTML=configTree();document.querySelectorAll('[data-config-file]').forEach(b=>b.onclick=async()=>{state.file=b.dataset.configFile;await refreshConfigFile();});};
}
await refreshTask(true);
if(state.page==='config')await loadConfig();
render();
setInterval(()=>refreshTask().catch(error=>toast('同步失败：'+error.message)),4000);
if(new URLSearchParams(location.search).get('dialog')==='new')showNew();
