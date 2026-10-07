from eye import *
from perfect_freehand import get_stroke
import math
begin('part_brush_lines')
for key in PARTS:
 p=part(key);src=next(e for e in p if e.get('id')==IDS[key]+'_source_curves');src.set('display','none');save(p)
p,g=layer('lower_eyelid','brush');src=next(e for e in p.iter() if e.get('id')==IDS['lower_eyelid']+'_source_curves_contact_rim')
curves=[[(453,248.9),(454.7,251),(457.2,253.85),(461.18,255.45)],[(461.18,255.45),(467.6,257.64),(477.3,256.95),(482.45,253.65)],[(482.45,253.65),(486.2,251.15),(488.8,247.1),(488.3,243.95)]]
points=[]
knots=[(0,.1),(.15,.6),(.38,.32),(.6,.25),(.8,.65),(.92,.8),(1,.12)]
for i,curve in enumerate(curves):
 for j in range(101):
  if i and j==0:continue
  t=j/100;s=1-t;x=s*s*s*curve[0][0]+3*s*s*t*curve[1][0]+3*s*t*t*curve[2][0]+t*t*t*curve[3][0];y=s*s*s*curve[0][1]+3*s*s*t*curve[1][1]+3*s*t*t*curve[2][1]+t*t*t*curve[3][1];u=(i+t)/3
  for (a,pa),(b,pb) in zip(knots,knots[1:]):
   if a<=u<=b:q=(u-a)/(b-a);pressure=pa+(pb-pa)*(q*q*(3-2*q));break
  points.append((x,y,pressure))
k=16;stroke=get_stroke([(x*k,y*k,v) for x,y,v in points],size=.95*k,thinning=.65,streamline=0,smoothing=.6,simulate_pressure=False,last=True,taper_start=1.8*k,taper_end=1.4*k,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t))
d='M '+' L '.join(f'{x/k:.5f} {y/k:.5f}' for x,y in stroke)+' Z'
e=path(g,'contact_rim',d,'Actual perfect_freehand 1.2.0 from '+src.get('id')+'; 301 dense explicit-pressure samples. simulate_pressure=False, streamline=0; 16x internal coordinates unscaled to preserve subpixel taper. Inner rise, light centre, firmer outer corner and tapered endpoints; complete guide ribbon clips the brush; hidden lower arc has no visible ink.',fill='#857b80',stroke='none');e.set('data-source-curve',src.get('id'));e.set('data-pressure-samples','work/contact-rim-pressure.json');save(p)
(T/'contact-rim-pressure.json').write_text(json.dumps({'source':src.get('d'),'samples':points,'pressure_knots':knots,'size':.95,'internal_scale':16,'thinning':.65,'taper_start':1.8,'taper_end':1.4,'simulate_pressure':False,'streamline':0},indent=2)+'\n')
print(board('part_brush_lines',line=True))
