from mouth import *
from perfect_freehand import get_stroke
import math
begin('part_highlights')
p,g=layer('upper_lip','surface_lights');source=next(e for e in p.iter() if e.get('id')==IDS['upper_lip']+'_source_curves_upper_reflection_range')
curves=[[(430.1,294.35),(431.9,292.9),(433.6,292.2),(435.5,291.8)],[(435.5,291.8),(436.6,291.8),(437.6,292.25),(438.9,292.05)],[(438.9,292.05),(441.7,292.05),(444.7,292.7),(447.7,294.3)]]
xy=[]
for i,c in enumerate(curves):
 for j in range(101):
  if i and j==0:continue
  t=j/100;s=1-t;xy.append(tuple(s*s*s*c[0][a]+3*s*s*t*c[1][a]+3*s*t*t*c[2][a]+t*t*t*c[3][a] for a in (0,1)))
lens=[0]
for a,b in zip(xy,xy[1:]):lens.append(lens[-1]+math.hypot(b[0]-a[0],b[1]-a[1]))
knots=[(0,0),(.15,.50),(.38,.70),(.65,.55),(.85,.42),(1,0)];pts=[]
for (x,y),distance in zip(xy,lens):
 u=distance/lens[-1]
 for (a,pa),(b,pb) in zip(knots,knots[1:]):
  if a<=u<=b:q=(u-a)/(b-a);v=pa+(pb-pa)*(q*q*(3-2*q));break
 pts.append((x,y,v))
k=16;stroke=get_stroke([(x*k,y*k,v) for x,y,v in pts],size=1.0*k,thinning=.4,streamline=0,smoothing=.6,simulate_pressure=False,last=True,taper_start=1.0*k,taper_end=1.3*k,taper_start_ease=lambda t:t*t*(3-2*t),taper_end_ease=lambda t:t*t*(3-2*t));d='M '+' L '.join(f'{x/k:.5f} {y/k:.5f}' for x,y in stroke)+' Z';soft=blur(p,'upper_reflection_soft',.26)
e=path(g,'upper_roll_reflection',d,'Narrow soft pale reflection on the upper lip roll, traced from the retained reflection-range curve. Tapered into both corners, brighter around offset cupid rise. Surface-attached paint follows this same physical upper lip, so no separate cross-part follow/receiver layer is needed. Raw closed contour and source remain editable.',fill='#fffaf7',opacity='.95',filter=soft,stroke='none');e.set('data-source-curve',source.get('id'));under_brush(p,g);save(p)
(T/'upper-reflection-pressure.json').write_text(json.dumps({'source_curve':source.get('id'),'source_d':source.get('d'),'samples':pts,'pressure_knots':knots,'size':1,'thinning':.4,'simulate_pressure':False,'streamline':0,'internal_scale':16,'taper_start':1,'taper_end':1.3,'edge_softness_sigma':.26},ensure_ascii=False,indent=2)+'\n')
p,g=layer('lower_lip','surface_lights');fill=grad(p,'lower_diffuse_reflection','radialGradient',{'gradientUnits':'userSpaceOnUse','cx':'0','cy':'0','r':'1','gradientTransform':'translate(438 297.2) scale(6.1 0.7)'},[(0,'#fff6ec',.18),(.5,'#fff6ec',.07),(1,'#fff6ec',0)]);d=next(d for source,d in guide_paths('lower_lip') if source.endswith('visible-surface'));path(g,'lower_diffuse_reflection',d,'Pale broad surface reflection follows lower lip, with diffuse edges and no isolated white dot. Retains soft thin lower-lip color fade. No independent optical motion relative to this lip is represented.',fill=fill,stroke='none');under_brush(p,g);save(p)
p=part('mouth_interior');add(p,'desc',text='4.6: closed reference provides no inner glossy spot or tooth highlight. Existing smooth concealed depth field retained, with no invented light or extra optical layer.');save(p)
print(board('part_highlights',context=True))
