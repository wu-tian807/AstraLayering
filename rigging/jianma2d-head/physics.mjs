import {evaluatePoint,clamp,physicsAnchor} from './deformer.mjs';
/** Two damped masses drive authored strand bend modes. Roots never receive inertia.
 * Same input/output separation as Cubism physics; this is our solver, not Cubism's. */
// Exact damped spring over a linearly moving target. Small substeps only
// approximate the coupling between the two masses, not the spring integration.
function spring(x,velocity,start,end,h,omega,damping){
 if(!h)return [x,velocity];
 const drive=(end-start)/h,a=damping*omega,b=omega*Math.sqrt(1-damping*damping);
 const u=x-start+2*damping*drive/omega,v=velocity-drive;
 const e=Math.exp(-a*h),c=Math.cos(b*h),s=Math.sin(b*h),q=(v+a*u)/b;
 const next=e*(u*c+q*s),speed=e*((-a*u+b*q)*c+(-a*q-b*u)*s);
 return [end-2*damping*drive/omega+next,drive+speed];
}
export class HeadPhysics {
 constructor(rig){this.rig=rig;this.enabled=true;this.states={};this.outputs={};this.reset({x:0,y:0,z:0});}
 driver(kind,p){const s=this.rig.physics.strands[kind],a=physicsAnchor(kind,this.rig),q=evaluatePoint(...a,s.driver?.kind||kind,p,this.rig),z=p.z*Math.PI/180;return [q[0]+Math.sin(z)*s.rollLever,q[1]+(1-Math.cos(z))*s.rollLever];}
 reset(p){for(const kind of Object.keys(this.rig.physics.strands)){const q=this.driver(kind,p);this.states[kind]={a:q.slice(),b:q.slice(),va:[0,0],vb:[0,0],driver:q};this.outputs[kind]=[0,0,0,0];}this.energy=0;}
 advance(p,seconds){
  if(!this.enabled||seconds>.25){this.reset(p);return false;}
  const dt=clamp(seconds,0,this.rig.physics.maxCatchup),steps=Math.max(1,Math.ceil(dt/this.rig.physics.step)),h=dt/steps;
  let energy=0;
  for(const [kind,s] of Object.entries(this.rig.physics.strands)){
   const st=this.states[kind],target=this.driver(kind,p),old=st.driver,omega=s.frequency*Math.PI*2;
   for(let j=1;j<=steps;j++)for(let k=0;k<2;k++){
    const t0=old[k]+(target[k]-old[k])*(j-1)/steps,t1=old[k]+(target[k]-old[k])*j/steps,previous=st.a[k];
    [st.a[k],st.va[k]]=spring(st.a[k],st.va[k],t0,t1,h,omega,s.damping);
    [st.b[k],st.vb[k]]=spring(st.b[k],st.vb[k],previous,st.a[k],h,omega*.80,s.damping);
   }
   st.driver=target;const out=this.outputs[kind];
   for(let k=0;k<2;k++){
    const scale=s.outputScale?.[k]??1;
    out[k]=clamp(st.a[k]-target[k],-s.maxOffset,s.maxOffset)*scale;
    out[k+2]=clamp(st.b[k]-target[k],-s.maxOffset,s.maxOffset)*scale;
    energy=Math.max(energy,Math.abs(st.va[k])*.03,Math.abs(st.vb[k])*.03,Math.abs(out[k]),Math.abs(out[k+2]));
   }
  }
  this.energy=energy;if(energy<this.rig.physics.threshold){this.reset(p);return false;}return true;
 }
}
