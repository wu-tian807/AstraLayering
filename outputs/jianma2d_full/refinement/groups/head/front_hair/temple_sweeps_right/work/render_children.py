from pathlib import Path
import subprocess,json
b=Path('refinement/groups/head/front_hair/temple_sweeps_right/2.直属拆分与色块/2.2.直属轮廓色块');py='.runtime/svg-preview/python/bin/python';tool='../../workflow-next/live2d-layering/tools/svg_preview.py';commands=[]
ids={'crown_sweeps':'group-head-front-hair-temple-sweeps-right-crown-sweeps',**{s:'part-head-front-hair-temple-sweeps-right-'+s.replace('_','-') for s in ['upper_temple_lock','middle_temple_lock','lower_temple_lock','ear_lock']}}
def run(out,args):
 cmd=[py,tool,str(b/'candidate.svg'),str(b/out)]+args;commands.append(cmd);
 if not (b/out).exists():subprocess.run(cmd,check=True)
args=['--reference','references/base-subject.png','--edge-overlay','--crop','432','118','101','173','--scale','4']
for name,id in ids.items():run(name+'.png',args+['--only',id])
more=[]
for id in ids.values():more+=['--only',id,'--part',id]
run('components.png',args+['--columns','4']+more)
run('full.png',['--reference','references/base-subject.png','--blend','.5','--scale','1'])
run('preview-white.png',['--scale','1'])
run('ear-root-8x.png',['--reference','references/base-subject.png','--edge-overlay','--crop','500','208','28','62','--scale','8','--only',ids['ear_lock']])
run('crown-root-8x.png',['--reference','references/base-subject.png','--edge-overlay','--crop','437','151','49','41','--scale','8','--only',ids['crown_sweeps']])
(b/'commands.json').write_text(json.dumps(commands,ensure_ascii=False,indent=2)+'\n')
