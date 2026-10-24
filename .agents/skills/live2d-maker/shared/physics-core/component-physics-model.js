import { validatePhysicsConfig, componentPhysicsVersion } from './component-physics-schema.js';
import { geometryFor, clothGeometry, refineControlGeometry, gridControlGeometry, mobilityAt, barycentric, clamp, smooth } from './component-physics-geometry.js';

import { PsdClothSolver } from './vendor/psd2live/xpbd.js';
import { CubismPendulumChain } from './vendor/psd2live/pendulum.js';
import { InochiPendulum } from './vendor/inochi2d/pendulum.js';
export { componentPhysicsVersion };
const TAU = Math.PI * 2, DEG = 180 / Math.PI;
// Additional projection passes run only while the displayed constraints fail.
const MAX_PROJECTION_PASSES = 40;
const distance = (a, b, i, j) => Math.hypot(a[i * 2] - b[j * 2], a[i * 2 + 1] - b[j * 2 + 1]);
const area = (p, a, b, c) => (p[b * 2] - p[a * 2]) * (p[c * 2 + 1] - p[a * 2 + 1]) - (p[b * 2 + 1] - p[a * 2 + 1]) * (p[c * 2] - p[a * 2]);
const angle = (ax, ay, bx, by) => Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
const rotate = (x, y, a) => [Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y];

