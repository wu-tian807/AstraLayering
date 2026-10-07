from pathlib import Path
import re,json,xml.etree.ElementTree as E,subprocess,os
from fractions import Fraction as F
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/outer_back_curtain/1.父级轮廓补全';R=(W/'../../workflow-next/live2d-layering').resolve()
text=(N/'input-groups.svg').read_text();root=E.fromstring(text);ID='head-rear-hair-left-outer-back-curtain-outer-main';path=next(e for e in root.iter() if e.get('id')==ID);d=path.get('d')
toks=re.findall('[A-Za-z]|[-+]?(?:[0-9]*\\.)?[0-9]+',d);out=[];i=0;proof=[]
def pair(vals):return tuple(F(v) for v in vals)
def mid(a,b):return tuple((a[k]+b[k])/2 for k in range(2))
def fmt(p):return ' '.join(format(float(v),'.12g') for v in p)
def point(ps,t):
 u=1-t;return tuple(u**3*ps[0][k]+3*u*u*t*ps[1][k]+3*u*t*t*ps[2][k]+t**3*ps[3][k] for k in range(2))
while i<len(toks):
 c=toks[i];i+=1
 if c=='M':
  cur=pair(toks[i:i+2]);i+=2;start=cur;out.append('M '+fmt(cur))
 elif c=='C':
  p1=pair(toks[i:i+2]);p2=pair(toks[i+2:i+4]);p3=pair(toks[i+4:i+6]);i+=6
  a=mid(cur,p1);b=mid(p1,p2);cc=mid(p2,p3);e=mid(a,b);f=mid(b,cc);q=mid(e,f)
  old=(cur,p1,p2,p3);left=(cur,a,e,q);right=(q,f,cc,p3)
  # Cubic polynomials are identical if equal at four distinct exact rational parameters.
  for t in (F(0),F(1,3),F(2,3),F(1)):
   assert point(left,t)==point(old,t/2)
   assert point(right,t)==point(old,(t+1)/2)
  proof.append({'original':[fmt(p) for p in old],'left':[fmt(p) for p in left],'right':[fmt(p) for p in right],'exact_rational_polynomial_identity':True})
  out.extend(['C '+fmt(a)+' '+fmt(e)+' '+fmt(q),'C '+fmt(f)+' '+fmt(cc)+' '+fmt(p3)]);cur=p3
 elif c=='L':
  cur=pair(toks[i:i+2]);i+=2;out.append('L '+fmt(cur))
 elif c=='Z':out.append('Z');cur=start
 else:raise ValueError(c)
newd=' '.join(out);assert text.count('d="'+d+'"')==1
(N/'candidate-r2-subdivided.svg').write_text(text.replace('d="'+d+'"','d="'+newd+'"',1))
(N/'equivalence-proof-r2.json').write_text(json.dumps({'method':'Every original cubic split once at t=1/2 using exact de Casteljau rationals','original_cubics':len(proof),'new_cubics':len(proof)*2,'outline_geometry_changed':False,'all_endpoints_preserved':True,'all_subpaths_and_fill_rules_preserved':True,'clip_unchanged':True,'identity_tests':'Each cubic polynomial equal at 4 exact rational t values in each half; therefore coefficient-identical. Output decimals terminate exactly.','segments':proof},ensure_ascii=False,indent=2)+'\n')
cmd=[str(W/'.runtime/svg-preview/python/bin/python'),str(R/'tools/svg_containment.py'),'--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r2-subdivided.svg'),'--groups',str(W/'structure/groups.json'),'--group-path','head/rear_hair_left','--out',str(N/'r2-containment.json')]
p=subprocess.run(cmd,env=dict(os.environ,TMPDIR=str(N/'tmp')),capture_output=True,text=True);print(p.returncode,p.stdout,p.stderr);(N/'r2-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n')
