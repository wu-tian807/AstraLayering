import sys,re,math,json,importlib.metadata
sys.path.insert(0,'refinement/groups/legs/right_leg/work');import toolkit as a
from perfect_freehand import get_stroke
assert importlib.metadata.version('perfect-freehand')=='1.2.0'
def sample(d):
 tok=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d);i=0;p=(0,0);out=[]
 while i<len(tok):
  cmd=tok[i];i+=1
  if cmd=='M':p=tuple(map(float,tok[i:i+2]));i+=2;out.append(p)
  elif cmd=='C':
   v=list(map(float,tok[i:i+6]));i+=6;c1,c2,q=(v[0],v[1]),(v[2],v[3]),(v[4],v[5]);count=max(16,math.ceil(sum(math.dist(x,y) for x,y in [(p,c1),(c1,c2),(c2,q)])*1.1))
   for k in range(1,count+1):
    t=k/count;u=1-t;out.append(tuple(u**3*p[j]+3*u*u*t*c1[j]+3*u*t*t*c2[j]+t**3*q[j] for j in range(2)))
   p=q
  else:raise ValueError(cmd)
 return out
a.start_stage('part_brush_lines');records=[]
for n in ['thigh','lower_leg']:
 p,g=a.layer(n,'brush');g.set('clip-path','url(#'+a.pid(n)+'_clip)');geo=next(e for e in p if e.get('id')==a.pid(n)+'_geometry');geo.set('display','none')
 for side in ['outer','inner']:
  source=next(e for e in geo if e.get('id')==a.pid(n)+'_contour_'+side);xy=sample(source.get('d'));points=[]
  for i,(x,y) in enumerate(xy):
   t=i/(len(xy)-1);pr=.39+.17*math.sin(math.pi*t)**.7
   if side=='inner':pr*=.86
   points.append((x,y,pr))
  stroke=get_stroke(points,size=1.65,thinning=.68,smoothing=.45,streamline=0,simulate_pressure=False,last=True,taper_start=7,taper_end=9,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t))
  d='M '+' L '.join(f'{x:.4f} {y:.4f}' for x,y in stroke)+' Z'
  a.path(g,a.pid(n)+'_ink_'+side,d,'来源 '+source.get('id')+'；perfect-freehand 1.2.0 密采样显式压力，simulate_pressure=False、streamline=0，size1.65/thinning.68，起7px收9px尖；内缘减压，原外缘半幅裁切，圆端不描线。',fill='#9e8b89',opacity='.84',data_source_curve=source.get('id'))
  records.append({'part':n,'source':source.get('id'),'samples':len(points),'pressure_range':[min(p[2] for p in points),max(p[2] for p in points)],'simulate_pressure':False,'streamline':0,'version':'1.2.0'})
 a.save(p)
(a.P/'work/brush-provenance.json').write_text(json.dumps(records,indent=2)+'\n');print(a.board('part_brush_lines',line=True))
