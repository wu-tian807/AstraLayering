from pathlib import Path
import sys,json
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');sys.path.insert(0,'../../workflow-next/live2d-layering/tools')
from svg_preview import read_svg
from svg_containment import selected_shape,alpha_image,occupied,union_box
from PIL import ImageChops
pr,size=read_svg(N/'input-groups.svg');cr,_=read_svg(N/'candidate-r2.svg');parent,_=selected_shape(pr,'group','head/rear_hair_left/outer_back_curtain');pb=alpha_image(parent,size).getbbox();result=[]
for r in json.loads((N/'r2-bounds.json').read_text())['results']:
 if r['status']=='pass':continue
 child,_=selected_shape(cr,r['kind'],r['path']);region=union_box(pb,alpha_image(child,size).getbbox(),size);pa=alpha_image(parent,size,region,4);ca=alpha_image(child,size,region,4);outside=ImageChops.subtract(occupied(ca),occupied(pa));samples=[]
 for y in range(outside.height):
  for x in range(outside.width):
   if outside.getpixel((x,y)):samples.append({'xy':[region[0]+x/4,region[1]+y/4],'parent_alpha':pa.getpixel((x,y)),'child_alpha':ca.getpixel((x,y))})
 result.append({'path':r['path'],'samples':samples});print(result[-1],flush=True)
(N/'r2-exact-samples.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
