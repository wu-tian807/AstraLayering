import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { taskDirectory } from '../shared/paths.ts';
import { optional, json } from './input.ts';
import { simulate } from './evidence.ts';
import { renderFrames } from './render.ts';
const {values}=parseArgs({options:{name:{type:'string'},dir:{type:'string'},test:{type:'string'},steps:{type:'string'},mode:{type:'string'},simulate:{type:'boolean'}}});
if(!values.name)throw Error('需要 --name');
const directory=join(taskDirectory(values.name,values.dir),'physics'),config=await optional(join(directory,'physics.draft.json'))||await optional(join(directory,'physics.json'))||await json(join(directory,'step02/physics.draft.json'));
if(values.simulate)console.log(await simulate(config,join(directory,'step03/evidence')));
if(values.test){const steps=(values.steps||'0,60,96,180,360,960').split(',').map(Number),source=await optional(join(directory,'preview/catalog.json'))?join(directory,'preview'):join(directory,'source');console.log(await renderFrames(config,source,join(directory,'step03/evidence'),[{test:values.test,steps,modes:(values.mode||'color,lit').split(',')}]));}
console.log('统一预览工作台：/studio?project='+encodeURIComponent(values.name)+'&workspace=physics');
