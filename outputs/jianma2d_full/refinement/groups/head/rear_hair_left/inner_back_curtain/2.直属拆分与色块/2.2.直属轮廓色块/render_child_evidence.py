from pathlib import Path
import json,os,subprocess
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/inner_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块';R=(W/'../../workflow-next/live2d-layering').resolve();py=W/'.runtime/svg-preview/python/bin/python';env=dict(os.environ,TMPDIR=str(N/'tmp'),PYTHONDONTWRITEBYTECODE='1');jobs=[]
ids=['part-head-rear-hair-left-inner-back-curtain-nape-back-sheet','part-head-rear-hair-left-inner-back-curtain-inner-side-lock']
def render(name,args):
 cmd=[str(py),str(R/'tools/svg_preview.py'),str(N/'candidate-groups.svg'),str(N/(name+'.png')),*args];p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'name':name,'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(name,p.returncode,p.stderr,flush=True);assert p.returncode==0
ref=['--reference',str(W/'references/base-subject.png')]
render('01-full-blend',ref+['--blend','0.5','--columns','3'])
render('02-two-part-overview',ref+['--only',ids[0],'--only',ids[1],'--part',ids[0],'--part',ids[1],'--edge-overlay','--crop','270','245','190','1195','--columns','3'])
for name,part,box in [
 ('03-nape-root-ear-4x',0,(325,250,125,150)),
 ('04-side-root-shoulder-4x',1,(335,250,65,200)),
 ('05-nape-shoulder-waist-4x',0,(315,390,135,310)),
 ('06-side-mid-sweep-4x',1,(275,545,110,390)),
 ('07-nape-hidden-end-4x',0,(310,965,140,315)),
 ('08-side-lower-tip-4x',1,(310,1020,75,420))]:
 render(name,ref+['--only',ids[part],'--edge-overlay','--crop',*map(str,box),'--scale','4','--columns','4'])
for name,box in [('09-root-connection-4x',(325,250,125,160)),('10-lower-connection-4x',(310,1030,140,260))]:
 render(name,ref+['--only',ids[0],'--only',ids[1],'--part',ids[0],'--part',ids[1],'--edge-overlay','--crop',*map(str,box),'--scale','4','--columns','3'])
render('candidate-white-preview',['--background','white'])
(N/'render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
