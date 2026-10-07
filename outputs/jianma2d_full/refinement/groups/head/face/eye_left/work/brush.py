from eye import *
from perfect_freehand import get_stroke
import math
begin('part_brush_lines')
for key in PARTS:
 p=part(key);src=next(e for e in p if e.get('id')==IDS[key]+'_source_curves');src.set('display','none');save(p)
p,g=layer('lower_eyelid','brush');src=next(e for e in p.iter() if e.get('id')==IDS['lower_eyelid']+'_source_curves_contact_rim')
curves=[[(388,248.1),(387.8,249.8),(388.2,251.25),(389.25,252.9)],[(389.25,252.9),(392.6,257.05),(397.4,259.78),(403.8,259.68)],[(403.8,259.68),(410.6,259.68),(415.7,256.92),(417.7,251.95)]]
xy=[]
for i,c in enumerate(curves):
 for j in range(101):
  if i and j==0:continue
  t=j/100;s=1-t;xy.append(tuple(s*s*s*c[0][a]+3*s*s*t*c[1][a]+3*s*t*t*c[2][a]+t*t*t*c[3][a] for a in (0,1)))
for j in range(1,21):t=j/20;xy.append((417.7+1.6*t,251.95-1.45*t))
lengths=[0]
for a,b in zip(xy,xy[1:]):lengths.append(lengths[-1]+math.hypot(b[0]-a[0],b[1]-a[1]))
knots=[(0,.12),(.10,.45),(.18,.83),(.27,.92),(.38,.42),(.60,.25),(.82,.30),(.92,.16),(1,.02)];points=[]
for (x,y),distance in zip(xy,lengths):
 u=distance/lengths[-1]
 for (a,pa),(b,pb) in zip(knots,knots[1:]):
  if a<=u<=b:q=(u-a)/(b-a);v=pa+(pb-pa)*(q*q*(3-2*q));break
 points.append((x,y,v))
k=16;stroke=get_stroke([(x*k,y*k,v) for x,y,v in points],size=1.05*k,thinning=.68,streamline=0,smoothing=.6,simulate_pressure=False,last=True,taper_start=1.5*k,taper_end=3.5*k,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t))
d='M '+' L '.join(f'{x/k:.5f} {y/k:.5f}' for x,y in stroke)+' Z'
e=path(g,'contact_rim',d,'Actual perfect_freehand 1.2.0 from '+src.get('id')+'; 321 dense samples, pressure parameterized by cumulative arc length. Explicit stronger short temporal segment, lighter lower centre and early nasal taper over the short joining line. simulate_pressure=False, streamline=0, 16x internal scale unscaled; source geometry unchanged and complete skin ribbon clips brush.',fill='#857b80',stroke='none');e.set('data-source-curve',src.get('id'));e.set('data-pressure-samples','work/contact-rim-pressure.json');save(p)
(T/'contact-rim-pressure.json').write_text(json.dumps({'source':src.get('d'),'samples':points,'pressure_knots':knots,'pressure_parameter':'arc length','size':1.05,'internal_scale':16,'thinning':.68,'taper_start':1.5,'taper_end':3.5,'simulate_pressure':False,'streamline':0},indent=2)+'\n')
print(board('part_brush_lines',line=True))
