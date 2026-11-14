import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nativeAuthentication } from '../environment-auth.ts';

test('native credentials expose type and presence without contents or subscription-plan claims',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'astra-auth-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const env={CODEX_HOME:directory,CLAUDE_CONFIG_DIR:directory,ANTIGRAVITY_GEMINI_DIR:directory};
 await writeFile(join(directory,'auth.json'),JSON.stringify({tokens:{access_token:'SECRET_CODEX',account_id:'PRIVATE_ACCOUNT'}}));
 await writeFile(join(directory,'.credentials.json'),JSON.stringify({claudeAiOauth:{accessToken:'SECRET_CLAUDE',subscriptionType:'plan'}}));
 await writeFile(join(directory,'oauth_creds.json'),JSON.stringify({refresh_token:'SECRET_AGV'}));
 for(const harness of ['codex','claude','agv'] as const)assert.deepEqual(await nativeAuthentication(harness,env),{kind:'account',configured:true});
 const api=await nativeAuthentication('codex',{...env,OPENAI_API_KEY:'SECRET_API'});
 assert.deepEqual(api,{kind:'api',configured:true,sourceKey:'OPENAI_API_KEY'});assert.ok(!JSON.stringify(api).includes('SECRET'));
 await writeFile(join(directory,'settings.json'),JSON.stringify({apiKeyHelper:'unused-command'}));
 assert.deepEqual(await nativeAuthentication('claude',env),{kind:'api',configured:true});
});

test('missing or invalid credentials stay unconfirmed and native cloud routes are not labelled subscriptions',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'astra-auth-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 const env={CODEX_HOME:directory,CLAUDE_CONFIG_DIR:directory,ANTIGRAVITY_GEMINI_DIR:directory};
 for(const harness of ['codex','claude','agv'] as const)assert.deepEqual(await nativeAuthentication(harness,env),{kind:'unknown',configured:false});
 await writeFile(join(directory,'auth.json'),'invalid JSON');assert.deepEqual(await nativeAuthentication('codex',env),{kind:'unknown',configured:false});
 await writeFile(join(directory,'.credentials.json'),JSON.stringify({claudeAiOauth:{accessToken:'SECRET'}}));
 await writeFile(join(directory,'settings.json'),JSON.stringify({env:{CLAUDE_CODE_USE_BEDROCK:'1'}}));
 assert.deepEqual(await nativeAuthentication('claude',env),{kind:'unknown',configured:false});
});