export class ComponentBody {
  constructor(component, scene) {
    this.component = component; this.scene = scene; this.id = component.id; this.kind = component.kind;
    this.binding = { maxAngle: component.limits.maxAngle, direction: 'down' };
    const a=component.authoring,grid=this.kind==='cloth'&&a.controlGrid?gridControlGeometry(a,component.supports):null,control=grid||(this.kind==='cloth'?clothGeometry({...a,subdivisions:a.simulationSubdivisions??0}):null);
    const cuts=grid?grid.indices.reduce((list,index,k,arr)=>{if(k%3!==2)list.push([grid.rest.slice(index*2,index*2+2),grid.rest.slice(arr[k+1]*2,arr[k+1]*2+2)]);else list.push([grid.rest.slice(index*2,index*2+2),grid.rest.slice(arr[k-2]*2,arr[k-2]*2+2)]);return list;},[]):null;
    const mesh = grid?clothGeometry({...a,cutLines:cuts,subdivisions:0}):control?refineControlGeometry(control,Math.max(0,(a.subdivisions??2)-(a.simulationSubdivisions??0))):geometryFor(component);
    if(grid)mesh.samples=Array.from({length:mesh.rest.length/2},(_,i)=>grid.sample(mesh.rest.slice(i*2,i*2+2)));
    this.rest = new Float64Array(mesh.rest); this.indices = new Uint32Array(mesh.indices); this.positions = new Float64Array(this.rest);
    this.pose = new Float64Array(this.rest); this.weights = new Float64Array(this.rest.length / 2); this.limits = new Float64Array(this.weights.length);
    this.freeLength = component.authoring.freeLength; this.maxDistance = this.freeLength * component.limits.maxTravel;
    this.controlIndices=new Uint32Array(control?.indices||mesh.indices);
    const particles = this.kind === 'strand' ? a.centerline.flat() : control?.rest||mesh.rest;
    this.pRest = new Float64Array(particles); this.pPose = new Float64Array(particles); this.p = new Float64Array(particles);
    this.previousMesh = new Float64Array(this.positions); this.previous = new Float64Array(particles); this.previousPose = new Float64Array(particles); this.velocity = new Float64Array(particles.length);
    this.mobility = new Float64Array(particles.length / 2); this.mass = new Float64Array(this.mobility.length).fill(1);
    for (let i = 0; i < this.mobility.length; i++) this.mobility[i] = this.kind === 'pendant' ? 1 : mobilityAt([particles[i * 2], particles[i * 2 + 1]], a);
    if(this.kind==='cloth')this.clothSamples=mesh.samples;
    this.clothFactors=grid?new Float64Array(this.weights.length):null;
    for (let i = 0; i < this.weights.length; i++) {
      const f=this.clothSamples?.[i];this.weights[i] = f?f[3]*this.mobility[f[0]]+f[4]*this.mobility[f[1]]+f[5]*this.mobility[f[2]]:this.kind === 'pendant' ? 1 : mobilityAt([this.rest[i * 2], this.rest[i * 2 + 1]], a);
      if(this.weights[i]<1e-10)this.weights[i]=0;
      this.limits[i] = this.maxDistance * this.weights[i];
      if(grid){const direct=mobilityAt([this.rest[i*2],this.rest[i*2+1]],a);this.clothFactors[i]=Math.min(1,direct/Math.max(1e-10,this.weights[i]));this.weights[i]=direct;this.limits[i]=this.maxDistance*direct;}
    }
    if (this.kind !== 'pendant' && !this.mobility.some(v => v === 0)) throw Error(component.name + ' 的固定区未覆盖任何实际控制点');
    this.edges = []; const unique = new Set();
    const edge = (i, j, type) => { const key = [Math.min(i,j),Math.max(i,j)].join(':'); if (!unique.has(key)) { unique.add(key); this.edges.push({ i,j,type,lambda:0 }); } };
    if (this.kind === 'strand') {
      for (let i = 1; i < this.mobility.length; i++) { edge(i - 1,i,'stretch'); if (i > 1) edge(i - 2,i,'bend'); }
    } else if (this.kind === 'cloth') {
      const adjacency = new Map(); this.mass.fill(0);
      for (let n = 0; n < this.controlIndices.length; n += 3) {
        const tri = [...this.controlIndices.slice(n,n+3)], m = Math.abs(area(this.pRest,...tri)) / 6;
        for (const i of tri) this.mass[i] += m;
        for (let k = 0; k < 3; k++) {
          const i=tri[k],j=tri[(k+1)%3],other=tri[(k+2)%3],key=[Math.min(i,j),Math.max(i,j)].join(':');
          edge(i,j,Math.abs(this.pRest[i*2]-this.pRest[j*2])>1e-5 && Math.abs(this.pRest[i*2+1]-this.pRest[j*2+1])>1e-5 ? 'shear' : 'stretch'); if (adjacency.has(key)) edge(adjacency.get(key),other,'bend'); else adjacency.set(key,other);
        }
      }
      const mean = this.mass.reduce((s,v)=>s+v,0)/this.mass.length;
      for (let i=0;i<this.mass.length;i++) this.mass[i]=Math.max(.05,this.mass[i]/mean);
    }
    if(this.kind==='strand') {
      this.fieldSamples=[];
      for(let v=0;v<this.weights.length;v++) {
        let nearest=Infinity;const samples=[];
        for(let i=0;i<this.mobility.length-1;i++){const ax=this.pRest[i*2],ay=this.pRest[i*2+1],dx=this.pRest[i*2+2]-ax,dy=this.pRest[i*2+3]-ay,t=clamp(((this.rest[v*2]-ax)*dx+(this.rest[v*2+1]-ay)*dy)/(dx*dx+dy*dy),0,1),d=Math.hypot(this.rest[v*2]-ax-dx*t,this.rest[v*2+1]-ay-dy*t);samples.push({i,t,d});nearest=Math.min(nearest,d);}
        // Blend neighbouring segment fields. A hard nearest-segment switch on
        // a curled strand can tear an otherwise valid continuous centreline.
        const sigma=Math.max(8,...samples.filter(s=>s.d<nearest+1).map(s=>(a.widths[s.i]+a.widths[s.i+1])*.25));let sum=0;
        for(const s of samples){s.w=Math.exp(-(s.d*s.d-nearest*nearest)/(sigma*sigma));sum+=s.w;}
        this.fieldSamples.push(samples.filter(s=>s.w/sum>1e-4).map(s=>({...s,w:s.w/sum,factor:Math.min(1,this.weights[v]/Math.max(1e-8,this.mobility[s.i]*(1-s.t)+this.mobility[s.i+1]*s.t))})));
      }
      this.segmentRotations=new Float64Array((this.mobility.length-1)*2);
    }
    this.supportPose=new Float64Array(component.supports.length*4).fill(NaN);
    const influences=points=>{const result=new Float64Array(points.length/2*(component.supports.length+1));for(let i=0;i<points.length/2;i++){let total=0;for(let j=0;j<component.supports.length;j++){const s=component.supports[j],d=Math.hypot(points[i*2]-s.at[0],points[i*2+1]-s.at[1]),w=1/Math.max(1,d*d);result[i*(component.supports.length+1)+j]=w;total+=w;}result[i*(component.supports.length+1)+component.supports.length]=total;}return result;};
    this.pInfluences=influences(this.pRest);this.meshInfluences=influences(this.rest);
    this.measurePose();
    this.theta=0; this.displayTheta=0; this.angularVelocity=0; this.impulses=0; this.motion=this.kind==='cloth'?new PsdClothSolver(this):this.kind==='strand'?new CubismPendulumChain(this):new InochiPendulum(this); this.syncMesh(); this.stats=this.inspect();
  }
  invMass(i) { return this.mobility[i] / this.mass[i]; }
  target(source) {
    let total=0,x=0,y=0;
    for (const support of this.component.supports) {
      const current=this.scene.support(support),d=Math.hypot(source[0]-support.at[0],source[1]-support.at[1]),w=1/Math.max(1,d*d);
      const r=rotate(source[0]-support.at[0],source[1]-support.at[1],current.angle||0);
      x+=(current.x+r[0])*w;y+=(current.y+r[1])*w;total+=w;
    }
    return [x/total,y/total];
  }
  prepare(dt) {
    this.dt=dt; this.previous.set(this.p); this.previousPose.set(this.pPose); this.previousMesh.set(this.positions);
    let changed=false;const supports=this.component.supports;
    for(let j=0;j<supports.length;j++){const s=this.scene.support(supports[j]),k=j*4,cs=Math.cos(s.angle||0),sn=Math.sin(s.angle||0);if(this.supportPose[k]!==s.x||this.supportPose[k+1]!==s.y||this.supportPose[k+2]!==cs||this.supportPose[k+3]!==sn)changed=true;this.supportPose[k]=s.x;this.supportPose[k+1]=s.y;this.supportPose[k+2]=cs;this.supportPose[k+3]=sn;}
    this.poseChanged=changed;
    if(changed){
      this.fillPose(this.pRest,this.pInfluences,this.pPose);
      if(this.kind==='cloth'&&!this.clothFactors)this.sampleCloth(this.pPose,this.pose);else this.fillPose(this.rest,this.meshInfluences,this.pose);
      this.measurePose();
    }
    this.limited=false;this.correction=0;this.fallback=false;this.finalStats=null;
  }
  fillPose(source,influences,target){const supports=this.component.supports,stride=supports.length+1;for(let i=0;i<source.length/2;i++){let x=0,y=0;for(let j=0;j<supports.length;j++){const s=supports[j],k=j*4,dx=source[i*2]-s.at[0],dy=source[i*2+1]-s.at[1],w=influences[i*stride+j];x+=(this.supportPose[k]+(this.supportPose[k+2]*dx-this.supportPose[k+3]*dy))*w;y+=(this.supportPose[k+1]+(this.supportPose[k+3]*dx+this.supportPose[k+2]*dy))*w;}const total=influences[i*stride+supports.length];target[i*2]=x/total;target[i*2+1]=y/total;}}
  measurePose(){
    const measure=(indices,p,old)=>{const out=old||{areas:new Float64Array(indices.length/3),angles:this.kind==='cloth'?new Float64Array(indices.length):null};for(let k=0;k<indices.length;k+=3){out.areas[k/3]=area(p,indices[k],indices[k+1],indices[k+2]);if(out.angles)for(let j=0;j<3;j++){const u=indices[k+j],v=indices[k+(j+1)%3],w=indices[k+(j+2)%3];out.angles[k+j]=angle(p[v*2]-p[u*2],p[v*2+1]-p[u*2+1],p[w*2]-p[u*2],p[w*2+1]-p[u*2+1]);}}return out;};
    this.displayMeasures=measure(this.indices,this.pose,this.displayMeasures);
    if(this.kind==='cloth')this.controlMeasures=measure(this.controlIndices,this.pPose,this.controlMeasures);
  }
  solve(){
    this.motion.step(this.dt);
    if(this.kind==='strand'){
      this.syncMesh();let ratio=0;
      for(let i=0;i<this.weights.length;i++)if(this.limits[i]>1e-8)ratio=Math.max(ratio,distance(this.positions,this.pose,i,i)/this.limits[i]);
      for(let i=0;i<this.mobility.length;i++)if(this.mobility[i]>1e-8)ratio=Math.max(ratio,distance(this.p,this.pPose,i,i)/(this.maxDistance*this.mobility[i]));
      // Cubism parameter output is bounded separately from the physical bobs.
      // A smooth travel envelope preserves curvature and avoids hard clipping
      // individual sections of the drawing while a support moves.
      const scale=ratio>1e-8?Math.tanh(ratio)/ratio:1;
      for(let q=0;q<this.p.length;q++)this.p[q]=this.pPose[q]+(this.p[q]-this.pPose[q])*scale;
      // Bound output speed relative to the current support pose. A physical
      // high mode must not turn into an instantaneous visible contour change.
      const swing=this.component.authoring.swing;
      let stepScale=1,cs=1,sn=0;
      if(swing){
        const a=angle(this.previousPose[2]-this.previousPose[0],this.previousPose[3]-this.previousPose[1],this.pPose[2]-this.pPose[0],this.pPose[3]-this.pPose[1]);cs=Math.cos(a);sn=Math.sin(a);
        for(let i=0;i<this.mobility.length;i++)if(this.mobility[i]>1e-8){
          const ox=this.previous[i*2]-this.previousPose[i*2],oy=this.previous[i*2+1]-this.previousPose[i*2+1],dx=this.p[i*2]-this.pPose[i*2]-(cs*ox-sn*oy),dy=this.p[i*2+1]-this.pPose[i*2+1]-(sn*ox+cs*oy),cap=this.maxDistance*this.mobility[i]*TAU*this.component.response.frequencyHz*this.dt*.5;
          stepScale=Math.min(stepScale,cap/Math.max(cap,Math.hypot(dx,dy)));
        }
      }
      for(let i=0;i<this.mobility.length;i++){
        // Subtract the old pose before adding the new one: adding large canvas
        // coordinates first creates roundoff at pinned controls with a zero cap.
        const ox=this.previous[i*2]-this.previousPose[i*2],oy=this.previous[i*2+1]-this.previousPose[i*2+1],x=this.pPose[i*2]+cs*ox-sn*oy,y=this.pPose[i*2+1]+sn*ox+cs*oy,dx=this.p[i*2]-x,dy=this.p[i*2+1]-y,len=Math.hypot(dx,dy);
        const cap=this.maxDistance*this.mobility[i]*TAU*this.component.response.frequencyHz*this.dt*.5;
        // One interpolation factor for the complete authored curve preserves
        // segment lengths. Per-node speed clipping stretches adjacent links
        // and repeatedly invokes emergency retreat on a moving pendant.
        const scale=swing?stepScale:len>cap&&len?cap/len:1;
        if(swing||len>cap&&len){this.p[i*2]=x+dx*scale;this.p[i*2+1]=y+dy*scale;}
      }

    }
  }
  pin(){for(let i=0;i<this.mobility.length;i++)if(!this.mobility[i]){this.p[i*2]=this.pPose[i*2];this.p[i*2+1]=this.pPose[i*2+1];}}
  correctDisplayAreas(){
    if(this.kind!=='strand'&&(this.kind!=='cloth'||!this.clothSamples))return false;
    let changed=false;
    // Project the actual rendered area through the control-to-display Jacobian.
    // A valid control face can still compress a thin display face at a fixed
    // transition. Correct its nearby controls, rather than retreating the sheet.
    for(let k=0;k<this.indices.length;k+=3){
      const a=this.indices[k],b=this.indices[k+1],c=this.indices[k+2],r=this.displayMeasures.areas[k/3],current=area(this.positions,a,b,c),sign=Math.sign(r);
      const C=sign*current-Math.abs(r)*(this.component.limits.minAreaRatio+.0001);if(C>=0||Math.abs(r)<1e-8)continue;
      const tri=[a,b,c],p=this.positions,grad=[[sign*(p[b*2+1]-p[c*2+1]),sign*(p[c*2]-p[b*2])],[sign*(p[c*2+1]-p[a*2+1]),sign*(p[a*2]-p[c*2])],[sign*(p[a*2+1]-p[b*2+1]),sign*(p[b*2]-p[a*2])]],controls=new Map();
      for(let n=0;n<3;n++)this.accumulateDisplayGradient(tri[n],grad[n],controls);
      let mass=0;for(const[id,g]of controls)mass+=this.invMass(id)*(g[0]*g[0]+g[1]*g[1]);if(mass<1e-12)continue;
      const delta=-C/mass;for(const[id,g]of controls){this.p[id*2]+=this.invMass(id)*delta*g[0];this.p[id*2+1]+=this.invMass(id)*delta*g[1];}
      this.syncMesh();this.limited=true;changed=true;
    }
    return changed;
  }
  accumulateDisplayGradient(vertex,gradient,controls){
    if(this.kind==='cloth'){
      const sample=this.clothSamples[vertex],factor=this.clothFactors?.[vertex]??1;
      for(let j=0;j<3;j++){const id=sample[j],g=controls.get(id)||[0,0],w=sample[j+3]*factor;g[0]+=gradient[0]*w;g[1]+=gradient[1]*w;controls.set(id,g);}
      return;
    }
    // Differentiate the actual blended strand field, including cross-section
    // rotation and source-pixel attachment weights. Correct the nearby curve
    // controls rather than freezing the entire strand at a compressed face.
    const swing=this.component.authoring.swing,beta=swing?1-swing.parallel:1;
    for(const {i,t,w,factor} of this.fieldSamples[vertex]){
      const j=i+1,dx=this.p[j*2]-this.p[i*2],dy=this.p[j*2+1]-this.p[i*2+1],length2=dx*dx+dy*dy;
      if(length2<1e-12)continue;
      const px=this.pPose[i*2]*(1-t)+this.pPose[j*2]*t,py=this.pPose[i*2+1]*(1-t)+this.pPose[j*2+1]*t;
      const rx=this.pose[vertex*2]-px,ry=this.pose[vertex*2+1]-py;
      const theta=angle(this.pPose[j*2]-this.pPose[i*2],this.pPose[j*2+1]-this.pPose[i*2+1],dx,dy)*beta;
      const cs=Math.cos(theta),sn=Math.sin(theta),rotX=cs*rx-sn*ry,rotY=sn*rx+cs*ry;
      const f=(swing?this.weights[vertex]:factor)*w,angular=beta*(-gradient[0]*rotY+gradient[1]*rotX);
      for(const [id,linear,sign] of [[i,1-t,1],[j,t,-1]]){
        const g=controls.get(id)||[0,0];
        g[0]+=f*(gradient[0]*linear+angular*sign*dy/length2);
        g[1]+=f*(gradient[1]*linear-angular*sign*dx/length2);controls.set(id,g);
      }
    }
  }
  sampleCloth(source,target){for(let i=0;i<this.clothSamples.length;i++){const[a,b,c,u,v,w]=this.clothSamples[i];target[i*2]=source[a*2]*u+source[b*2]*v+source[c*2]*w;target[i*2+1]=source[a*2+1]*u+source[b*2+1]*v+source[c*2+1]*w;}}
  correctDisplayShear(){
    if(this.kind!=='cloth'||!this.clothSamples)return false;
    let changed=false;const limit=this.component.limits.maxShear/DEG;
    // A legal control face can still shear a thin rendered face at a fixed
    // transition. Project its angle gradient through the same sampling map as
    // its area, rather than repeatedly retreating the whole sheet.
    for(let k=0;k<this.indices.length;k+=3)for(let j=0;j<3;j++){
      const tri=[this.indices[k+j],this.indices[k+(j+1)%3],this.indices[k+(j+2)%3]],[a,b,c]=tri,p=this.positions;
      const ax=p[b*2]-p[a*2],ay=p[b*2+1]-p[a*2+1],bx=p[c*2]-p[a*2],by=p[c*2+1]-p[a*2+1];
      let delta=angle(ax,ay,bx,by)-this.displayMeasures.angles[k+j];delta=Math.atan2(Math.sin(delta),Math.cos(delta));
      const C=delta-clamp(delta,-limit,limit);if(Math.abs(C)<1e-7)continue;
      const la=ax*ax+ay*ay,lb=bx*bx+by*by;if(la<1e-12||lb<1e-12)continue;
      const gb=[ay/la,-ax/la],gc=[-by/lb,bx/lb],grad=[[-gb[0]-gc[0],-gb[1]-gc[1]],gb,gc],controls=new Map();
      for(let n=0;n<3;n++){
        const vertex=tri[n],sample=this.clothSamples[vertex],factor=this.clothFactors?.[vertex]??1;
        for(let q=0;q<3;q++){const id=sample[q],g=controls.get(id)||[0,0],w=sample[q+3]*factor;g[0]+=grad[n][0]*w;g[1]+=grad[n][1]*w;controls.set(id,g);}
      }
      let mass=0;for(const[id,g]of controls)mass+=this.invMass(id)*(g[0]*g[0]+g[1]*g[1]);if(mass<1e-12)continue;
      for(const[id,g]of controls){this.p[id*2]-=this.invMass(id)*C/mass*g[0];this.p[id*2+1]-=this.invMass(id)*C/mass*g[1];}
      this.syncMesh();this.limited=true;changed=true;
    }
    return changed;
  }
  syncMesh(){
    if(this.kind==='cloth'){this.sampleCloth(this.p,this.positions);if(this.clothFactors)for(let i=0;i<this.clothSamples.length;i++){const[a,b,c,u,v,w]=this.clothSamples[i],factor=this.clothFactors[i];for(let k=0;k<2;k++)this.positions[i*2+k]=this.pose[i*2+k]+(this.positions[i*2+k]-(this.pPose[a*2+k]*u+this.pPose[b*2+k]*v+this.pPose[c*2+k]*w))*factor;}return;}
    if(this.kind==='pendant'){
      const pivot=this.component.authoring.pivot,current=this.pivot||this.target(pivot);
      const a=angle(this.rest[2]-this.rest[0],this.rest[3]-this.rest[1],this.pose[2]-this.pose[0],this.pose[3]-this.pose[1])+this.theta;
      this.rigidFrame??=new Float64Array(4);this.rigidFrame[0]=current[0];this.rigidFrame[1]=current[1];this.rigidFrame[2]=Math.cos(a);this.rigidFrame[3]=Math.sin(a);
      for(let i=0;i<this.weights.length;i++){
        const q=this.target([this.rest[i*2],this.rest[i*2+1]]),r=rotate(q[0]-current[0],q[1]-current[1],this.theta);
        this.positions[i*2]=current[0]+r[0];this.positions[i*2+1]=current[1]+r[1];
      }return;
    }
    // Fixed-region boundaries are actual mesh edges. A pinned source pixel
    // cannot inherit residual motion through a triangle crossing the root.
    for(let i=0;i<this.mobility.length-1;i++){const j=i+1,a=angle(this.pPose[j*2]-this.pPose[i*2],this.pPose[j*2+1]-this.pPose[i*2+1],this.p[j*2]-this.p[i*2],this.p[j*2+1]-this.p[i*2+1]);this.segmentRotations[i*2]=Math.cos(a);this.segmentRotations[i*2+1]=Math.sin(a);}
    for(let v=0;v<this.weights.length;v++){
      if(!this.weights[v]){this.positions[v*2]=this.pose[v*2];this.positions[v*2+1]=this.pose[v*2+1];continue;}
      let dx=0,dy=0;
      for(const{i,t,w,factor}of this.fieldSamples[v]){const j=i+1;
        const cx=this.p[i*2]*(1-t)+this.p[j*2]*t,cy=this.p[i*2+1]*(1-t)+this.p[j*2+1]*t,px=this.pPose[i*2]*(1-t)+this.pPose[j*2]*t,py=this.pPose[i*2+1]*(1-t)+this.pPose[j*2+1]*t;
        let cs=this.segmentRotations[i*2],sn=this.segmentRotations[i*2+1];
        // Wide hair sheets need independently hanging cross-sections rather
        // than a board rotating around the centreline. Apply the source-pixel
        // attachment weight exactly to the complete displacement: dividing
        // by a nearby control's weight lets a nearly pinned boundary pixel
        // shrink the motion of the entire strand.
        const swing=this.component.authoring.swing;
        if(swing){const a=Math.atan2(sn,cs)*(1-swing.parallel);cs=Math.cos(a);sn=Math.sin(a);}
        const rx=this.pose[v*2]-px,ry=this.pose[v*2+1]-py,f=swing?this.weights[v]:factor;
        dx+=(cx+(cs*rx-sn*ry)-this.pose[v*2])*f*w;dy+=(cy+(sn*rx+cs*ry)-this.pose[v*2+1])*f*w;
      }
      this.positions[v*2]=this.pose[v*2]+dx;this.positions[v*2+1]=this.pose[v*2+1]+dy;
    }
  }
  inspect(controlsOnly=false){
    let valid=true,travel=0,root=0,stretch=0,shear=0,maxAngle=0,minArea=Infinity;
    const lim=this.component.limits;
    for(let i=0;i<this.weights.length;i++){
      const d=distance(this.positions,this.pose,i,i);travel=Math.max(travel,d);if(!this.weights[i])root=Math.max(root,d);
      if(!Number.isFinite(d)||d>this.maxDistance*this.weights[i]+1e-5)valid=false;
    }
    for(const e of this.edges){
      if(e.type==='bend')continue;
      const dx=this.p[e.j*2]-this.p[e.i*2],dy=this.p[e.j*2+1]-this.p[e.i*2+1],rx=this.pPose[e.j*2]-this.pPose[e.i*2],ry=this.pPose[e.j*2+1]-this.pPose[e.i*2+1],len=Math.hypot(rx,ry);
      const ratio=Math.hypot(dx,dy)/Math.max(1e-9,len),a=Math.abs(angle(rx,ry,dx,dy))*DEG;
      stretch=Math.max(stretch,ratio-1);maxAngle=Math.max(maxAngle,a);
      if(ratio>1+lim.maxStretch+1e-5||ratio<1-lim.maxCompression-1e-5||a>lim.maxAngle+1e-4)valid=false;
    }
    const indices=controlsOnly&&this.kind==='cloth'?this.controlIndices:this.indices,measures=controlsOnly&&this.kind==='cloth'?this.controlMeasures:this.displayMeasures,positions=controlsOnly&&this.kind==='cloth'?this.p:this.positions;
    for(let k=0;k<indices.length;k+=3){
      const i=indices[k],j=indices[k+1],n=indices[k+2],r=measures.areas[k/3],a=area(positions,i,j,n),ratio=a/r;
      minArea=Math.min(minArea,ratio);if(!Number.isFinite(ratio)||ratio<lim.minAreaRatio-1e-5)valid=false;
      if(this.kind==='cloth')for(let j=0;j<3;j++){
        const u=indices[k+j],v=indices[k+(j+1)%3],w=indices[k+(j+2)%3];
        const before=measures.angles[k+j];
        const after=angle(positions[v*2]-positions[u*2],positions[v*2+1]-positions[u*2+1],positions[w*2]-positions[u*2],positions[w*2+1]-positions[u*2+1]);
        let delta=Math.abs(after-before);if(delta>Math.PI)delta=TAU-delta;delta*=DEG;shear=Math.max(shear,delta);if(delta>lim.maxShear+1e-4)valid=false;
      }
    }
    if(this.kind==='pendant'){maxAngle=Math.abs(this.theta)*DEG;if(maxAngle>lim.maxAngle+1e-5)valid=false;}
    return {valid,travel,root,stretch,shear,angle:maxAngle,minArea,limited:this.limited||false,correction:this.correction||0,fallback:this.fallback||false};
  }
  constrain(){
    const lim=this.component.limits;
    if(this.kind==='pendant'){
      const radius=Math.max(...Array.from({length:this.weights.length},(_,i)=>Math.hypot(this.rest[i*2]-this.component.authoring.pivot[0],this.rest[i*2+1]-this.component.authoring.pivot[1])));
      const max=Math.min(lim.maxAngle/DEG,2*Math.asin(clamp(this.maxDistance/(2*Math.max(radius,1)),0,1)));
      // As in the Cubism strand output, bound the displayed deformation while
      // retaining the independent physical state. Hard clipping and returning
      // that angle to the world bob creates recoil in a serial ornament chain.
      const previous=this.displayTheta,target=max*Math.tanh(this.theta*(this.component.response.outputGain??1)/max);
      const outputFrequency=this.component.response.outputFrequencyHz??this.component.response.frequencyHz;
      this.displayTheta+=(target-previous)*(1-Math.exp(-TAU*outputFrequency*this.dt*3));
      this.theta=this.displayTheta;this.angularVelocity=(this.displayTheta-previous)/this.dt;
      // Soft output bounds can plateau too. Retain the saturation signal for
      // persistent-limit review even though the mesh never crosses the bound.
      this.limited=Math.abs(this.displayTheta)>=max*.98;
      this.syncMesh();return;
    }
    for(let pass=0;pass<MAX_PROJECTION_PASSES;pass++){
      for(let i=0;i<this.mobility.length;i++){
        const dx=this.p[i*2]-this.pPose[i*2],dy=this.p[i*2+1]-this.pPose[i*2+1],d=Math.hypot(dx,dy),max=this.maxDistance*this.mobility[i];
        if(d>max&&d){const scale=max/d;this.p[i*2]=this.pPose[i*2]+dx*scale;this.p[i*2+1]=this.pPose[i*2+1]+dy*scale;this.limited=true;this.correction=Math.max(this.correction,d-max);}
      }
      for(const e of this.edges){
        if(e.type==='bend')continue;const {i,j}=e,dx=this.p[j*2]-this.p[i*2],dy=this.p[j*2+1]-this.p[i*2+1],rx=this.pPose[j*2]-this.pPose[i*2],ry=this.pPose[j*2+1]-this.pPose[i*2+1];
        const len=Math.hypot(dx,dy),rest=Math.hypot(rx,ry),mass=this.invMass(i)+this.invMass(j);if(!mass||!len||!rest)continue;
        const a=angle(rx,ry,dx,dy),allowed=clamp(a,-lim.maxAngle/DEG,lim.maxAngle/DEG),targetLen=clamp(len,rest*(1-lim.maxCompression),rest*(1+lim.maxStretch));
        const target=rotate(rx/rest*targetLen,ry/rest*targetLen,allowed),cx=target[0]-dx,cy=target[1]-dy;
        if(Math.hypot(cx,cy)>1e-8){this.limited=true;this.correction=Math.max(this.correction,Math.hypot(cx,cy));
          this.p[i*2]-=cx*this.invMass(i)/mass;this.p[i*2+1]-=cy*this.invMass(i)/mass;this.p[j*2]+=cx*this.invMass(j)/mass;this.p[j*2+1]+=cy*this.invMass(j)/mass;}
      }
      this.pin();this.syncMesh();if(this.correctDisplayAreas()){this.pin();this.syncMesh();}let metrics=this.inspect(!this.clothFactors);
      if(!metrics.valid&&this.kind==='cloth'&&metrics.shear>lim.maxShear+1e-4&&this.correctDisplayShear()){this.pin();this.syncMesh();metrics=this.inspect(!this.clothFactors);}
      if(metrics.valid){if(this.kind!=='cloth'||this.clothFactors)this.finalStats=metrics;return;}
      // Local triangle retreat fixes a fold without stopping the whole cloth.
      if(this.kind==='cloth')for(let k=0;k<this.controlIndices.length;k+=3){
        const tri=[...this.controlIndices.slice(k,k+3)],ratio=area(this.p,...tri)/area(this.pPose,...tri);
        if(!Number.isFinite(ratio)||ratio<lim.minAreaRatio)for(const i of tri)if(this.mobility[i])for(let j=0;j<2;j++)this.p[i*2+j]=(this.p[i*2+j]+this.pPose[i*2+j])/2;
      }
    }
    this.syncMesh();
    if(!this.inspect(!this.clothFactors).valid){
      // Last-resort projection is reported, never counted as natural response.
      const current=new Float64Array(this.p),safe=new Float64Array(this.p.length);let lo=0,hi=1;
      // Retreat toward the previous valid state in the current support pose.
      // Returning toward the original drawing can create a large one-frame jump
      // and turn a position correction into an artificial rebound velocity.
      const recovery=Math.exp(-TAU*this.component.response.frequencyHz*this.dt);
      for(let q=0;q<safe.length;q++)this.p[q]=safe[q]=this.pPose[q]+(this.previous[q]-this.previousPose[q])*recovery;
      this.pin();this.syncMesh();if(!this.inspect(!this.clothFactors).valid)safe.set(this.pPose);
      for(let n=0;n<20;n++){const t=(lo+hi)/2;for(let q=0;q<this.p.length;q++)this.p[q]=safe[q]+(current[q]-safe[q])*t;this.pin();this.syncMesh();if(this.inspect(!this.clothFactors).valid)lo=t;else hi=t;}
      for(let q=0;q<this.p.length;q++)this.p[q]=safe[q]+(current[q]-safe[q])*lo;
      this.fallback=true;this.limited=true;this.syncMesh();
    }
  }
  finish(){
    this.motion.reconcile?.();
    if(this.kind==='strand')for(let i=0;i<this.mobility.length;i++)for(let k=0;k<2;k++)this.velocity[i*2+k]=(this.p[i*2+k]-this.previous[i*2+k])/this.dt;
    if(this.kind!=='pendant')for(let i=0;i<this.mobility.length;i++){
      // The speed budget bounds secondary motion, not the commanded parent
      // pose. Clipping world velocity makes a short piece lag behind a moving
      // attachment even when its local deformation is exactly zero.
      const px=(this.pPose[i*2]-this.previousPose[i*2])/this.dt,py=(this.pPose[i*2+1]-this.previousPose[i*2+1])/this.dt;
      let vx=this.velocity[i*2]-px,vy=this.velocity[i*2+1]-py;
      const speed=Math.hypot(vx,vy),cap=this.maxDistance*TAU*this.component.response.frequencyHz*2;
      if(speed>cap){vx*=cap/speed;vy*=cap/speed;}
      const dx=this.p[i*2]-this.pPose[i*2],dy=this.p[i*2+1]-this.pPose[i*2+1],d=Math.hypot(dx,dy);
      if(d>=this.maxDistance*this.mobility[i]*.98&&d){const outward=Math.max(0,(vx*dx+vy*dy)/(d*d));vx-=outward*dx;vy-=outward*dy;}
      this.velocity[i*2]=px+vx;this.velocity[i*2+1]=py+vy;
    }
    this.stats=this.motion.reconcile?this.inspect():this.finalStats||this.inspect();
  }
  reset(){this.p.set(this.pRest);this.pPose.set(this.pRest);this.pose.set(this.rest);this.positions.set(this.rest);this.supportPose.fill(NaN);this.measurePose();this.finalStats=null;this.velocity.fill(0);this.theta=0;this.displayTheta=0;this.angularVelocity=0;this.pivot=null;this.motion.reset?.();if(this.motion.lastRoot)this.motion.lastRoot.set(this.pRest.slice(this.motion.root*2,this.motion.root*2+2));this.limited=false;this.fallback=false;this.correction=0;this.stats=this.inspect();}
  moving(){return Math.abs(this.angularVelocity)>.0001||this.velocity.some(v=>Math.abs(v)>.02)||this.positions.some((v,i)=>Math.abs(v-this.pose[i])>.015)||this.pose.some((v,i)=>Math.abs(v-this.rest[i])>.015);}
  impulse(x,y,vx,vy,radius,weight=1){
    if(![x,y,vx,vy,radius].every(Number.isFinite)||radius<=0)return;
    const speed=Math.hypot(vx,vy),cap=this.freeLength*2,scale=speed?cap*Math.tanh(speed/cap)/speed*this.component.response.inputGain*weight:0;
    if(this.kind==='pendant'){const p=this.pivot||this.component.authoring.pivot,delta=((x-p[0])*vy-(y-p[1])*vx)*scale/Math.max(1,this.freeLength*this.freeLength);this.angularVelocity+=delta;this.motion.speed+=delta;this.impulses++;return;}
    let affected=false;
    const apply=(i,w)=>{w*=this.mobility[i];if(w>0){this.velocity[i*2]+=vx*scale*w;this.velocity[i*2+1]+=vy*scale*w;this.motion.impulse?.(i,vx*scale*w,vy*scale*w);affected=true;}};
    for(let i=0;i<this.mobility.length;i++){
      const d=Math.hypot(this.p[i*2]-x,this.p[i*2+1]-y);if(d<radius)apply(i,smooth(1-d/radius));
    }
    // A pointer can hit artwork between coarse controls. Distribute the point
    // load to its containing control face instead of creating a dead zone.
    if(!affected&&this.kind==='cloth')for(let k=0;k<this.controlIndices.length;k+=3){const tri=[...this.controlIndices.slice(k,k+3)],w=barycentric([x,y],...tri.map(i=>[this.p[i*2],this.p[i*2+1]]));if(w){tri.forEach((i,n)=>apply(i,w[n]));break;}}
    if(!affected&&this.kind==='strand'){
      let best=null;for(let i=0;i<this.mobility.length-1;i++){const dx=this.p[i*2+2]-this.p[i*2],dy=this.p[i*2+3]-this.p[i*2+1],t=clamp(((x-this.p[i*2])*dx+(y-this.p[i*2+1])*dy)/Math.max(1e-9,dx*dx+dy*dy),0,1),d=Math.hypot(x-this.p[i*2]-dx*t,y-this.p[i*2+1]-dy*t);if(!best||d<best.d)best={i,t,d};}if(best){apply(best.i,1-best.t);apply(best.i+1,best.t);}
    }
    this.impulses++;
  }
  sample(point){
    if(this.kind==='pendant'){
      // A connector may sit just outside the visible metal's contour. It
      // still belongs to the same rigid frame, including its rotation. A
      // nearest-vertex translation gives neighbouring probes different
      // frames and can jerk every downstream link.
      const f=this.rigidFrame,p=this.component.authoring.pivot,x=point[0]-p[0],y=point[1]-p[1];
      return [f[0]+f[2]*x-f[3]*y,f[1]+f[3]*x+f[2]*y];
    }
    for(let k=0;k<this.indices.length;k+=3){
      const tri=[...this.indices.slice(k,k+3)],weights=barycentric(point,...tri.map(i=>[this.rest[i*2],this.rest[i*2+1]]));
      if(weights)return [0,1].map(axis=>tri.reduce((s,i,n)=>s+this.positions[i*2+axis]*weights[n],0));
    }
    // Explicit rigid extrapolation of a connected support, not a guessed layer.
    const nearest=Array.from({length:this.weights.length},(_,i)=>i).reduce((best,i)=>Math.hypot(this.rest[i*2]-point[0],this.rest[i*2+1]-point[1])<Math.hypot(this.rest[best*2]-point[0],this.rest[best*2+1]-point[1])?i:best,0);
    return [point[0]+this.positions[nearest*2]-this.rest[nearest*2],point[1]+this.positions[nearest*2+1]-this.rest[nearest*2+1]];
  }
  sampleAlpha(x,y,layers){
    for(let k=0;k<this.indices.length;k+=3){
      const a=this.indices[k]*2,b=this.indices[k+1]*2,c=this.indices[k+2]*2,p=this.positions,ax=p[a],ay=p[a+1],bx=p[b],by=p[b+1],cx=p[c],cy=p[c+1];
      // Reject empty space before barycentrics, without allocating triangle and
      // vector arrays for every probe in the swept mouse contact.
      const ex=(Math.abs(bx-ax)+Math.abs(cx-ax))*1e-6,ey=(Math.abs(by-ay)+Math.abs(cy-ay))*1e-6;
      if(x<Math.min(ax,bx,cx)-ex||x>Math.max(ax,bx,cx)+ex||y<Math.min(ay,by,cy)-ey||y>Math.max(ay,by,cy)+ey)continue;
      const d=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax);if(Math.abs(d)<1e-12)continue;
      const u=((bx-x)*(cy-y)-(by-y)*(cx-x))/d,v=((x-ax)*(cy-ay)-(y-ay)*(cx-ax))/d,w=1-u-v;if(u< -1e-6||v< -1e-6||w< -1e-6)continue;
      const r=this.rest,rx=r[a]*u+r[b]*v+r[c]*w,ry=r[a+1]*u+r[b+1]*v+r[c+1]*w;
      let value=0;for(const l of layers){if(!l)continue;const ix=Math.floor(rx-l.bounds.x),iy=Math.floor(ry-l.bounds.y);if(ix>=0&&iy>=0&&ix<l.bounds.width&&iy<l.bounds.height)value=Math.max(value,l.maskedRgba[(iy*l.bounds.width+ix)*4+3]);}return value;
    }return 0;
  }
  hit(x,y,layers){return this.sampleAlpha(x,y,layers)>32;}
  step(dt=1/120){this.prepare(dt);this.solve();this.constrain();this.finish();}
}

