from pathlib import Path
import json,subprocess,sys,xml.etree.ElementTree as E,hashlib,shutil
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');R=Path('../../workflow-next/live2d-layering');sys.path.insert(0,str(R/'tools'))
from svg_preview import read_svg,isolate
recipes=json.loads((N/'shape-recipes.json').read_text());ids={r['name']:f"{r['kind']}-head-rear-hair-left-outer-back-curtain-{r['name'].replace('_','-')}" for r in recipes};allids=list(ids.values());longids=[ids[n] for n in ['inner_forked_lock','pointed_long_lock','sweeping_long_lock','outward_curl_lock']]
shutil.copyfile(N/'candidate-r4.svg',N/'candidate-groups.svg')
def isolate_file(source,selected,out):
 root,size=read_svg(N/source);isolate(root,selected);E.ElementTree(root).write(N/out,encoding='utf-8',xml_declaration=True)
isolate_file('candidate-r4.svg',allids,'candidate-children-only.svg');isolate_file('input-groups.svg',['group-head-rear-hair-left-outer-back-curtain'],'parent-only.svg')
for name in ['upper_loop_lock','sweeping_long_lock']:isolate_file('candidate-r1.svg',[ids[name]],'r1-only-'+name+'.svg')
for name in ['inner_forked_lock','pointed_long_lock']:isolate_file('candidate-r2.svg',[ids[name]],'r2-only-'+name+'.svg')
isolate_file('candidate-r2.svg',longids,'r2-only-long-children.svg')
def only(selected):return [a for id in selected for a in ['--only',id]]
jobs=[];py='.runtime/svg-preview/python/bin/python'
def render(name,args,source='candidate-groups.svg'):
 cmd=[py,str(R/'tools/svg_preview.py'),str(N/source),str(N/(name+'.png')),*args];p=subprocess.run(cmd,capture_output=True,text=True);jobs.append({'name':name,'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});(N/'final-render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n');print(name,p.returncode,flush=True);assert p.returncode==0
render('final-01-full-blend',['--reference','references/base-subject.png','--blend','0.5','--columns','3'])
for i,r in enumerate(recipes,2):
 box=(148,393,190,610) if 'loop' in r['name'] else (95,250,290,1270)
 render(f"final-{i:02}-{r['name']}",['--only',ids[r['name']],'--reference','references/base-subject.png','--crop',*map(str,box),'--edge-overlay','--columns','4'])
render('final-08-children-no-parent',only(allids)+['--reference','references/base-subject.png','--compare',str(N/'parent-only.svg'),'--crop','95','250','290','1270','--edge-overlay','--columns','3'])
render('final-09-opening-fit-8x',only(longids)+['--reference','references/base-subject.png','--compare',str(N/'r2-only-long-children.svg'),'--crop','189','795','22','28','--scale','8','--edge-overlay','--columns','4',*[a for id in longids for a in ['--part',id]]])
render('final-10-inner-return-fit-8x',['--only',ids['inner_forked_lock'],'--reference','references/base-subject.png','--compare',str(N/'r2-only-inner_forked_lock.svg'),'--crop','319','1238','20','28','--scale','8','--edge-overlay','--columns','3'])
render('final-11-pointed-fit-8x',['--only',ids['pointed_long_lock'],'--reference','references/base-subject.png','--compare',str(N/'r2-only-pointed_long_lock.svg'),'--crop','143','1443','104','52','--scale','8','--edge-overlay','--columns','3'])
render('final-12-upper-root-repair-4x',['--only',ids['upper_loop_lock'],'--reference','references/base-subject.png','--compare',str(N/'r1-only-upper_loop_lock.svg'),'--crop','285','395','67','145','--scale','4','--edge-overlay','--columns','3'])
render('final-13-sweeping-root-repair-4x',['--only',ids['sweeping_long_lock'],'--reference','references/base-subject.png','--compare',str(N/'r1-only-sweeping_long_lock.svg'),'--crop','282','390','83','175','--scale','4','--edge-overlay','--columns','3'])
render('final-14-loop-junctions-4x',only(allids)+['--reference','references/base-subject.png','--crop','151','695','111','310','--scale','4','--edge-overlay','--columns','4'])
render('final-15-open-forks-4x',only(allids)+['--reference','references/base-subject.png','--crop','125','1240','165','275','--scale','4','--edge-overlay','--columns','4'])
reuse={'component':'lower_loop_lock','prior_actually_viewed_image':str(N/'r1-03-lower_loop_lock.png'),'final_image':str(N/'final-03-lower_loop_lock.png'),'same_sha256':hashlib.sha256((N/'r1-03-lower_loop_lock.png').read_bytes()).hexdigest()==hashlib.sha256((N/'final-03-lower_loop_lock.png').read_bytes()).hexdigest(),'sha256':hashlib.sha256((N/'final-03-lower_loop_lock.png').read_bytes()).hexdigest()};assert reuse['same_sha256'];(N/'actual-view-reuse.json').write_text(json.dumps(reuse,ensure_ascii=False,indent=2)+'\n')
