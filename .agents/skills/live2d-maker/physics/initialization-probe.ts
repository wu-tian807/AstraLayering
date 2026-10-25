// Independent numerical probes of the parameter recipes, without a workbench
// or character reference. Synthetic geometry does not constitute art approval.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {parseArgs} from 'node:util';
import {componentDefaults,validatePhysicsConfig} from '../shared/physics-core/component-physics-schema.js';
import {motionPresets,motionPresetVersion,initializeMotionParameters} from '../shared/physics-core/motion-presets.js';
import {groupAssemblies} from '../shared/physics-core/assemblies.js';
import {simulate,simulationHash,configHash} from '../shared/physics-evidence/store.ts';
import {calibrate,selectCandidate} from './calibration.ts';

const {values}=parseArgs({options:{output:{type:'string'},scales:{type:'string',default:'0.5,1,2'},repair:{type:'boolean',default:false},cases:{type:'string'}}});
if(!values.output)throw Error('Use --output <diagnostic directory>; this command never publishes physics.json');
const output=resolve(values.output),scales=values.scales!.split(',').map(Number);
if(!scales.length||scales.some(s=>!Number.isFinite(s)||s<.25||s>3))throw Error('Probe scales must be in [0.25,3]');
const wanted=values.cases?.split(',');
const available=motionPresets.flatMap(p=>scales.map(s=>p.id+'-'+s));
if(wanted?.some(id=>!available.includes(id)))throw Error('Unknown probe case; use <preset>-<scale>');
await mkdir(output,{recursive:true});
const solverHash=await simulationHash(),results:any[]=[];
const lengthFor=(preset:any)=>preset.length??(preset.kind==='pendant'?120:500);
function geometry(preset:any,scale:number){
  const L=lengthFor(preset)*scale,x=L*.65,y=L*.12,w=L*(preset.kind==='cloth'?.5:.12);
  const point=(dx:number,dy:number)=>[x+dx*L,y+dy*L];
  const fixed=[point(-.6,-.12),point(.6,-.12),point(.6,.05),point(-.6,.05)];
  const common={id:'probe-'+preset.id,name:preset.id,kind:preset.kind,priority:'primary',enabled:true,
    layerRefs:[{uuid:'synthetic-'+preset.id,contentHash:'synthetic-geometry-v1'}],sourcePartIds:['synthetic:'+preset.id],
    supports:[{id:'root',at:[x,y]}],...componentDefaults(preset.kind)};
  let authoring:any={freeLength:L,transitionPixels:L*.1,fixedRegions:[fixed]};
  if(preset.kind==='strand')authoring={...authoring,centerline:[point(0,0),point(.025,.2),point(.05,.45),point(.02,.7),point(-.015,1)],widths:[w,w,w*.9,w*.65,w*.35]};
  else if(preset.kind==='cloth')authoring={...authoring,controlGrid:[4,8],subdivisions:2,
    contour:[point(-.25,-.04),point(.25,-.04),point(.29,.35),point(.36,.9),point(.25,1),point(-.28,1),point(-.32,.65),point(-.24,.3)]};
  else authoring={freeLength:L,pivot:[x,y],contour:[point(-.08,0),point(.08,0),point(.25,.75),point(.18,1),point(-.18,1),point(-.25,.75)]};
  return validatePhysicsConfig({kind:'astra-component-physics',version:1,solver:'astra-component-physics-1',
    source:{canvas:{width:Math.ceil(L*1.5),height:Math.ceil(L*1.4)},origin:'synthetic-initialization-probe-v1'},
    components:[initializeMotionParameters({...common,authoring},preset.id)]});
}
for(const preset of motionPresets)for(const scale of scales){
  const id=preset.id+'-'+scale;if(wanted&&!wanted.includes(id))continue;
  const folder=join(output,id);await mkdir(folder,{recursive:true});
  let config=geometry(preset,scale);const original=structuredClone(config),assembly=groupAssemblies(config)[0];
  const calibration=await calibrate(config,folder,assembly.id,'Synthetic recipe/scale probe; preserve an eligible baseline',undefined,undefined,undefined,{preserveEligibleBaseline:true});
  let selected=calibration.round.recommendedCandidate,finalCalibration=calibration;
  if(!selected&&values.repair){
    const c=config.components[0],r=c.response,weak=calibration.round.candidates[0].issues.some((v:string)=>v.includes('weak-response'));
    const decay={frequencyHz:Math.min(6,r.frequencyHz*1.15),dampingRatio:Math.min(1.5,r.dampingRatio*1.6)};
    const required=Math.max(.05,c.authoring.freeLength*c.limits.maxTravel*.005);
    const weakMetrics=Object.values(calibration.round.candidates[0].metrics).map((m:any)=>m[c.id]).filter((m:any)=>m.issues.includes('weak-response'));
    const factor=Math.max(1.5,...weakMetrics.map((m:any)=>required/Math.max(.005,m.visiblePeak)*1.15));
    const drive:any={inputGain:Math.min(2,r.inputGain*factor)};
    if(c.kind==='strand')drive.outputGain=Math.min(8,(r.outputGain??1)*2);
    const candidates=[{id:'decay-envelope',parameters:{[c.id]:{response:decay}}},
      {id:'visible-drive',parameters:{[c.id]:{response:drive}}},
      {id:'balanced-envelope',parameters:{[c.id]:{response:{...decay,...(weak?drive:{})}}}}];
    finalCalibration=await calibrate(config,folder,assembly.id,'Recipe boundary: finite response candidates; retain geometry and maximum constraints',candidates);
    selected=finalCalibration.round.recommendedCandidate;
  }
  if(selected)config=await selectCandidate(config,folder,assembly.id,selected,'Program-selected eligible candidate; visual approval remains unreviewed');
  if(JSON.stringify(config.components[0].authoring)!==JSON.stringify(original.components[0].authoring)||JSON.stringify(config.components[0].limits)!==JSON.stringify(original.components[0].limits))throw Error('Probe calibration changed authored geometry or maximum constraints');
  await writeFile(join(folder,'probe.config.json'),JSON.stringify(config,null,2));
  let manifest:any;
  try{
    const cached=JSON.parse(await readFile(join(folder,'evidence/manifest.json'),'utf8'));
    if(cached.configHash===configHash(config)&&cached.simulationHash===solverHash)manifest=cached;
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  manifest??=await simulate(config,join(folder,'evidence'));
  const tests=manifest.runs.map((run:any)=>({test:run.test,durationSteps:run.durationSteps,
    ...run.metrics.motionReview.components[config.components[0].id]}));
  const issues=tests.flatMap((run:any)=>run.issues.map((issue:string)=>run.test+': '+issue));
  const result={id,preset:preset.id,scale,freeLength:config.components[0].authoring.freeLength,configHash:configHash(config),
    selectedCandidate:selected,baselineEligible:calibration.round.candidates[0].eligible,
    calibrationIssues:calibration.round.candidates[0].issues,
    repairRequested:values.repair,calibrationRounds:finalCalibration.round.round,
    responseChanges:finalCalibration.round.candidates.find((c:any)=>c.id===selected)?.changes??[],
    geometryAndLimitsPreserved:true,numericallyEligible:issues.length===0,issues,tests};
  results.push(result);console.log(JSON.stringify({id,selectedCandidate:selected,numericallyEligible:result.numericallyEligible,issues}));
  await writeFile(join(output,'summary.json'),JSON.stringify({version:1,motionPresetVersion,solverHash,
    purpose:'Synthetic geometry and parameter diagnostics; no character-semantic, visual or human approval',
    scales,repairRequested:values.repair,results,visual:'unreviewed',human:'unreviewed'},null,2));
}
console.log(JSON.stringify({output,cases:results.length,numericallyEligible:results.filter(r=>r.numericallyEligible).length,
  failures:results.filter(r=>!r.numericallyEligible).map(r=>({id:r.id,issues:r.issues})),visual:'unreviewed'}));
