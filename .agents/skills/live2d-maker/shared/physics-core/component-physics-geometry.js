// Module workers have no document import map. They load the same pinned Three
// module explicitly; Node and the page keep their existing package resolution.
const { ShapeUtils, Vector2 } = await import(typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope ? new URL('../vendor/three.module.js',import.meta.url).href : 'three');

export const geometryVersion = 'astra-component-mesh-1';
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
export const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function pointInPolygon(p, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
export function segmentDistance(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / Math.max(1e-12, dx * dx + dy * dy), 0, 1);
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}
export function polygonDistance(p, polygon) {
  if (pointInPolygon(p, polygon)) return 0;
  return Math.min(...polygon.map((a, i) => segmentDistance(p, a, polygon[(i + 1) % polygon.length])));
}
export function barycentric(p, a, b, c) {
  const d = cross(a, b, c); if (Math.abs(d) < 1e-12) return null;
  const u = cross(p, b, c) / d, v = cross(a, p, c) / d, w = 1 - u - v;
  return u >= -1e-6 && v >= -1e-6 && w >= -1e-6 ? [u, v, w] : null;
}
function split(poly, a, b) {
  // Cut only triangles touched by the actual boundary segment. Extending every
  // fixed edge across the entire garment creates thousands of tiny slivers.
  const touches=pointInPolygon(a,poly)||pointInPolygon(b,poly)||poly.some((p,i)=>{
    const q=poly[(i+1)%poly.length];if(Math.max(a[0],b[0])+1e-8<Math.min(p[0],q[0])||Math.max(p[0],q[0])+1e-8<Math.min(a[0],b[0])||Math.max(a[1],b[1])+1e-8<Math.min(p[1],q[1])||Math.max(p[1],q[1])+1e-8<Math.min(a[1],b[1]))return false;
    return cross(a,b,p)*cross(a,b,q)<=1e-8&&cross(p,q,a)*cross(p,q,b)<=1e-8;
  });
  if(!touches)return [poly];
  const sides = [[], []];
  for (let k = 0; k < 2; k++) {
    const sign = k ? -1 : 1;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], dp = cross(a, b, p) * sign, dq = cross(a, b, q) * sign;
      if (dp >= -1e-8) sides[k].push(p);
      if (dp > 1e-8 && dq < -1e-8 || dp < -1e-8 && dq > 1e-8) {
        const t = dp / (dp - dq); sides[k].push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
  }
  return sides.filter(p => p.length >= 3);
}
function conformTriangles(triangles) {
  const points=[],catalog=new Map();
  const index=p=>{const key=p.map(v=>Math.round(v*1e6)).join(',');if(!catalog.has(key)){catalog.set(key,points.length);points.push(p);}return catalog.get(key);};
  const pending=triangles.map(t=>t.map(index)),result=[];
  // A boundary cut can end on a neighbouring triangle's edge. Insert that
  // same vertex into both faces: T junctions otherwise crack on the GPU and
  // leave independent cloth controls along what should be one shared seam.
  while(pending.length){
    const tri=pending.pop();let found=false;
    for(let e=0;e<3&&!found;e++){
      const a=tri[e],b=tri[(e+1)%3],c=tri[(e+2)%3],p=points[a],q=points[b],dx=q[0]-p[0],dy=q[1]-p[1],length2=dx*dx+dy*dy;
      if(length2<1e-12)continue;
      for(let v=0;v<points.length;v++){
        if(tri.includes(v))continue;const r=points[v],t=((r[0]-p[0])*dx+(r[1]-p[1])*dy)/length2;
        if(t<=1e-7||t>=1-1e-7||Math.abs(cross(p,q,r))>Math.sqrt(length2)*1e-6)continue;
        pending.push([a,v,c],[v,b,c]);found=true;break;
      }
    }
    if(!found)result.push(tri.map(i=>points[i]));
    if(result.length+pending.length>30000)throw Error('固定区切分过密，请减少控制点');
  }
  return result;
}
// Improve the weakest triangle by flipping only a shared interior diagonal of
// a convex pair. Contours, holes, fixed edges and control-face cuts stay intact;
// source vertices are never moved or deleted to make area checks easier.
export function conditionTriangles(triangles, constraints=[]) {
  const points=[],catalog=new Map();
  const index=p=>{const key=p.map(v=>Math.round(v*1e6)).join(',');if(!catalog.has(key)){catalog.set(key,points.length);points.push(p);}return catalog.get(key);};
  const faces=triangles.map(t=>t.map(index)),protectedEdges=new Map();
  const quality=(a,b,c)=>{
    const p=points[a],q=points[b],r=points[c],ab=(p[0]-q[0])**2+(p[1]-q[1])**2,bc=(q[0]-r[0])**2+(q[1]-r[1])**2,ca=(r[0]-p[0])**2+(r[1]-p[1])**2;
    return Math.abs(cross(p,q,r))/Math.max(1e-12,ab,bc,ca);
  };
  const protectedEdge=(key,a,b)=>{
    if(!protectedEdges.has(key))protectedEdges.set(key,constraints.some(([p,q])=>segmentDistance(points[a],p,q)<1e-5&&segmentDistance(points[b],p,q)<1e-5));
    return protectedEdges.get(key);
  };
  for(let pass=0;pass<24;pass++) {
    const edges=new Map(),used=new Set();let changed=0;
    for(let k=0;k<faces.length;k++)for(let e=0;e<3;e++) {
      const a=faces[k][e],b=faces[k][(e+1)%3],c=faces[k][(e+2)%3],key=Math.min(a,b)+':'+Math.max(a,b);
      if(!edges.has(key)){edges.set(key,{k,a,b,c});continue;}
      const old=edges.get(key),d=old.c;
      if(used.has(k)||used.has(old.k)||c===d||protectedEdge(key,a,b))continue;
      if(cross(points[a],points[b],points[c])*cross(points[a],points[b],points[d])>=0||cross(points[c],points[d],points[a])*cross(points[c],points[d],points[b])>=0)continue;
      const before=Math.min(quality(a,b,c),quality(a,b,d)),after=Math.min(quality(c,d,a),quality(c,d,b));
      if(after<=before*1.000001+1e-12)continue;
      faces[k]=[c,d,a];faces[old.k]=[d,c,b];used.add(k);used.add(old.k);changed++;
    }
    if(!changed)break;
  }
  return faces.map(f=>f.map(i=>points[i]));
}
export function clothGeometry(authoring) {
  const outer = authoring.contour, holes = authoring.holes || [], all = outer.concat(...holes);
  const faces = ShapeUtils.triangulateShape(outer.map(p => new Vector2(...p)), holes.map(h => h.map(p => new Vector2(...p))));
  let polys = faces.map(f => f.map(i => all[i]));
  // Insert fixed-region boundaries before refinement. No triangle straddles a
  // fixed edge; mobility cannot leak across a large interpolation triangle.
  for (const region of authoring.fixedRegions) for (let i = 0; i < region.length; i++) {
    polys = polys.flatMap(p => split(p, region[i], region[(i + 1) % region.length]));
    if (polys.length > 12000) throw Error('固定区过于复杂，请减少控制点或拆分活动区');
  }
  for(const [a,b]of authoring.cutLines||[]){polys=polys.flatMap(p=>split(p,a,b));if(polys.length>12000)throw Error('活动轴过于复杂，请减少控制节');}
  let triangles = conformTriangles(polys.flatMap(p => p.slice(1, -1).map((_, i) => [p[0], p[i + 1], p[i + 2]])));
  const constraints=[...authoring.fixedRegions.flatMap(region=>region.map((a,i)=>[a,region[(i+1)%region.length]])),...(authoring.cutLines||[])];
  triangles=conditionTriangles(triangles,constraints);
  const levels = authoring.subdivisions ?? 2;
  for (let level = 0; level < levels; level++) {if(triangles.length>20000)throw Error('网格细分超出作者容量');triangles = triangles.flatMap(([a, b, c]) => {
    const ab = a.map((v, i) => (v + b[i]) / 2), bc = b.map((v, i) => (v + c[i]) / 2), ca = c.map((v, i) => (v + a[i]) / 2);
    return [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]];
  });}
  const vertices = [], indices = [], catalog = new Map();
  const index = p => {
    const key = p.map(v => Math.round(v * 1e6)).join(',');
    if (!catalog.has(key)) { catalog.set(key, vertices.length / 2); vertices.push(...p); }
    return catalog.get(key);
  };
  for (const face of triangles) {
    const area = cross(...face); if (Math.abs(area) < 1e-7) continue;
    indices.push(...(area > 0 ? face : [face[0], face[2], face[1]]).map(index));
  }
  if (vertices.length > 60000 || !indices.length) throw Error('布片网格为空或超过作者容量');
  return { rest: vertices, indices };
}
export function strandGeometry(authoring) {
  const line = authoring.centerline, widths = authoring.widths, rest = [], indices = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
    if (length < 1e-6) throw Error('发束中心线有重合控制点');
    const n = [-dy / length, dx / length], width = widths[i];
    for (const s of [-1, 0, 1]) rest.push(line[i][0] + n[0] * width * s / 2, line[i][1] + n[1] * width * s / 2);
    if (i) for (let x = 0; x < 2; x++) { const k = (i - 1) * 3 + x; indices.push(k, k + 1, k + 3, k + 1, k + 4, k + 3); }
  }
  // An original curve may reverse its overall winding; retain each original
  // triangle orientation and require the same orientation after deformation.
  return { rest, indices };
}
export function refineControlGeometry(control,levels){
  const rest=[...control.rest],samples=Array.from({length:rest.length/2},(_,i)=>[i,i,i,1,0,0]);let indices=[...control.indices];
  for(let level=0;level<levels;level++){
    const edges=new Map(),next=[];
    const midpoint=(a,b)=>{const key=Math.min(a,b)+':'+Math.max(a,b);if(edges.has(key))return edges.get(key);const id=rest.length/2;rest.push((rest[a*2]+rest[b*2])/2,(rest[a*2+1]+rest[b*2+1])/2);
      const weights=new Map();for(const index of [a,b]){const row=samples[index];for(let j=0;j<3;j++)weights.set(row[j],(weights.get(row[j])||0)+row[j+3]/2);}const values=[...weights].filter(([,w])=>w>0);if(values.length>3)throw Error('显示网格跨越独立控制三角形');while(values.length<3)values.push([values[0][0],0]);samples.push([...values.map(([n])=>n),...values.map(([,w])=>w)]);edges.set(key,id);return id;};
    for(let k=0;k<indices.length;k+=3){const a=indices[k],b=indices[k+1],c=indices[k+2],ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}indices=next;
    if(rest.length>60000)throw Error('显示网格超过作者容量');
  }
  return {rest,indices,samples};
}
export function gridControlGeometry(authoring,supports){
  const [columns,rows]=authoring.controlGrid,outer=authoring.contour;
  const min=[0,1].map(k=>Math.min(...outer.map(p=>p[k]))),max=[0,1].map(k=>Math.max(...outer.map(p=>p[k])));
  const axes=[columns,rows].map((count,k)=>{
    const values=Array.from({length:count+1},(_,i)=>min[k]+(max[k]-min[k])*i/count);
    // An authored support must be a real control vertex, even on a small cuff.
    for(const s of supports){const value=clamp(s.at[k],min[k],max[k]),nearest=values.reduce((n,v,i)=>Math.abs(v-value)<Math.abs(values[n]-value)?i:n,0);if(nearest>0&&nearest<values.length-1&&Math.abs(values[nearest]-value)<(max[k]-min[k])/count*.2)values[nearest]=value;else if(!values.includes(value))values.push(value);}
    return values.sort((a,b)=>a-b);
  });
  const [xs,ys]=axes,rest=[],indices=[];for(const y of ys)for(const x of xs)rest.push(x,y);
  for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++){const a=y*xs.length+x,b=a+1,c=a+xs.length,d=c+1;indices.push(a,b,c,b,d,c);}
  // A point a rounding error beyond the last axis belongs to the last cell.
  // findIndex=-1 must never wrap that source pixel back to the first cell.
  const cell=(axis,v)=>{const end=axis.findIndex((p,i)=>i>0&&p>=v);return end<0?axis.length-2:Math.max(0,end-1);};
  const sample=([x,y])=>{const ix=cell(xs,x),iy=cell(ys,y),u=clamp((x-xs[ix])/(xs[ix+1]-xs[ix]),0,1),v=clamp((y-ys[iy])/(ys[iy+1]-ys[iy]),0,1),a=iy*xs.length+ix,b=a+1,c=a+xs.length,d=c+1;return u+v<=1?[a,b,c,1-u-v,u,v]:[b,d,c,1-v,u+v-1,1-u];};
  return {rest,indices,sample};
}
export function geometryFor(component) {
  const a = component.authoring;
  return component.kind === 'strand' ? (()=>{const strip=strandGeometry(a),n=a.centerline.length,contour=[];for(let i=0;i<n;i++)contour.push(strip.rest.slice(i*6,i*6+2));for(let i=n-1;i>=0;i--)contour.push(strip.rest.slice(i*6+4,i*6+6));const cutLines=[];for(let i=1;i<n-1;i++)cutLines.push([strip.rest.slice(i*6,i*6+2),strip.rest.slice(i*6+4,i*6+6)]);return clothGeometry({contour:a.contour||contour,holes:a.holes,fixedRegions:a.fixedRegions,cutLines,subdivisions:0});})() : component.kind === 'pendant'
    ? clothGeometry({ contour: a.contour, holes: a.holes, fixedRegions: [], subdivisions: 0 }) : clothGeometry(a);
}
export function mobilityAt(p, authoring) {
  const d = Math.min(...authoring.fixedRegions.map(poly => polygonDistance(p, poly)));
  return d <= 1e-6 ? 0 : smooth(d / authoring.transitionPixels);
}
export function meshCoverage(rest,indices,bounds,rgba) {
  const covered=new Uint8Array(bounds.width*bounds.height);
  for(let k=0;k<indices.length;k+=3){
    const points=Array.from(indices.slice(k,k+3),i=>[rest[i*2]-bounds.x,rest[i*2+1]-bounds.y]);
    const minX=Math.max(0,Math.floor(Math.min(...points.map(p=>p[0])))),maxX=Math.min(bounds.width-1,Math.ceil(Math.max(...points.map(p=>p[0]))));
    const minY=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1])))),maxY=Math.min(bounds.height-1,Math.ceil(Math.max(...points.map(p=>p[1]))));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(barycentric([x+.5,y+.5],...points))covered[y*bounds.width+x]=1;
  }
  let opaque=0,missing=0;const examples=[];
  for(let i=0;i<covered.length;i++)if(rgba[i*4+3]>0){opaque++;if(!covered[i]){missing++;if(examples.length<8)examples.push([bounds.x+i%bounds.width,bounds.y+Math.floor(i/bounds.width)]);}}
  return {opaque,missing,ratio:missing/Math.max(1,opaque),examples};
}
