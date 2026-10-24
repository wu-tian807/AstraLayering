// Painted projections have their own extent. Extend the caster displacement
// field continuously over that extent; the receiver alpha clips it afterwards.
// This is a bounded 2D follow field, not a new geometric shadow calculation.
export function projectionField(bounds, caster,poseSource) {
  const nx=Math.max(1,Math.min(80,Math.ceil(bounds.width/24))),ny=Math.max(1,Math.min(80,Math.ceil(bounds.height/24)));
  const rest=new Float64Array((nx+1)*(ny+1)*2),positions=new Float64Array(rest.length),indices=[],influences=[];
  const sigma=Math.max(8,(caster?.freeLength||24)*.15);
  for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
    const i=y*(nx+1)+x,px=bounds.x+x*bounds.width/nx,py=bounds.y+y*bounds.height/ny;rest.set([px,py],i*2);
    if(caster){let nearest=Infinity;const distances=[];
      for(let n=0;n<caster.rest.length/2;n++){const d=(caster.rest[n*2]-px)**2+(caster.rest[n*2+1]-py)**2;distances.push(d);nearest=Math.min(nearest,d);}
      const row=[];let sum=0;for(let n=0;n<distances.length;n++){const w=Math.exp(-(distances[n]-nearest)/(sigma*sigma));if(w>.0001){row.push([n,w]);sum+=w;}}
      influences.push(row.map(([n,w])=>[n,w/sum]));
    }
    if(x<nx&&y<ny){const a=i,b=i+1,c=i+nx+1,d=c+1;indices.push(a,b,c,b,d,c);}
  }
  positions.set(rest);
  const poseRest=caster?new Float64Array(caster.rest.length):null;
  return {rest,positions,indices:new Uint32Array(indices),update(){
    if(caster){if(poseSource)for(let i=0;i<caster.rest.length/2;i++)poseRest.set(poseSource.sourcePoint([caster.rest[i*2],caster.rest[i*2+1]]),i*2);else poseRest.set(caster.rest);}
    for(let i=0;i<rest.length/2;i++){let dx=0,dy=0;for(const[n,w]of influences[i]||[]){dx+=(caster.positions[n*2]-poseRest[n*2])*w;dy+=(caster.positions[n*2+1]-poseRest[n*2+1])*w;}const p=poseSource?.sourcePoint([rest[i*2],rest[i*2+1]])||[rest[i*2],rest[i*2+1]];positions[i*2]=p[0]+dx;positions[i*2+1]=p[1]+dy;}
  }};
}
