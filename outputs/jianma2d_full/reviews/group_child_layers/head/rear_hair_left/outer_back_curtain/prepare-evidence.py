"""Read-only native renders for the independently reviewed frozen n30 candidate."""
from pathlib import Path
import hashlib,json,subprocess,sys
ROOT=Path.cwd()
REVIEW=Path('reviews/group_child_layers/head/rear_hair_left/outer_back_curtain')
E=REVIEW/'evidence'
D=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块')
C=D/'candidate-groups.svg'
EXPECTED='4da747b49621ec49eec03cbdeeac09a0563c0c4527afc57e24a3b4442a781679'
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert sha(C)==EXPECTED
short=sys.argv[1]; ids=[] if len(sys.argv)<3 or sys.argv[2]=='-' else sys.argv[2].split(',')
crop=list(map(int,sys.argv[3:7])) if len(sys.argv)>=7 else None
scale=sys.argv[7] if len(sys.argv)>7 else '1'
cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_preview.py',str(C),str(E/(short+'.png')),'--reference','references/base-subject.png','--blend','0.5','--columns','4' if crop else '3']
for identity in ids:cmd+=['--only',identity]
if crop:cmd+=['--crop',*map(str,crop),'--reference-crop',*map(str,crop),'--scale',scale,'--edge-overlay']
r=subprocess.run(cmd,capture_output=True,text=True)
item={'name':short,'argv':cmd,'returncode':r.returncode,'stdout':r.stdout,'stderr':r.stderr,'candidate_sha256':sha(C),'reference_sha256':sha('references/base-subject.png')}
if r.returncode==0:item['output_sha256']=sha(E/(short+'.png'))
with (E/'render-commands.jsonl').open('a') as f:f.write(json.dumps(item,ensure_ascii=False)+'\n')
print(json.dumps(item,ensure_ascii=False))
assert r.returncode==0
assert sha(C)==EXPECTED
