/** Interpolate explicitly authored 2D landmarks. The solver only fills the
 * space BETWEEN artist-specified points; it never invents endpoint poses. */
const caches=new WeakMap();
const kernel=r=>r<1e-16?0:r*Math.log(r);
function solve(a,b){
 const n=a.length,m=a.map((row,i)=>[...row,...b[i]]);
 for(let col=0;col<n;col++){
  let pivot=col;for(let r=col+1;r<n;r++)if(Math.abs(m[r][col])>Math.abs(m[pivot][col]))pivot=r;
  if(Math.abs(m[pivot][col])<1e-11)throw Error('Coincident or degenerate head landmarks');
  [m[col],m[pivot]]=[m[pivot],m[col]];const d=m[col][col];for(let j=col;j<n+2;j++)m[col][j]/=d;
  for(let r=0;r<n;r++)if(r!==col){const f=m[r][col];for(let j=col;j<n+2;j++)m[r][j]-=f*m[col][j];}
 }
 return m.map(row=>row.slice(n));
}
function compile(field,key){
 if(field.interpolation==='barycentric-cage'){
  const names=Object.keys(field.landmarks),source=Object.values(field.landmarks),target=names.map(n=>field.poses[key][n]);
  const triangles=field.triangles.map(ids=>{
   const [a,b,c]=ids.map(i=>source[i]),det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
   return {ids,a,b,c,det};
  });
  return (x,y)=>{
   let best=null,score=-Infinity;
   for(const t of triangles){
    const {a,b,c,det}=t,u=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,v=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det,w=1-u-v,s=Math.min(u,v,w);
    if(s>score){best={t,weights:[u,v,w]};score=s;}if(s>=-1e-9)break;
   }
   return [0,1].map(axis=>best.t.ids.reduce((sum,id,i)=>sum+target[id][axis]*best.weights[i],0));
  };
 }

 const entries=Object.entries(field.landmarks),destinations={...field.poses[key]};
 if(field.contours){
  const cubic=(p,t)=>[0,1].map(d=>(1-t)**3*p[0][d]+3*t*(1-t)**2*p[1][d]+3*t*t*(1-t)*p[2][d]+t**3*p[3][d]);
  for(const [side,segments] of Object.entries(field.contours.source)){
   const samples=segments.flatMap(segment=>Array.from({length:200},(_,i)=>cubic(segment,i/200)));
   samples.push(segments.at(-1).at(-1));const arc=[0];
   for(let i=1;i<samples.length;i++)arc.push(arc[i-1]+Math.hypot(samples[i][0]-samples[i-1][0],samples[i][1]-samples[i-1][1]));
   const target=field.contours.poses[key][side];
   for(let i=25;i<samples.length-1;i+=25){const name=`contour-${side}-${i}`;entries.push([name,samples[i]]);destinations[name]=cubic(target,arc[i]/arc.at(-1));}
  }
 }
 const n=entries.length;
 const points=entries.map(([,p])=>p.map(v=>v/100));
 const targets=entries.map(([name],i)=>{const q=destinations[name];if(!q||q.some(v=>!Number.isFinite(v)))throw Error(`Missing authored ${key}/${name}`);return q.map((v,k)=>v/100-points[i][k]);});
 const a=Array.from({length:n+3},()=>Array(n+3).fill(0));
 for(let i=0;i<n;i++){
  const [x,y]=points[i];for(let j=0;j<n;j++)a[i][j]=kernel((x-points[j][0])**2+(y-points[j][1])**2);
  a[i][n]=a[n][i]=1;a[i][n+1]=a[n+1][i]=x;a[i][n+2]=a[n+2][i]=y;
 }
 const coef=solve(a,[...targets,[0,0],[0,0],[0,0]]);
 return (x,y)=>{
  const u=x/100,v=y/100,q=[x,y];
  for(let k=0;k<2;k++){
   let d=coef[n][k]+coef[n+1][k]*u+coef[n+2][k]*v;
   for(let i=0;i<n;i++)d+=coef[i][k]*kernel((u-points[i][0])**2+(v-points[i][1])**2);
   q[k]+=d*100;
  }return q;
 };
}
export function authoredPoint(x,y,surface,kx,ky,rig){
 if(!kx&&!ky)return null;
 const field=rig.keyforms?.[surface],key=`${kx},${ky}`;if(!field?.poses[key])return null;
 let cache=caches.get(rig);if(!cache)caches.set(rig,cache=new Map());const id=surface+'/'+key;
 if(!cache.has(id))cache.set(id,compile(field,key));return cache.get(id)(x,y);
}
