import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { StepDefinition } from '../shared/raster/steps.ts';
import type { PhysicsInput } from './input.ts';
export const steps=[
  {id:'step01',title:'组件、连接与活动区分析',model:'gpt-6.1-sol',effort:'high',modelStep:'physics_analysis',prompt:new URL('prompts/analysis.md',import.meta.url),requiredFiles:['analysis.json','coverage.json','report.md']},
  {id:'step02',title:'装配制作与有限标定',model:'gpt-6.1-sol',effort:'xhigh',modelStep:'physics_authoring',freshSession:true,prompt:new URL('prompts/authoring.md',import.meta.url),requiredFiles:['physics.draft.json','assemblies.json','tuning.json','coverage.json','report.md']},
  {id:'step03',title:'连续动画模拟与独立复核',model:'gpt-6.1-sol',effort:'xhigh',modelStep:'physics_review',freshSession:true,allowsEarlyArtifacts:true,prompt:new URL('prompts/review.md',import.meta.url),requiredFiles:['physics.json','findings.json','evidence/manifest.json','report.md']},
] as const satisfies readonly StepDefinition[];
export async function buildPrompt(step:StepDefinition,input:PhysicsInput,output:string) {
  return `${await readFile(step.prompt,'utf8')}\n${await readFile(new URL('guide.md',import.meta.url),'utf8')}\n本次管线：${dirname(output)}；输出：${output}。范围 ${input.profile}。显式运动参考：${input.referencePhysics??'未提供；按通用配方初始化'}。源工程与 PNG 只读：${input.document}、${input.color}。catalog 与原尺寸部件图：${join(dirname(output),'source')}。使用 physics_* 工具，绝不重画皮套。已有组件缓存：${join(input.task,'physics.components-cache.json')}；只复用 UUID、指纹、实际支撑都匹配的绑定，重新验证运动。若 ${join(input.task,'physics-recovery/handoff.md')} 存在，读取同源续跑交接；其中草稿仅为来源和未验收候选参考，不替代当前模拟、渲染或看图。必须产出 ${step.requiredFiles.join('、')}。只修改本步骤；仅制作 B 可改 step02 草稿，复核 C 不可修改 B 配置。不改上游、另一管线、管线 run.json 或完成标记。最后返回 status、summary。C 发现失败须调用 physics_request_repair 并返回 blocked，调度器交回 B；不能直接改草稿或把数值通过写成自然效果通过。`;
}
