from pathlib import Path
import re,json,subprocess,xml.etree.ElementTree as E,sys
from PIL import Image,ImageDraw
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');text=(N/'candidate-r5.svg').read_text();pid='node22-lower-loop-lock-silhouette';tag=re.search(r'<path\b[^>]*id="'+pid+r'"[^>]*>',text).group(0);before='C 205 813 197 812 192 818';after='C 205 810 199 810 194 811 C 193.6 812 192.8 815 192 818';assert before in tag;text=text.replace(tag,tag.replace(before,after),1);(N/'candidate-r6.svg').write_text(text)
(N/'r6-changes.json').write_text(json.dumps({'component':'lower_loop_lock','only_changed_segment':{'start':[212,812],'before':before,'after':after},'observation':'r5 actual4x no-parent view still has a small wedge below the true upper-hole tip. r5 is not accepted despite default bounds PASS.','correction':'Bring lower-loop rejoining face to actual hole-bottom anchor194,811, then slightly overlap the upper loop inside the parent using an inner cubic toward192,818. Preserve both real holes and external parent anchors.','before_view':'r5-04-loop-junctions-4x.png'},ensure_ascii=False,indent=2)+'\n')
cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_containment.py','--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r6.svg'),'--groups','structure/groups.json','--group-path','head/rear_hair_left/outer_back_curtain','--out',str(N/'r6-bounds.json')];p=subprocess.run(cmd,text=True,capture_output=True);(N/'r6-bounds-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n');print(p.stdout,p.stderr);assert p.returncode==0
sys.path.insert(0,'../../workflow-next/live2d-layering/tools');from svg_preview import read_svg,isolate
recipes=json.loads((N/'shape-recipes.json').read_text());ids=[f"{r['kind']}-head-rear-hair-left-outer-back-curtain-{r['name'].replace('_','-')}" for r in recipes]
for source,out in [('candidate-r5.svg','r5-children-only.svg'),('candidate-r6.svg','r6-children-only.svg')]:
 root,size=read_svg(N/source);isolate(root,ids);E.ElementTree(root).write(N/out,encoding='utf-8',xml_declaration=True)
jobs=[]
def render(name,args):
 cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_preview.py',str(N/'candidate-r6.svg'),str(N/(name+'.png')),*args];p=subprocess.run(cmd,text=True,capture_output=True);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});(N/'r6-render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n');print(name,p.returncode,flush=True);assert p.returncode==0
render('r6-full-blend',['--reference','references/base-subject.png','--blend','0.5','--columns','3'])
render('r6-junction-8x',[a for id in ids for a in ['--only',id]]+['--reference','references/base-subject.png','--compare',str(N/'r5-children-only.svg'),'--crop','185','796','32','43','--scale','8','--edge-overlay','--columns','3','--part','part-head-rear-hair-left-outer-back-curtain-lower-loop-lock'])
ims=[Image.open(N/p).convert('RGB') for p in ['r6-full-blend.png','r6-junction-8x.png']];sheet=Image.new('RGB',(sum(im.width for im in ims),max(im.height for im in ims)+24),'white');draw=ImageDraw.Draw(sheet);x=0;panels=[]
for filename,im in zip(['r6-full-blend.png','r6-junction-8x.png'],ims):
 draw.text((x+4,4),filename,fill='black');sheet.paste(im,(x,24));panels.append({'file':filename,'offset':[x,24],'size':list(im.size),'scale':1});x+=im.width
sheet.save(N/'r6-final-contact-sheet.png');(N/'r6-contact-sheet.json').write_text(json.dumps({'panels':panels,'resized':False},indent=2)+'\n')
