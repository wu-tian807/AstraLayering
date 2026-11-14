import { readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Harness } from '../.agents/skills/live2d-maker/shared/agents/models.ts';

export type NativeAuthentication = { kind:'account'|'api'|'unknown'; configured:boolean; sourceKey?:string };

// Read only the authentication sources copied by the production adapters.
// Return presence/type, never tokens, account identifiers, or credential paths.
export async function nativeAuthentication(harness:Harness, env:NodeJS.ProcessEnv):Promise<NativeAuthentication> {
  const unknown:NativeAuthentication={kind:'unknown',configured:false};
  const json=async(path:string)=>{
    try { if((await stat(path)).size>256*1024)return;return JSON.parse(await readFile(path,'utf8')); }
    catch { return undefined; }
  };
  const present=(value:unknown)=>typeof value==='string'&&!!value.trim();
  if(harness==='codex') {
    if(present(env.OPENAI_API_KEY))return {kind:'api',configured:true,sourceKey:'OPENAI_API_KEY'};
    const auth=await json(join(env.CODEX_HOME||join(homedir(),'.codex'),'auth.json'));
    if(auth?.auth_mode==='apikey'&&present(auth.OPENAI_API_KEY))return {kind:'api',configured:true};
    if(present(auth?.tokens?.access_token)||present(auth?.tokens?.refresh_token))return {kind:'account',configured:true};
    if(present(auth?.OPENAI_API_KEY))return {kind:'api',configured:true};
  } else if(harness==='claude') {
    const directory=env.CLAUDE_CONFIG_DIR||join(homedir(),'.claude');
    const settings=await json(join(directory,'settings.json'));
    const nativeEnv={...settings?.env,...env};
    if(['CLAUDE_CODE_USE_BEDROCK','CLAUDE_CODE_USE_VERTEX','CLAUDE_CODE_USE_FOUNDRY'].some(key=>/^(true|1)$/.test(nativeEnv[key])))return unknown;
    for(const key of ['ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN'])if(present(nativeEnv[key]))return {kind:'api',configured:true,sourceKey:key};
    if(present(settings?.apiKeyHelper))return {kind:'api',configured:true};
    const auth=await json(join(directory,'.credentials.json'));
    if(present(auth?.claudeAiOauth?.accessToken)||present(auth?.claudeAiOauth?.refreshToken))return {kind:'account',configured:true};
  } else {
    const auth=await json(join(env.ANTIGRAVITY_GEMINI_DIR||env.GEMINI_DIR||join(homedir(),'.gemini'),'oauth_creds.json'));
    if(present(auth?.access_token)||present(auth?.refresh_token))return {kind:'account',configured:true};
  }
  return unknown;
}
