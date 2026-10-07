from pathlib import Path
import sys,json,os,subprocess,xml.etree.ElementTree as E
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/outer_back_curtain/1.父级轮廓补全';R=(W/'../../workflow-next/live2d-layering').resolve();sys.path.insert(0,str(R/'tools'))
from svg_preview import read_svg,isolate
from svg_containment import selected_shape,alpha_image,occupied,union_box
from PIL import ImageChops
ID='group-head-rear-hair-left-outer-back-curtain';GP='head/rear_hair_left/outer_back_curtain'
root,size=read_svg(N/'input-groups.svg');isolate(root,[ID]);E.ElementTree(root).write(N/'input-only.svg',encoding='utf-8',xml_declaration=True)
py=W/'.runtime/svg-preview/python/bin/python';env=dict(os.environ,TMPDIR=str(N/'tmp'));jobs=[]
def run(name,args,valid=(0,)):
 cmd=[str(py),str(R/'tools'/args[0]),*args[1:]];p=subprocess.run(cmd,env=env,text=True,capture_output=True);jobs.append({'name':name,'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});print(name,p.returncode,p.stdout,p.stderr,flush=True);assert p.returncode in valid
run('before-containment',['svg_containment.py','--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-groups.svg'),'--groups',str(W/'structure/groups.json'),'--group-path','head/rear_hair_left','--out',str(N/'before-containment.json')],(1,))
root,size=read_svg(N/'input-groups.svg');parent,_=selected_shape(root,'group','head/rear_hair_left');child,_=selected_shape(root,'group',GP)
region=union_box(alpha_image(parent,size).getbbox(),alpha_image(child,size).getbbox(),size)
p=alpha_image(parent,size,region,4);c=alpha_image(child,size,region,4);outside=ImageChops.subtract(occupied(c),occupied(p));points=[]
for y in range(outside.height):
 for x in range(outside.width):
  if outside.getpixel((x,y)):
   points.append({'pixel_top_left':[region[0]+x/4,region[1]+y/4],'pixel_center':[region[0]+(x+.5)/4,region[1]+(y+.5)/4],'parent_alpha':p.getpixel((x,y)),'child_alpha':c.getpixel((x,y))})
print('Points',points,flush=True);(N/'before-samples.json').write_text(json.dumps({'region':region,'scale':4,'alpha_threshold':128,'samples':points},indent=2)+'\n')
run('01-before-isolated',['svg_preview.py',str(N/'input-groups.svg'),str(N/'01-before-isolated.png'),'--only',ID,'--reference',str(W/'references/base-subject.png'),'--crop','95','250','290','1270','--edge-overlay','--columns','4'])
run('02-before-full-blend',['svg_preview.py',str(N/'input-groups.svg'),str(N/'02-before-full-blend.png'),'--reference',str(W/'references/base-subject.png'),'--columns','3'])
for name,box,ref in [
 ('03-before-ear-root-4x',(328,252,62,126),'references/base-subject.png'),
 ('04-before-ear-line-4x',(328,252,62,126),'references/line-reference.png'),
 ('05-before-loop-upper-4x',(158,603,116,221),'references/base-subject.png'),
 ('06-before-loop-lower-4x',(151,828,89,175),'references/base-subject.png'),
 ('07-before-bottom-branches-4x',(97,1120,236,397),'references/base-subject.png')]:
  args=['svg_preview.py',str(N/'input-groups.svg'),str(N/(name+'.png')),'--only',ID,'--reference',str(W/ref),'--edge-overlay','--crop',*map(str,box),'--scale','4','--columns','4']
  if 'line-reference' in ref:args+=['--reference-crop',*map(str,box)]
  run(name,args)
(N/'input-render-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
