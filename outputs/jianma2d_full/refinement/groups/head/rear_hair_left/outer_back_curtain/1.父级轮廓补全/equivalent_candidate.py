from pathlib import Path
import re,json,xml.etree.ElementTree as E,subprocess,os
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/outer_back_curtain/1.父级轮廓补全';R=(W/'../../workflow-next/live2d-layering').resolve()
text=(N/'input-groups.svg').read_text();root=E.fromstring(text);ID='head-rear-hair-left-outer-back-curtain-outer-main';path=next(e for e in root.iter() if e.get('id')==ID);d=path.get('d')
def parse(d):
 tokens=re.findall('[A-Za-z]|[-+]?(?:[0-9]*\\.)?[0-9]+',d);subs=[];i=0
 while i<len(tokens):
  c=tokens[i];i+=1
  if c=='M':
   start=tuple(map(float,tokens[i:i+2]));i+=2;sub=[];p=start
  elif c=='C':
   q=list(map(float,tokens[i:i+6]));i+=6;end=tuple(q[4:6]);sub.append(('C',p,tuple(q[:2]),tuple(q[2:4]),end));p=end
  elif c=='L':
   end=tuple(map(float,tokens[i:i+2]));i+=2;sub.append(('L',p,end));p=end
  elif c=='Z':
   if p!=start:sub.append(('L',p,start))
   subs.append(sub)
  else:raise ValueError(c)
 return subs
subs=parse(d)
def fmt(p):return ' '.join(format(v,'.12g') for v in p)
def reverse(sub):
 out=['M '+fmt(sub[-1][-1])]
 for s in reversed(sub):
  out.append(('C '+fmt(s[3])+ ' '+fmt(s[2])+' '+fmt(s[1])) if s[0]=='C' else 'L '+fmt(s[1]))
 return ' '.join(out)+' Z'
def area(sub):
 points=[]
 for s in sub:
  if s[0]=='C':
   for i in range(32):
    t=i/32;u=1-t;points.append(tuple(u**3*s[1][k]+3*u*u*t*s[2][k]+3*u*t*t*s[3][k]+t**3*s[4][k] for k in range(2)))
  else:points.append(s[1])
 return sum(points[i][0]*points[(i+1)%len(points)][1]-points[(i+1)%len(points)][0]*points[i][1] for i in range(len(points)))/2
areas=[area(s) for s in subs];assert all(a*areas[0]>0 for a in areas)
new_d=d.split(' Z M ')[0]+' Z '+' '.join(reverse(s) for s in subs[1:])
# Reversing the exact cubic sequence is an identity: endpoints unchanged,
# C(P0,P1,P2,P3,t) == C(P3,P2,P1,P0,1-t); evenodd holes become opposite winding.
new=text.replace('d="'+d+'"','d="'+new_d+'"',1)
oldtag=re.search(r'<(?:\w+:)?path\b[^>]*id="'+re.escape(ID)+r'"[^>]*>',new).group(0)
newtag=oldtag.replace('fill-rule="evenodd"','fill-rule="nonzero"')
assert newtag!=oldtag;new=new.replace(oldtag,newtag,1);(N/'candidate-r1-winding.svg').write_text(new)
(N/'equivalence-proof-r1.json').write_text(json.dumps({'representation':'Explicit opposite-winding holes with nonzero fill','outer_path_unchanged':True,'holes_exact_bezier_reversal':True,'control_point_values_unchanged':True,'original_signed_areas_32_samples':areas,'output_signed_areas_32_samples':[area(s) for s in parse(new_d)],'new_parent_clip':False,'retained_existing_ear_opening_clip':True,'geometry_identity':'B(P0,P1,P2,P3,t) = B(P3,P2,P1,P0,1-t); closed-subpath winding is reversed, shape is unchanged.'},ensure_ascii=False,indent=2)+'\n')
cmd=[str(W/'.runtime/svg-preview/python/bin/python'),str(R/'tools/svg_containment.py'),'--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r1-winding.svg'),'--groups',str(W/'structure/groups.json'),'--group-path','head/rear_hair_left','--out',str(N/'r1-containment.json')]
p=subprocess.run(cmd,env=dict(os.environ,TMPDIR=str(N/'tmp')),capture_output=True,text=True);print(p.returncode,p.stdout,p.stderr);(N/'r1-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n')
