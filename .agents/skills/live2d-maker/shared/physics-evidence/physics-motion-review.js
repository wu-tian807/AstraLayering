// Numerical rejection gates, not a substitute for animation/shape review.
export const motionReviewVersion='astra-motion-review-6';
export const motionStepBasis='inverse-sourcePose-only';

// Remove only the prescribed whole-character rigid pose. A component's own
// pose includes physical ancestor motion and must remain visible to the gate.
export class MotionStepTracker {
  constructor(canvas, length, maximum) {
    this.cx=canvas.width/2;this.cy=canvas.height/2;
    this.world=new Float64Array(length);this.source=new Float64Array(length);
    this.origin=new Float64Array(length);this.delta=new Float64Array(length);
    this.initialized=false;this.maxStep=0;this.maxWorldStep=0;this.maxAcceleration=0;this.visiblePeak=0;
    this.fallbackStreak=0;this.maxFallbackStreak=0;
    if(maximum!==undefined){this.stepThreshold=Math.max(2,maximum*.2);this.accelerationThreshold=Math.max(.5,maximum*.03);this.discontinuityRatio=0;}
  }
  update(positions, pose, fallback=false) {
    this.fallbackStreak=fallback?this.fallbackStreak+1:0;
    this.maxFallbackStreak=Math.max(this.maxFallbackStreak,this.fallbackStreak);
    const c=Math.cos(pose.angle),s=Math.sin(pose.angle);
    this.visibleTravel=0;
    for(let i=0;i<positions.length;i+=2) {
      const x=positions[i]-this.cx-pose.x,y=positions[i+1]-this.cy-pose.y;
      const qx=c*x+s*y+this.cx,qy=-s*x+c*y+this.cy;
      if(this.initialized) {
        const dx=qx-this.source[i],dy=qy-this.source[i+1];
        const step=Math.hypot(dx,dy),acceleration=Math.hypot(dx-this.delta[i],dy-this.delta[i+1]);
        this.maxStep=Math.max(this.maxStep,step);
        this.maxAcceleration=Math.max(this.maxAcceleration,acceleration);
        // Both thresholds must be exceeded at the same vertex and instant.
        // Combining maxima from unrelated events falsely rejects smooth motion.
        if(this.discontinuityRatio!==undefined)this.discontinuityRatio=Math.max(this.discontinuityRatio,Math.min(step/this.stepThreshold,acceleration/Math.max(this.accelerationThreshold,step*.35)));
        this.delta[i]=dx;this.delta[i+1]=dy;
        this.maxWorldStep=Math.max(this.maxWorldStep,Math.hypot(positions[i]-this.world[i],positions[i+1]-this.world[i+1]));
      }else{this.origin[i]=qx;this.origin[i+1]=qy;}
      this.visibleTravel=Math.max(this.visibleTravel,Math.hypot(qx-this.origin[i],qy-this.origin[i+1]));
      this.source[i]=qx;this.source[i+1]=qy;
      this.world[i]=positions[i];this.world[i+1]=positions[i+1];
    }
    this.visiblePeak=Math.max(this.visiblePeak,this.visibleTravel);this.initialized=true;
  }
}
export function motionIssues(test, component, metric, steps=960){
  const issues=[],maximum=component.authoring.freeLength*component.limits.maxTravel;
  const ordinary=!['neutral','extreme','sustained','combined'].includes(test);
  if(metric.invalid)issues.push('invalid-mesh');
  if(metric.root>1e-5)issues.push('attachment-slip');
  // A short continuous stop can be hidden by a low eight-second total. This
  // includes strong and combined input, even when the final mesh is legal.
  if(metric.maxFallbackStreak>2)issues.push('continuous-retreat');
  if(ordinary&&metric.fallback/steps>.05)issues.push('persistent-retreat');
  if(ordinary&&metric.limited/steps>.35)issues.push('persistent-limit');
  if(['light-brush','tip-impulse','airflow'].includes(test)&&(metric.visiblePeak??metric.peak)<Math.max(.05,maximum*.005))issues.push('weak-response');
  // Speed alone is not a jump. Keep inherited physical motion, and reject a
  // large step when its source-relative acceleration also changes abruptly.
  if(ordinary&&(metric.discontinuityRatio!==undefined?metric.discontinuityRatio>1:metric.maxStep>Math.max(2,maximum*.2)&&(metric.maxAcceleration===undefined||metric.maxAcceleration>Math.max(.5,maximum*.03))))issues.push('discontinuous-motion');
  if(test!=='neutral'&&metric.recovery?.passed!==true)issues.push('unsettled');
  return issues;
}