export class ComponentScene {
  constructor(config){
    this.config=validatePhysicsConfig(config);this.inputs=new Map();this.bodies=new Map();this.layerBodies=new Map();this.stepNumber=0;this.sourcePose={x:0,y:0,angle:0};this.airflow={x:0,y:0};
    const pending=new Map(config.components.filter(c=>c.enabled).map(c=>[c.id,c]));
    while(pending.size){let progress=false;for(const [id,c]of pending)if(c.supports.every(s=>!s.componentId||this.bodies.has(s.componentId)||!pending.has(s.componentId))){
      const b=new ComponentBody(c,this);this.bodies.set(id,b);for(const r of c.layerRefs){if(this.layerBodies.has(r.uuid))throw Error('同一源层不能重复叠加两个组件场；请明确拆分活动区');this.layerBodies.set(r.uuid,b);}pending.delete(id);progress=true;
    }if(!progress)throw Error('支撑存在环：闭环需先定义耦合装配，不能使用循环父级');}
  }
  support(s){
    if(s.componentId){const b=this.bodies.get(s.componentId);if(b){const p=b.sample(s.at),q=b.sample([s.at[0]+1,s.at[1]]);return {x:p[0],y:p[1],angle:Math.atan2(q[1]-p[1],q[0]-p[0])};}}
    const p=this.sourcePoint(s.at),v=this.inputs.get(s.id)||{};return {x:p[0]+(v.x||0),y:p[1]+(v.y||0),angle:this.sourcePose.angle+(v.angle||0)};
  }
  sourcePoint(point){const c=this.config.source.canvas,p=this.sourcePose,r=rotate(point[0]-c.width/2,point[1]-c.height/2,p.angle);return [c.width/2+r[0]+p.x,c.height/2+r[1]+p.y];}
  step(dt=1/120){
    if(!Number.isFinite(dt)||dt<=0||dt>1/30)throw Error('物理步长无效');
    for(const b of this.bodies.values()){
      const driven=Object.values(this.sourcePose).some(v=>Math.abs(v)>1e-9)||b.component.supports.some(s=>s.componentId?this.bodies.get(s.componentId)?.moving():Object.values(this.inputs.get(s.id)||{}).some(v=>Math.abs(v)>1e-9));
      if(!driven&&!this.airflow.x&&!this.airflow.y&&Math.abs(b.angularVelocity)<1e-9&&!b.velocity.some(v=>Math.abs(v)>1e-9)&&b.positions.every((v,i)=>Math.abs(v-b.rest[i])<1e-9))continue;
      b.prepare(dt);b.solve();b.constrain();b.finish();if(!b.stats.valid)throw Error('最终组件约束不满足：'+b.component.name);
    }
    this.stepNumber++;
  }
  reset(){this.inputs.clear();this.stepNumber=0;this.sourcePose={x:0,y:0,angle:0};this.airflow={x:0,y:0};for(const b of this.bodies.values())b.reset();}
  inspect(){return Object.fromEntries([...this.bodies].map(([id,b])=>[id,b.inspect()]));}
}
