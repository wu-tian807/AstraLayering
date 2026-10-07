from pathlib import Path
import os,json,subprocess,sys,xml.etree.ElementTree as E
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');R=Path('../../workflow-next/live2d-layering');sys.path.insert(0,str(R/'tools'))
from svg_preview import read_svg,isolate
recipes=json.loads((N/'shape-recipes.json').read_text());ids=[f"{r['kind']}-head-rear-hair-left-outer-back-curtain-{r['name'].replace('_','-')}" for r in recipes]
root,size=read_svg(N/'candidate-r1.svg');isolate(root,ids);E.ElementTree(root).write(N/'r1-children-only.svg',encoding='utf-8',xml_declaration=True)
jobs=[];py='.runtime/svg-preview/python/bin/python'
def render(name,args):
 cmd=[py,str(R/'tools/svg_preview.py'),str(N/'candidate-r1.svg'),str(N/(name+'.png')),*args];p=subprocess.run(cmd,capture_output=True,text=True);jobs.append({'name':name,'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});(N/'r1-render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n');print(name,p.returncode,flush=True);assert p.returncode==0
render('r1-01-full-blend',['--reference','references/base-subject.png','--blend','0.5','--columns','3'])
for i,r in enumerate(recipes,2):
 box=(148,393,190,610) if 'loop' in r['name'] else (95,250,290,1270)
 render(f"r1-{i:02}-{r['name']}",['--only',ids[i-2],'--reference','references/base-subject.png','--crop',*map(str,box),'--edge-overlay','--columns','4'])
render('r1-08-children-no-parent',['--only',*ids,'--reference','references/base-subject.png','--crop','95','250','290','1270','--edge-overlay','--columns','4'])
