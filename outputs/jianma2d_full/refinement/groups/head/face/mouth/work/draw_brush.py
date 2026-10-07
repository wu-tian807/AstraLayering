from mouth import *
from perfect_freehand import get_stroke
import math,importlib.metadata
assert importlib.metadata.version('perfect-freehand')=='1.2.0'
begin('part_brush_lines')
for key in PARTS:
 p=part(key);src=next(e for e in p if e.get('id')==IDS[key]+'_source_curves');src.set('display','none');save(p)
p,g=layer('upper_lip','brush');source=next(e for e in p.iter() if e.get('id')==IDS['upper_lip']+'_source_curves_contact_seam')
curves=[[(429.2,296.3),(431.0,295.85),(433.0,295.45),(435.1,295.35)],[(435.1,295.35),(436.5,295.3),(437.7,295.9),(439.1,295.8)],[(439.1,295.8),(442.1,295.45),(445.8,295.2),(448.55,295.55)]]
xy=[]
for i,c in enumerate(curves):
 for j in range(101):
  if i and j==0:continue
  t=j/100;s=1-t;xy.append(tuple(s*s*s*c[0][a]+3*s*s*t*c[1][a]+3*s*t*t*c[2][a]+t*t*t*c[3][a] for a in (0,1)))
lengths=[0]
for a,b in zip(xy,xy[1:]):lengths.append(lengths[-1]+math.hypot(b[0]-a[0],b[1]-a[1]))
knots=[(0,.03),(.14,.70),(.28,.45),(.45,.17),(.65,.25),(.85,.68),(1,.02)];points=[]
for (x,y),dist in zip(xy,lengths):
 u=dist/lengths[-1]
 for (a,pa),(b,pb) in zip(knots,knots[1:]):
  if a<=u<=b:q=(u-a)/(b-a);pressure=pa+(pb-pa)*(q*q*(3-2*q));break
 points.append((x,y,pressure))
k=16;result=get_stroke([(x*k,y*k,pr) for x,y,pr in points],size=.75*k,thinning=.6,streamline=0,smoothing=.5,simulate_pressure=False,last=True,taper_start=.5*k,taper_end=.6*k,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t))
d='M '+' L '.join(f'{x/k:.5f} {y/k:.5f}' for x,y in result)+' Z'
soft=blur(p,'seam_edge_softness',.055)
e=path(g,'contact_seam',d,'Actual perfect_freehand1.2.0 generated from the retained contact_seam:301 dense samples, explicit pressure by cumulative arc length. Corners moderately stronger, center lighter; tapered endpoints and subtle separate edge softness. Single upper-lip-owned line, clipped by complete upper lip. Hidden outer arcs and color helpers remain uninked.',fill='#8e7c84',opacity='.65',filter=soft,stroke='none');e.set('data-source-curve',source.get('id'));e.set('data-pressure-samples','work/contact-seam-pressure.json');save(p)
(T/'contact-seam-pressure.json').write_text(json.dumps({'source_curve':source.get('id'),'source_d':source.get('d'),'samples':points,'pressure_parameter':'cumulative arc length','pressure_knots':knots,'size':.75,'thinning':.6,'simulate_pressure':False,'streamline':0,'internal_scale':16,'taper_start':.5,'taper_end':.6,'edge_softness_sigma':.055},ensure_ascii=False,indent=2)+'\n')
print(board('part_brush_lines',line=True))
