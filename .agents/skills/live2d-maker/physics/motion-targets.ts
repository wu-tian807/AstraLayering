export const motionTargetVersion='astra-physics-motion-target-3';
const rms=(samples:any[])=>Math.sqrt(samples.reduce((s,p)=>s+(p.visibleTravel??p.travel)**2,0)/Math.max(1,samples.length));
export function compareMotionTarget(component:any,metric:any,referenceComponent:any,referenceMetric:any){
  const scale=component.authoring.freeLength/referenceComponent.authoring.freeLength;
  const targetPeak=(referenceMetric.visiblePeak??referenceMetric.peak)*scale,targetRms=rms(referenceMetric.samples)*scale,currentRms=rms(metric.samples);
  const ratios={peak:targetPeak>.05?(metric.visiblePeak??metric.peak)/targetPeak:1,activity:targetRms>.025?currentRms/targetRms:1};
  // An accepted preview is a starting point, not proof that every stress
  // episode is safe. Never demand reproduction of a measured reference defect.
  const issues:string[]=[];
  const freeLengthRatio=component.authoring.freeLength/referenceComponent.authoring.freeLength;
  if(component.layerRefs.length===referenceComponent.layerRefs.length&&component.layerRefs.every((r:any)=>referenceComponent.layerRefs.some((v:any)=>v.uuid===r.uuid&&v.contentHash===r.contentHash))&&freeLengthRatio<.75)issues.push('reference-free-region');
  if(referenceMetric.referenceAssemblyIssues?.length||referenceMetric.issues?.length)return {version:motionTargetVersion,referenceComponent:referenceComponent.id,ratios,targetPeak,targetRms,freeLengthRatio,currentRms,issues,envelopeLoss:0,usable:false,reason:'reference-motion-issues',referenceIssues:referenceMetric.referenceAssemblyIssues??referenceMetric.issues};
  // Upper/lower bounds preserve visible movement; zero motion cannot win on smoothness.
  // Ratios below a tenth of a source pixel are not a meaningful visual target.
  // The independent weak-response gate still rejects invisible movement.
  if(targetPeak>.05&&(ratios.peak<.8||ratios.peak>1.3)&&Math.abs((metric.visiblePeak??metric.peak)-targetPeak)>.1)issues.push('reference-amplitude');
  if(targetRms>.025&&(ratios.activity<.8||ratios.activity>1.3)&&Math.abs(currentRms-targetRms)>.1)issues.push('reference-activity');
  const envelopeLoss=Math.abs(Math.log(Math.max(.001,ratios.peak)))+Math.abs(Math.log(Math.max(.001,ratios.activity)));
  return {version:motionTargetVersion,referenceComponent:referenceComponent.id,targetPeak,targetRms,ratios,freeLengthRatio,envelopeLoss,issues,usable:true};
}
export function matchTargetComponent(component:any,reference:any){
  return reference.components.find((c:any)=>c.enabled&&c.kind===component.kind&&c.sourcePartIds.length===component.sourcePartIds.length&&c.sourcePartIds.every((id:string)=>component.sourcePartIds.includes(id)));
}
