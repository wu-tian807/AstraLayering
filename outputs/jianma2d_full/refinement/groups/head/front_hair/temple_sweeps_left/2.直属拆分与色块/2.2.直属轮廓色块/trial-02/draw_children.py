"""n27 authored closed hair sheets; exact parent outer arcs, distinct hooked ends."""
from pathlib import Path
import json, shutil, hashlib
from xml.sax.saxutils import escape

BASE=Path('refinement/groups/head/front_hair/temple_sweeps_left')
OUT=BASE/'2.直属拆分与色块/2.2.直属轮廓色块'
OUT.mkdir(parents=True,exist_ok=True)
INPUT=OUT/'input.svg'
if not INPUT.exists(): shutil.copyfile('block-layers/groups.svg',INPUT)
OUTER=[[(389,127),(377.05,131.05),(367,142),(361,153)],
       [(361,153),(354,167),(350,182),(348,196)],
       [(348,196),(346,208),(347,219),(346,228)],
       [(346,228),(342,238),(345,250),(348,258)],
       [(348,258),(352,269),(361,279),(370,282)]]
INNER=[(370,282),(367,276),(373,254),(379,234)]
def lerp(a,b,t): return tuple(x+(y-x)*t for x,y in zip(a,b))
def split(p,t):
 a,b,c=[lerp(p[i],p[i+1],t) for i in range(3)]
 d,e=lerp(a,b,t),lerp(b,c,t);f=lerp(d,e,t)
 return [p[0],a,d,f],[f,e,c,p[3]]
def sub(p,a,b):
 q=split(p,b)[0] if b<1 else p
 return split(q,a/b)[1] if a else q
def xy(p): return ' '.join(f'{v:.17g}' for v in p)
def arc(p): return ' C '+' '.join(xy(x) for x in p[1:])
def outer(i,a,j,b):
 segs=[sub(OUTER[k],a if k==i else 0,b if k==j else 1) for k in range(i,j+1)]
 return 'M '+xy(segs[0][0])+''.join(arc(s) for s in segs),segs[0][0]

paths={}
d,_=outer(0,0,2,.45)
paths['crown_sweeps']=d+' C 350.5 215.1 357.3 208.5 364 199 C 376 183.5 389 169.5 403 165.5 C 414 160.4 425 162.4 431 171 C 432 156 418 138 403 130 C 398 127 393 126 389 127 Z'
d,p=outer(1,.70,2,.70)
paths['upper_temple_lock']=d+' C 348.5 224.0 354.0 224.6 359.7 219.5 C 374.0 207.0 382.5 188.7 391.5 178 C 397.4 170.8 403.4 167.0 408.5 168.0 C 395 160.8 371 167.5 '+xy(p)+' Z'
d,p=outer(2,.35,3,.35)
paths['middle_temple_lock']=d+' C 347.3 243.5 352.4 241.6 357.2 236.9 C 371.5 225.3 380.5 205.5 386.0 190.8 C 389.5 181.7 394.4 176.5 400.1 173.9 C 389.0 172.5 367.5 190.0 '+xy(p)+' Z'
d,p=outer(2,.75,3,1)
# The lower sheet's open inner contour follows the upper-left boundaries of
# both real skin gaps. No mask or filler is used to force containment.
paths['lower_temple_lock']=d+' C 352.0 262.2 356.2 262.3 360.8 257.0 C 362.1 256.0 363.9 254.2 364.9 253.1 C 366.2 251.9 367.1 249.5 368.4 248.2 C 369.6 246.8 371.1 244.6 372.3 242.9 C 378.0 232.9 384.1 211.7 387.9 196.0 C 390.1 186.9 393.9 180.1 398.4 176.4 C 384.2 181.2 359.3 206.0 '+xy(p)+' Z'
d,p=outer(3,.60,4,1)
d+=arc(INNER)
# The two gaps are open notches between the ear sheet and the lower sweep,
# with the original geometric sides kept verbatim along the exposed edges.
paths['ear_lock']=d+' C 377.2 238.8 374.5 242.3 372.3 242.9 C 372.1 245.2 371.0 248.7 369.2 251.0 C 368.8 250.2 368.5 249.1 368.4 248.2 C 367.2 249.8 366.1 251.9 364.9 253.1 C 365.0 255.6 364.7 259.5 364.0 262.4 C 362.7 261.4 361.1 259.3 360.8 257.0 C 354.3 253.7 349.4 250.7 '+xy(p)+' Z'

notes={
 'crown_sweeps':'Complete upper crown-side sweep fan; short overlapping leaves remain a group for subsequent refinement. Existing crown/scalp hidden root and left outside arc retained.',
 'upper_temple_lock':'Continuous first long hooked temple sheet from its inner upper root to the side turn around y219–224; independent overlapping root, not a horizontal slice.',
 'middle_temple_lock':'Second complete hooked sheet, from the forehead-hair hidden root to the longer rounded turn near y239; surface bands are not separate pieces.',
 'lower_temple_lock':'Broad lower temple sheet. Its inner edge follows the upper-left edges of the two reference skin gaps; those gaps stay outside this physical surface.',
 'ear_lock':'Complete narrow ear-side hooked sheet with bottom point (370,282). Two upper notches preserve the real skin gaps jointly with the lower sheet; no receiver clipping.'}
colors=['#C6AC65','#70B5BF','#CE8EAC','#9AAE6B','#8F92CA']
chunks=[]
color_for=dict(zip(paths,colors))
for name in ['ear_lock','lower_temple_lock','middle_temple_lock','upper_temple_lock','crown_sweeps']:
 d=paths[name];color=color_for[name]
 kind='group' if name=='crown_sweeps' else 'part'
 ident=kind+'-head-front-hair-temple-sweeps-left-'+name.replace('_','-')
 full='head/front_hair/temple_sweeps_left/'+name
 chunks.append(f'<g id="{ident}" data-{kind}-path="{full}" fill="{color}" stroke="none"><desc>{escape(notes[name])}</desc><path id="{ident}-shape" d="{d}" stroke="none"/></g>')
addition='\n<!-- n27-child-contours-start -->\n'+'\n'.join(chunks)+'\n<!-- n27-child-contours-end -->\n'
candidate=INPUT.read_text().replace('</svg>',addition+'</svg>')
(OUT/'candidate.svg').write_text(candidate)
(OUT/'authored-paths.json').write_text(json.dumps(paths,ensure_ascii=False,indent=2)+'\n')
print(hashlib.sha256(candidate.encode()).hexdigest())
