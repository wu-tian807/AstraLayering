// Coverage describes author decisions, not a name-based automatic rig.
export const coverageVersion = 1;
export const motionFamilies = ['hair', 'fabric', 'accessory', 'other'] as const;
export function validateMotionScope(plan: any, profile: string) {
  if (plan.version !== 2) throw Error('物理分析需使用 version:2，逐 part 记录 motion.family/region/freedom');
  for (const part of plan.parts) {
    const m = part.motion;
    if (!m || !motionFamilies.includes(m.family) || !m.region?.trim() || !['free','fixed','follow','uncertain'].includes(m.freedom))
      throw Error('缺少实际活动区判断：' + part.id);
    if (m.freedom === 'fixed' && part.decision !== 'excluded') throw Error('无自由段的部件应固定随动作，不独立绑定：' + part.id);
    if (part.decision === 'bind' && !['free','follow'].includes(m.freedom)) throw Error('未确认自由段或共享运动，不能绑定：' + part.id);
    if (part.decision === 'defer') {
      if (!['profile-secondary','uncertain-connection','unsupported-topology'].includes(part.deferCode) || !part.reason?.trim())
        throw Error('暂缓必须明确范围、连接或拓扑原因：' + part.id);
      if (profile === 'all' && part.deferCode === 'profile-secondary') throw Error('all 不能因部件小或属于头发/挂件而跳过：' + part.id);
      if (part.deferCode === 'unsupported-topology' && !part.unsupportedTopology?.trim()) throw Error('暂缓需说明无法表达的实际连接，不能把硬环一律当动态闭环：' + part.id);
    }
  }
}
export function coverageReport(plan: any, config?: any) {
  const rows = new Map<string, any>();
  for (const p of plan.parts) {
    const m=p.motion, key=m.family+'\0'+m.region;
    const row=rows.get(key)||{family:m.family,region:m.region,parts:[],bound:[],deferred:[],fixed:[]};
    row.parts.push(p.id);
    if (p.decision === 'bind') {
      const owner=plan.components.find((c:any)=>c.sourcePartIds.includes(p.id));
      const enabled=config?.components.find((c:any)=>c.id===owner?.id)?.enabled;
      row.bound.push({part:p.id,component:owner?.id,enabled:config?!!enabled:undefined,freedom:m.freedom});
    } else if(p.decision==='defer')row.deferred.push({part:p.id,code:p.deferCode,reason:p.reason});
    else row.fixed.push({part:p.id,reason:p.reason});
    rows.set(key,row);
  }
  return {version:coverageVersion,regions:[...rows.values()]};
}
