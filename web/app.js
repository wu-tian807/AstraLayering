import { processFileList } from './process-files.js';
import { sectionSteps as stepTemplates, groupLayers, groupPhases, stepArtifacts, groupArtifacts, shadowInspectionArtifacts, previousNineAxisSectionSteps,
 groupSummary, groupPreviewArtifacts, groupStagePreviewArtifacts, groupReviewSteps, reviewReportText, replacementGroupDraft,
 latestKraPreview, statusNames, displayStatus, statusLabel } from './progress.js';
import { selectedTask, rememberTask } from './task-selection.js';
import { renderReport } from './report-markdown.js';
import { morph } from './dom-morph.js';
import { loadVideoCovers, videoCover } from './video-preview.js';
import { createEnvEditor } from './env-editor.js';
import { createSettings } from './settings-dialog.js';
import { HeadPreview } from './head-preview.js';
import { nineAxisStepCard } from './nine-axis-flow.js';
import { flowStepHeading, flowStepList } from './flow-step-ui.js';
const headPreview = new HeadPreview();

const icons = {
 layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
 folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="m5 12 4 4L19 6"/>', chevron:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m5 9 7 7 7-7"/>',
 play:'<path d="m8 4 12 8-12 8V4Z"/>', stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
 file:'<path d="M13 3H5v18h14V9l-6-6Z"/><path d="M13 3v6h6M8 13h8M8 17h5"/>',
 code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-13-2 16"/>',
 branch:'<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M6 7v10M18 7v2a5 5 0 0 1-5 5H6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 close:'<path d="m6 6 12 12M6 18 18 6"/>',
 expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
 history:'<path d="M3 3v6h6M4 8a9 9 0 1 1-1 7M12 7v5l4 2"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-11v1"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
 };
