import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,validateProfile} from '../tools.ts';
import {coverageReport} from '../coverage.ts';
const catalog={parts:['cap','front','cloth','ear'].map(id=>({id})),layers:['cap','front','cloth','ear'].map(id=>({partPath:id,uuid:'uuid-'+id}))};
const make=()=>({version:2,parts:[
 {id:'cap',decision:'excluded',reason:'贴头发盖，没有自由段',motion:{family:'hair',region:'发盖',freedom:'fixed'}},
 {id:'front',decision:'bind',reason:'贴头根固定，外侧尾段自由',motion:{family:'hair',region:'前侧发',freedom:'free'}},
 {id:'cloth',decision:'bind',reason:'腰口固定，下摆自由',motion:{family:'fabric',region:'裙摆',freedom:'free'}},
 {id:'ear',decision:'bind',reason:'耳钉下的短颈与硬坠',motion:{family:'accessory',region:'耳坠',freedom:'free'}}],
 components:['front','cloth','ear'].map(id=>({id,name:id,kind:id==='front'?'strand':id==='ear'?'pendant':'cloth',priority:'primary',sourcePartIds:[id],layerUuids:['uuid-'+id],connection:'实际源层连接'}))});
const config=(plan:any)=>({components:plan.components.map((c:any)=>({id:c.id,enabled:true,sourcePartIds:c.sourcePartIds,layerRefs:c.layerUuids.map((uuid:string)=>({uuid}))}))});
test('源活动区覆盖前侧发、衣物和小硬坠，固定发盖不加入物理',async()=>{
 const p=make();await validatePlan(p,catalog);await validateProfile(config(p),p,'all');
 const rows=coverageReport(p,config(p)).regions;
 assert.deepEqual(rows.map(r=>[r.region,r.bound.length,r.fixed.length]),[['发盖',0,1],['前侧发',1,0],['裙摆',1,0],['耳坠',1,0]]);
});
test('all 不接受因体积小将挂件留给另一个范围，真实未知连接可暂缓',async()=>{
 const p:any=make();p.components.pop();const ear=p.parts.at(-1);ear.decision='defer';ear.deferCode='profile-secondary';
 await assert.rejects(validatePlan(p,catalog,'all'),/all 不能/);await validatePlan(p,catalog,'primary');
 ear.deferCode='uncertain-connection';ear.motion.freedom='uncertain';await validatePlan(p,catalog,'all');
 ear.deferCode='unsupported-topology';await assert.rejects(validatePlan(p,catalog),/实际连接/);
 ear.unsupportedTopology='一张源层存在两个相互独立的活动区';await validatePlan(p,catalog);
});
test('不能通过绑定整片固定头发或省掉源 part 满足覆盖',async()=>{
 const p:any=make();p.parts[0].decision='bind';await assert.rejects(validatePlan(p,catalog),/无自由段/);
 const missing=make();missing.parts.pop();await assert.rejects(validatePlan(missing,catalog),/一一对应/);
 const duplicate=make();duplicate.components.push({...duplicate.components[0],id:'another'});await assert.rejects(validatePlan(duplicate,catalog),/唯一组件场/);
});
test('同名组件换错原层、或绑定阶段漏做挂件时不放行',async()=>{
 const p=make();const wrong=make();wrong.components[0].layerUuids=['uuid-cloth'];await assert.rejects(validatePlan(wrong,catalog),/实际图层来源/);
 const c=config(p);c.components.pop();await assert.rejects(validateProfile(c,p,'all'),/漏做/);
 const swapped=config(p);swapped.components[0].layerRefs=[{uuid:'uuid-cloth'}];await assert.rejects(validateProfile(swapped,p,'all'),/不一致/);
});
