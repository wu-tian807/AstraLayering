from pathlib import Path
import json,sys,subprocess,concurrent.futures,hashlib,os
from PIL import Image
w=Path(__file__).resolve().parents[4]
s=w.parents[1]/'workflow-next/live2d-layering'
e=Path(__file__).resolve().parent
p=w/'.runtime/svg-preview/python/bin/python'
children=json.loads((e/'independent-protection-start.json').read_text())['children']
ids=[x['container_ids'][0] for x in children]
jobs=[]
def add(name,only,crop,scale=2,line=False):
 jobs.append({'file':name+'.png','only':only,'crop':crop,'scale':scale,'reference':'references/line-reference.png' if line else 'references/base-subject.png','explicit_same_coordinate_reference_crop':line})
add('00-full-blend',[],[0,0,895,1758],1)
add('00-children-head',ids,[270,5,350,370],2)
add('01-face',[ids[0]],[330,125,190,240],3)
add('02-front-hair',[ids[1]],[318,97,228,241],3)
add('03-framing-left',[ids[2]],[305,198,120,402],2)
add('04-framing-right',[ids[3]],[480,216,105,381],2)
add('05-rear-left-upper',[ids[4]],[275,185,205,435],2)
add('05-rear-left-middle',[ids[4]],[150,585,325,515],2)
add('05-rear-left-lower',[ids[4]],[98,1060,365,475],2)
add('05-notch-base',[ids[4]],[130,1288,115,182],5)
add('05-notch-line',[ids[4]],[130,1288,115,182],5,True)
add('05-children-lower-loop',ids,[98,1070,270,465],2)
add('06-rear-right-upper',[ids[5]],[425,188,235,445],2)
add('06-rear-right-middle',[ids[5]],[470,590,310,495],2)
add('06-rear-right-lower',[ids[5]],[485,1038,365,490],2)
add('07-crown',[ids[6]],[275,10,330,215],2)
add('08-ribbon-left',[ids[7]],[135,112,215,720],1)
add('09-ribbon-right',[ids[8]],[515,115,226,731],1)
add('10-bun',[ids[9]],[380,33,118,112],4)
add('11-earring-left',[ids[10]],[354,262,37,69],6)
add('12-earring-right',[ids[11]],[480,262,30,69],6)
add('13-crown-links',ids,[280,105,310,106],4)
add('14-left-ear-links',ids,[332,245,69,122],5)
add('15-right-ear-links',ids,[479,248,65,117],5)
def run(job):
 cmd=[str(p),str(s/'tools/svg_preview.py'),str(w/'block-layers/groups.svg'),str(e/job['file']),'--reference',str(w/job['reference']),'--edge-overlay','--blend','0.35','--columns','2','--crop',*[str(x) for x in job['crop']],'--scale',str(job['scale'])]
 if job['explicit_same_coordinate_reference_crop']:cmd+=['--reference-crop',*[str(x) for x in job['crop']]]
 for x in job['only']:cmd+=['--only',x]
 result=subprocess.run(cmd,text=True,capture_output=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'})
 if result.returncode:raise RuntimeError(job['file']+result.stdout+result.stderr)
 job['argv']=cmd;job['sha256']=hashlib.sha256((e/job['file']).read_bytes()).hexdigest();job['dimensions']=Image.open(e/job['file']).size
 return job
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 outputs=list(pool.map(run,jobs))
(e/'render-manifest.json').write_text(json.dumps({'candidate_sha256':hashlib.sha256((w/'block-layers/groups.svg').read_bytes()).hexdigest(),'renderer':str(s/'tools/svg_preview.py'),'jobs':outputs},ensure_ascii=False,indent=2)+'\n')
print(json.dumps([{'file':x['file'],'dimensions':x['dimensions']} for x in outputs],ensure_ascii=False))
