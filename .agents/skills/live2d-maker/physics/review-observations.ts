// Current workflow reviewers own their actual image observations. Historical
// pre-scope reviews remain readable; they do not become newly scoped reviews.
export const observationScopeVersion = 1;
export function scopedObservations(viewed: any[], session: any, findings?: any): any[] {
  if (session?.observationScopeVersion === undefined) return viewed;
  if (session.observationScopeVersion !== observationScopeVersion || !session.id)
    throw Error('未知的独立复核看图记录版本');
  if (findings && (findings.reviewSession !== session.id || findings.configHash !== session.configHash))
    throw Error('结论不是当前独立复核会话及配置');
  return viewed.filter(view => view.reviewSession === session.id);
}
