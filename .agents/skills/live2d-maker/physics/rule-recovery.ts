import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fingerprint,json,optional,put,ruleBaseline,type PhysicsInput,type RuleBaseline} from './input.ts';

// Prove the old digest using current source bytes before preserving analysis.
// This never writes a completed marker or a review verdict.
export async function resumeRuleUpdate(input:PhysicsInput,directory:string,baseline:RuleBaseline,validate:()=>Promise<void>){
  const run=await json(join(directory,'run.json')),current=await fingerprint(input);
  if(run.inputFingerprint===current)return {status:'current' as const};
  if(run.inputFingerprint!==await fingerprint(input,baseline))throw Error('规则恢复拒绝：源图、groups、范围或参考与原任务不一致，或提供的旧规则基线不匹配');
  await validate();
  const archive=join(directory,'recovery','rules-'+randomUUID());
  await put(join(archive,'run-before.json'),run);
  await put(join(archive,'rules-before.json'),baseline);
  await put(join(archive,'rules-after.json'),await ruleBaseline());
  await put(join(archive,'migration.json'),{version:1,reason:'Explicit rule maintenance; all source inputs match the previous fingerprint',previousFingerprint:run.inputFingerprint,inputFingerprint:current,at:new Date().toISOString(),analysisValidated:true,bindingsValidated:!!await optional(join(directory,'step02/physics.draft.json')),reviewAcceptanceInherited:false});
  await put(join(directory,'run.json'),{...run,inputFingerprint:current,sourceInput:input});
  return {status:'migrated' as const,archive};
}
