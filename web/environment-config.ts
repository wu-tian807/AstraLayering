import { readFile, writeFile, rename, rm, lstat, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, join, delimiter } from 'node:path';
import { parseEnv, promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { workflowsDirectory } from '../.agents/skills/live2d-maker/shared/paths.ts';
import { modelHarnesses, modelSlots, resolveModelDefaults, resolveImageDefaults, imageSteps, imageModelProviders, reasoningEfforts, stepModelSlots, type AgentStep, type Harness } from '../.agents/skills/live2d-maker/shared/agents/models.ts';
import { parseWorkflowEnvironment, type WorkflowEnvironment } from '../.agents/skills/live2d-maker/shared/codex/environment.ts';
import { appServerCommand } from '../.agents/skills/live2d-maker/shared/codex/tool-agent.ts';
import { validateImageSelection } from '../.agents/skills/live2d-maker/shared/agents/images.ts';
import { validateProviderModel } from '../.agents/skills/live2d-maker/shared/agents/providers.ts';

const envValues = (source: string) => parseEnv(source) as Record<string,string>;
const roles: Record<string,string> = { preparation:'参考准备与姿态判断',part_draw:'轮廓绘制与返修',part_review:'轮廓审核',part_reduce:'同层去重',part_completion:'遮挡补全',part_groups:'部件分组',part_depth:'深度分析',raster_step01:'分层绘制与返修',raster_step01_review:'分层绘制审核',raster_step02:'边缘精修',raster_step03:'人物换装素体',assembly:'穿戴组装',shadow:'阴影制作',nine_axis_head:'九轴脸部与双耳转向' };
const images: Record<string,string> = { part_standardize:'人物姿态标准化',part_simplify:'简化穿衣参考',part_base_subject:'人物素体参考',clothing_preparation:'纯衣服参考',part_completion:'人物补全辅助参考',clothing_completion:'衣服补全辅助参考',raster_step01:'人物分层绘制',raster_step01_review:'人物绘制审核',raster_step01_repair:'人物绘制返修',raster_step02:'人物边缘精修',raster_step03:'人物换装素体',clothing_raster_step01:'衣服分层绘制',clothing_raster_step01_review:'衣服绘制审核',clothing_raster_step01_repair:'衣服绘制返修',clothing_raster_step02:'衣服边缘精修',assembly:'穿戴组装',shadow_maps:'阴影法线与深度' };
export const secretKey = (key: string) => /(?:key|token|secret|password|credential|authorization)/i.test(key);
const digest = (text: string, exists: boolean) => createHash('sha256').update(`${exists}\0${text}`).digest('hex');
const queues = new Map<string,Promise<unknown>>();
type Field = { key:string; label:string; section:string; type:string; options?:string[]; fallback?:string; hint?:string };
export class EnvironmentConflict extends Error { }

function scalarFields(defaults: Record<string,string>): Field[] {
  const result: Field[] = [];
  for (const harness of ['codex','claude','agv']) {
    for (const [suffix,label,type] of [['api_key','API 密钥','secret'],['base_url','服务地址','text'],['models','可用模型列表','text'],['path','CLI 路径','text']]) result.push({key:`layering_${harness}_${suffix}`,label:`${harness} ${label}`,section:'connection',type,hint:suffix==='models'?'逗号分隔模型 ID；留空沿用已有范围':suffix==='api_key'?'留空复用已有登录；填入新值可替换本地密钥':undefined});
  }
  const labels: Record<string,string> = {layering_agv_protocol:'AGV 网关协议',layering_codex_home:'Codex 配置目录',layering_openai_image_base_url:'GPT 生图服务地址',layering_openai_image_api_key:'GPT 生图 API 密钥',layering_google_image_base_url:'Nano 生图服务地址',layering_google_image_api_key:'Nano 生图 API 密钥',layering_google_image_protocol:'Nano 生图协议',layering_agv_unlimited_response_header_timeout:'AGV 响应头期限兼容',layering_agv_minimal_thinking_level:'AGV MINIMAL 兼容',layering_image_compact_threshold:'Codex 图片数量预算（兼容键）',layering_krita_max_instances:'本机 Krita 并发上限',layering_update_check:'检查新版本'};
  const choices: Record<string,string[]> = {layering_agv_protocol:['','genai','openai'],layering_google_image_protocol:['gemini','openai'],layering_agv_minimal_thinking_level:['','LOW','MEDIUM','HIGH']};
  for (const key of Object.keys(defaults)) {
    if (result.some(f=>f.key===key)||key.startsWith('layering_agent_')||key.endsWith('_image_model')||key==='layering_image_model') continue;
    const type = secretKey(key)?'secret':choices[key]?'select':/deduplicate$|unlimited_response_header_timeout$|update_check$/.test(key)?'boolean':/compact_threshold$|compact_mib$|_max_instances$/.test(key)?'number':'text';
    result.push({ key,label:labels[key]??key.replace(/^layering_/,'').replaceAll('_',' '), section:key==='layering_agv_protocol'?'connection':key.includes('compact')||key.includes('deduplicate')?'budget':key.includes('_image_')?'image-api':'advanced',type,options:choices[key],fallback:defaults[key] });
  }
  for(const [key,label] of Object.entries({DISPLAY:'Linux 显示入口 DISPLAY',WAYLAND_DISPLAY:'Wayland 显示入口',QT_QPA_PLATFORM:'Qt 显示方式'})) result.push({key,label,section:'advanced',type:'text'});
  return result;
}

// Preserve untouched bytes, including comments, unknown keys, multiline values and CRLF.
function records(text: string) {
  const lines = text.match(/[^\n]*(?:\n|$)/g)?.filter(Boolean)??[];
  const result: {key?:string;text:string}[]=[];
  for(let i=0;i<lines.length;i++) {
    let value=lines[i]; const match=value.match(/^\s*(?:export\s+)?([\w]+)\s*=\s*([\s\S]*)$/);
    if(match) { const quote=match[2][0]; if(['"',"'",'`'].includes(quote)) {let tail=match[2].slice(1); while(!tail.includes(quote)&&i+1<lines.length) {const next=lines[++i];value+=next;tail+=next;}} }
    result.push({key:match?.[1],text:value});
  }
  return result;
}
function quoted(value: string) {
  if(!value) return '';
  for(const candidate of [value,`'${value}'`,`"${value}"`,`\`${value}\``]) {
    try {if(envValues(`VALUE=${candidate}`).VALUE===value) return candidate;} catch { /* Try another quote. */ }
  }
  throw new Error('该值包含不支持的引号组合，请在本机编辑此项。');
}
export function patchEnvironment(text: string, changes: Record<string,string>) {
  const eol=text.includes('\r\n')?'\r\n':'\n', emitted=new Set<string>();
  let result=records(text).map(record=> {
    if(!record.key||!Object.hasOwn(changes,record.key)) return record.text;
    if(emitted.has(record.key)) return '';
    emitted.add(record.key);
    const ending=record.text.endsWith('\n')?eol:'';
    const assigned=record.text.replace(/^\s*(?:export\s+)?\w+\s*=\s*/, '');
    const mark=assigned[0];
    const tail=['"',"'",'`'].includes(mark)?assigned.slice(assigned.indexOf(mark,1)+1):assigned;
    const comment=tail.includes('#')?' '+tail.slice(tail.indexOf('#')).replace(/[\r\n]+$/,''):'';
    return `${record.key}=${quoted(changes[record.key])}${comment}${ending}`;
  }).join('');
  for(const [key,value] of Object.entries(changes)) if(!emitted.has(key)) {if(result&&!result.endsWith('\n'))result+=eol;result+=`${key}=${quoted(value)}${eol}`;}
  return result;
}
function redactedPreview(text: string) {
  return Object.entries(envValues(text)).map(([key,value])=>`${key}=${secretKey(key)&&value?'[已隐藏]':quoted(value)}`).join('\n');
}

// Probe executable versions only. Never install CLIs, build Codex, or contact a model.
export async function probeEnvironmentCli(harness: Harness, values: Record<string,string>, env: NodeJS.ProcessEnv, directory: string) {
  const explicit=env[`layering_${harness}_path`]??values[`layering_${harness}_path`];
  const names=harness==='agv'?['agy','agv','antigravity']:[harness];
  const paths=explicit?[resolve(directory,explicit)]:(env.PATH??'').split(delimiter).flatMap(p=>names.flatMap(n=>process.platform==='win32'?[join(p,n+'.exe'),join(p,n+'.cmd')]:[join(p,n)]));
  const exec=promisify(execFile);
  for(const path of paths) {
    try {await access(path,constants.X_OK);if(!(await lstat(path)).isFile()&&!(await lstat(path)).isSymbolicLink())continue;
      // Batch launchers are located, but only fixed .exe / native entrypoints are run here.
      if(process.platform==='win32'&&/\.(cmd|bat)$/i.test(path)) return {available:true,detail:'已找到 CLI 入口，启动任务时检查版本',path};
      const r=await exec(path,['--version'],{env,timeout:3500,maxBuffer:16000});
      if(/\d+\.\d+/.test(r.stdout+r.stderr))return {available:true,detail:(r.stdout||r.stderr).trim().split('\n')[0],path};
    } catch { /* Check the next installed entrypoint. */ }
  }
  if(harness==='codex'&&!explicit) {
    try {const command=appServerCommand();const r=await exec(command.command,[...command.args.slice(0,-1),'--version'],{env,timeout:3500,maxBuffer:16000});if(/\d+\.\d+/.test(r.stdout+r.stderr))return {available:true,detail:'使用项目内 Codex CLI；补丁由任务启动时准备',path:command.args[0]};} catch { /* SDK CLI unavailable too. */ }
  }
  return {available:false,detail:`当前服务环境未检测到可用 ${harness} CLI，请安装后登录或填写 CLI 路径`,path:explicit||''};
}
export function createEnvironmentConfig({directory=workflowsDirectory, env=process.env, probe=probeEnvironmentCli}:{directory?:string;env?:NodeJS.ProcessEnv;probe?:typeof probeEnvironmentCli}={}) {
  const file=join(directory,'.env');
  async function source() {try {const info=await lstat(file);if(!info.isFile())throw new Error('.env 需要是当前 skill 内的普通文件');return {text:await readFile(file,'utf8'),exists:true};}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {text:'',exists:false};throw error;}}
  async function schema() {
    const template=await readFile(join(directory,'example.env'),'utf8'), defaults=envValues(template);
    const modelSlotDefaults=resolveModelDefaults(defaults), imageDefaults=resolveImageDefaults(defaults);
    return {template,fields:[...Object.entries(modelSlotDefaults).map(([slot,fallback])=>({key:`layering_agent_${slot}_model`,label:roles[slot],section:'llm',type:'model',fallback})),{key:'layering_default_image_model',label:'默认生图模型',section:'image',type:'image',fallback:imageDefaults.model},...imageSteps.map(step=>({key:`layering_${step}_image_model`,label:images[step],section:'image',type:'image',fallback:defaults[`layering_${step}_image_model`]??''})),...scalarFields(defaults)] as Field[]};
  }
  async function describe(text:string,exists:boolean,revision:string) {
    const {fields}=await schema(),values=envValues(text), issues:string[]=[];
    let settings:WorkflowEnvironment|undefined;
    try { settings=parseWorkflowEnvironment(text,env,directory); }catch(error) { issues.push((error as Error).message); }
    const cli=Object.fromEntries(await Promise.all((['codex','claude','agv'] as const).map(async h=>[h,await probe(h,values,settings?.codex.env??{...values,...env},directory)])));
    const effective:Record<string,string>={};
    if(settings) {
      for(const [step,slot] of Object.entries(stepModelSlots)) {const m=settings.stepModels[step as AgentStep];effective[`layering_agent_${slot}_model`]=`${m.model}-${m.effort}`;}
      for(const step of imageSteps)effective[`layering_${step}_image_model`]=settings.stepImages[step]!;
      for(const step of imageSteps)try{validateImageSelection(settings,step);}catch(error){issues.push((error as Error).message);}
      for(const slot of modelSlots){const step=Object.keys(stepModelSlots).find(s=>stepModelSlots[s as AgentStep]===slot)!;try{validateProviderModel(settings.providers,settings.stepModels[step as AgentStep],roles[slot]);}catch(error){issues.push((error as Error).message);}}
    }
    return {path:file,exists,revision,preview:redactedPreview(text),issues:[...new Set(issues)],cli,
      models:Object.entries(modelHarnesses).map(([id,harness])=>({id,harness,...cli[harness],allowed:!settings?.providers?.[harness].models||settings.providers[harness].models!.includes(id)})),imageModels:Object.keys(imageModelProviders),efforts:reasoningEfforts,
      fields:fields.map(field=> {
        const match=field.key.match(/^layering_(codex|claude|agv)_(api_key|base_url|models|protocol)$/);
        const provider=match?settings?.providers?.[match[1] as Harness]:undefined;
        const property=match?.[2]==='api_key'?'apiKey':match?.[2]==='base_url'?'baseUrl':match?.[2];
        const sourceKey=provider&&property?provider.sources[property as keyof typeof provider.sources]:field.key;
        const overridden=env[field.key]!==undefined||!!(sourceKey&&env[sourceKey]!==undefined);
        const providerValue=provider&&property?(provider as unknown as Record<string,unknown>)[property]:undefined;
        return {...field,secret:field.type==='secret',value:field.type==='secret'?'':values[field.key]??'',configured:!!values[field.key],effective:field.type==='secret'?undefined:effective[field.key]??(Array.isArray(providerValue)?providerValue.join(','):typeof providerValue==='string'?providerValue:undefined)??env[field.key]??values[field.key]??field.fallback??'',source:overridden?'environment':sourceKey&&!!values[sourceKey]?'file':'default',sourceKey,overridden};
      }),
      providers:settings?.providers&&Object.fromEntries(Object.entries(settings.providers).map(([h,p])=>[h,{...p,apiKey:undefined,configured:!!p.apiKey}])),
    };
  }
  function changes(raw:unknown,fields:Field[]) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>150)throw new Error('请提交需要修改的配置字段');
    const allowed=new Map(fields.map(f=>[f.key,f])); const result:Record<string,string>={};
    for(const [key,value] of Object.entries(raw)) {
      if(!allowed.has(key)||typeof value!=='string'||value.length>8192||/[\0\r\n]/.test(value))throw new Error(`配置字段无效：${key}`);
      const field=allowed.get(key)!;
      if(value&&field.type==='model'&&!Object.entries(modelHarnesses).some(([model])=>reasoningEfforts.some(e=>value===`${model}-${e}`)))throw new Error(`${field.label} 需要选择支持的模型与力度`);
      if(value&&field.type==='image'&&!Object.hasOwn(imageModelProviders,value))throw new Error(`${field.label} 需要选择支持的生图模型`);
      if(field.options&&!field.options.includes(value))throw new Error(`${field.label} 的选项无效`);
      if(value&&field.type==='boolean'&&!['true','false'].includes(value))throw new Error(`${field.label} 需要选择开启或关闭`);
      result[key]=value;
    }
    return result;
  }
  async function draft(value:{revision?:unknown;changes?:unknown}) {
    const current=await source(), revision=digest(current.text,current.exists);
    if(value.revision!==revision)throw new EnvironmentConflict('配置已被其他窗口或编辑器更新，请重新读取后再保存。');
    const {fields,template}=await schema(), edits=changes(value.changes,fields);
    const text=patchEnvironment(current.exists?current.text:template,edits);
    // Validate with the worker resolver, without modifying the live file.
    parseWorkflowEnvironment(text,env,directory);
    const report=await describe(text,true,revision);
    for(const [key,newValue] of Object.entries(edits)) if(key.startsWith('layering_agent_')&&newValue&&newValue!==envValues(current.text)[key]) {
      const model=report.models.find(m=>newValue.startsWith(m.id+'-'));
      if(model&&!model.available)throw new Error(model.detail);
      if(model&&!model.allowed)throw new Error(`${model.id} 未包含在该 CLI 的可用模型列表中，请同时调整模型列表。`);
    }
    return {current,revision,text,report};
  }
  return {
    async read() {const current=await source();return describe(current.text,current.exists,digest(current.text,current.exists));},
    async preview(value:{revision?:unknown;changes?:unknown}) {return (await draft(value)).report;},
    async save(value:{revision?:unknown;changes?:unknown}) {
      const previous=queues.get(file)??Promise.resolve();
      const operation=previous.catch(()=>{}).then(async()=>{
        const next=await draft(value), current=await source();
        if(digest(current.text,current.exists)!==next.revision)throw new EnvironmentConflict('配置已更新，请重新读取后再保存。');
        const temporary=`${file}.${randomUUID()}.tmp`;
        try {await writeFile(temporary,next.text,{mode:0o600,flag:'wx'});await rename(temporary,file);}finally{await rm(temporary,{force:true});}
        return describe(next.text,true,digest(next.text,true));
      });
      queues.set(file,operation);
      try{return await operation;}finally{if(queues.get(file)===operation)queues.delete(file);}
    },
  };
}
