import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {preparePrivateKrita} from '../krita/private-environment.ts';
for (const platform of ['darwin','linux','win32'] as const) test(`private Krita isolation: ${platform}`,async t=>{
 const root=await mkdtemp(join(tmpdir(),'private-krita-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const source=join(root,'source.py');await writeFile(source,'# fixture');
 const inherited={HOME:'/real-home',CFFIXED_USER_HOME:'/real-cf-home',DISPLAY:':3',KEEP:'yes'};
 const before={...inherited};
 const {config,resource,env}=await preparePrivateKrita(root,'probe',source,inherited,platform);
 assert.deepEqual(inherited,before);assert.equal(env.KEEP,'yes');assert.equal(env.DISPLAY,':3');
 assert.equal(await readFile(join(resource,'pykrita/probe/__init__.py'),'utf8'),'# fixture');
 assert.match(await readFile(join(config,'kritarc'),'utf8'),/enable_probe=true/);
 if(platform==='darwin'){
  assert.equal(env.HOME,root);assert.equal(env.CFFIXED_USER_HOME,root);
  assert.equal(config,join(root,'Library/Preferences'));assert.equal(resource,join(root,'Library/Application Support/krita'));
 }else{assert.equal(env.HOME,inherited.HOME);assert.equal(env.XDG_CONFIG_HOME,join(root,'config'));}
 await assert.rejects(preparePrivateKrita(root,'../escape',source,inherited,platform),Error);
});
