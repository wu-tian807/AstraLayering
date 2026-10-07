from pathlib import Path
import sys,os,json,subprocess,xml.etree.ElementTree as E
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/inner_back_curtain/1.父级轮廓补全';R=(W/'../../workflow-next/live2d-layering').resolve();sys.path.insert(0,str(R/'tools'))
from svg_preview import read_svg,isolate
ID='group-head-rear-hair-left-inner-back-curtain'
root,size=read_svg(N/'input-groups.svg');isolate(root,[ID]);E.ElementTree(root).write(N/'input-only.svg',encoding='utf-8',xml_declaration=True)
py=W/'.runtime/svg-preview/python/bin/python';tool=R/'tools/svg_preview.py';env=dict(os.environ,TMPDIR=str(N/'tmp'));jobs=[]
def render(name,extra):
 cmd=[str(py),str(tool),str(N/'candidate-groups.svg'),str(N/(name+'.png')),*extra];p=subprocess.run(cmd,env=env,text=True,capture_output=True);jobs.append({'name':name,'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(name,p.returncode,p.stdout,p.stderr,flush=True);assert p.returncode==0
render('01-current-isolated',['--only',ID,'--reference',str(W/'references/base-subject.png'),'--crop','270','245','190','1195','--edge-overlay','--columns','4'])
render('02-current-full-blend',['--reference',str(W/'references/base-subject.png'),'--columns','3'])
for name,box,reference in [
 ('03-root-ear-4x',(325,250,125,145),'references/base-subject.png'),
 ('04-root-ear-line-4x',(325,250,125,145),'references/line-reference.png'),
 ('05-shoulder-bend-4x',(300,385,150,265),'references/base-subject.png'),
 ('06-waist-bend-4x',(270,650,180,285),'references/base-subject.png'),
 ('07-hidden-lower-join-4x',(310,1000,140,285),'references/base-subject.png'),
 ('08-inner-tip-4x',(305,1220,70,220),'references/base-subject.png')]:
 args=['--only',ID,'--reference',str(W/reference),'--compare',str(N/'input-only.svg'),'--crop',*map(str,box),'--scale','4','--edge-overlay','--columns','3']
 if 'line-reference' in reference:args+=['--reference-crop',*map(str,box)]
 render(name,args)
cmd=[str(py),str(R/'tools/svg_containment.py'),'--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-groups.svg'),'--groups',str(W/'structure/groups.json'),'--group-path','head/rear_hair_left','--out',str(N/'parent-containment.json')]
p=subprocess.run(cmd,env=env,text=True,capture_output=True);jobs.append({'name':'native-parent-containment','argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(p.stdout,p.stderr,flush=True)
(N/'render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
assert p.returncode in (0,1)
report=json.loads((N/'parent-containment.json').read_text())
current=next(r for r in report['results'] if r['path']=='head/rear_hair_left/inner_back_curtain')
assert current['status']=='pass' and current['outside_samples']==0
if report['status']!='pass':print('Aggregate scan FAIL retained. Unchanged sibling risk must be handled by controller; only n29 current-group containment passed.',flush=True)
