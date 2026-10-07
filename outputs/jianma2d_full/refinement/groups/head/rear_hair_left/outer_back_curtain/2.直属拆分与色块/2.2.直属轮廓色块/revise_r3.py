from pathlib import Path
from fractions import Fraction as F
import json,re,xml.etree.ElementTree as E,subprocess
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');text=(N/'candidate-r2.svg').read_text();root=E.fromstring(text);proof=[]
def split_exact(points,t=F(3,8)):
 p=[tuple(F(v) for v in row) for row in points]
 def lerp(a,b):return tuple((1-t)*a[k]+t*b[k] for k in range(2))
 a,b,c=lerp(p[0],p[1]),lerp(p[1],p[2]),lerp(p[2],p[3]);d,e=lerp(a,b),lerp(b,c);q=lerp(d,e)
 def fmt(pt):return ' '.join(format(float(v),'.15g') for v in pt)
 def point(ps,u):return tuple((1-u)**3*ps[0][k]+3*(1-u)**2*u*ps[1][k]+3*(1-u)*u*u*ps[2][k]+u**3*ps[3][k] for k in range(2))
 for u in [F(0),F(1,3),F(2,3),F(1)]:
  assert point([p[0],a,d,q],u)==point(p,u*t)
  assert point([q,e,c,p[3]],u)==point(p,t+u*(1-t))
 proof.append({'original':[fmt(pt) for pt in p],'parameter':'3/8','left':[fmt(pt) for pt in [p[0],a,d,q]],'right':[fmt(pt) for pt in [q,e,c,p[3]]],'exact_polynomial_identity':True})
 return 'C '+fmt(a)+' '+fmt(d)+' '+fmt(q)+' C '+fmt(e)+' '+fmt(c)+' '+fmt(p[3])
for el in root.iter():
 pid=el.get('id','')
 if not pid.startswith('node22-') or not pid.endswith('-silhouette'):continue
 old=el.get('d');new=old
 if pid=='node22-upper-loop-lock-silhouette':new=new.replace('C 312 508 315 491 316 477 C 320 454','C 312 508 313.5 491 315 477 C 319 454')
 if 'C 223 737 210 776 194 811' in new:new=new.replace('C 223 737 210 776 194 811',split_exact([(235,693),(223,737),(210,776),(194,811)]))
 if pid=='node22-inner-forked-lock-silhouette':new=new.replace('C 332 1234 343 1194 346 1154',split_exact([(319,1278),(332,1234),(343,1194),(346,1154)]))
 if pid=='node22-pointed-long-lock-silhouette':new=new.replace('C 176 1492 213 1469 239 1449',split_exact([(147,1487),(176,1492),(213,1469),(239,1449)]))
 tag=re.search(r'<path\b[^>]*id="'+re.escape(pid)+r'"[^>]*>',text).group(0);text=text.replace(tag,tag.replace('d="'+old+'"','d="'+new+'"'),1)
(N/'candidate-r3.svg').write_text(text);(N/'r3-changes.json').write_text(json.dumps({'hidden_attachment_revision':'upper_loop narrow throat inner return moved to x315 at y477 with x313.5 control at y491, to follow the parent concavity without crossing it','shared_visible_boundary_representations':'Exact cubic subdivisions at 3/8; same continuous curves, not a tolerance or contour shrink','proof':proof},ensure_ascii=False,indent=2)+'\n')
cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_containment.py','--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r3.svg'),'--groups','structure/groups.json','--group-path','head/rear_hair_left/outer_back_curtain','--out',str(N/'r3-bounds.json')];p=subprocess.run(cmd,text=True,capture_output=True);(N/'r3-bounds-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n');print(p.stdout,p.stderr)
