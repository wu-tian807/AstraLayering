// Integer steps are the replay clock, shared by offline evidence and workbench.
import { airflowAt } from '../physics-core/physics-airflow.js';
export const inputVersion = 'astra-physics-tests-3';
export const testNames = ['neutral','tip-impulse','support-release','support-reverse','sustained','extreme','combined','light-brush','airflow'];
const ease = t => {t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function applyTestInput(scene, test, step) {
  if(!testNames.includes(test)) throw Error('未知物理测试');
  const t=step/120;
  const parentLength=Math.max(1,...[...scene.bodies.values()].map(b=>b.freeLength));let parentX=0,parentAngle=0;
  if(test==='support-release'||test==='combined'){parentX=parentLength*.05*ease((t-.5)/.4)*(1-ease((t-1.6)/.4));parentAngle=.035*parentX/(parentLength*.05);}
  if(test==='support-reverse')parentX=t>=.5&&t<2.5?parentLength*.04*Math.sin((t-.5)*Math.PI)*Math.pow(Math.sin((t-.5)*Math.PI/2),2):0;
  // Move the parent artwork and every attachment through the same pose.
  // Translating an abstract port while its parent stays still tests a tear.
  scene.sourcePose={x:parentX,y:0,angle:parentAngle};scene.inputs.clear();
  scene.airflow=test==='airflow'&&t>=.5&&t<4.5?airflowAt(t,.2):{x:0,y:0};
  for(const body of scene.bodies.values()) {
    const c=body.component,L=body.freeLength,a=c.authoring;
    const pulse=(test==='tip-impulse'||test==='extreme'||test==='combined'||test==='light-brush')&&step===60;
    const sustained=test==='sustained'&&step>=60&&step<300&&step%12===0;
    if(pulse||sustained) {
      let best=0;for(let i=1;i<body.weights.length;i++)if(body.weights[i]>body.weights[best]||body.weights[i]===body.weights[best]&&Math.hypot(body.rest[i*2]-c.supports[0].at[0],body.rest[i*2+1]-c.supports[0].at[1])>Math.hypot(body.rest[best*2]-c.supports[0].at[0],body.rest[best*2+1]-c.supports[0].at[1]))best=i;
      const speed=L*(test==='extreme'?8:test==='light-brush'?.06:sustained?.08:.7);
      const dx=body.rest[best*2]-c.supports[0].at[0],dy=body.rest[best*2+1]-c.supports[0].at[1],length=Math.max(1,Math.hypot(dx,dy));
      body.impulse(body.positions[best*2],body.positions[best*2+1],speed*dy/length,-speed*dx/length,L*.45);
    }
  }
}
