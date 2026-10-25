// SPDX-License-Identifier: GPL-3.0-only
// JavaScript port of psd2live XpbdSolver.kt, commit
// 24b1e87892f0051f1168058e1d60405d88a8a07c. Original source and license alongside.
// Adapter: interleaved Float64 arrays, canvas y-down, no gravity at drawn rest;
// excludes welds/colliders, retains the upstream distance/area/rotation/goal solve.
export class PsdClothSolver {
  constructor(body) {
    this.body=body;this.n=body.mobility.length;
    this.goal=new Float64Array(body.p.length);this.old=new Float64Array(body.p.length);
    this.solved=new Float64Array(body.p.length);
    this.edges=body.edges.filter(e=>e.type!=='bend').map(e=>({...e,rest:Math.hypot(body.pRest[e.i*2]-body.pRest[e.j*2],body.pRest[e.i*2+1]-body.pRest[e.j*2+1])}));
    this.triangles=[];this.bends=[];const adjacent=new Map();
    for(let k=0;k<body.controlIndices.length;k+=3){
      const t={ids:Array.from(body.controlIndices.slice(k,k+3)),inverse:new Float64Array(4),area:0};this.triangles.push(t);
      for(let j=0;j<3;j++){const key=[t.ids[j],t.ids[(j+1)%3]].sort((a,b)=>a-b).join(':');if(adjacent.has(key))this.bends.push([adjacent.get(key),this.triangles.length-1]);else adjacent.set(key,this.triangles.length-1);}
    }
    this.meanLength=this.edges.reduce((s,e)=>s+e.rest,0)/Math.max(1,this.edges.length);
    this.grad=new Float64Array(6);this.turnResult=new Float64Array(2);
    this.bendIds=new Int32Array(6);this.bendGrad=new Float64Array(12);
    this.inverseMass=new Float64Array(this.n);this.decay=new Float64Array(this.n);
    for(let i=0;i<this.n;i++)this.inverseMass[i]=body.invMass(i);
  }
  w(i){return this.inverseMass[i];}
  measureRest(){
    const g=this.goal;
    for(const e of this.edges)e.length=Math.max(e.rest,Math.hypot(g[e.i*2]-g[e.j*2],g[e.i*2+1]-g[e.j*2+1]));
    for(const t of this.triangles){const[a,b,c]=t.ids,m00=g[b*2]-g[a*2],m01=g[c*2]-g[a*2],m10=g[b*2+1]-g[a*2+1],m11=g[c*2+1]-g[a*2+1],det=m00*m11-m01*m10;
      t.area=det/2;if(det*det<1e-12)t.inverse.fill(0);else t.inverse.set([m11/det,-m01/det,-m10/det,m00/det]);}
  }
  distances(h,reverse){
    const b=this.body,p=b.p,m=b.component.material;
    for(let n=0;n<this.edges.length;n++){const e=this.edges[reverse?this.edges.length-1-n:n],a=e.i,c=e.j,wa=this.w(a),wb=this.w(c),w=wa+wb;if(!w)continue;
      const dx=p[a*2]-p[c*2],dy=p[a*2+1]-p[c*2+1],len=Math.hypot(dx,dy);if(len<1e-9)continue;
      const C=len-e.length;
      // Upstream's asymmetric compression is essential for projected folds.
      const compliance=C<0?(m.compressionCompliance??Math.max(.001,m.shearCompliance)):(e.type==='shear'?m.shearCompliance:m.stretchCompliance);
      const delta=-C/(w+compliance/(h*h)),nx=dx/len,ny=dy/len;
      p[a*2]+=wa*delta*nx;p[a*2+1]+=wa*delta*ny;p[c*2]-=wb*delta*nx;p[c*2+1]-=wb*delta*ny;
    }
  }
  area(t,target,alpha,unilateral){
    const p=this.body.p,[a,b,c]=t.ids,wa=this.w(a),wb=this.w(b),wc=this.w(c),sign=Math.sign(t.area);
    const xa=p[a*2],ya=p[a*2+1],xb=p[b*2],yb=p[b*2+1],xc=p[c*2],yc=p[c*2+1];
    const C=sign*((xb-xa)*(yc-ya)-(xc-xa)*(yb-ya))/2-target;if(unilateral&&C>=0)return;
    const ax=sign*(yb-yc)/2,ay=sign*(xc-xb)/2,bx=sign*(yc-ya)/2,by=sign*(xa-xc)/2,cx=sign*(ya-yb)/2,cy=sign*(xb-xa)/2;
    const w=wa*(ax*ax+ay*ay)+wb*(bx*bx+by*by)+wc*(cx*cx+cy*cy);if(w<1e-12)return;
    const d=-C/(w+alpha);p[a*2]+=wa*d*ax;p[a*2+1]+=wa*d*ay;p[b*2]+=wb*d*bx;p[b*2+1]+=wb*d*by;p[c*2]+=wc*d*cx;p[c*2+1]+=wc*d*cy;
  }
  turn(t){
    const p=this.body.p,[a,b,c]=t.ids,[q00,q01,q10,q11]=t.inverse;
    if(!q00&&!q01&&!q10&&!q11)return false;
    const e1x=p[b*2]-p[a*2],e1y=p[b*2+1]-p[a*2+1],e2x=p[c*2]-p[a*2],e2y=p[c*2+1]-p[a*2+1];
    const cs=e1x*q00+e2x*q10+e1y*q01+e2y*q11,sn=e1y*q00+e2y*q10-e1x*q01-e2x*q11,norm=cs*cs+sn*sn;if(norm<1e-12)return false;
    const bx=(-cs*q01-sn*q00)/norm,by=(cs*q00-sn*q01)/norm,cx=(-cs*q11-sn*q10)/norm,cy=(cs*q10-sn*q11)/norm;
    this.grad.set([-bx-cx,-by-cy,bx,by,cx,cy]);this.turnResult.set([cs,sn]);return true;
  }
  rotations(h,reverse){
    const p=this.body.p;const alpha=this.body.component.material.bendCompliance/(this.meanLength*this.meanLength*h*h);
    for(let n=0;n<this.bends.length;n++){
      const [i,j]=this.bends[reverse?this.bends.length-1-n:n],t1=this.triangles[i],t2=this.triangles[j];let count=0;
      if(!this.turn(t1))continue;const cs=this.turnResult[0],sn=this.turnResult[1];
      for(let k=0;k<3;k++){this.bendIds[count]=t1.ids[k];this.bendGrad[count*2]=this.grad[k*2];this.bendGrad[count*2+1]=this.grad[k*2+1];count++;}
      if(!this.turn(t2))continue;
      for(let k=0;k<3;k++){let index=0;while(index<count&&this.bendIds[index]!==t2.ids[k])index++;if(index===count){this.bendIds[count]=t2.ids[k];this.bendGrad[count*2]=0;this.bendGrad[count*2+1]=0;count++;}this.bendGrad[index*2]-=this.grad[k*2];this.bendGrad[index*2+1]-=this.grad[k*2+1];}
      const C=Math.atan2(sn*this.turnResult[0]-cs*this.turnResult[1],cs*this.turnResult[0]+sn*this.turnResult[1]);let w=0;
      for(let k=0;k<count;k++)w+=this.w(this.bendIds[k])*(this.bendGrad[k*2]**2+this.bendGrad[k*2+1]**2);if(w<1e-12)continue;
      const delta=-C/(w+alpha);for(let k=0;k<count;k++){const v=this.bendIds[k],wi=this.w(v);p[v*2]+=wi*delta*this.bendGrad[k*2];p[v*2+1]+=wi*delta*this.bendGrad[k*2+1];}
    }
  }
  step(dt){
    const b=this.body,p=b.p,v=b.velocity,c=b.component,omega=2*Math.PI*c.response.frequencyHz;
    // Four small steps at 120 Hz = upstream's sixteen per 30 Hz frame.
    const substeps=4,h=dt/substeps,flow=b.scene.airflow;
    if(this.cachedDt!==dt){this.cachedDt=dt;for(let i=0;i<this.n;i++)this.decay[i]=Math.exp(-2*c.response.dampingRatio*omega*h*(1-.35*b.mobility[i]));}
    for(let sub=1;sub<=substeps;sub++){
      const fraction=sub/substeps,reverse=sub%2===0;
      for(let q=0;q<p.length;q++)this.goal[q]=b.previousPose[q]+(b.pPose[q]-b.previousPose[q])*fraction;
      if(b.poseChanged!==false||!this.measured){this.measureRest();this.measured=true;}this.old.set(p);
      for(let i=0;i<this.n;i++){
        if(!b.mobility[i]){p[i*2]=this.goal[i*2];p[i*2+1]=this.goal[i*2+1];continue;}
        const decay=this.decay[i];
        for(let k=0;k<2;k++){const q=i*2+k,a=(k?flow.y:flow.x)*b.maxDistance*omega*omega*.65*b.mobility[i];v[q]=(v[q]+a*h)*decay;p[q]+=v[q]*h;}
      }
      this.distances(h,reverse);
      for(let n=0;n<this.triangles.length;n++){const t=this.triangles[reverse?this.triangles.length-1-n:n];if(t.area*t.area<1e-8)continue;
        const compliance=c.material.areaCompliance??c.material.shapeCompliance*this.meanLength*this.meanLength;
        if(Number.isFinite(compliance))this.area(t,Math.abs(t.area),compliance/(h*h),false);
        this.area(t,Math.abs(t.area)*c.limits.minAreaRatio,0,true);
      }
      this.rotations(h,reverse);
      // Upstream soft goal keeps drawn equilibrium; material edges and rotations
      // couple particles. It is not the old independent displacement oscillator.
      for(let i=0;i<this.n;i++)if(b.mobility[i]){
        const w=this.w(i),compliance=w/(omega*omega)*Math.max(.25,c.material.shapeCompliance/.0008)*2;
        const alpha=compliance/(h*h);for(let k=0;k<2;k++){const q=i*2+k;p[q]+=w*(this.goal[q]-p[q])/(w+alpha);}
      }
      this.distances(h,!reverse);
      for(let q=0;q<p.length;q++)v[q]=(p[q]-this.old[q])/h;
    }
    this.solved.set(p);
    this.solvedStep=true;
  }
  reconcile(){
    const b=this.body,p=b.p,v=b.velocity;
    // A binding editor can prepare and finish a commanded pose without a
    // solver step. That remains a kinematic update, including parent velocity.
    if(!this.solvedStep){for(let q=0;q<p.length;q++)v[q]=(p[q]-b.previous[q])/b.dt;return;}
    this.solvedStep=false;
    // Keep upstream's velocity from the last substep. Averaging it over the
    // outer step afterwards changes the cloth's response on every frame.
    // Author safety projections may block motion, but must not create a new
    // rebound impulse from a positional correction.
    for(let i=0;i<this.n;i++){
      const q=i*2;
      if(!b.mobility[i]){v[q]=(b.pPose[q]-b.previousPose[q])/b.dt;v[q+1]=(b.pPose[q+1]-b.previousPose[q+1])/b.dt;continue;}
      const dx=p[q]-this.solved[q],dy=p[q+1]-this.solved[q+1],length=dx*dx+dy*dy;
      if(length<1e-16)continue;
      const px=(b.pPose[q]-b.previousPose[q])/b.dt,py=(b.pPose[q+1]-b.previousPose[q+1])/b.dt;
      const blocked=((v[q]-px)*dx+(v[q+1]-py)*dy)/length;
      if(blocked<0){v[q]-=blocked*dx;v[q+1]-=blocked*dy;}
    }
  }
}
