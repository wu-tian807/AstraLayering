// Source members make an isolated clipping island resolve to the original
// painted parts. A whole island may share a field only when unambiguous.
export function resolveComponentBindings(config,layers) {
  const assignments=new Map(),issues=[],compatible=new Set();
  for(const c of config.components){
    const resolved=[];let reason='';
    for(const ref of c.layerRefs){
      const layer=layers.find(l=>l.uuid===ref.uuid&&l.contentHash===ref.contentHash)||layers.find(l=>l.sourceLayers?.some(r=>r.uuid===ref.uuid&&r.contentHash===ref.contentHash));
      if(!layer){reason='原层缺失、像素已改变或合成结构不同';break;}
      const shadows=new Set(layer.projection?.shadows?.map(s=>s.shadowLayerUuid)||[]);
      if(layer.composited&&layer.sourceLayers?.some(r=>!shadows.has(r.uuid)&&!c.layerRefs.some(ref=>ref.uuid===r.uuid))){reason='隔离组包含未绑定成员，不能让整组继承单个部件运动';break;}
      resolved.push(layer);
    }
    if(!reason){for(const l of resolved){const old=assignments.get(l.id);if(old&&old!==c.id){reason='隔离组包含不同运动场，需要拆分原生组';issues.push({component:old,reason});compatible.delete(old);}else assignments.set(l.id,c.id);}if(!reason)compatible.add(c.id);}
    if(reason)issues.push({component:c.id,reason});
  }
  for(const[id,component]of assignments)if(!compatible.has(component))assignments.delete(id);
  return {assignments,issues,compatible};
}
