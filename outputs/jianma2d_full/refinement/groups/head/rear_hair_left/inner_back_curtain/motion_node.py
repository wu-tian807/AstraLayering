from pathlib import Path
import sys,os,json,re,subprocess,hashlib,shutil,xml.etree.ElementTree as E
sys.dont_write_bytecode=True
W=Path.cwd();G=W/'refinement/groups/head/rear_hair_left/inner_back_curtain';N=G/'2.直属拆分与色块/2.3.运动露出补齐';N.mkdir(parents=True,exist_ok=True);(N/'tmp').mkdir(exist_ok=True);R=(W/'../../workflow-next/live2d-layering').resolve();sys.path.insert(0,str(R/'tools'));from svg_preview import read_svg,isolate
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
ids=['part-head-rear-hair-left-inner-back-curtain-nape-back-sheet','part-head-rear-hair-left-inner-back-curtain-inner-side-lock']
assert json.loads((W/'structure/groups.dispatch.json').read_text())['active']=={'target':'n29','route':'generic','pointer':'group_child_layers'}
source=(W/'block-layers/groups.svg').read_text();assert sha(W/'block-layers/groups.svg')=='5ef71923ba49f927c35822b518b8bc650998d1c4603c5dde2def75adc15ed5bb';(N/'input-groups.svg').write_text(source)
root=E.fromstring(source);g=next(x for x in root.iter() if x.get('id')==ids[0]);path=next(x for x in g if x.tag.rsplit('}',1)[-1]=='path');old=path.get('d');commands=re.findall(r'[A-Za-z][^A-Za-z]*',old)
# Only the nape edge beneath the continuous side lock receives this 4px allowance.
# Fade from zero at the existing ear/neck join; maintain it through the waist,
# and taper back into the same existing lower hidden return.
for index in range(5,16):
 cmd=commands[index];letter=cmd[0];v=[float(x) for x in cmd[1:].split()]
 for j in range(0,len(v),2):
  offset=4
  if index==5:offset=[0,2,4][j//2]
  if index==15:offset=[4,2,0][j//2]
  v[j]-=offset
 commands[index]=letter+' '+' '.join(f'{n:.9f}'.rstrip('0').rstrip('.') if n else '0' for n in v)+' '
new=''.join(commands).strip();assert source.count(old)==1
candidate=source.replace(old,new,1)
# Keep rationale on this changed part only.
start=candidate.rfind('<',0,candidate.index('id="'+ids[0]+'"'));end=candidate.index('>',start)+1
candidate=candidate[:end]+'<desc>Hidden nape backing extends 4px beneath the side lock from shoulder to lower join; covers a small relative hair sway while preserving the visible silhouette, ear opening and free side tip.</desc>'+candidate[end:]
(N/'candidate-groups.svg').write_text(candidate)
children={'groups':[],'parts':[]};(N/'children.json').write_text(json.dumps(children,ensure_ascii=False,indent=2)+'\n');shutil.copyfile(W/'structure/groups.json',N/'merged-groups.json')
manifest={'node':'part_motion_completion','branch':'then: current group has two direct parts','actual_actor':'/root/jianma_runner_recovery/maker_n29','logical_worker':'group:head/rear_hair_left/inner_back_curtain','inputs':{p:sha(W/p) for p in ['block-layers/groups.svg','structure/groups.json','refinement/character.svg','structure/rendering.json','references/base-subject.png']},'changed':'nape_back_sheet hidden edge only','side_lock_changed':False,'example_images_actually_opened':['milly-collar-wrist.png','milly-sleeve-shoe.png'],'movement_assumption':'Small relative sway: up to roughly 8px around waist, tapering at attached root and lower nape termination; local -8px waist diagnostic is illustrative, not an authored animation.'};(N/'input-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
py=W/'.runtime/svg-preview/python/bin/python';env=dict(os.environ,TMPDIR=str(N/'tmp'),PYTHONDONTWRITEBYTECODE='1');runs=[]
def run(name,cmd):
 p=subprocess.run([str(py),*map(str,cmd)],env=env,text=True,capture_output=True);runs.append({'name':name,'argv':[str(py),*map(str,cmd)],'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(name,p.returncode,p.stdout,p.stderr,flush=True);assert p.returncode==0
run('check-children',[R/'tools/groups.py','check-children','--groups',W/'structure/groups.json','--group-path','head/rear_hair_left/inner_back_curtain','--patch',N/'children.json'])
run('bounds',[R/'tools/svg_containment.py','--parent-svg',N/'input-groups.svg','--candidate',N/'candidate-groups.svg','--groups',N/'merged-groups.json','--group-path','head/rear_hair_left/inner_back_curtain','--out',N/'轮廓检查.json'])
for name,p in [('before',N/'input-groups.svg'),('after',N/'candidate-groups.svg')]:
 doc,_=read_svg(p);isolate(doc,[ids[0]]);E.ElementTree(doc).write(N/(name+'-nape-only.svg'),encoding='utf-8',xml_declaration=True)
 doc,_=read_svg(p);isolate(doc,ids);side=next(x for x in doc.iter() if x.get('id')==ids[1]);side.set('transform','translate(-8 0)');E.ElementTree(doc).write(N/(name+'-waist-sway.svg'),encoding='utf-8',xml_declaration=True)
ref=[ '--reference',W/'references/base-subject.png']
for name,box in [('01-shoulder-before-after-4x',(320,355,90,240)),('02-lower-before-after-4x',(310,1010,140,270))]:
 run(name,[R/'tools/svg_preview.py',N/'candidate-groups.svg',N/(name+'.png'),'--only',ids[0],*ref,'--compare',N/'before-nape-only.svg','--edge-overlay','--crop',*box,'--scale','4','--columns','3'])
run('03-waist-sway-before-after-4x',[R/'tools/svg_preview.py',N/'after-waist-sway.svg',N/'03-waist-sway-before-after-4x.png',*ref,'--compare',N/'before-waist-sway.svg','--crop','270','720','180','180','--scale','4','--columns','3'])
run('white-preview',[R/'tools/svg_preview.py',N/'candidate-groups.svg',N/'candidate-white-preview.png','--background','white'])
(N/'render-commands.json').write_text(json.dumps(runs,ensure_ascii=False,indent=2)+'\n')
