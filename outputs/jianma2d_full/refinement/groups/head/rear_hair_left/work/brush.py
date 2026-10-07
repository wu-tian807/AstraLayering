import re,math
from perfect_freehand import get_stroke
from rear_left_ops import *
def samples(d):
 tok=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',d);i=0;p=None;pts=[];start=None
 while i<len(tok):
  cmd=tok[i];i+=1
  if cmd=='Z':v=list(start)
  else:
   n={'M':2,'L':2,'C':6}[cmd];v=list(map(float,tok[i:i+n]));i+=n
  if cmd=='M':p=(v[0],v[1]);start=p;pts.append(p);continue
  if cmd in ('L','Z'):
   q=tuple(v);n=max(2,math.ceil(math.dist(p,q)/.55))
   pts.extend(((1-t)*p[0]+t*q[0],(1-t)*p[1]+t*q[1]) for t in [k/n for k in range(1,n+1)]);p=q;continue
  a,b,q=tuple(v[:2]),tuple(v[2:4]),tuple(v[4:]);n=max(8,math.ceil((math.dist(p,a)+math.dist(a,b)+math.dist(b,q))/.55))
  for k in range(1,n+1):
   t=k/n;u=1-t;pts.append(tuple(u*u*u*p[j]+3*u*u*t*a[j]+3*u*t*t*b[j]+t*t*t*q[j] for j in (0,1)))
  p=q
 return pts
def redraw():
 report=[];gs=[]
 for id in IDS:
  g=group(id);defs=next(n for n in g if n.tag==tag('defs'));geo=byid(g,id+'_geometry');geo.set('display','none')
  clip=elem('clipPath',{'id':id+'_surface_clip','clipPathUnits':'userSpaceOnUse'})
  for n in byid(g,id+'_surfaces'):
   clip.append(elem('path',{'d':n.get('d'),'fill-rule':n.get('fill-rule','nonzero')}))
  defs.append(clip);f=elem('filter',{'id':id+'_line_soft','x':'-5%','y':'-5%','width':'110%','height':'110%'});f.append(elem('feGaussianBlur',{'stdDeviation':.12}));defs.append(f)
  ink=elem('g',{'id':id+'_ink','clip-path':'url(#'+id+'_surface_clip)'});g.append(ink)
  for src in geo:
   if src.get('data-final')!='visible':continue
   pts=samples(src.get('d'));dist=[0.]
   for a,b in zip(pts,pts[1:]):dist.append(dist[-1]+math.dist(a,b))
   length=dist[-1];pressure=[.18+.65*max(0.0,math.sin(math.pi*x/length))**.65 for x in dist]
   scale=16;size=float(src.get('stroke-width'));role=src.get('data-role');taper=min(length*.1,10 if role=='contour' else 13)
   inp=[(x*scale,y*scale,p) for (x,y),p in zip(pts,pressure)]
   poly=get_stroke(inp,size=size*scale,streamline=0,simulate_pressure=False,thinning=.7,smoothing=.55,last=True,taper_start=taper*scale,taper_end=taper*scale,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t))
   pd='M '+' L '.join(f'{x/scale:.4f} {y/scale:.4f}' for x,y in poly)+' Z'
   n=elem('path',{'id':src.get('id').replace('_source_','_brush_'),'data-source':src.get('id'),'data-role':role,'data-brush':'perfect-freehand-1.2.0','d':pd,'fill':'#7E8595','stroke':'none','opacity':.78 if role=='contour' else .6 if role=='structure' else .4})
   if role!='contour':n.set('filter','url(#'+id+'_line_soft)')
   note(n,'实际perfect_freehand1.2.0；沿原曲线密集采样显式pressure，simulate_pressure=False/streamline=0；16倍坐标与size/taper同步计算再精确缩回，保证亚像素细线。压力由两端0.18渐至中段0.83，首尾taper。'+''.join(x.text or '' for x in src if x.tag==tag('desc')))
   ink.append(n);report.append({'source':src.get('id'),'points':len(inp),'outline_points':len(poly),'size':size,'taper_px':taper,'pressure_minmax':[min(pressure),max(pressure)],'source_sha256':hashlib.sha256(src.get('d').encode()).hexdigest()})
  gs.append(g)
 put_groups(gs);return report
if __name__=='__main__':
 d=G/'3.geometry/3.5.画笔重绘';d.mkdir(exist_ok=True);report=redraw();(d/'brush-samples.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');preview_parts(d)
