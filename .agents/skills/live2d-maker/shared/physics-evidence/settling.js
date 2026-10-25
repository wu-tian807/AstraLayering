// A serial chain can still be driven by its physical parent after external
// input ends. Keep the input episode unchanged and measure its free decay.
export const settlingVersion='astra-physics-settling-3';
export function recoveryBudgetSteps(config) {
  const byId=new Map(config.components.filter(c=>c.enabled).map(c=>[c.id,c])),cache=new Map();
  const time=c=>{if(cache.has(c.id))return cache.get(c.id);const parent=Math.max(0,...c.supports.map(s=>byId.has(s.componentId)?time(byId.get(s.componentId)):0));const t=parent+4/(2*Math.PI*c.response.frequencyHz*c.response.dampingRatio);cache.set(c.id,t);return t;};
  return Math.ceil(Math.max(4,Math.min(20,Math.max(0,...[...byId.values()].map(time))))*120);
}
export function recoveryState(body, peak, visibleTravel=body.stats.travel) {
  // Require an interval near rest, not an isolated zero-crossing. Check the
  // internal pendulum state too; an output bound cannot hide stored energy.
  const tolerance=Math.max(.1,peak*.02),travel=Math.max(body.stats.travel,visibleTravel);
  const internalSpeed=body.kind==='pendant'?Math.abs(body.motion.speed||0)*body.freeLength:Math.max(0,...body.velocity.map(Math.abs));
  return {travel,internalSpeed,tolerance,quiet:body.stats.valid&&!body.stats.fallback&&travel<=tolerance&&internalSpeed<=Math.max(.1,tolerance)};
}

export function recoveryProofValid(recovery, durationSteps) {
  return recovery?.version===settlingVersion&&recovery.passed===true&&recovery.startStep===960&&
    recovery.endStep===durationSteps&&durationSteps>=1019&&recovery.quietSteps>=60&&
    recovery.fallbackSteps===0&&Number.isFinite(recovery.final)&&Number.isFinite(recovery.internalSpeed)&&
    Number.isFinite(recovery.tolerance)&&recovery.tolerance>=.1&&recovery.final<=recovery.tolerance&&
    recovery.internalSpeed<=Math.max(.1,recovery.tolerance);
}
