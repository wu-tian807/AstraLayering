from pathlib import Path
import json,shutil,hashlib
from xml.sax.saxutils import escape
BASE=Path('refinement/groups/head/front_hair/temple_sweeps_right');OUT=BASE/'2.直属拆分与色块/2.2.直属轮廓色块';OUT.mkdir(parents=True,exist_ok=True)
INPUT=OUT/'input.svg'
if not INPUT.exists():shutil.copyfile('block-layers/groups.svg',INPUT)
OUTER=[[(488,130),(501,138),(509,151),(514,167)],[(514,167),(519,180),(522,197),(522,212)],[(522,212),(525,224),(525,235),(521,248)],[(521,248),(517,261),(510,271),(499,279)]]
def lerp(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
def split(p,t):
 a,b,c=[lerp(p[i],p[i+1],t) for i in range(3)];d,e=lerp(a,b,t),lerp(b,c,t);f=lerp(d,e,t);return [p[0],a,d,f],[f,e,c,p[3]]
def sub(p,a,b):
 q=split(p,b)[0] if b<1 else p
 return split(q,a/b)[1] if a else q
def xy(p):return ' '.join(f'{v:.17g}' for v in p)
def arc(p):return ' C '+' '.join(xy(q) for q in p[1:])
def outer(i,a,j,b):
 q=[sub(OUTER[k],a if k==i else 0,b if k==j else 1) for k in range(i,j+1)];return 'M '+xy(q[0][0])+''.join(arc(p) for p in q),q[0][0]
paths={}
d,_=outer(0,0,1,.88)
paths['crown_sweeps']=d+' C 520.0 210.0 514.6 203.7 508.6 195.0 C 498.2 180.6 485.0 170.0 475.0 181.0 C 463 163 448 162 440 175 C 440 159 454 142 469 133 C 476 129 482 128 488 130 Z'
paths['upper_temple_lock']='M 513.2 179.8 C 518.4 190.0 520.7 205.1 520.7 216.7 C 518.8 222.5 514.6 220.9 510.9 217.8 C 498.3 206.8 490.2 188.9 482.1 179.1 C 475.6 171.3 470.2 168.4 465.2 168.5 C 479.0 161.0 501.2 166.0 513.2 179.8 Z'
d,p=outer(1,.75,2,.65)
paths['middle_temple_lock']=d+' C 520.2 242.6 515.8 240.5 511.4 236.3 C 498.9 223.8 491.0 204.3 486.1 190.8 C 482.8 181.7 477.5 176.2 471.2 173.9 C 485.4 175.0 507.0 188.0 '+xy(p)+' Z'
d,p=outer(1,.95,2,1)
paths['lower_temple_lock']=d+' C 518.1 257.0 513.2 260.6 508.0 255.1 C 496.8 244.7 490.8 217.7 485.7 199.4 C 483.2 189.0 479.4 180.9 474.2 176.4 C 487.0 179.0 508.0 199.0 '+xy(p)+' Z'
d,p=outer(2,0,3,1)
paths['ear_lock']=d+' C 506 271 498 251 491 231 C 499.0 237.0 502.3 244.2 510.0 250.9 C 518.0 244.0 521.0 226.0 '+xy(p)+' Z'
notes={
 'crown_sweeps':'Right crown-side full root and short sweep fan; tighter right arc and continuous inner rim. Internal short leaves remain a group for later n51; same physical family as left, not a mirrored silhouette.',
 'upper_temple_lock':'First long right hooked sheet, complete hidden root to own front-facing rim and turn near (518,220); own visible edge inside parent global envelope, no horizontal strip cut.',
 'middle_temple_lock':'Complete middle right sweep from frontal-hair hidden root to rounded edge near (518,239); own upper root overlaps previous sheet; darker material bands are not separate entities.',
 'lower_temple_lock':'Broad lower right sweep with curved tip near (513,258), continuous ear-side inner rim and full hidden root; no left-side holes copied.',
 'ear_lock':'Complete right ear-side sweep including original parent inner root curve from (499,279) to (491,231); continuous inner rim and full tip, no invented holes; stays behind fringe.'}
colors={'crown_sweeps':'#C6AC65','upper_temple_lock':'#70B5BF','middle_temple_lock':'#CE8EAC','lower_temple_lock':'#9AAE6B','ear_lock':'#8F92CA'}
chunks=[]
for name in ['ear_lock','lower_temple_lock','middle_temple_lock','upper_temple_lock','crown_sweeps']:
 kind='group' if name=='crown_sweeps' else 'part';id=kind+'-head-front-hair-temple-sweeps-right-'+name.replace('_','-');full='head/front_hair/temple_sweeps_right/'+name
 chunks.append(f'<g id="{id}" data-{kind}-path="{full}" fill="{colors[name]}" stroke="none"><desc>{escape(notes[name])}</desc><path id="{id}-shape" d="{paths[name]}" stroke="none"/></g>')
add='\n<!-- n28-child-contours-start -->\n'+'\n'.join(chunks)+'\n<!-- n28-child-contours-end -->\n'
t=INPUT.read_text().replace('</svg>',add+'</svg>');(OUT/'candidate.svg').write_text(t);(OUT/'authored-paths.json').write_text(json.dumps(paths,ensure_ascii=False,indent=2)+'\n');print(hashlib.sha256(t.encode()).hexdigest())
