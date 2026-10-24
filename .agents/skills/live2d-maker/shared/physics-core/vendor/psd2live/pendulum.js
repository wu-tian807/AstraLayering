// SPDX-License-Identifier: GPL-3.0-only
// Port of PhysicsKernel.update, psd2live 24b1e87892f0051f1168058e1d60405d88a8a07c.
// Original source/license alongside. Inputs adapted to normalized canvas units.
// The physical chain hangs straight; its angles drive the authored curved strand.
export class CubismPendulumChain {
  constructor(body){
    this.body=body;this.root=0;while(this.root+1<body.mobility.length&&!body.mobility[this.root+1])this.root++;
    // Physics nodes are independent of the authored contour sampling density.
    // Cubism uses a short coupled chain, not 38 bobs for 38 contour samples.
    const nodes=body.mobility.length-this.root;
    this.count=Math.min(4,nodes);this.scale=15/body.freeLength;
    this.arc=new Float64Array(body.mobility.length);
    for(let j=this.root+1;j<body.mobility.length;j++)this.arc[j]=this.arc[j-1]+Math.hypot(body.pRest[j*2]-body.pRest[(j-1)*2],body.pRest[j*2+1]-body.pRest[(j-1)*2+1]);
    const total=this.arc.at(-1);this.total=total;
    this.x=new Float64Array(this.count);this.y=new Float64Array(this.count);this.vx=new Float64Array(this.count);this.vy=new Float64Array(this.count);this.length=new Float64Array(this.count).fill(total*this.scale/(this.count-1));this.gravityX=new Float64Array(this.count);this.gravityY=new Float64Array(this.count);
    this.angles=new Float64Array(body.mobility.length);this.reset();this.lastRoot=new Float64Array(2);this.lastRoot.set(body.pPose.slice(this.root*2,this.root*2+2));
  }
  reset(){this.angles?.fill(0);this.x.fill(0);this.vx.fill(0);this.vy.fill(0);this.gravityX.fill(0);this.gravityY.fill(1);this.y[0]=0;for(let i=1;i<this.count;i++)this.y[i]=this.y[i-1]+this.length[i];}
  step(dt){
    const b=this.body,c=b.component,omega=2*Math.PI*c.response.frequencyHz,delay=dt*30;
    const root=b.pPose.slice(this.root*2,this.root*2+2),dx=(root[0]-this.lastRoot[0])*this.scale*c.response.inputGain,dy=(root[1]-this.lastRoot[1])*this.scale*c.response.inputGain;this.lastRoot.set(root);
    // Keep root at zero and carry the old bobs against the moving attachment.
    for(let i=1;i<this.count;i++){this.x[i]-=dx;this.y[i]-=dy;}
    const acceleration=omega*omega*15/900,flow=b.scene.airflow,windGain=c.response.windGain??.04,orientation=b.scene.support(c.supports[0]).angle*c.response.inputGain,gx=Math.sin(orientation),gy=Math.cos(orientation);
    for(let i=1;i<this.count;i++){
      const oldX=this.x[i],oldY=this.y[i];
      const turn=Math.atan2(this.gravityX[i]*gy-this.gravityY[i]*gx,this.gravityX[i]*gx+this.gravityY[i]*gy)/5;
      const ex=this.x[i]-this.x[i-1],ey=this.y[i]-this.y[i-1],cs=Math.cos(turn),sn=Math.sin(turn);
      let px=this.x[i-1]+cs*ex-sn*ey+this.vx[i]*delay+acceleration*(gx+flow.x*windGain)*delay*delay;
      let py=this.y[i-1]+sn*ex+cs*ey+this.vy[i]*delay+acceleration*(gy+flow.y*windGain)*delay*delay;
      let nx=px-this.x[i-1],ny=py-this.y[i-1],len=Math.hypot(nx,ny)||1;
      px=this.x[i-1]+nx/len*this.length[i];py=this.y[i-1]+ny/len*this.length[i];
      const mobility=Math.exp(-2*c.response.dampingRatio*omega*dt*1.35*(1-.3*i/(this.count-1)));
      this.x[i]=px;this.y[i]=py;this.vx[i]=(px-oldX)/delay*mobility;this.vy[i]=(py-oldY)/delay*mobility;this.gravityX[i]=gx;this.gravityY[i]=gy;
    }
    for(let i=0;i<=this.root;i++){b.p[i*2]=b.pPose[i*2];b.p[i*2+1]=b.pPose[i*2+1];}
    for(let j=this.root+1;j<b.mobility.length;j++){
      const u=this.arc[j]/this.total*(this.count-1),lo=Math.max(1,Math.floor(u)),hi=Math.min(this.count-1,lo+1),t=Math.max(0,u-lo);
      // Cubism's X output normalized by segment length has no +/-pi wrap.
      const angleAt=i=>-(this.x[i]-this.x[i-1])/this.length[i];
      let physicalAngle=angleAt(lo)*(1-t)+angleAt(hi)*t;
      if(c.authoring.swing){
        // Author a parent bend and progressively delayed bends below it.
        // Integrating rotated rest tangents preserves the curved drawing's
        // arc length, including a curled tip. Each later bend affects only
        // the section below its own attachment (psd2live SwingDeformer).
        const s=this.arc[j]/this.total,ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
        physicalAngle=0;let previous=0;
        for(let k=1;k<this.count;k++){const current=angleAt(k);physicalAngle+=(current-previous)*ease((s-(k-1)/(this.count-1))/(1-(k-1)/(this.count-1)));previous=current;}
      }
      physicalAngle*=c.response.outputGain??1;
      const limit=c.limits.maxAngle*Math.PI/180,targetAngle=limit*Math.tanh(physicalAngle/limit)*b.mobility[j];
      this.angles[j]+=(targetAngle-this.angles[j])*(1-Math.exp(-omega*dt*3));const angle=this.angles[j];
      const rx=b.pPose[j*2]-b.pPose[(j-1)*2],ry=b.pPose[j*2+1]-b.pPose[(j-1)*2+1],cs=Math.cos(angle),sn=Math.sin(angle);
      b.p[j*2]=b.p[(j-1)*2]+cs*rx-sn*ry;b.p[j*2+1]=b.p[(j-1)*2+1]+sn*rx+cs*ry;
    }
  }
  impulse(index,vx,vy){
    if(index<=this.root)return;const b=this.body,dx=b.pPose[index*2]-b.pPose[(index-1)*2],dy=b.pPose[index*2+1]-b.pPose[(index-1)*2+1],len=Math.hypot(dx,dy)||1;
    const u=this.arc[index]/this.total*(this.count-1),lo=Math.max(1,Math.floor(u)),hi=Math.min(this.count-1,lo+1),t=Math.max(0,u-lo),span=(this.arc[Math.min(this.arc.length-1,index+1)]-this.arc[Math.max(this.root,index-1)])/2,v=(vx*dy-vy*dx)/len*this.scale/30*Math.min(1,span/(this.total/(this.count-1)));
    this.vx[lo]+=v*(1-t);this.vx[hi]+=v*t;
  }
  // Physics state stays independent of artwork safety projection. Feeding an
  // accepted, mobility-weighted drawing back into bob positions injects energy.
}
