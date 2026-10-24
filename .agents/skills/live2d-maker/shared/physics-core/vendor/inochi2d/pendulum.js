// SPDX-License-Identifier: BSD-2-Clause
// Copyright © 2022, Inochi2D Project. Original author: Asahi Lina.
// Port of Pendulum.eval/tick and PhysicsSystem.tick (RK4), Inochi2D v0.8.7
// e2235f6f29688d4013a0eec116a37ec8af8f1fb5. Source and license alongside.
export class InochiPendulum {
  constructor(body){this.body=body;this.reset();}
  reset(){this.angle=0;this.speed=0;this.bob=null;this.lastPivot=null;this.frameAngle=0;}
  step(h){
    const b=this.body,c=b.component,pivot=b.target(c.authoring.pivot),L=b.freeLength;
    const down=b.target([c.authoring.pivot[0],c.authoring.pivot[1]+1]);
    this.frameAngle=Math.atan2(-(down[0]-pivot[0]),down[1]-pivot[1]);
    if(this.bob){
      // The rendered attachment always follows its actual parent. Only the
      // inertia induced by parent translation is scaled by author inputGain.
      // Carrying the remaining fraction avoids treating gain=0 as full input.
      const dx=pivot[0]-this.lastPivot[0],dy=pivot[1]-this.lastPivot[1],speed=Math.hypot(dx,dy)/h;
      const cap=c.response.parentVelocityLimit===undefined?Infinity:L*c.response.parentVelocityLimit,ratio=speed/cap;
      // Carry the artwork through its complete parent pose. Saturate only the
      // inherited inertial force at high speeds, retaining gentle-motion gain.
      const gain=(c.response.parentGain??c.response.inputGain??1)*(ratio>1e-8?Math.tanh(ratio)/ratio:1);
      this.angle=Math.atan2(-(this.bob[0]+dx*(1-gain)-pivot[0]),this.bob[1]+dy*(1-gain)-pivot[1]);
    }
    this.lastPivot=[...pivot];
    const g=(2*Math.PI*c.response.frequencyHz)**2,damp=2*Math.sqrt(g)*c.response.dampingRatio,wind=b.scene.airflow.x*(c.response.windGain??.08)*g;
    const acceleration=(a,v)=>-g*Math.sin(a)-damp*v-wind;
    const a=this.angle,v=this.speed,k1a=v,k1v=acceleration(a,v),k2a=v+h*k1v/2,k2v=acceleration(a+h*k1a/2,v+h*k1v/2),k3a=v+h*k2v/2,k3v=acceleration(a+h*k2a/2,v+h*k2v/2),k4a=v+h*k3v,k4v=acceleration(a+h*k3a,v+h*k3v);
    this.angle=a+h*(k1a+2*k2a+2*k3a+k4a)/6;this.speed=v+h*(k1v+2*k2v+2*k3v+k4v)/6;
    this.bob=[pivot[0]-Math.sin(this.angle)*L,pivot[1]+Math.cos(this.angle)*L];b.pivot=pivot;
    // Inochi updateOutputs transforms its world output into the attachment's
    // local frame. The mesh already carries that frame, so only residual
    // rotation may be applied again here. Artwork bounds never feed back into
    // the integrated bob: doing that injects energy at a moving hard stop.
    b.theta=Math.atan2(Math.sin(this.angle-this.frameAngle),Math.cos(this.angle-this.frameAngle));
  }
}
