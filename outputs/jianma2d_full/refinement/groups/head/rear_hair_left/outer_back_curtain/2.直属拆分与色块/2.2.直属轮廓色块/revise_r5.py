from pathlib import Path
import re,json,subprocess,xml.etree.ElementTree as E,sys
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');text=(N/'candidate-r4.svg').read_text();pid='node22-lower-loop-lock-silhouette';tag=re.search(r'<path\b[^>]*id="'+pid+r'"[^>]*>',text).group(0);before='C 207 821 199 830 192 818';after='C 205 813 197 812 192 818';assert before in tag
text=text.replace(tag,tag.replace(before,after),1);(N/'candidate-r5.svg').write_text(text)
(N/'r5-changes.json').write_text(json.dumps({'component':'lower_loop_lock','only_changed_segment':{'start':[212,812],'before':before,'after':after},'observed_problem':'Actual no-parent4x view reveals a small unfilled triangular seam between the two loop join and front diagonal sheets. Existing parent filled this area.','design_correction':'Raise the lower-loop hidden upper rejoining surface to overlap the front sheets beneath the upper loop exit. Keep both root endpoint and visible outer-arc endpoint unchanged; do not fill either true hole.','evidence_before':'final-14-loop-junctions-4x.png'},ensure_ascii=False,indent=2)+'\n')
cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_containment.py','--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r5.svg'),'--groups','structure/groups.json','--group-path','head/rear_hair_left/outer_back_curtain','--out',str(N/'r5-bounds.json')];p=subprocess.run(cmd,text=True,capture_output=True);(N/'r5-bounds-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n');print(p.stdout,p.stderr);assert p.returncode==0
# Keep r4 candidates, comparison renders and native reports immutable. New output has its own files.
(N/'candidate-groups.svg').write_text(text)
sys.path.insert(0,'../../workflow-next/live2d-layering/tools');from svg_preview import read_svg,isolate
recipes=json.loads((N/'shape-recipes.json').read_text());ids=[f"{r['kind']}-head-rear-hair-left-outer-back-curtain-{r['name'].replace('_','-')}" for r in recipes]
root,size=read_svg(N/'candidate-r5.svg');isolate(root,ids);E.ElementTree(root).write(N/'candidate-children-only.svg',encoding='utf-8',xml_declaration=True)
jobs=[]
def render(name,args):
 cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_preview.py',str(N/'candidate-groups.svg'),str(N/(name+'.png')),*args];p=subprocess.run(cmd,text=True,capture_output=True);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});(N/'r5-render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n');print(name,p.returncode,flush=True);assert p.returncode==0
only=[x for id in ids for x in ['--only',id]]
render('r5-01-full-blend',['--reference','references/base-subject.png','--blend','0.5','--columns','3'])
render('r5-02-lower-loop',['--only','part-head-rear-hair-left-outer-back-curtain-lower-loop-lock','--reference','references/base-subject.png','--crop','148','393','190','610','--edge-overlay','--columns','4'])
render('r5-03-no-parent',only+['--reference','references/base-subject.png','--compare',str(N/'parent-only.svg'),'--crop','95','250','290','1270','--edge-overlay','--columns','3'])
render('r5-04-loop-junctions-4x',only+['--reference','references/base-subject.png','--crop','151','695','111','310','--scale','4','--edge-overlay','--columns','4'])
