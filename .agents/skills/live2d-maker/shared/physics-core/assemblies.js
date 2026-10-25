// Assembly identity follows component IDs, never layer order or pixel area.
// A directed support remains directed in links; weak connectivity defines the
// complete group that must be simulated together.
export function groupAssemblies(config) {
  const components=config.components||[],byId=new Map(components.map(c=>[c.id,c])),parent=new Map(components.map(c=>[c.id,c.id]));
  const root=id=>{let p=parent.get(id);while(p!==parent.get(p))p=parent.get(p);let n=id;while(parent.get(n)!==p){const next=parent.get(n);parent.set(n,p);n=next;}return p;};
  const unite=(a,b)=>{const x=root(a),y=root(b);if(x!==y)parent.set(x<y?y:x,x<y?x:y);};
  const links=[],layers=new Map();
  for(const c of components){
    for(const s of c.supports||[])if(s.componentId&&byId.has(s.componentId)){unite(c.id,s.componentId);links.push({parent:s.componentId,child:c.id,supportId:s.id,at:s.at});}
    for(const ref of c.layerRefs||[]){const old=layers.get(ref.uuid);if(old)unite(old,c.id);else layers.set(ref.uuid,c.id);}
  }
  const sets=new Map();for(const c of components){const id=root(c.id);if(!sets.has(id))sets.set(id,[]);sets.get(id).push(c);}
  return [...sets.values()].map(members=>{
    const componentIds=members.map(c=>c.id).sort(),inside=new Set(componentIds),groupLinks=links.filter(l=>inside.has(l.child));
    return {id:'assembly:'+componentIds.map(encodeURIComponent).join('|'),componentIds,
      roots:componentIds.filter(id=>!groupLinks.some(l=>l.child===id)),links:groupLinks,
      layerUuids:[...new Set(members.flatMap(c=>(c.layerRefs||[]).map(r=>r.uuid)))].sort(),
      enabledComponentIds:members.filter(c=>c.enabled).map(c=>c.id).sort()};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