const icon = (name, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.file}</svg>`;
const esc = value => String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// An error on one line; the full text shows on hover and the button copies it.
const errorBox = (message, cls='', copy='复制错误') => `<div class="error-box ${cls}"><p class="status-error" title="${esc(message)}">${esc(message)}</p><button class="icon-button" data-copy-error="${esc(message)}" title="${copy}" aria-label="${copy}">${icon('copy')}</button></div>`;
// The error a 限流等待 call will retry after, verbatim as in workflow.log, on one copyable line.
const waitBox = message => message ? errorBox(message, 'wait-box', '复制原文') : '';
async function get(path) { const response = await fetch(path); const value = await response.json(); if(!response.ok) throw new Error(value.error); return value; }
const initial = await get('./api/tasks');
let tasks = initial.tasks, data = { files:[], sections:[] }, sectionSteps = structuredClone(stepTemplates);
const state = {
 page:new URLSearchParams(location.search).get('page')||'project', name:selectedTask(initial.directory,tasks,new URLSearchParams(location.search).get('name')),
 stage:0, selectedStep:'preparation', inspect:false, compare:false, asset:null, zoom:null, autoHeight:true, canvasLeft:0, canvasTop:0, lane:0, mergeShift:0,
 directory:initial.directory, ref:new URLSearchParams(location.search).get('ref')||'worktree', file:new URLSearchParams(location.search).get('file')||'', diff:false, configFilter:'', configFolders:new Map(), uploaded:null, configMode:new URLSearchParams(location.search).get('file')?'files':'env',
 collapsedSections:new Set(), collapsedSteps:new Set(), collapsedPhases:new Set(),
 details:new Map(),
};
const stages = [
 {name:'人物分块',id:'part-layering'}, {name:'人物绘制',id:'raster-layering'},
 {name:'衣服分块',id:'clothing-part-layering'}, {name:'衣服绘制',id:'clothing-raster-layering'},
 {name:'穿戴组装',id:'character-assembly'}, {name:'阴影制作',id:'shadow'},
 {name:'头部九轴',id:'nine-axis'},
];
const runnableStages=stages.filter(stage=>initial.sections?initial.sections.includes(stage.id):stage.id!=='nine-axis');
// After the character preparation the character and clothing lanes run side by side; both merge into the assembly.
const flowLanes = [{name:'人物线',stages:[0,1]}, {name:'衣服线',stages:[2,3]}], mergeStages = [4,5,6];
const laneOf = index => flowLanes.findIndex(lane=>lane.stages.includes(index));
const isRasterSection = index => ['raster-layering','clothing-raster-layering'].includes(stages[index]?.id);
const hasKraPreview = index => isRasterSection(index)||stages[index]?.id==='character-assembly'
 ||stages[index]?.id==='shadow'&&data.sections[index]?.mode==='mask';
async function post(path, value) {
 const response = await fetch('./api/'+path, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dir:state.directory,...value})});
 const result = await response.json(); if(!response.ok)throw Object.assign(new Error(result.error),{krita:result.krita,ffmpeg:result.ffmpeg}); return result;
}
// Creating a task, start, continue, resume and retry refuse an unusable Krita before changing
// anything; the global settings open, and the action runs again once they are saved.
const settings=createSettings({get,post,esc,icon,onSaved:async()=>{await refreshTask(true);if(state.page==='config'&&state.configMode==='files')await loadConfig();render();}});
const requestedStage = Number(new URLSearchParams(location.search).get('stage') ?? 0);
function defaultStep(index) {
 return index===0||index===2?'layers':sectionSteps[index]?.[0]?.id||'step01';
}
if (Number.isInteger(requestedStage) && requestedStage >= 0 && requestedStage < stages.length) {
 state.stage = requestedStage;
 state.selectedStep = requestedStage===6?defaultStep(requestedStage):requestedStage===0||requestedStage===2?'layers':requestedStage>=4?'step01':'step02';
}
const taskParams = () => new URLSearchParams({name:state.name,dir:state.directory});
const artifact = (path, thumbnail=false) => './artifact?'+new URLSearchParams({name:state.name,dir:state.directory,path,v:data.fileVersions?.[path]||'',...(/\.kra$/i.test(path)?{preview:'kra',...(thumbnail?{fit:'content'}:{})}:thumbnail&&/\.svg$/i.test(path)?{preview:'content'}:{})});
function flat(nodes) { return nodes.flatMap(node=>[node,...flat(node.groups||[])]); }
function toast(message) { const el=document.querySelector('#toast'); el.textContent=message; el.classList.add('visible'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('visible'),4000); }

// Release version and the newest tag on GitHub; the notice only links to the release page.
let appVersion=null;
const dismissedKey='astra-layering:dismissed-update';
function dismissedUpdate(){try{return localStorage.getItem(dismissedKey);}catch{return null;}}
function versionBadge() {
 if(!appVersion)return '';
 const update=appVersion.updateAvailable&&dismissedUpdate()!==appVersion.latest;
 return `<span class="app-version" title="${appVersion.source==='git'?'按 Git 发布标签确定':'按 package.json 确定'}">${esc(appVersion.label)}</span>${update?`<span class="update-notice"><a href="${esc(appVersion.releaseUrl)}" target="_blank" rel="noopener">有新版本 v${esc(appVersion.latest)} · 查看更新说明</a><button class="icon-button" data-action="dismiss-update" aria-label="不再提示此版本">${icon('close')}</button></span>`:''}`;
}

function header() {
 return `<header class="app-header"><a class="brand" href="./"><span class="brand-mark">${icon('layers')}</span><span>Astra<span class="brand-light">Layering</span></span></a>${versionBadge()}
 <nav class="global-tabs" aria-label="工作台页面"><button data-page="project" class="${state.page==='project'?'active':''}">${icon('branch')}任务与执行</button><button data-page="preview" class="${state.page==='preview'?'active':''}">${icon('layers')}流程预览</button><button data-page="config" class="${state.page==='config'?'active':''}">${icon('code')}管线配置</button></nav>
 <a class="button" href="./studio?${new URLSearchParams({project:state.name})}">${icon('eye')}角色工作台</a><button class="button" data-action="settings" title="Krita、运行目录与先验知识目录">${icon('settings')}全局设置</button><span class="demo-badge">实时任务 · 每 4 秒同步</span></header>`;
}
// Why a failed lane stopped, unless one of its steps already says so (a step keeps a shortened copy).
function laneFailure(section){
 const reason=String(section?.summary||'').split('\n')[0].trim();
 return reason&&!Object.values(section.messages||{}).some(message=>String(message).includes(reason)||reason.startsWith(String(message)))?reason:'';
}
const taskStatusNames = {ready:'待启动', running:'运行中', completed:'所选路线已完成', failed:'执行失败', interrupted:'已中断', untracked:'无总控记录', layout:'需转换目录'};
function pageHeading() {
 return `<div class="page-heading"><div class="task-heading"><select id="task-select" aria-label="选择任务"><option value="" ${!state.name?'selected':''}>选择任务</option>${tasks.map(task=>`<option value="${esc(task.name)}" ${task.name===state.name?'selected':''}>${esc(task.displayName||task.name)} · ${taskStatusNames[task.status]||task.status}</option>`).join('')}</select></div><div class="heading-actions"><button class="button" data-action="new">${icon('plus')}新建任务</button>${state.name?`${!data.archived&&!data.runnerAlive&&!data.lockHeld?'<button class="button" data-action="run-options">执行参数</button>':''}<button class="button" data-action="files">${icon('folder')}全部产物</button>${stepToolbar()}`:''}</div></div>`;
}
let archivedFiles = new Set();
const assetLookup = new Map();
const groupViews = {0:{selected:'',depth:-1,search:'',open:false,expanded:new Set()},2:{selected:'',depth:-1,search:'',open:false,expanded:new Set()}};
// Expanded and collapsed sections survive a page reload (per browser tab).
const viewKey='astra-layering-view';
function saveView() {
 try{sessionStorage.setItem(viewKey,JSON.stringify({details:[...state.details],sections:[...state.collapsedSections],steps:[...state.collapsedSteps],phases:[...state.collapsedPhases],notice:state.noticeStatus,
  groups:Object.fromEntries(Object.entries(groupViews).map(([index,view])=>[index,{...view,expanded:[...view.expanded]}]))}));}catch{}
}
try{
 const saved=JSON.parse(sessionStorage.getItem(viewKey)||'null');
 if(saved){
  state.details=new Map(saved.details);state.collapsedSections=new Set(saved.sections);state.collapsedSteps=new Set(saved.steps);state.collapsedPhases=new Set(saved.phases);state.noticeStatus=saved.notice;
  for(const [index,view] of Object.entries(saved.groups||{}))if(groupViews[index])Object.assign(groupViews[index],{...view,expanded:new Set(view.expanded)});
 }
}catch{}
const sectionTree = index => data.sections?.[index]?.groups||[];
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
 data.sections=stages.map(stage=>next.sections.find(section=>section.id===stage.id)||{id:stage.id,states:{},messages:{},reports:{},steps:[]});
 if(state.asset?.kind==='image'&&state.asset.path.endsWith('.kra')) {
  const source=state.asset.sharedPreview?latestKraPreview(data.sections[state.stage]?.previews):data.sections[state.stage]?.previews?.[state.selectedStep];
  if(source){state.asset={...state.asset,path:source.path};if(state.asset.sharedPreview)state.selectedStep=source.stepId;}
 }
 if(state.asset?.kind==='file'&&/\.md(?:\.tmp)?$/.test(state.asset.path)&&!archivedFiles.has(state.asset.path)) {
  const published=state.asset.path.replace(/\.tmp$/,'');
  if(archivedFiles.has(published))state.asset={...state.asset,path:published};
 }
 if(state.asset?.path.endsWith('.draft.svg')&&!archivedFiles.has(state.asset.path)) {
  const replacement=groupViews[state.stage]?replacementGroupDraft(state.asset.path,stages[state.stage].id,sectionTree(state.stage),archivedFiles,data.fileVersions):undefined;
  if(replacement!==undefined)state.asset=replacement?{...state.asset,...replacement}:null;
  else {
   const published=state.asset.path.replace(/\.draft\.svg$/,'.svg');
   if(archivedFiles.has(published))state.asset={...state.asset,path:published,label:state.asset.label.replace(' · 中间产物','图')};
  }
 }
 sectionSteps=structuredClone(stepTemplates);
 if(data.sections[6]?.layout==='nested')sectionSteps[6]=structuredClone(previousNineAxisSectionSteps);
 if(state.stage===6&&!sectionSteps[6].some(step=>step.id===state.selectedStep||step.children.some(child=>child.id===state.selectedStep||child.children.some(group=>group.id===state.selectedStep))))state.selectedStep=defaultStep(6);
 for(const [index,stage] of stages.entries()) {
  stage.status=data.sections[index]?.status||'pending';
  const mark=steps=>steps.forEach(step=>{
   step.status=data.sections[index]?.states[step.id]||'pending';
   if(index===6&&step.id==='step08_hair') {
    const hair=data.sections[index]?.hair;
    if(hair) {
     step.rounds.forEach(round=>round.status=hair.rounds[round.id]||'pending');
     if(hair.awaitingContinue)step.roundNotice=`继续后制作${step.rounds.find(round=>round.id===hair.next)?.title||'下一轮'}`;
    } else if(step.status==='done')step.rounds=[];
   }
   if(index===0&&step.id==='standard')step.note=data.run?.standard===true?'标准化：已开启':data.run?.standard===false?'标准化：未开启':'标准化：未记录';
   mark(step.children);
  });
  mark(sectionSteps[index]);
 }
 for(const index of [0,2]) {
  const roots=sectionTree(index),view=groupViews[index];
  if(!flat(roots).some(node=>node.id===view.selected)){view.selected=roots[0]?.id||'';view.expanded=new Set(roots[0]?[roots[0].id]:[]);}
 }
}
let refreshVersion=0, lastSnapshot='', refreshInFlight=null;
async function refreshTask(force=false) {
 // A slow snapshot must finish before polling asks for another one. Explicit
 // selections still supersede it, and only the latest selection can publish.
 if(!force&&refreshInFlight)return;
 const version=++refreshVersion;
 const pending=readTaskSnapshot(version,force);
 refreshInFlight=pending;
 try{await pending;}
 catch(error){
  if(version!==refreshVersion)return;
  if(state.loading){state.loading=false;state.loadError=error.message;render();}
  throw error;
 }finally{if(refreshInFlight===pending)refreshInFlight=null;}
}
async function readTaskSnapshot(version,force) {
 const listing=await get('./api/tasks');
 if(version!==refreshVersion)return;
 if(listing.directory!==state.directory){state.directory=listing.directory;state.name='';state.inspect=false;state.asset=null;state.loading=true;applySnapshot({files:[],sections:[]});render();force=true;}
 tasks=listing.tasks;
 if(!tasks.some(task=>task.name===state.name))state.name=selectedTask(state.directory,tasks);
 rememberTask(state.directory,state.name);
 const next=state.name?await get('./api/task?'+taskParams()):{files:[],sections:[]};
 if(version!==refreshVersion)return;
 const fingerprint=JSON.stringify({next,tasks});
 // Interaction may defer artifact redraws, but must never hide a stopped runner.
 const executionState=value=>JSON.stringify([value.status,value.runnerAlive,value.lockHeld,value.run?.live,value.run?.from,value.run?.to,(value.sections||[]).map(section=>[section.id,section.status,section.states,section.krita])]);
 const executionChanged=executionState(next)!==executionState(data);
 const focused=document.activeElement;
 const treeControl=focused?.dataset?.treeSearch!==undefined?'data-tree-search':focused?.dataset?.treeDepth!==undefined?'data-tree-depth':null;
 if(!force&&!executionChanged&&(document.querySelector('dialog[open]')||(!treeControl&&focused?.id!=='task-select'&&focused?.matches('input,select'))||document.querySelector('.panning,.selecting')))return;
 const focus=treeControl?{selector:`[${treeControl}="${focused.getAttribute(treeControl)}"]`,start:focused.selectionStart,end:focused.selectionEnd}:null;
 if(fingerprint!==lastSnapshot||force||state.loading||state.loadError){
  const selected=state.asset;
  if(selected?.kind==='file'&&next.fileVersions?.[selected.path]!==data.fileVersions?.[selected.path]) {
   const published=selected.path.replace(/\.md\.tmp$/,'.md');
   const path=next.files.includes(published)&&!next.files.includes(selected.path)?published:selected.path;
   const response=await fetch(artifact(path));
   const text=response.ok?await response.text():'此产物暂时不可读取';
   if(version!==refreshVersion)return;
   if(state.asset===selected)selected.text=text;
  }
  lastSnapshot=fingerprint;state.loading=false;state.loadError=null;applySnapshot(next);if(document.querySelector('.app-header')&&(state.page!=='config'||force)){
   render();
   if(focus){const input=document.querySelector(focus.selector);input?.focus({preventScroll:true});if(focus.start!=null)input?.setSelectionRange(focus.start,focus.end);}
  }
 }
 void headPreview.update(document.querySelector('[data-head-preview]'),data.directory);
}
function taskLoading() {
 return `${pageHeading()}<div class="run-notice ${state.loadError?'error':''}" role="status">${icon(state.loadError?'info':'clock')}<span>${state.loadError?`读取失败：${esc(state.loadError)}`:`正在读取 ${esc(state.name)} 的进展…`}</span></div>`;
}
function artifacts(items, index, stepId, className='') {
 const list=available(items);
 if(!list.length)return '';
 const view=item=>{
  if(item.path.endsWith('.kra')&&item.kind!=='image')return `<a class="artifact-file" href="${artifact(item.path).replace('&preview=kra','')}" target="_blank" rel="noopener">${icon('layers')}${esc(item.label)} ${icon('arrow')}</a>`;
  const key=item.reviewIndex===undefined?item.path:`${item.path}#${item.reviewMode}-${item.reviewIndex}`;
  assetLookup.set(key,item);
  if(item.kind==='video'){
   const url=artifact(item.path),cover=videoCover(url);
   return `<figure class="artifact-video"><button class="video-cover" data-asset="${esc(key)}" data-asset-stage="${index}" data-asset-step="${stepId}" aria-label="播放${esc(item.label)}"><img data-video-cover="${esc(url)}" ${cover?`src="${esc(cover)}"`:''} alt=""><span class="video-play">${icon('play')}</span></button><figcaption>${esc(item.label)}${className!=='nine-artifacts'&&data.fileVersions?.[item.path]?` · ${esc(new Date(Number(data.fileVersions[item.path].split(':')[0])).toLocaleTimeString())}`:''}</figcaption><a href="${url}" target="_blank" rel="noopener">打开原视频</a></figure>`;
  }
  return `<button class="${item.kind==='image'?'artifact-image':'artifact-file'} ${item.path.endsWith('.draft.svg')?'draft-artifact':''}" data-asset="${esc(key)}" data-asset-stage="${index}" data-asset-step="${stepId}" title="${esc(item.path)}">${item.kind==='image'?`<img loading="lazy" ${/\.svg$/i.test(item.path)?'data-svg-artifact':''} src="${artifact(item.path,true)}" alt="${esc(item.label)}">`:icon('file')}<span>${esc(item.label)}</span>${item.kind==='image'&&data.fileVersions?.[item.path]?`<small>更新于 ${esc(new Date(Number(data.fileVersions[item.path].split(':')[0])).toLocaleTimeString())}</small>`:''}${item.kind==='file'?icon('chevron'):''}</button>`;
 };
 const images=list.filter(item=>item.kind==='image'),files=list.filter(item=>item.kind!=='image');
 const fileList=files.map(view).join('');
 return `<div class="step-artifacts ${className}">${images.length?`<div class="artifact-images">${images.map(view).join('')}</div>`:''}${className==='process-artifacts'&&files.length?`<div class="process-file-list">${fileList}</div>`:fileList}</div>`;
}
function inlineTreeRows(nodes,index,depth=0,flatView=false) {
 const view=groupViews[index];
 return nodes.map(node=>{
  const branch=!!node.groups?.length,open=branch&&view.expanded.has(node.id)&&!flatView;
  const status=groupSummary(node);
  return `<div class="tree-row ${view.selected===node.id?'selected':''}" style="--depth:${depth}" title="${esc(node.id+' · '+status.text)}">${branch&&!flatView?`<button class="tree-toggle" data-tree-expand="${esc(node.id)}" data-tree-stage="${index}" aria-label="${open?'收起':'展开'} ${esc(node.id)}" aria-expanded="${open}">${icon(open?'down':'chevron')}</button>`:'<span class="tree-toggle"></span>'}<button class="tree-label" data-tree-group="${esc(node.id)}" data-tree-stage="${index}">${statusMark(status.status)}<span>${esc(node.id.split('/').at(-1))}</span><small>${esc(status.text)}</small></button></div>${open?inlineTreeRows(node.groups,index,depth+1):''}`;
 }).join('');
}
function svgPreviewPanel(index,group,phase,phaseFiles) {
 const items=groupStagePreviewArtifacts(phase,phaseFiles,archivedFiles,data.fileVersions);
 const title=phase==='outline'?'轮廓 SVG 最新画面':'补全 SVG 最新画面';
 return `<section class="kra-preview-panel svg-preview-panel" data-svg-preview="${index}:${phase}" aria-label="${esc(group.id)} ${title}"><h3>${icon('layers')}${title}</h3><p class="preview-source" title="${esc(items[0]?.path||group.id)}">${esc(items[0]?.label||group.id)}</p>${items.length?artifacts(items,index,phase,'live-kra-artifacts'):'<p class="archive-gap">等待首次保存 SVG</p>'}</section>`;
}
// Task recovery: 继续 keeps products and sessions, 恢复 drops the sessions and keeps
// products, 重试 deletes the step products, sessions and agent attempt records.
// Each acts on every interrupted or failed step of the task at once, then runs the
// task again. Without any step record 继续 opens the run dialog instead. While the
// task runs they cannot apply, so the toolbar holds the stop button in their place.
const stepActionNames={continue:'继续',resume:'恢复',retry:'重试'};
// Shown on hover and focus: what the button keeps or drops, and when to choose it.
const stepActionHelp={
 continue:['保留已有产物和 agent 会话，让原来的 agent 从中断处接着做。','适合：手动停止或意外中断后，想沿着刚才的进度继续。'],
 resume:['保留已有产物，但丢掉旧会话；新 agent 读取这些产物，在新会话中接着做。','适合：产物可用，但旧会话卡住、上下文过长或换了模型。'],
 retry:['删除这些步骤的产物、会话和 agent 尝试记录，从干净状态重做。','适合：结果方向不对，需要从头再来。'],
};
function stepTargets() {
 return (data.sections||[]).flatMap((section,index)=>[
  ...(section.steps||[]).map(step=>({index,id:step.id,status:step.status,session:step.session}))]);
}
const brokenSteps=(targets=stepTargets(),action='continue')=>targets.filter(target=>target.status==='running');
const stepLabel=target=>`${stages[target.index].name} ${target.id}`;
const visibleStage=index=>!data.archived||Object.hasOwn(data.run?.sections||{},stages[index].id);
function stepToolbar() {
 if(!state.name)return '';
 const exportButton=data.canExport?`<a class="button" data-export href="./api/export?${taskParams()}" title="下载正式产物、完整流程预览与报告；不包含过程文件">导出成果</a>`:'';
 if(data.archived)return `<div class="step-toolbar" role="group" aria-label="成果归档">${exportButton}<span>成果归档</span></div>`;
 const targets=stepTargets(),busy=data.runnerAlive||data.lockHeld;
 if(busy)return `<div class="step-toolbar" role="group" aria-label="任务控制"><button class="button" data-action="stop" title="${data.canStop?'停止运行，保留产物与续跑记录（命令行 --stop）':'当前运行未提供可用的停止入口'}" ${data.canStop?'':'disabled'}>${icon('stop')}停止</button></div>`;
 const allowed=action=>action==='continue'||brokenSteps(targets,action).length>0;
 const scope=action=>{const steps=brokenSteps(targets,action);return steps.length?`作用于 ${steps.length} 个中断 / 失败步骤：${steps.map(stepLabel).join('、')}`:'没有中断或失败的步骤，从未完成处续跑';};
 return `<div class="step-toolbar" role="group" aria-label="任务恢复">${Object.keys(stepActionNames).map(action=>`<span class="step-action"><button class="${action==='continue'?'primary':'button'}" data-step-toolbar="${action}" aria-describedby="step-tip-${action}" ${!allowed(action)?'disabled':''}>${stepActionNames[action]}</button><span class="step-tip" role="tooltip" id="step-tip-${action}"><b>${stepActionNames[action]}</b>${!targets.length?'<span>使用保存的参数，从未完成处继续执行。</span>':stepActionHelp[action].map(line=>`<span>${line}</span>`).join('')}${!targets.length?'':!allowed(action)?'<small>当前没有中断或失败的步骤，不可用。</small>':`<small>${esc(scope(action))}。<span class="nowrap">命令行 --${action}</span></small>`}</span></span>`).join('')}${exportButton}</div>`;
}
function groupPhaseNode(index,id,label,status,detail,items,number,hasPreview=false) {
 const key=`${index}:${id}`,closed=state.collapsedPhases.has(key);
 return `<section class="cycle-phase ${status==='skipped'?'skipped-node':''} ${closed?'collapsed':''}" data-phase="${key}"><button data-phase-toggle="${key}" aria-expanded="${!closed}" aria-label="${closed?'展开':'收起'}${label}"><span class="cycle-number">${number}</span><b>${esc(label)}</b>${statusMark(status)}${icon(closed?'chevron':'down')}</button>${closed?'':`<p class="phase-state ${displayStatus(status)}" title="${esc(detail)}">${status==='skipped'?'无需执行':esc(statusLabel(status))}</p>${status==='throttled'?waitBox(detail):''}${artifacts(items,index,id,'phase-artifacts')}${status==='skipped'?'':hasPreview?'<span class="phase-explanation">SVG 见左侧预览</span>':!available(items).length?'<span class="phase-explanation">尚无本步骤产物</span>':''}`}</section>`;
}
function groupDetailPhases(index,group,phaseFiles) {
 const steps=groupPhases.flatMap(([id,label])=>id==='review'
  ?groupReviewSteps(group,stages[index].id,group.id)
  :[{id,title:label,status:group.webPhases?.[id]||'pending',detail:group.webDetails?.[id]||'',
    artifacts:['outline','completion'].includes(id)?phaseFiles[id].filter(item=>item.kind==='file'):phaseFiles[id]}]);
 return steps.map((step,i)=>{
  return (['outline','completion'].includes(step.id)?svgPreviewPanel(index,group,step.id,phaseFiles):'')
   +groupPhaseNode(index,step.id,step.title,step.status,step.detail,step.artifacts,i+1,
    ['outline','completion'].includes(step.id)&&available(phaseFiles[step.id]).some(item=>item.kind==='image'));
 }).join('');
}
function groupCycle(index) {
 const roots=sectionTree(index), view=groupViews[index], layers=groupLayers(roots), all=flat(roots);
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
 <p class="tree-note">点击部件切换预览；详情由“横向展开”控制。</p>
 ${artifacts([{path:`${prefix}/groups.json`,label:'完整 groups.json',kind:'file'}],index,'layers')}
 </div>
 ${view.open?`<div class="group-detail"><p class="group-note">${esc(group.note||'')}</p><div class="cycle-phases">${groupDetailPhases(index,group,phaseFiles)}</div></div>`:`<div class="group-compact"><p>${statusMark(groupSummary(group).status)}${esc(groupSummary(group).text)}</p><div class="compact-phases">${groupPhases.map(([id,label])=>`<button data-group-toggle="${index}" aria-label="展开 ${esc(group.id)} 的${label}">${statusMark(group.webPhases?.[id]||'pending')}${label}</button>`).join('')}</div>${artifacts(groupPreviewArtifacts(group,phaseFiles,archivedFiles,data.fileVersions),index,'layers')}</div>`}
 </div></div>`;
}
function statusMark(status) {
 const value=displayStatus(status);
 return `<span class="phase-mark ${value}" title="${statusLabel(status)}" aria-label="${statusLabel(status)}">${value==='done'?icon('check'):value==='running'||value==='throttled'?'<i></i>':value==='failed'?'<b class="failure-exclamation" aria-hidden="true">!</b>':icon(value==='available'?'image':'clock')}</span>`;
}
function selectedStep() {
 const all=nodes=>nodes.flatMap(node=>[node,...all(node.children)]);
 return all(sectionSteps[state.stage]).find(step=>step.id===state.selectedStep)||sectionSteps[state.stage][0];
}
function observedDisplayStatus(index, status, stepId) {
 return displayStatus(status);
}
function rasterItems(index, stepId) {
 const stage=stages[index].id, section=data.sections[index];
 if(!hasKraPreview(index))return stepArtifacts[index][stepId];
 if(stage==='shadow')return (stepArtifacts[index][stepId]||[]).filter(item=>item.path!=='shadow/step01_mask/character-shadowed.png');
 const files=(stepArtifacts[index][stepId]||[]).filter(item=>item.kind==='file');
 const report=section?.reports?.[stepId];
 const reportFile=report?[{path:report.path,label:report.draft?'报告草稿':'完整报告',kind:'file'}]:[];
 if(isRasterSection(index)) {
  // Drawing, review and repair share one live canvas, shown beside the steps.
  if(stepId==='step01')return files.filter(item=>!item.path.endsWith('/report.md'));
  return [...files.filter(item=>!item.path.endsWith('.md')),...reportFile];
 }
 return files;
}
function kraPreviewPanel(index) {
 if(!hasKraPreview(index))return '';
 const record=latestKraPreview(data.sections[index]?.previews);
 const step=record&&sectionSteps[index].find(step=>step.id===record.stepId);
 const sourceTitle=stages[index].id==='shadow'?'Live2D 蒙版':step?.title||record?.stepId;
 return `<section class="kra-preview-panel" data-kra-preview="${index}" aria-label="${esc(stages[index].name)}最新 KRA 预览"><h3>${icon('layers')}Krita 最新画面</h3>${record?`<p class="preview-source">${esc(sourceTitle)}</p>${artifacts([{path:record.path,label:'最新保存画面',kind:'image',sharedPreview:true}],index,record.stepId,'live-kra-artifacts')}`:'<p class="archive-gap">等待首次保存 KRA</p>'}</section>`;
}
function reportEvidence(index, stepId) {
 const report=data.sections[index]?.reports?.[stepId];
 if(!report||stepId==='step01'&&sectionSteps[index]?.find(step=>step.id===stepId)?.children.length)return '';
 const images=[...new Map(report.images.map(image=>[image.path,image])).values()];
 images.sort((a,b)=>Number(/\/marked\.png$/.test(b.path))-Number(/\/marked\.png$/.test(a.path)));
 return `<p class="review-feedback">${report.draft?'<span class="report-draft">草稿 · </span>':''}${esc(report.summary)}</p>${images.length?artifacts(images.map(image=>({path:image.path,label:image.label,kind:'image'})),index,stepId,'report-evidence'):''}`;
}
function reviewNodes(index,children) {
 let html='',skipping=false;
 for(const child of children) {
  if(child.status==='skipped'&&!skipping){html+='<div class="skipped-steps" aria-label="无需执行的后续步骤">';skipping=true;}
  if(child.status!=='skipped'&&skipping){html+='</div>';skipping=false;}
  html+=stepNode(index,child,true);
 }
 return html+(skipping?'</div>':'');
}
function stepNode(index,step,nested=false) {
 const status=observedDisplayStatus(index,step.status,step.id);
 if(step.status==='skipped')return `<section class="step-node nested skipped-node" data-node="${index}:${step.id}"><div class="skipped-heading"><span class="phase-mark">${icon('arrow')}</span><h3>${esc(step.title)}</h3><small>无需执行</small></div></section>`;
 if(stages[index].id==='nine-axis')return nineAxisStepCard(step,{esc,icon,statusMark,statusLabel,content:nineAxisContent,
  collapsed:state.collapsedSteps,selected:state.inspect&&state.stage===index?state.selectedStep:null});
 const selected=state.inspect&&state.stage===index&&state.selectedStep===step.id;
 const key=`${index}:${step.id}`, closed=state.collapsedSteps.has(key);
 const alternative=step.childrenMode==='alternative', parallel=step.childrenMode==='parallel';
 const mode=stages[index].id==='shadow'&&['mask','normal-depth'].includes(step.id);
 const currentMode=mode&&step.id===(data.run?.shadowMode||'mask');
 const context=step.id==='layers'?groupCycle(index):step.children.length?`<div class="step-children ${alternative?'step-alternatives':parallel?'step-parallel':''}" ${alternative?'role="group" aria-label="阴影方式：二选一"':parallel?'role="group" aria-label="并发制作任务"':''}>${isRasterSection(index)&&step.id==='step01'?reviewNodes(index,step.children):step.children.map((child,i)=>`${alternative&&i?'<span class="alternative-or">OR</span>':''}${stepNode(index,child,true)}`).join('')}</div>`:'';
 return `<section class="step-node ${nested?'nested':''} ${step.children.length?'step-container':''} ${isRasterSection(index)&&step.id==='step01'?'raster-review':''} ${closed?'node-collapsed':''} ${step.status} ${selected?'selected':''}" data-node="${index}:${step.id}">
 ${mode?`<div class="mode-choice ${currentMode?'current':''}">${currentMode?'当前方式':'备选方式'}</div>`:''}
 ${flowStepHeading(step,{index,status,closed,esc,icon,statusMark,statusLabel})}
 ${closed?'':`<div class="step-content">
 ${step.id!=='layers'&&(step.note||['standard','simplified','base','clothing'].includes(step.id))?`<p class="step-summary" ${step.note?`title="${esc(step.note)}"`:'aria-hidden="true"'}>${esc(step.note)}</p>`:''}
 ${step.id==='standard'&&!available(stepArtifacts[index][step.id]).some(item=>item.kind==='image')?'<p class="archive-gap" title="人物准备阶段执行后展示标准参考图">尚无标准参考图</p>':''}
 ${context}
 ${reportEvidence(index,step.id)}
 ${artifacts(step.id==='mask'&&stages[index].id==='shadow'?[...rasterItems(index,step.id),...shadowInspectionArtifacts(data.files)]:rasterItems(index,step.id),index,step.id)}
 ${data.sections[index]?.products?.[step.id]?'<p class="step-activity">已有产物</p>':''}
 ${data.sections[index]?.messages[step.id]?(step.status==='throttled'?waitBox(data.sections[index].messages[step.id]):['failed','interrupted'].includes(step.status)?errorBox(data.sections[index].messages[step.id]):`<p class="step-activity">${esc(data.sections[index].messages[step.id])}</p>`):''}
 ${processArtifacts(index,step)}
 </div>
 `}
 </section>`;
}
function nineAxisContent(step) {
 const section=data.sections[6],report=section?.reports?.[step.id];
 let items=available(stepArtifacts[6][step.id]);
 if(step.id==='step01_preparation') {
  const image=items.find(item=>item.kind==='image');
  items=items.filter(item=>item.kind!=='image'||item===image);
 }
 const preview=section?.previews?.[step.id];
 if(['step01_preparation','step07_jaw-line','step08_hair','step09_head-accessories'].includes(step.id)&&preview?.path.endsWith('.kra')) {
  items=items.filter(item=>item.kind!=='image');
  items.unshift({path:preview.path,label:'最新保存画面',kind:'image'});
  if(!items.some(item=>item.path===preview.path&&item.kind==='file'))items.push({path:preview.path,label:'分层 KRA',kind:'file'});
 }
 if(report&&!items.some(item=>item.path===report.path))items.push({path:report.path,label:'阶段报告',kind:'file'});
 const message=section?.messages?.[step.id];
 const notice=!message?'':step.status==='throttled'?waitBox(message):['failed','interrupted'].includes(step.status)?errorBox(message):`<p class="step-activity">${esc(message)}</p>`;
 return artifacts(items,6,step.id,'nine-artifacts')+(section?.products?.[step.id]?'<p class="step-activity">已有产物</p>':'')+notice+processArtifacts(6,step);
}
function processArtifacts(index, step) {
 const directory=step.processDirectory||(step.id.startsWith('step')?stages[index].id+'/'+step.id:null);
 if(!directory)return '';
 const prefix=directory+'/';
 const known=new Set([...Object.values(stepArtifacts[index]).flat(),...shadowInspectionArtifacts(data.files)].map(item=>item.path));
 const roots=[directory+'/workspace'];
 const filtered=data.files.filter(path=>path.startsWith(prefix)&&!known.has(path)
  && (roots.some(root=>path.startsWith(root+'/'))||!path.includes('/agents/')&&!/(?:^|\/)(?:prompt\.md|[^/]+\.prompt\.txt|(?:[^/]+\.)?result\.json|attempts\.jsonl|events\.jsonl|error\.txt)$/.test(path)));
 const items=filtered.filter(path=>roots.some(root=>path.startsWith(root+'/')));
 // Outside workspace only fixed results and report-cited evidence are shown; the step's own report already shows its images.
 const reports=data.sections[index]?.reports||{}, own=reportEvidence(index,step.id)?reports[step.id].images.map(image=>image.path):[];
 const cited=new Set(Object.values(reports).flatMap(report=>report.images.map(image=>image.path)).filter(path=>!own.includes(path)));
 const deliveries=filtered.filter(path=>!items.includes(path)&&cited.has(path));
 const listing=processFileList(items,roots,data.fileVersions);
 const render=paths=>artifacts(paths.map(path=>({path,label:path.split('/').at(-1),kind:/\.(png|jpe?g|webp|svg|kra)$/i.test(path)?'image':/\.mp4$/i.test(path)?'video':'file'})),index,step.id,'process-artifacts');
 const extra=deliveries.length?`<details class="process-files delivery-files" data-details="delivery:${index}:${step.id}"><summary>${deliveries.length} 个补充产物</summary>${render(deliveries)}</details>`:'';
 return extra+(items.length?`<details class="process-files" data-details="process:${index}:${step.id}"><summary>${listing.total} 个过程文件${listing.shown<listing.total?` · 显示 ${listing.shown} 个（按目录平分）`:''}</summary>${listing.folders.map(({folder,total,files})=>`<details class="process-group" data-details="process-folder:${index}:${step.id}:${esc(folder)}"><summary>${esc(folder||'workspace 根目录')} <small>${total} 个${files.length<total?` · 显示最新 ${files.length} 个`:''}</small></summary>${render(files)}</details>`).join('')}</details>`:'');
}
// A skipped lane (no dress-up, nothing to make) counts as complete.
const finished=stage=>stage.status==='done'||stage.status==='skipped';
function headThumbnail() {
 return `<section class="kra-preview-panel head-preview-panel" data-head-preview data-model="${headPreview.folder===data.directory&&headPreview.available?'available':'pending'}" aria-label="头部九轴步骤与预览"><h3>${icon('layers')}九轴步骤</h3><div class="preview-step-plan">${flowStepList(sectionSteps[6],{index:6,esc,icon,statusMark,statusLabel})}</div><div class="head-preview-levels" role="group" aria-label="预览组合"><button data-head-level="face" aria-label="脸＋五官" disabled>脸＋五官</button><button data-head-level="hair" aria-label="脸＋五官＋头发" disabled>＋头发</button><button data-head-level="accessory" aria-label="脸＋五官＋头发＋头饰" disabled>＋头饰</button></div><canvas aria-label="随鼠标运动的九轴角色头"></canvas><p data-head-status role="status">等待模型保存</p><a href="./studio?${new URLSearchParams({project:state.name,workspace:'nine-axis'})}">${icon('eye')}打开九轴工作台</a></section>`;
}
function flowCard(index) {
 const stage=stages[index],status=observedDisplayStatus(index,stage.status),closed=state.collapsedSections.has(index),wide=!closed&&groupViews[index]?.open&&!state.collapsedSteps.has(`${index}:layers`);
 return `<section class="section-lane ${stage.status} ${closed?'collapsed':''} ${wide?'group-expanded':''} ${stage.id==='shadow'?'shadow-lane':''}" data-section="${index}"><div class="section-heading"><button data-stage="${index}" aria-label="查看${stage.name}交付"><span class="node-number">${String(index+1).padStart(2,'0')}</span><h2>${stage.name}</h2>${statusMark(status)}${kritaBadge(index)}</button><button class="icon-button" data-section-toggle="${index}" aria-label="${closed?'展开':'收起'}${stage.name}栏目" aria-expanded="${!closed}">${icon(closed?'chevron':'down')}</button></div>${!closed&&stage.status==='skipped'?`<p class="lane-summary skipped-lane">${esc(data.sections[index]?.summary||'无需执行')}</p>`:''}${!closed&&stage.status==='failed'&&laneFailure(data.sections[index])?errorBox(laneFailure(data.sections[index]),'lane-error'):''}${closed?`<div class="lane-collapsed-body"><span>${esc(statusLabel(status))}</span><small>${sectionSteps[index].filter(finished).length} / ${sectionSteps[index].length} 步</small>${(()=>{const note=stage.status==='skipped'?data.sections[index]?.summary||'无需执行':stage.status==='failed'?laneFailure(data.sections[index]):'';return note?`<p class="${stage.status==='failed'?'status-error':''}" title="${esc(note)}">${esc(note)}</p>`:'';})()}</div>`:`<div class="section-steps">${stage.id==='nine-axis'?headThumbnail():kraPreviewPanel(index)}${stage.id==='shadow'?'<div class="shadow-references"><a href="./shadow-reference/skirt.png" target="_blank" rel="noopener">裙影参考 ↗</a><a href="./shadow-reference/hair.png" target="_blank" rel="noopener">发影参考 ↗</a></div>':''}${sectionSteps[index].map(step=>stepNode(index,step)).join('')}${data.sections[index]?.threadId?`<small class="thread-id" title="${esc(data.sections[index].threadId)}">thread · ${esc(data.sections[index].threadId)}</small>`:''}</div>`}</section>`;
}
function inspector() {
 const stage=stages[state.stage],step=selectedStep(),item=state.asset;
 const image=item?.kind==='image',video=item?.kind==='video';
 const report=item&&Object.values(data.sections[state.stage]?.reports||{}).find(report=>report.path===item.path);
 return `<aside class="output-inspector" aria-label="产物放大查看"><header class="output-heading"><div><small>${esc(stage.name)} · ${esc(step.title)}</small><h2>${esc(item?.label||step.title)}</h2></div><button class="icon-button" data-action="close-inspector" aria-label="关闭产物面板">${icon('close')}</button></header><div class="output-scroll">
 ${video?`<div class="output-video"><video controls autoplay playsinline preload="auto" src="${artifact(item.path)}" aria-label="${esc(item.label)}"></video></div>`:image?`<div class="output-caption"><span>当前任务产物</span><label><input type="checkbox" id="compare-reference" ${state.compare?'checked':''}>对照参考</label></div><div class="output-image ${state.compare?'compare':''}">${state.compare&&data.reference?`<figure><img src="${artifact(data.reference)}" alt="简化角色参考"><figcaption>简化角色参考</figcaption></figure>`:''}<figure><a href="${artifact(item.path)}" target="_blank" rel="noopener"><img loading="lazy" ${/\.svg$/i.test(item.path)?'data-svg-artifact':''} src="${artifact(item.path)}" alt="${esc(item.label)}"></a><figcaption>点击打开原尺寸</figcaption></figure></div>`:item?item.reviewIndex!==undefined?`<article class="report-document">${renderReport(reviewReportText(item.text??'正在读取…',item))}</article>`:/\.md(?:\.tmp)?$/.test(item.path)?`<article class="report-document">${renderReport(item.text??'正在读取…',report?.images,path=>artifact(path))}</article>`:`<pre class="artifact-text">${esc(item.text??'正在读取…')}</pre>`:`<p class="step-note">${esc(step.note||'此步骤的过程和已有产物直接展示在画布中。')}</p>`}
 ${item?`<a class="artifact-source" href="${artifact(item.path)}" target="_blank" rel="noopener">${esc(item.path)} ${icon('arrow')}</a>`:''}</div></aside>`;
}
function overviewCard(stage,index) {
 const status=observedDisplayStatus(index,stage.status),reason=String(data.sections?.[index]?.summary||'').split('\n')[0].trim();
 return `<article class="overview-card ${status} ${state.stage===index?'selected':''}" data-overview="${index}">
 <button class="overview-stage" data-stage="${index}" aria-label="查看${esc(stage.name)}进展"><span class="node-number">${String(index+1).padStart(2,'0')}</span><h3>${esc(stage.name)}</h3>${kritaBadge(index)}</button>
 ${status==='failed'&&reason?`<p class="overview-reason status-error" title="${esc(reason)}">${esc(reason)}</p>`:''}
 <div class="overview-footer"><span class="execution-state ${status}">${statusMark(status)}${esc(statusLabel(status))}</span><div class="overview-actions"><button class="button" data-stage="${index}">${icon('eye')}预览</button></div></div>
 </article>`;
}
function projectPage() {
 if(!state.name)return `${pageHeading()}<section class="empty-workspace"><h2>开始一次角色制作</h2><p>新建任务并提供一张角色图，或选择已有任务所在的运行目录。</p><p>${esc(state.directory)}</p><button class="primary" data-action="new">新建任务</button></section>`;
 // The character preparation is shared; then the character and clothing lanes run in parallel and merge.
 const cards=indexes=>indexes.filter(index=>stages[index]&&visibleStage(index)).map(index=>overviewCard(stages[index],index)).join('');
 const column=(kind,title,html)=>html?`<div class="overview-column ${kind}"><small class="overview-column-title">${title}</small>${html}</div>`:'';
 const lanes=[{name:'人物线',stages:[1]},{name:'衣服线',stages:[2,3]}].map(lane=>({...lane,html:cards(lane.stages)})).filter(lane=>lane.html);
 return `${pageHeading()}${runNotice()}<section class="section-overview">
 <div class="overview-heading"><div><h2>管线执行</h2><p>人物分块准备完成后，人物线与衣服线并行执行，共用同一组 agent 名额，在穿戴组装合流。选择管线，打开完整进展图。</p></div></div>
 <div class="overview-flow">${column('overview-start','共同准备',cards([0]))}${lanes.length?`<div class="overview-lanes">${lanes.map(lane=>`<div class="overview-lane"><small class="overview-column-title">${lane.name}</small><div class="overview-lane-cards">${lane.html}</div></div>`).join('')}</div>`:''}${column('overview-merge','合流',cards(mergeStages))}</div><p class="route-summary">${data.run?`本次路线：${esc(stages.find(stage=>stage.id===data.run.from)?.name)} → ${esc(stages.find(stage=>stage.id===data.run.to)?.name)}${data.run.to==='nine-axis'?' · 含头部九轴':' · 九轴未加入本次路线'}`:'尚未保存执行路线'}；可在“执行参数”中保存下一次执行的设置。</p></section>`;
}
// The section's machine-wide Krita slot, beside its own execution state:
// queued for a slot, or holding one (with Krita running or not yet started).
function kritaBadge(index) {
 const krita=data.sections?.[index]?.krita;
 if(!krita)return '';
 const time=value=>esc(new Date(value).toLocaleTimeString());
 const usage=krita.limit?`本机 Krita 名额 ${esc(data.kritaInUse??'?')} / ${esc(krita.limit)}`:'';
 const count=krita.limit?`<small>${esc(data.kritaInUse??'?')}/${esc(krita.limit)}</small>`:'';
 if(krita.state==='waiting')return `<span class="krita-badge waiting" title="${usage?usage+'，':'本机 Krita 名额'}已满，等待其他 section 释放 · 自 ${time(krita.since)} 起排队">Krita 排队中${count}</span>`;
 const detail=krita.state==='running'?`Krita ${esc(krita.version)} · pid ${esc(krita.pid)} · 启动于 ${time(krita.startedAt)}`:'已占名额，Krita 尚未启动或正在重启';
 return `<span class="krita-badge ${krita.state==='running'?'running':'reserved'}" title="${detail}${usage?' · '+usage:''}">${krita.state==='running'?'正在使用 Krita':'已占用 Krita 名额'}${count}</span>`;
}
function graph() {
 if(!state.name)return '<section class="empty-workspace"><h2>尚未选择任务</h2><button class="button" data-page="project">选择任务</button></section>';
 const cards=indexes=>indexes.filter(visibleStage).map(flowCard).join('');
 const lanes=flowLanes.map((lane,i)=>({...lane,html:cards(lane.stages),i})).filter(lane=>lane.html),merge=cards(mergeStages);
 const switcher=lanes.length>1?`<nav class="lane-switch" aria-label="切换关注的管线">${lanes.map(lane=>`<button data-lane="${lane.i}" class="${state.lane===lane.i?'active':''}" aria-label="查看${lane.name}" aria-pressed="${state.lane===lane.i}" title="${lane.name}"><span></span><small>${lane.name}</small></button>`).join('')}</nav>`:'';
 return `<section class="workflow-shell"><div class="flow-area"><div class="flow-toolbar"><button class="button preview-back" data-page="project">${icon('branch')}执行控制</button><span>${esc(state.name)} · ${data.run?esc(stages.find(stage=>stage.id===data.run.from)?.name)+' → '+esc(stages.find(stage=>stage.id===data.run.to)?.name):'已有产物'}</span><div class="flow-legend">${Object.keys(statusNames).map(status=>`<span>${statusMark(status)}${statusNames[status]}</span>`).join('')}</div><div class="canvas-tools"><button data-action="zoom-out" aria-label="缩小画布">−</button><button data-action="zoom-reset" id="zoom-label">100%</button><button data-action="zoom-in" aria-label="放大画布">＋</button><button data-action="zoom-fit">适合高度</button></div>${!data.archived&&!data.runnerAlive&&!data.lockHeld?'<button class="button" data-action="run-options">执行参数</button>':''}${stepToolbar()}</div>
 <div class="flow-scroll" tabindex="0" aria-label="完整流程画布：横向滚动或拖动浏览，上下拖动或 Ctrl/⌘ + 滚轮切换人物线与衣服线"><div class="flow-size" data-flow-layout><div class="flow-world preview-world" data-flow-layout><svg class="flow-connectors" aria-hidden="true"></svg><div class="flow-input">${data.original?`<a href="${artifact(data.original)}" target="_blank" rel="noopener"><img src="${artifact(data.original)}" alt="原始输入图"></a>`:icon('image')}<span><b>输入角色图</b><small>original → standard</small></span></div><div class="flow-grid"><div class="flow-lanes">${lanes.map(lane=>`<div class="flow-lane" data-lane-row="${lane.i}">${lane.html}</div>`).join('')}</div>${merge?`<div class="flow-merge" style="margin-top:${state.mergeShift}px">${merge}</div>`:''}</div></div></div></div>${switcher}
 <footer class="flow-footnote">人物分块准备完成后，人物线与衣服线并行，在穿戴组装合流 · 滚轮或左右拖动横向浏览 · 上下拖动、上下滑动或 Ctrl/⌘ + 滚轮切换两条线 · 点击产物放大查看</footer></div>${state.inspect?inspector():''}</section>`;
}
function runNotice() {
 if(data.status==='layout')return `<div class="run-notice error"><span>${icon('info')}${esc(data.message)}</span>${data.layout==='previous'?`<button class="button" data-action="convert-layout">${icon('folder')}转换目录</button>`:''}</div>`;
 const message=data.run?.error||data.lastLogMessage||'尚无总调度执行记录；可先保存本任务执行参数，再继续制作。';
 const stopped=data.status==='failed'||data.status==='interrupted';
 return `<details data-details="run-notice" class="run-notice ${data.status==='failed'?'error':''}" ${stopped?'open':''}><summary>${icon(data.status==='failed'?'info':'clock')}<span>${stopped?esc(taskStatusNames[data.status])+' · ':''}${esc(message.split('\n')[0])}</span><small>运行记录与日志</small></summary><div>${data.errors.length?`<pre class="status-error">${esc(data.errors.join('\n'))}</pre>`:''}<pre>${esc(message)}</pre><pre class="live-log">${esc(data.logs||'暂无日志')}</pre><small>日志：${esc(data.logPath||data.directory)}${data.logUpdatedAt?' · 日志更新：'+esc(new Date(data.logUpdatedAt).toLocaleString()):''}${data.run?.updatedAt?' · 状态保存：'+esc(new Date(data.run.updatedAt).toLocaleString()):''}</small></div></details>`;
}
let flowObserver;
// Lane geometry from the last layout, in world units: where each lane's view starts and how tall it is.
let laneMetrics={tops:[0],heights:[0]},laneAnimation=null;
const laneCount=()=>laneMetrics.tops.length;
const laneScrollTop=(lane=state.lane)=>(laneMetrics.tops[lane]??0)*state.zoom;
// The vertical scroll range inside a lane: empty when the lane fits the viewport.
function laneRange(lane=state.lane) {
 const viewport=document.querySelector('.flow-scroll'),top=laneScrollTop(lane);
 return [top,top+Math.max(0,(laneMetrics.heights[lane]??0)*state.zoom-viewport.clientHeight)];
}
function nineAxisConnection(run) {
 const enabled=run?.live===true,serial=run?.to==='nine-axis'&&run?.from!=='nine-axis';
 const detail=!run?'尚未保存执行范围':run.from==='nine-axis'&&run.to==='nine-axis'?'本次独立九轴':serial?enabled?'阴影完成后继续':'按所选范围串行':run.to==='shadow'?'本次止于阴影':'本次范围未含九轴';
 return {enabled,serial,label:`--live ${enabled?'开启':'关闭'}`,detail};
}
function connectFlow() {
 const world=document.querySelector('.flow-world');
 if(!world)return;
 const viewport=document.querySelector('.flow-scroll'),merge=world.querySelector('.flow-merge'),grid=world.querySelector('.flow-grid');
 const left=viewport.scrollLeft,top=viewport.scrollTop,previousZoom=state.zoom;
 const atEnd=left>0&&viewport.scrollWidth-viewport.clientWidth-left<2;
 // Layout in world units, independent of the current zoom and merge shift.
 const rows=[...world.querySelectorAll('[data-lane-row]')];
 const gridTop=grid.offsetTop,mergeHeight=merge?.offsetHeight||0,pad=12;
 // Each lane is framed like the first: its row sits where the first row sits in the first lane.
 const tops=rows.map(row=>row.offsetTop-rows[0].offsetTop);
 const heights=rows.map((row,i)=>Math.max(gridTop+row.offsetTop+row.offsetHeight,gridTop+tops[i]+mergeHeight)+pad-tops[i]);
 laneMetrics=rows.length?{tops,heights}:{tops:[0],heights:[world.offsetHeight]};
 if(state.lane>=laneCount())state.lane=0;
 if(!laneAnimation)state.mergeShift=laneMetrics.tops[state.lane];
 if(merge)merge.style.marginTop=`${state.mergeShift}px`;
 if(state.autoHeight||state.zoom===null)state.zoom=Math.min(1,Math.max(.05,(viewport.clientHeight-8)/Math.max(...laneMetrics.heights)));
 world.style.transform=`scale(${state.zoom})`;
 const size=document.querySelector('.flow-size');
 // The last lane can always scroll to the top of the viewport.
 size.style.width=`${world.offsetWidth*state.zoom}px`;size.style.height=`${Math.max(world.offsetHeight*state.zoom,laneScrollTop(laneCount()-1)+viewport.clientHeight)}px`;
 // ResizeObserver also runs outside render(). Keep the user's location when
 // artwork changes the fitted scale or the canvas bounds; stay at the right edge.
 viewport.scrollLeft=atEnd?viewport.scrollWidth-viewport.clientWidth:left*(previousZoom?state.zoom/previousZoom:1);
 viewport.scrollTop=top;
 document.querySelector('#zoom-label').textContent=Math.round(state.zoom*100)+'%';
 const bounds=world.getBoundingClientRect();
 const box=selector=>{const element=world.querySelector(selector);if(!element)return null;const r=element.getBoundingClientRect();return {x:(r.left-bounds.left)/state.zoom,y:(r.top-bounds.top)/state.zoom,w:r.width/state.zoom,h:r.height/state.zoom};};
 const input=box('.flow-input'),cards=stages.map((_,i)=>box(`[data-section="${i}"] .section-heading`));
 const svg=world.querySelector('.flow-connectors'),paths=[];
 // Labels sit on their line as pills, turned upright on a vertical run that is long enough.
 const status=done=>done?'done':'pending',labels=[];
 const textWidth=text=>[...text].reduce((sum,char)=>sum+(/[　-鿿]/.test(char)?11:6.4),0)+14;
 const path=(d,state,connection)=>paths.push(`<path class="${state}"${connection?` data-connection="${connection}"`:''} d="${d}" marker-end="url(#flow-arrow-${state})"/>`);
 const label=(text,x,y,state,upright=false)=>{const w=textWidth(text);labels.push(`<g class="flow-label ${state}"${upright?` transform="rotate(90 ${x} ${y})"`:''}><rect x="${x-w/2}" y="${y-8}" width="${w}" height="16" rx="8"/><text x="${x}" y="${y+4}">${text}</text></g>`);};
 // From the right of `a` to the left of `b`, turning at `turn` when they are not level.
 const link=(a,b,text,done,turn,from=a.y+a.h/2,to=b.y+b.h/2,connection)=>{
  const state=status(done);
  if(Math.abs(from-to)<2){path(`M${a.x+a.w} ${from} H${b.x-6}`,state,connection);label(text,(a.x+a.w+b.x-6)/2,from,state);return;}
  path(`M${a.x+a.w} ${from} H${turn} V${to} H${b.x-6}`,state,connection);
  if(Math.abs(from-to)>=textWidth(text)+24)label(text,turn,(from+to)/2,state,true);
  // Starts right of the source card: a pill wider than its run must not slide under that card.
  else label(text,Math.max((a.x+a.w+turn)/2,a.x+a.w+textWidth(text)/2+6),from,state);
 };
 if(input&&cards[0]){
  const entryY=cards[0].y+cards[0].h/2;
  path(`M${input.x+input.w} ${input.y+input.h/2} H${cards[0].x-20} V${entryY} H${cards[0].x-6}`,'done');
 }
 for(const [a,b,text,done] of [[cards[0],cards[1],'parts',finished(stages[0])],[cards[2],cards[3],'parts',finished(stages[2])],[cards[4],cards[5],'组装 KRA',finished(stages[4])]])
  if(a&&b)link(a,b,text,done);
 if(cards[5]&&cards[6]){
  const connection=nineAxisConnection(data.run),done=connection.serial&&finished(stages[5]);
  link(cards[5],cards[6],connection.label,done,(cards[5].x+cards[5].w+cards[6].x-6)/2,undefined,undefined,'shadow-nine-axis');
  label(connection.detail,(cards[5].x+cards[5].w+cards[6].x-6)/2,cards[5].y+cards[5].h/2+24,status(done));
 }
 // The clothing lane hangs off the character preparation, down the left gutter.
 if(cards[0]&&cards[2]){
  const preparation=box('[data-node="0:preparation"]'),collapsed=box('[data-section="0"] .lane-collapsed-body'),from=preparation?preparation.y+40:collapsed?collapsed.y+collapsed.h/2:cards[0].y+cards[0].h+20,x=cards[0].x-34,to=cards[2].y+cards[2].h/2,state=status(!!data.reference);
  path(`M${cards[0].x} ${from} H${x} V${to} H${cards[2].x-6}`,state);
  label('简化角色参考',x,(from+to)/2,state,to-from>=textWidth('简化角色参考')+24);
 }
 // Both lanes merge into the assembly, entering its heading side by side.
 if(cards[4]){
  const middle=cards[4].y+cards[4].h/2;
  if(cards[1])link(cards[1],cards[4],'人物素体 KRA',finished(stages[1]),cards[4].x-30,undefined,middle-(cards[3]?7:0));
  if(cards[3])link(cards[3],cards[4],'衣服 KRA',finished(stages[3]),cards[4].x-56,undefined,middle+(cards[1]?7:0));
 }
 paths.push(...labels);
 svg.setAttribute('viewBox',`0 0 ${world.offsetWidth} ${world.offsetHeight}`);
 svg.innerHTML=`<defs>${['done','pending'].map(status=>`<marker id="flow-arrow-${status}" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 6 3 0 6" fill="${status==='done'?'#86b7a8':'#a7b3c0'}"/></marker>`).join('')}</defs>${paths.join('')}`;
}
// Slides the canvas to another lane; the merge column travels along so it stays in view.
function switchLane(lane) {
 const viewport=document.querySelector('.flow-scroll');
 if(!viewport||lane<0||lane>=laneCount()||lane===state.lane&&!laneAnimation)return;
 const fromTop=viewport.scrollTop,fromShift=state.mergeShift,started=performance.now(),duration=380;
 state.lane=lane;state.canvasTop=0;
 document.querySelectorAll('[data-lane]').forEach(button=>{const active=Number(button.dataset.lane)===lane;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});
 const animation=laneAnimation={};viewport.classList.add('animating');
 const frame=now=>{
  if(laneAnimation!==animation)return;
  const t=Math.min(1,(now-started)/duration),ease=t<.5?4*t*t*t:1-(-2*t+2)**3/2;
  state.mergeShift=fromShift+(laneMetrics.tops[lane]-fromShift)*ease;
  connectFlow();
  viewport.scrollTop=fromTop+(laneScrollTop(lane)-fromTop)*ease;
  if(t<1)requestAnimationFrame(frame);else{laneAnimation=null;viewport.classList.remove('animating');connectFlow();viewport.scrollTop=laneScrollTop(lane);state.canvasLeft=viewport.scrollLeft;}
 };
 requestAnimationFrame(frame);
}
function zoomCanvas(value,fit=false) {
 const viewport=document.querySelector('.flow-scroll'),previous=state.zoom;
 const centerX=viewport.scrollLeft+viewport.clientWidth/2,centerY=viewport.scrollTop+viewport.clientHeight/2;
 state.autoHeight=fit;state.zoom=Math.min(1.5,Math.max(.2,value));connectFlow();
 viewport.scrollLeft=fit?0:centerX*state.zoom/previous-viewport.clientWidth/2;
 const [min,max]=laneRange();
 viewport.scrollTop=fit?min:Math.min(max,Math.max(min,centerY*state.zoom/previous-viewport.clientHeight/2));
}
async function openAsset(item,index,stepId) {
 // A KRA is binary: the drawer shows its saved composite, never its bytes as text.
 if(item.kind==='file'&&/\.kra$/i.test(item.path))item={...item,kind:'image'};
 state.stage=index;state.selectedStep=stepId;state.inspect=true;state.asset={...item};
 const selected=state.asset;render();
 if(item.kind==='file') {
  try{const response=await fetch(artifact(item.path));if(!response.ok)throw new Error('无法读取产物');selected.text=await response.text();}
  catch(error){selected.text=error.message;}
  if(state.asset===selected&&state.inspect)render();
 }
}
let versions, configFiles=[], configDirectory='', configText='', schemaText='', diffText='', configBusy=false;
// What the knowledge browser previews, by extension; anything else is offered for download.
const textFile=/\.(md|markdown|txt|json|jsonc|ya?ml|toml|csv|tsv|[cm]?[jt]s|py|sh|xml|html?|css|ini|log)$/i;
const mediaKind=file=>/\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(file)?'image':/\.(mp4|m4v|webm|mov|ogv)$/i.test(file)?'video':/\.(mp3|wav|ogg)$/i.test(file)?'audio':textFile.test(file)?'text':'binary';
const configQuery=file=>`?ref=${encodeURIComponent(state.ref)}&path=${encodeURIComponent(file)}`;
const envEditor=createEnvEditor({get,post,toast,render});
function setConfigBusy(busy) {
 configBusy=busy;
 document.querySelectorAll('.version-bar input,.version-bar select,.config-workspace button,.config-workspace input,[data-action=history]').forEach(node=>{node.disabled=busy;});
}
async function refreshConfigFile() {
 setConfigBusy(true);
 try {await loadConfigFile();render();} catch(error) {toast(error.message);} finally {setConfigBusy(false);}
}
async function loadConfig() {
 if(state.configMode==='env'){await envEditor.load();return;}
 setConfigBusy(true);
 try {
  versions=await get('./api/config/versions?ref='+encodeURIComponent(state.ref));
  if(!versions.git)state.ref='worktree';
  const snapshot=await get('./api/config/files?ref='+encodeURIComponent(state.ref)); configFiles=snapshot.paths;configDirectory=snapshot.directory;
  if(!configFiles.includes(state.file)) state.file=configFiles[0]||'';
  await loadConfigFile();
 } catch(error) { toast(error.message); } finally {setConfigBusy(false);}
}
async function loadConfigFile() {
 configText='';schemaText='';diffText='';
 if(!state.file) {configText='这个版本的先验知识目录没有文件。';return;}
 if(mediaKind(state.file)==='text')configText=(await get('./api/config/content'+configQuery(state.file))).text;
 // Descriptions live in knowledge; their schemas stay with the code and come from the server.
 if(/\/tools\/[^/]+\/description\.md$/.test(state.file))schemaText=(await get('./api/config/schema?path='+encodeURIComponent(state.file))).text;
 if(state.diff) diffText=(await get('./api/config/diff'+configQuery(state.file)+'&base='+encodeURIComponent(state.base||'HEAD~2'))).text;
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
// The knowledge files as folders, the way they sit in the directory. A folder whose only
// content is one folder shares its row (prompts / groups). Folders around the selected file
// open by themselves; one the user opened or closed stays so until the page reloads.
function configTree() {
 const scope=file=>file;
 const families=[['part-layering','人物分块'],['raster-layering','人物绘制'],['clothing-part-layering','衣服分块'],['clothing-raster-layering','衣服绘制'],['character-assembly','穿戴组装'],['shadow','阴影制作'],['head-nine-axis','头部九轴'],['shared','公共先验'],['','其他文件']];
 const query=state.configFilter.toLowerCase();
 const owned=file=>families.some(([prefix])=>prefix&&scope(file).startsWith(prefix+'/'));
 const count=node=>node.files.length+[...node.folders.values()].reduce((sum,child)=>sum+count(child),0);
 const isOpen=(path,fallback)=>query?true:state.configFolders.get(path)??fallback;
 const fileRow=(file,depth)=>`<button data-config-file="${esc(file)}" class="config-file ${state.file===file?'active':''}" style="--depth:${depth}" title="${esc(file)}">${icon(file.endsWith('.json')?'code':mediaKind(file)==='image'||mediaKind(file)==='video'?'image':'file')}<span>${esc(file.split('/').at(-1))}</span></button>`;
 const folderRows=(node,depth)=>[...[...node.folders].sort(([a],[b])=>a.localeCompare(b)).map(([name,child])=>{
  let label=name;
  while(!child.files.length&&child.folders.size===1){const [[next,inner]]=child.folders;label+=' / '+next;child=inner;}
  return `<details class="config-folder" data-config-folder="${esc(child.path)}" style="--depth:${depth}" ${isOpen(child.path,scope(state.file).startsWith(child.path+'/'))?'open':''}><summary title="${esc(child.path)}">${icon('chevron')}${icon('folder')}<span>${esc(label)}</span><small>${count(child)}</small></summary>${folderRows(child,depth+1)}</details>`;
 }),...node.files.sort().map(file=>fileRow(file,depth))].join('');
 return families.map(([prefix,label])=> {
  const files=configFiles.filter(file=>(prefix?scope(file).startsWith(prefix+'/'):!owned(file))&&(!query||file.toLowerCase().includes(query)));
  if(!files.length)return '';
  const root={path:prefix,folders:new Map(),files:[]};
  for(const file of files){
   let node=root;
   for(const part of scope(file).split('/').slice(prefix?1:0,-1)){
    if(!node.folders.has(part))node.folders.set(part,{path:(node.path?node.path+'/':'')+part,folders:new Map(),files:[]});
    node=node.folders.get(part);
   }
   node.files.push(file);
  }
  const key=prefix||'.',active=prefix?scope(state.file).startsWith(prefix+'/'):!!state.file&&!owned(state.file);
  return `<details class="config-family" data-config-folder="${key}" ${isOpen(key,active)?'open':''}><summary>${icon('chevron')}${icon(prefix==='shared'?'code':'folder')}<span>${label}</span><small>${files.length}</small></summary><div>${folderRows(root,0)}</div></details>`;
 }).join('');
}
// Selecting a file, and remembering a folder the user opened or closed for the next render.
function bindConfigTree() {
 document.querySelectorAll('[data-config-file]').forEach(b=>b.onclick=async()=>{state.file=b.dataset.configFile;await refreshConfigFile();});
 document.querySelectorAll('[data-config-folder]>summary').forEach(summary=>summary.onclick=()=>{if(!state.configFilter)state.configFolders.set(summary.parentElement.dataset.configFolder,!summary.parentElement.open);});
}
function configPage() {
 const tabs=`<nav class="config-mode-tabs" aria-label="配置内容"><button data-config-mode="env" class="${state.configMode==='env'?'active':''}">环境与模型</button><button data-config-mode="files" class="${state.configMode==='files'?'active':''}">先验知识</button></nav>`;
 return state.configMode==='env'?`<div class="page-heading config-heading"><div><div class="breadcrumb">工作空间 ${icon('chevron')}<span>本地配置</span></div><h1>管线配置</h1><p>设置模型、服务与制作先验。</p></div></div>${tabs}${envEditor.view()}`:tabs+promptConfigPage();
}
function configPreview(currentFile) {
 const kind=mediaKind(state.file),raw='./api/config/raw'+configQuery(state.file);
 if(kind==='image')return `<div class="media-preview"><img src="${raw}" alt="${esc(currentFile)}"></div>`;
 if(kind==='video')return `<div class="media-preview"><video src="${raw}" controls preload="metadata"></video></div>`;
 if(kind==='audio')return `<div class="media-preview"><audio src="${raw}" controls preload="metadata"></audio></div>`;
 if(kind==='binary')return `<div class="empty-diff">${icon('info')}这种文件无法预览。<a class="button" href="${raw}" download="${esc(currentFile)}">下载</a></div>`;
 return /\.(md|markdown)$/i.test(currentFile)?markdown(configText):`<pre>${esc(configText)}</pre>`;
}
function promptConfigPage() {
 const isTool=/\/tools\/[^/]+\/description\.md$/.test(state.file), currentFile=state.file.split('/').at(-1)||'', toolName=isTool?state.file.split('/').at(-2):currentFile;
 const kind=mediaKind(state.file), type=isTool?'TOOL DESCRIPTION':kind==='text'?(currentFile.split('.').at(-1)||'TEXT').toUpperCase():kind.toUpperCase();
 const sourceRefs=['worktree',...new Set(['origin/main','upstream/main',...(versions?.branches||[])].filter(ref=>versions?.branches?.includes(ref)))];
 const versionBar=versions?.git?`<div class="version-bar"><span class="version-label">${icon('branch')}知识版本</span><select id="config-ref" aria-label="先验知识版本">${sourceRefs.map(ref=>`<option value="${esc(ref)}" ${ref===state.ref?'selected':''}>${ref==='worktree'?'本地工作区':esc(ref)}</option>`).join('')}${versions.commits.filter(c=>c.sha===state.ref).map(c=>`<option selected value="${c.sha}">${c.short}</option>`).join('')}</select><span class="version-sha">${versions.commits[0]?.short||'…'}</span><span class="version-description">${state.ref==='worktree'?'包含尚未提交的本地修改':'固定版本快照'}</span><span class="spacer"></span><label class="diff-toggle"><input type="checkbox" id="config-diff" ${state.diff?'checked':''}>查看差异</label><select id="config-base" aria-label="对比基准">${versions.commits.slice(1).map((c,i)=>`<option value="${c.sha}" ${(state.base?state.base===c.sha:i===1)?'selected':''}>对比 ${c.short} · ${esc(c.title.slice(0,32))}</option>`).join('')}</select></div>`
  :`<div class="version-bar"><span class="version-label">${icon('folder')}先验知识目录</span><span class="version-description">不在 Git 仓库内，只显示当前文件</span></div>`;
 const diffing=state.diff&&versions?.git;
 return `<div class="page-heading config-heading"><div><div class="breadcrumb">工作空间 ${icon('chevron')}<span>先验知识</span></div><h1>管线配置 <span class="subtitle-tag">只读</span></h1><p>浏览先验知识目录中的提示词、参考资料与工具说明：<code>${esc(configDirectory)}</code>（在「全局设置」中更换）。</p></div>${versions?.git?`<button class="button" data-action="history">${icon('history')}提交历史</button>`:''}</div>
 ${versionBar}
 <div class="config-workspace"><aside class="config-tree"><div class="pane-title"><h3>先验知识</h3><span class="count-badge">${configFiles.length}</span></div><div class="tree-search">${icon('search')}<input id="config-search" value="${esc(state.configFilter)}" placeholder="搜索提示词、参考或工具" aria-label="搜索先验知识"></div><div class="config-tree-scroll">${configTree()}</div><div class="config-tree-footer">${icon('lock')}只读浏览，不修改目录</div></aside>
 <section class="config-content"><div class="config-file-heading"><div class="config-file-icon">${icon(isTool?'code':kind==='image'||kind==='video'?'image':'file')}</div><div><h2>${esc(toolName)}</h2><code>${esc(state.file.replace(/\/description\.md$/,''))}</code></div><span class="spacer"></span><span class="small-tag">${esc(type)}</span></div><div class="config-tabs"><button class="active">${icon(diffing?'branch':'eye')}${diffing?'版本差异':'预览'}</button><span>所选版本的实际文件</span></div>
 ${diffing?`<div class="diff-content">${diffText?diffText.split('\n').map(line=>`<pre class="${line.startsWith('+')?'addition':line.startsWith('-')?'deletion':''}">${esc(line)}</pre>`).join(''):`<div class="empty-diff">${icon('check')}这个文件在两个版本之间没有变化。</div>`}</div>`:`<div class="config-pair"><article class="markdown-panel"><header><span>${icon('file')}${esc(currentFile)}</span><small>${esc(type)}</small></header><div class="markdown-body">${configPreview(currentFile)}</div></article>${schemaText?`<article class="schema-panel"><header><span>${icon('code')}schema.json</span><small>JSON SCHEMA · 随代码</small></header><div class="code-body">${jsonLines(schemaText)}</div></article>`:''}</div>`}
 <div class="config-content-footer">${icon('info')}工具 schema 随代码发布，说明来自先验知识目录；预览不会影响正在运行的 agent。</div></section></div>`;
}
function render() {
 const focused=document.activeElement;
 const focusId=focused?.id;
 const selection=focused?.tagName==='INPUT'&&focused.type==='text'?[focused.selectionStart,focused.selectionEnd]:null;
 const previous=document.querySelector('.flow-scroll');
 // The vertical position is kept relative to the focused lane, which may move as cards change.
 if(previous){state.canvasLeft=previous.scrollLeft;state.canvasTop=previous.scrollTop-laneScrollTop();}
 const treeScroll=Object.fromEntries([...document.querySelectorAll('[data-tree-scroll]')].map(node=>[node.dataset.treeScroll,node.scrollTop]));
 const outputScroll=document.querySelector('.output-scroll')?.scrollTop||0;
 document.querySelectorAll('[data-details]').forEach(node=>state.details.set(node.dataset.details,node.open));
 flowObserver?.disconnect();
 morph(document.querySelector('#app'),header()+`<main class="main ${state.page==='config'?'config-page':state.page==='preview'?'preview-main':'project-main'}">${state.page==='config'?configPage():state.loading||state.loadError?taskLoading():state.page==='preview'?graph():projectPage()}</main>`);
 bind();setConfigBusy(configBusy);
 loadVideoCovers(document.querySelector('#app'));
 void headPreview.update(document.querySelector('[data-head-preview]'),data.directory);
 if(state.page==='config'&&state.configMode==='env')envEditor.bind();
 document.querySelectorAll('[data-details]').forEach(node=>{if(state.details.has(node.dataset.details))node.open=state.details.get(node.dataset.details);});
 // A run that newly stops opens its notice once; closing it afterwards sticks.
 const stopped=data.status==='failed'||data.status==='interrupted';
 if(stopped&&state.noticeStatus!==data.status){const notice=document.querySelector('[data-details="run-notice"]');if(notice){notice.open=true;state.details.set('run-notice',true);}}
 state.noticeStatus=data.status;
 saveView();
 if(focusId&&focused&&!focused.isConnected){const replacement=document.getElementById(focusId);replacement?.focus({preventScroll:true});if(selection&&replacement?.tagName==='INPUT')replacement.setSelectionRange(...selection);}
 const output=document.querySelector('.output-scroll');if(output)output.scrollTop=outputScroll;
 if(state.page==='preview'&&state.name&&!state.loading&&!state.loadError) {
  connectFlow();
  const viewport=document.querySelector('.flow-scroll');viewport.scrollLeft=state.canvasLeft;
  const [min,max]=laneRange();viewport.scrollTop=laneAnimation?viewport.scrollTop:Math.min(max,Math.max(min,min+state.canvasTop));
  document.querySelectorAll('[data-tree-scroll]').forEach(node=>{node.scrollTop=treeScroll[node.dataset.treeScroll]||0;});
  flowObserver=new ResizeObserver(connectFlow);flowObserver.observe(document.querySelector('.flow-world'));flowObserver.observe(viewport);
 }
}
function executionFields(run) {
 return `<label class="standard-option"><div><b>标准化人物姿态</b><p>关闭时直接沿用输入姿态。</p></div><input type="checkbox" name="standard" ${run?.standard?'checked':''} role="switch" aria-label="标准化人物姿态"></label>
 <label class="standard-option live-option"><div><b>阴影完成后制作头部九轴</b><p>由总调度的 --live 控制，默认关闭。</p></div><input type="checkbox" name="live" ${run?.live?'checked':''} role="switch" aria-label="阴影完成后制作头部九轴"></label><p class="live-detail"></p>
 <label class="field-label" for="task-shadowMode">阴影方式</label><select id="task-shadowMode" name="shadowMode"><option value="mask" ${run?.shadowMode!=='normal-depth'?'selected':''}>Live2D 蒙版</option><option value="normal-depth" ${run?.shadowMode==='normal-depth'?'selected':''}>法线＋深度</option></select>
 <label class="field-label" for="task-jobs">调度并发 jobs</label><input id="task-jobs" name="jobs" type="number" min="1" required value="${run?.jobs||3}">`;
}
function bindExecutionFields(form,run) {
 let rangeEdited=false;
 const update=()=>{
  const from=form.elements.from?.value||'part-layering';
  let to=form.elements.to?.value||(form.elements.live.checked?'nine-axis':'shadow');
  if(form.elements.to&&!rangeEdited){
   const savedTo=run?.to||'shadow',changedLive=form.elements.live.checked!==(run?.live===true);
   to=changedLive&&(savedTo==='shadow'||savedTo==='nine-axis'&&from!=='nine-axis')?(form.elements.live.checked?'nine-axis':'shadow'):savedTo;
   form.elements.to.value=to;
  }
  form.elements.standard.disabled=from!=='part-layering';
  form.elements.shadowMode.disabled=stages.findIndex(stage=>stage.id===from)>5||stages.findIndex(stage=>stage.id===to)<5;
  form.querySelector('.live-detail').textContent=form.elements.from?`${nineAxisConnection({from,to,live:form.elements.live.checked}).detail}。保存参数后，再使用继续、恢复或重试执行。`:form.elements.live.checked?'阴影完成后继续制作头部九轴，包含脸部、头发与头部饰品。':'本次在阴影完成后结束，头部九轴暂不启动。';
 };
 form.querySelectorAll('[name=from],[name=to]').forEach(select=>select.onchange=()=>{
  rangeEdited=true;
  const from=stages.findIndex(stage=>stage.id===form.elements.from.value);
  for(const option of form.elements.to.options)option.disabled=stages.findIndex(stage=>stage.id===option.value)<from;
  if(stages.findIndex(stage=>stage.id===form.elements.to.value)<from)form.elements.to.value=form.elements.from.value;
  update();
 });
 form.elements.live.onchange=update;update();
 return ()=>rangeEdited;
}
function showRunOptions() {
 const dialog=document.querySelector('#new-task'),run=data.run,from=run?.from||'part-layering',to=run?.to||'shadow';
 const options=selected=>runnableStages.map(stage=>`<option value="${stage.id}" ${stage.id===selected?'selected':''}>${stage.name}</option>`).join('');
 const displayName=tasks.find(task=>task.name===state.name)?.displayName||'';
 dialog.innerHTML=`<div class="modal-heading"><div><h2>执行参数 · ${esc(state.name)}</h2><p>保存到本任务的调度记录，下一次继续、恢复或重试时使用。</p></div><button class="icon-button" data-close>${icon('close')}</button></div>
 <form id="task-options-form"><div class="new-task-columns"><div>${data.original?`<img class="resume-reference" src="${artifact(data.original)}" alt="当前任务原图">`:''}<label class="field-label" for="task-name">任务名</label><input id="task-name" value="${esc(state.name)}" readonly><label class="field-label" for="task-displayName">显示名称</label><input id="task-displayName" name="displayName" value="${esc(displayName)}"><label class="field-label" for="task-from">执行范围起点</label><select id="task-from" name="from">${options(from)}</select><label class="field-label" for="task-to">执行范围终点</label><select id="task-to" name="to">${options(to)}</select><p class="dialog-note">保留已有产物，由调度从未完成的步骤接续。明确修改执行范围时，以所选范围为准。</p></div><div>${executionFields(run)}
 <label class="field-label" for="task-krita">本任务 Krita 可执行文件</label><div class="path-field"><input id="task-krita" name="krita" value="${esc(run?.krita||'')}"><button type="button" class="button" data-task-pick="krita">浏览</button></div>
 <label class="field-label" for="task-knowledge">本任务先验知识目录</label><div class="path-field"><input id="task-knowledge" name="knowledge" value="${esc(run?.knowledge||'')}" placeholder="留空使用 skill 自带的 knowledge/"><button type="button" class="button" data-task-pick="knowledge">浏览</button></div>
 <p class="dialog-note">保存在本任务，修改全局设置不会覆盖。相对路径以任务根目录为基准，绝对路径按原值使用。</p></div></div>
 <p class="form-error" role="alert"></p><div class="modal-footer"><span>保存参数不会启动制作。</span><button type="button" class="button" data-close>取消</button><button class="primary" type="submit">保存参数</button></div></form>`;
 dialog.showModal();dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>dialog.close());
 const form=dialog.querySelector('form'),rangeEdited=bindExecutionFields(form,run);
 form.querySelectorAll('[data-task-pick]').forEach(button=>button.onclick=async()=>{
  const field=form.elements[button.dataset.taskPick];
  const path=await settings.pick({kind:field.name==='krita'?'file':'dir',path:field.value.trim(),title:field.name==='krita'?'选择本任务 Krita':'选择本任务先验知识目录'});
  if(path)field.value=path;
 });
 form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;form.querySelector('.form-error').textContent='';
  try{
   const payload={name:state.name};
   if(form.elements.krita.value.trim()!==(run?.krita||''))payload.krita=form.elements.krita.value.trim();
   if(form.elements.knowledge.value.trim()!==(run?.knowledge||''))payload.knowledge=form.elements.knowledge.value.trim();
   if(form.elements.displayName.value.trim()!==displayName)payload.displayName=form.elements.displayName.value.trim();
   if(rangeEdited()&&(form.elements.from.value!==from||form.elements.to.value!==to)){payload.from=form.elements.from.value;payload.to=form.elements.to.value;}
   if(form.elements.live.checked!==(run?.live===true))payload.live=form.elements.live.checked;
   if(!form.elements.standard.disabled&&form.elements.standard.checked!==(run?.standard===true))payload.standard=form.elements.standard.checked;
   if(!form.elements.shadowMode.disabled&&form.elements.shadowMode.value!==(run?.shadowMode||'mask'))payload.shadowMode=form.elements.shadowMode.value;
   if(Number(form.elements.jobs.value)!==(run?.jobs||3))payload.jobs=Number(form.elements.jobs.value);
   await post('task-options',payload);dialog.close();await refreshTask(true);toast('执行参数已保存；下一次继续、恢复或重试时使用。');
  }catch(error){form.querySelector('.form-error').textContent=error.message;}finally{button.disabled=false;}
 };
}
function showNew() {
 const dialog=document.querySelector('#new-task');state.uploaded=null;
 dialog.innerHTML=`<div class="modal-heading"><div><h2>新建任务</h2><p>从角色参考图开始制作；人物与衣服并行，在组装后进入阴影。</p></div><button class="icon-button" data-close>${icon('close')}</button></div>
 <form id="new-task-form"><div class="new-task-columns"><div><label class="field-label">输入参考图</label><label class="upload-zone" id="upload-zone"><input id="image-input" type="file" accept="image/png,image/jpeg,image/webp" hidden><span class="upload-icon">${icon('upload')}</span><b>选择或拖入角色图片</b><p>PNG、JPG、WebP · 最大 20 MB</p></label><label class="field-label" for="task-image">或填写服务器上的图片路径</label><input id="task-image" name="image" placeholder="绝对路径；相对路径基于任务目录"><label class="field-label" for="task-name">任务名</label><input id="task-name" name="name" required maxlength="128" pattern="[\\p{L}\\p{N}][\\p{L}\\p{N}._\\-]{0,127}" title="以字母或数字开头，只含字母、数字、点、下划线和短横线" placeholder="角色任务名称"><label class="field-label" for="task-displayName">显示名称</label><input id="task-displayName" name="displayName" placeholder="可选"><p class="dialog-note">任务保存在 ${esc(state.directory)}。已有任务请从任务列表选择，调整执行参数后继续。</p></div><div>${executionFields()}</div></div><p class="form-error" role="alert"></p><div class="modal-footer"><span>关闭网页后仍会在后台执行。</span><button type="button" class="button" data-close>取消</button><button class="primary" type="submit">新建并开始</button></div></form>`;
 dialog.showModal();dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>dialog.close());
 let previewURL,created=false;
 const upload=file=>{if(created)return;if(!file?.type.startsWith('image/'))return toast('请选择图片文件');if(file.size>20*1024*1024)return toast('图片最大 20 MB');state.uploaded=file;if(previewURL)URL.revokeObjectURL(previewURL);previewURL=URL.createObjectURL(file);const zone=dialog.querySelector('#upload-zone');zone.classList.add('has-image');zone.style.backgroundImage=`url("${previewURL}")`;zone.querySelector('b').textContent=file.name;};
 dialog.querySelector('#image-input').onchange=event=>upload(event.target.files[0]);const zone=dialog.querySelector('#upload-zone');zone.ondragover=event=>event.preventDefault();zone.ondrop=event=>{event.preventDefault();upload(event.dataTransfer.files[0]);};
 dialog.addEventListener('close',()=>{if(previewURL)URL.revokeObjectURL(previewURL);},{once:true});
 const form=dialog.querySelector('form');bindExecutionFields(form);
 form.onsubmit=async event=>{
  event.preventDefault();const fields=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;form.querySelector('.form-error').textContent='';
  try{
   const payload={name:fields.get('name').trim(),displayName:fields.get('displayName').trim(),from:'part-layering',live:fields.get('live')==='on',standard:fields.get('standard')==='on',shadowMode:fields.get('shadowMode'),jobs:Number(fields.get('jobs'))};
   if(!created){
    payload.image=fields.get('image');
    if(state.uploaded)payload.upload=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(state.uploaded);});
    await settings.withSoftware(selected=>post('tasks',{...payload,...selected}));created=true;form.elements.name.readOnly=true;form.elements.image.disabled=true;form.querySelector('#image-input').disabled=true;delete payload.image;delete payload.upload;
   }
   state.name=payload.name;rememberTask(state.directory,state.name);button.textContent='正在启动…';await settings.withSoftware(selected=>post('start',{...payload,...selected}));dialog.close();await refreshTask(true);toast('新任务已在后台启动。');
  }catch(error){form.querySelector('.form-error').textContent=error.message;if(created){button.textContent='继续启动';await refreshTask(true);}}finally{button.disabled=false;}
 };
}
function showFiles() {
 const dialog=document.querySelector('#directory-dialog');dialog.innerHTML=`<div class="modal-heading"><div><h2>${esc(state.name)} · 全部产物</h2><p>按任务实际目录浏览、预览或下载。</p></div><button class="icon-button" data-close>${icon('close')}</button></div><input id="file-filter" placeholder="筛选路径" aria-label="筛选产物"><div class="all-files"></div>`;
 const listing=filter=>{
  const matched=data.files.filter(path=>path.toLowerCase().includes(filter.toLowerCase()));
  const listing=processFileList(matched,[''],data.fileVersions);
  const shown=listing.folders.flatMap(folder=>folder.files);
  dialog.querySelector('.all-files').innerHTML=`<p>${matched.length} 个文件 · 显示 ${shown.length} 个</p>`+shown.map(path=>`<button data-open-file="${esc(path)}">${icon(path.endsWith('.kra')?'layers':'file')}<span>${esc(path)}</span></button>`).join('');
  dialog.querySelectorAll('[data-open-file]').forEach(button=>button.onclick=()=>{const path=button.dataset.openFile,index=Math.max(0,stages.findIndex(stage=>path.startsWith(stage.id+'/')));dialog.close();if(path.endsWith('.kra'))window.open(artifact(path),'_blank','noopener');else openAsset({path,label:path.split('/').at(-1),kind:/\.(png|jpe?g|webp|svg)$/i.test(path)?'image':'file'},index,'step01');});
 };
 dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('#file-filter').oninput=e=>listing(e.target.value);listing('');
}
function showHistory() {
 const dialog=document.querySelector('#directory-dialog');dialog.innerHTML=`<div class="modal-heading"><div><h2>提交历史</h2><p>选择一次提交，浏览当时的先验知识。</p></div><button class="icon-button" data-close>${icon('close')}</button></div><div class="commit-list">${(versions?.commits||[]).map((c,i)=>`<button data-commit="${c.sha}"><span class="commit-node">${icon('branch')}</span><div><b>${esc(c.title)}</b><small>${c.short}${i===0?' · 当前分支最新提交':''}</small></div>${icon('chevron')}</button>`).join('')}</div>`;dialog.showModal();dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelectorAll('[data-commit]').forEach(b=>b.onclick=async()=>{state.ref=b.dataset.commit;dialog.close();await loadConfig();render();});
}
function selectStage(index) {
 state.stage=index;state.selectedStep=defaultStep(index);
 state.asset=null;state.inspect=false;state.page='preview';state.autoHeight=true;
 // A lane stage brings its lane into focus; the merge stages keep the current one.
 if(laneOf(index)>=0){state.lane=laneOf(index);laneAnimation=null;}
 updateViewURL();render();
 focusPreviewStep();
}
function focusPreviewStep() {
 const viewport=document.querySelector('.flow-scroll'),node=state.stage===6?document.querySelector('[data-head-preview]')||document.querySelector(`[data-node="${state.stage}:${state.selectedStep}"]`):document.querySelector(`[data-kra-preview="${state.stage}"]`)||document.querySelector(`[data-node="${state.stage}:${state.selectedStep}"]`);
 if(!viewport||!node)return;
 viewport.scrollLeft+=node.getBoundingClientRect().left-viewport.getBoundingClientRect().left-12;
 viewport.scrollTop=laneScrollTop();state.canvasLeft=viewport.scrollLeft;state.canvasTop=0;
}
function updateViewURL() {
 const url=new URL(location.href);
 url.searchParams.set('page',state.page);url.searchParams.set('stage',state.stage);
 if(state.name)url.searchParams.set('name',state.name);
 history.replaceState(null,'',url);
}
const wheelBound=new WeakSet();
// The inner list that scrolls vertically under `target`, if any: it keeps its own vertical gestures.
function innerScroller(target,viewport) {
 for(let node=target;node&&node!==viewport;node=node.parentElement)
  if(node.matches('.inline-tree-rows')||(node.scrollHeight>node.clientHeight+1&&/auto|scroll/.test(getComputedStyle(node).overflowY)))return node;
 return null;
}
// Whether (x, y) lies on rendered text: a drag that starts there selects the text instead of panning.
function onText(x,y) {
 let node=document.caretRangeFromPoint?.(x,y)?.startContainer;
 if(!node&&document.caretPositionFromPoint)node=document.caretPositionFromPoint(x,y)?.offsetNode;
 if(node?.nodeType!==Node.TEXT_NODE||!node.textContent.trim())return false;
 // The caret APIs return the nearest text even beside it, so require the point inside the text's own boxes.
 const range=document.createRange();range.selectNodeContents(node);
 return [...range.getClientRects()].some(box=>x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom);
}
function bind() {
 const select=document.querySelector('#task-select');
 if(select)select.onchange=async()=>{
  state.name=select.value;rememberTask(state.directory,state.name);
  state.inspect=false;state.asset=null;state.canvasLeft=0;state.canvasTop=0;
  state.loading=true;state.loadError=null;applySnapshot({files:[],sections:[]});render();
  const url=new URL(location.href);url.searchParams.set('name',state.name);history.replaceState(null,'',url);
  try{await refreshTask(true);}catch(error){toast('读取失败：'+error.message);}
 };
 document.querySelectorAll('[data-step-toolbar]').forEach(b=>b.onclick=async()=>{
  const targets=stepTargets(),action=b.dataset.stepToolbar,broken=brokenSteps(targets,action);
  if(!data.run){if(action==='continue')showRunOptions();return;}
  if(action==='retry'&&!confirm(`重试：删除以下步骤的产物、会话与 agent 尝试记录并重新运行。\n${broken.map(stepLabel).join('\n')}\n确定吗？`))return;
  b.disabled=true;
  try{const result=await settings.withSoftware(selected=>post('task-action',{name:state.name,action,...selected}));toast(result.message+' 已在后台重新运行。');await refreshTask(true);}
  catch(error){toast(error.message);b.disabled=false;}
 });
 document.querySelectorAll('[data-page]').forEach(b=>b.onclick=async()=>{state.page=b.dataset.page;updateViewURL();if(state.page==='config')await loadConfig();render();});
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>selectStage(Number(b.dataset.stage)));
 document.querySelectorAll('[data-copy-error]').forEach(b=>b.onclick=async()=>{
  try{await navigator.clipboard.writeText(b.dataset.copyError);}
  // The clipboard API needs a secure origin; a LAN address falls back to a hidden textarea.
  catch{const area=Object.assign(document.createElement('textarea'),{value:b.dataset.copyError});document.body.append(area);area.select();document.execCommand('copy');area.remove();}
  const title=b.title;b.innerHTML=icon('check');b.title='已复制';setTimeout(()=>{b.innerHTML=icon('copy');b.title=title;},1200);
 });
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>{const [index,step]=b.dataset.step.split(':'),i=Number(index);const item=available(stepArtifacts[i][step])[0];if(item)openAsset(item,i,step);else{state.stage=i;state.selectedStep=step;state.asset=null;state.inspect=true;render();}});
 document.querySelectorAll('[data-asset]').forEach(b=>b.onclick=()=>openAsset(assetLookup.get(b.dataset.asset),Number(b.dataset.assetStage),b.dataset.assetStep));
 const toggle=(set,key)=>{set.has(key)?set.delete(key):set.add(key);render();};
 document.querySelectorAll('[data-section-toggle]').forEach(b=>b.onclick=()=>toggle(state.collapsedSections,Number(b.dataset.sectionToggle)));
 document.querySelectorAll('[data-step-toggle]').forEach(b=>b.onclick=()=>toggle(state.collapsedSteps,b.dataset.stepToggle));
 document.querySelectorAll('[data-phase-toggle]').forEach(b=>b.onclick=()=>toggle(state.collapsedPhases,b.dataset.phaseToggle));
 const revealGroup=index=>{
  const viewport=document.querySelector('.flow-scroll'),node=document.querySelector(`[data-node="${index}:layers"]`);
  const bounds=node.getBoundingClientRect(),view=viewport.getBoundingClientRect();
  viewport.scrollLeft+=bounds.left-view.left-20;
  const [min,max]=laneRange();viewport.scrollTop=Math.min(max,Math.max(min,viewport.scrollTop+bounds.top-view.top-20));
 };
 document.querySelectorAll('[data-tree-group]').forEach(b=>b.onclick=()=>{const index=b.dataset.treeStage;groupViews[index].selected=b.dataset.treeGroup;state.inspect=false;render();revealGroup(index);});
 document.querySelectorAll('[data-group-toggle]').forEach(b=>b.onclick=()=>{const index=b.dataset.groupToggle;groupViews[index].open=!groupViews[index].open;render();if(groupViews[index].open)revealGroup(index);});
 document.querySelectorAll('[data-tree-expand]').forEach(b=>b.onclick=()=>{const view=groupViews[b.dataset.treeStage],id=b.dataset.treeExpand;view.expanded.has(id)?view.expanded.delete(id):view.expanded.add(id);render();});
 document.querySelectorAll('[data-expand-all]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.expandAll),view=groupViews[i];view.depth=-1;view.search='';view.expanded=new Set(flat(sectionTree(i)).filter(node=>node.groups?.length).map(node=>node.id));render();});
 document.querySelectorAll('[data-tree-depth]').forEach(select=>select.onchange=()=>{groupViews[select.dataset.treeDepth].depth=Number(select.value);render();});
 document.querySelectorAll('[data-tree-search]').forEach(input=>input.oninput=()=>{const i=input.dataset.treeSearch,position=input.selectionStart;groupViews[i].search=input.value;render();const next=document.querySelector(`[data-tree-search="${i}"]`);next.focus({preventScroll:true});next.setSelectionRange(position,position);});
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=> {
  const action=b.dataset.action;
  if(action==='new')showNew();
  else if(action==='run')showRunOptions();
  else if(action==='run-options')showRunOptions();
  else if(action==='files')showFiles();
  else if(action==='stop'){b.disabled=true;post('stop',{name:state.name}).then(result=>{toast(result.message);return refreshTask(true);}).catch(error=>{toast(error.message);b.disabled=false;});}
  else if(action==='convert-layout'){b.disabled=true;toast('正在备份并转换目录…');post('convert-layout',{name:state.name}).then(result=>{toast(`已转换，原目录备份在 ${result.backup}`);return refreshTask(true);}).catch(error=>{toast(error.message);b.disabled=false;});}
  else if(action==='settings')settings.show();
  else if(action==='history')showHistory();
  else if(action==='dismiss-update'){try{localStorage.setItem(dismissedKey,appVersion.latest);}catch{}render();}
  else if(action==='close-inspector'){state.inspect=false;render();}
  else if(action==='zoom-in')zoomCanvas(state.zoom+.1);
  else if(action==='zoom-out')zoomCanvas(state.zoom-.1);
  else if(action==='zoom-reset')zoomCanvas(1);
  else if(action==='zoom-fit')zoomCanvas(1,true);
 });
 const compare=document.querySelector('#compare-reference');if(compare)compare.onchange=()=>{state.compare=compare.checked;render();};
 const viewport=document.querySelector('.flow-scroll');if(viewport){
  // Plain wheel browses sideways (the usual direction); Ctrl/⌘ + wheel moves between the lanes.
  // An inner list under the pointer keeps its own plain wheel. The viewport survives refreshes (dom-morph), so its listeners are added once.
  if(!wheelBound.has(viewport)){
   wheelBound.add(viewport);
   let wheelTotal=0,wheelAt=0,wheelRest=0;
   viewport.addEventListener('wheel',event=>{
    const delta=event.deltaY*(event.deltaMode===1?20:event.deltaMode===2?viewport.clientHeight:1);
    if(event.ctrlKey||event.metaKey){
     // Also keeps the browser from zooming the page.
     event.preventDefault();
     const dy=delta,[min,max]=laneRange();
     // A lane taller than the viewport scrolls through first, then hands over to the next lane.
     if(!laneAnimation&&(dy>0?viewport.scrollTop<max-1:viewport.scrollTop>min+1)){viewport.scrollTop=Math.min(max,Math.max(min,viewport.scrollTop+dy));wheelTotal=0;return;}
     const now=performance.now();
     if(now-wheelAt>250)wheelTotal=0;
     wheelAt=now;wheelTotal+=dy;
     // One switch per gesture: a trackpad keeps sending events after the slide starts.
     if(laneAnimation||now<wheelRest||Math.abs(wheelTotal)<40)return;
     wheelTotal=0;wheelRest=now+600;switchLane(state.lane+Math.sign(dy));
     return;
    }
    if(Math.abs(event.deltaX)>=Math.abs(event.deltaY)||innerScroller(event.target,viewport))return;
    if(viewport.scrollWidth<=viewport.clientWidth)return;
    event.preventDefault();viewport.scrollLeft+=delta;
   },{passive:false});
   viewport.addEventListener('keydown',event=>{
    if(event.target!==viewport)return;
    const step={ArrowUp:-1,PageUp:-1,ArrowDown:1,PageDown:1}[event.key];
    if(step&&laneCount()>1){event.preventDefault();switchLane(state.lane+step);}
   });
  }
  // Drags and swipes: sideways pans; up or down slides to the other lane once past the lane's own range.
  // Touch leaves sideways swipes to the browser (touch-action: pan-x) and vertical ones on inner lists to the list.
  // A mouse drag that starts on text selects it and never pans; one that starts elsewhere pans and never selects.
  let drag;
  viewport.onpointerdown=e=>{
   const touch=e.pointerType!=='mouse';
   if(e.button!==0||e.target.closest('button,a,input,select,summary,.inline-tree-rows')||touch&&innerScroller(e.target,viewport))return;
   if(!touch&&onText(e.clientX,e.clientY)){
    viewport.classList.add('selecting');
    addEventListener('pointerup',()=>viewport.classList.remove('selecting'),{once:true});
    return;
   }
   // A touch on selected text adjusts the selection.
   if(touch&&!getSelection().isCollapsed&&viewport.contains(getSelection().anchorNode))return;
   drag={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,axis:null,touch,id:e.pointerId};
  };
  viewport.onselectstart=e=>{if(drag||laneAnimation)e.preventDefault();};
  viewport.onpointermove=e=>{
   if(!drag||drag.id!==e.pointerId||drag.axis==='done')return;
   const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
   if(!drag.axis){
    if(Math.max(Math.abs(dx),Math.abs(dy))<6)return;
    drag.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';
    if(drag.axis==='x'&&drag.touch){drag=null;return;}
    viewport.setPointerCapture(e.pointerId);viewport.classList.add('panning');getSelection().removeAllRanges();
   }
   if(drag.axis==='x'){viewport.scrollLeft=drag.left-dx;return;}
   const [min,max]=laneRange(),wanted=drag.top-dy;
   if(!laneAnimation)viewport.scrollTop=Math.min(max,Math.max(min,wanted));
   const over=wanted<min?wanted-min:wanted>max?wanted-max:0;
   if(Math.abs(over)>48&&laneCount()>1){const next=state.lane+Math.sign(over);if(next>=0&&next<laneCount()){drag.axis='done';switchLane(next);}}
  };
  const end=()=>{drag=null;viewport.classList.remove('panning');};viewport.onpointerup=end;viewport.onpointercancel=end;
 }
 document.querySelectorAll('[data-lane]').forEach(b=>b.onclick=()=>switchLane(Number(b.dataset.lane)));
 bindConfigTree();
 document.querySelectorAll('[data-config-mode]').forEach(b=>b.onclick=async()=>{state.configMode=b.dataset.configMode;await loadConfig();render();});
 const source=document.querySelector('#config-ref');if(source)source.onchange=async()=>{state.ref=source.value;state.base=undefined;await loadConfig();render();};
 const diff=document.querySelector('#config-diff');if(diff)diff.onchange=async()=>{state.diff=diff.checked;state.base=document.querySelector('#config-base').value;await refreshConfigFile();};
 const base=document.querySelector('#config-base');if(base)base.onchange=async()=>{state.base=base.value;if(state.diff){await refreshConfigFile();}};
 const filter=document.querySelector('#config-search');if(filter)filter.oninput=()=>{state.configFilter=filter.value;document.querySelector('.config-tree-scroll').innerHTML=configTree();bindConfigTree();};
}
// The file may be published between the snapshot and the image request.
// Replace a failed SVG image until the next snapshot supplies a usable path.
document.addEventListener('error',event=>{
 const image=event.target;
 if(!(image instanceof HTMLImageElement)||!image.hasAttribute('data-svg-artifact'))return;
 const message=document.createElement('span');message.className='svg-unavailable';message.setAttribute('role','status');message.textContent='画面暂不可用，等待刷新';
 image.replaceWith(message);
},true);
await refreshTask(true);
if(state.page==='config')await loadConfig();
render();
if(state.page==='preview')focusPreviewStep();
fetch('./api/version').then(r=>r.ok?r.json():null).then(value=>{if(value){appVersion=value;render();}}).catch(()=>{});
setInterval(()=>refreshTask().catch(error=>toast('同步失败：'+error.message)),4000);
if(new URLSearchParams(location.search).get('dialog')==='new')showNew();
