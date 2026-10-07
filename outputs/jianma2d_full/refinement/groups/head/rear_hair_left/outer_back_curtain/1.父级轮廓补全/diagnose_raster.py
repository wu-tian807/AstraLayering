from pathlib import Path
import sys,json,copy,xml.etree.ElementTree as E,re
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/outer_back_curtain/1.父级轮廓补全';R=(W/'../../workflow-next/live2d-layering').resolve();sys.path.insert(0,str(R/'tools'))
from svg_preview import read_svg
from svg_containment import selected_shape,alpha_image,occupied,union_box
from PIL import ImageChops
root,size=read_svg(N/'input-groups.svg');parent,_=selected_shape(root,'group','head/rear_hair_left');child,_=selected_shape(root,'group','head/rear_hair_left/outer_back_curtain')
region=union_box(alpha_image(parent,size).getbbox(),alpha_image(child,size).getbbox(),size)
pa=alpha_image(parent,size,region,4);pm=occupied(pa);points=json.loads((N/'before-samples.json').read_text())['samples']
ID='group-head-rear-hair-left-outer-back-curtain';MAIN='head-rear-hair-left-outer-back-curtain-outer-main'
find=lambda doc,id:next(e for e in doc.iter() if e.get('id')==id)
parent_d=find(root,'head-rear-left-main').get('d');child_d=find(root,MAIN).get('d')
shared_outer=parent_d.split(' C 313 1322')[0];assert child_d.startswith(shared_outer)
assert parent_d.split(' Z M ',1)[1]==child_d.split(' Z M ',1)[1]
summary={'proof':{'shared_outer_commands_identical':True,'shared_hole_subpaths_identical':True,'shared_outer_prefix':shared_outer,'holes':parent_d.split(' Z M ',1)[1]},'region':region,'experiments':[]}
def measure(name,doc,save=False):
 a=alpha_image(doc,size,region,4);outside=ImageChops.subtract(occupied(a),pm)
 values=[a.getpixel((round((p['pixel_top_left'][0]-region[0])*4),round((p['pixel_top_left'][1]-region[1])*4))) for p in points]
 item={'name':name,'outside_samples':outside.histogram()[255],'alphas_at_previous_failures':values};summary['experiments'].append(item);print(item,flush=True)
 if save:E.ElementTree(doc).write(N/(name+'.svg'),encoding='utf-8',xml_declaration=True)
measure('input-child',child)
doc=copy.deepcopy(child);find(doc,ID).set('fill','#5FA8D3');measure('diagnostic-parent-color',doc)
doc=copy.deepcopy(parent);pg=find(doc,'group-head-rear-hair-left')
for el in list(pg):
 if el.tag.endswith('path') and el.get('id')!='head-rear-left-main':pg.remove(el)
measure('diagnostic-parent-main-only',doc)
doc=copy.deepcopy(child);g=find(doc,ID);p=find(doc,MAIN);p.set('clip-path',g.attrib.pop('clip-path'));measure('diagnostic-clip-on-path',doc)
doc=copy.deepcopy(child);g=find(doc,ID);p=find(doc,MAIN);g.remove(p);wrap=E.SubElement(g,'{http://www.w3.org/2000/svg}g',{'id':'diagnostic-shape-wrapper'});wrap.append(p);measure('diagnostic-nested-group',doc)
doc=copy.deepcopy(child);g=find(doc,ID);g.attrib.pop('clip-path');measure('diagnostic-no-ear-clip',doc)
(N/'raster-diagnosis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
