from pathlib import Path
import sys,os,json,subprocess,xml.etree.ElementTree as E
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/outer_back_curtain/1.父级轮廓补全';R=(W/'../../workflow-next/live2d-layering').resolve();py=W/'.runtime/svg-preview/python/bin/python';ID='group-head-rear-hair-left-outer-back-curtain';jobs=[]
for name,svg,box in [
 ('08-r1-upper-before-after-4x','candidate-r1-winding.svg',(164,711,66,67)),
 ('09-r1-lower-before-after-4x','candidate-r1-winding.svg',(195,925,29,39)),
 ('10-r2-upper-before-after-4x','candidate-r2-subdivided.svg',(164,711,66,67)),
 ('11-r2-lower-before-after-4x','candidate-r2-subdivided.svg',(195,925,29,39)),
 ('12-input-shoulder-hidden-4x','candidate-groups.svg',(281,365,100,270)),
 ('13-input-lower-hidden-4x','candidate-groups.svg',(279,982,82,307))]:
 args=[str(py),str(R/'tools/svg_preview.py'),str(N/svg),str(N/(name+'.png')),'--only',ID,'--reference',str(W/'references/base-subject.png'),'--compare',str(N/'input-only.svg'),'--crop',*map(str,box),'--scale','4','--edge-overlay','--columns','3']
 p=subprocess.run(args,env=dict(os.environ,TMPDIR=str(N/'tmp')),text=True,capture_output=True);jobs.append({'name':name,'argv':args,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(name,p.returncode,flush=True);assert p.returncode==0
(N/'diagnostic-render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
