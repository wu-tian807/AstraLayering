from pathlib import Path
import xml.etree.ElementTree as E,copy,json,hashlib
N='{http://www.w3.org/2000/svg}';E.register_namespace('',N[1:-1])
source=Path('refinement/groups/face/3.关联部件校准/character.svg');dest=Path('refinement/groups/face/4.肤色与局部层次');tmp=Path('tmp/refinement-face-step4-new')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='92acb1b6b4a60f66340f225c8a1dbb75c6f9bb670fa466a9e8336b30e16ee77f'
r=E.parse(source).getroot();baseline=copy.deepcopy(r);defs=r.find(N+'defs');face=next(g for g in r.findall(N+'g') if g.get('id')=='face_base')
def add(tag,attrs,parent):
 e=E.SubElement(parent,N+tag,{k:str(v) for k,v in attrs.items()});return e
# Continuous clean skin color, not eye-socket, nasal, blush or cast-shadow paint.
g=add('radialGradient',{'id':'face_clean_skin_base','gradientUnits':'userSpaceOnUse','cx':0,'cy':0,'r':1,'gradientTransform':'translate(444 211) scale(61 54)'},defs)
for at,col in [(0,'#FCEDEB'),(.22,'#FCEEEC'),(.5,'#FDF2EF'),(.65,'#FDF5F3'),(.95,'#FDF4F3'),(1,'#FDF4F3')]:
 add('stop',{'offset':at,'stop-color':col},g)
fill=face.find('.//*[@id="face_base_fill"]');fill.set('fill','url(#face_clean_skin_base)')
shape=face.find('.//*[@id="face_base_shape"]');clip=add('clipPath',{'id':'face_clean_skin_clip','clipPathUnits':'userSpaceOnUse'},defs);add('path',{'d':shape.get('d')},clip)
tones=E.Element(N+'g',{'id':'face_clean_skin_tones','data-part':'face_base','data-kind':'face','data-role':'intrinsic-skin-chroma','clip-path':'url(#face_clean_skin_clip)'})
contour=face.find('.//*[@id="face_base_contour"]');face.insert(list(face).index(contour),tones)
# Broad complexion variations sampled on clean skin. No white specular highlights or anatomical feature shading.
fields=[
 ('forehead_neutral_skin',462,167,28,27,'#FEFAF8',[(0,.68),(.4,.42),(.75,.10),(1,0)]),
 ('left_lower_warm_skin',425,237,12,15,'#F9DAD7',[(0,.15),(.35,.10),(.70,.02),(1,0)]),
 ('right_lower_cool_skin',472,235,9,13,'#E6E7EC',[(0,.075),(.5,.035),(1,0)])
]
for name,cx,cy,rx,ry,col,stops in fields:
 grad=add('radialGradient',{'id':name+'_gradient','gradientUnits':'userSpaceOnUse','cx':0,'cy':0,'r':1,'gradientTransform':f'translate({cx} {cy}) scale({rx} {ry})'},defs)
 for offset,alpha in stops:add('stop',{'offset':offset,'stop-color':col,'stop-opacity':alpha},grad)
 add('ellipse',{'id':name,'cx':cx,'cy':cy,'rx':rx,'ry':ry,'fill':f'url(#{name}_gradient)'},tones)
r.find(N+'title').text='剑妈 · 完整分层稿 · face 第4步干净肤色'
r.find(N+'desc').text='原画布 941×1672。本节点仅更新 face_base 内的干净肤色与连续冷暖过渡；脸型、独立轮廓和其他部件内容沿用第3步。隐藏脸底连续，背景透明。'
dest.mkdir(parents=True,exist_ok=True);E.ElementTree(r).write(dest/'character.svg',encoding='utf-8',xml_declaration=True)
# Isolated evidence comes only from this freshly saved output and the specified step-3 input.
saved=E.parse(dest/'character.svg').getroot()
for name,tree in [('after-face',saved),('before-face',baseline)]:
 out=E.Element(tree.tag,tree.attrib)
 for node in tree:
  if node.tag==N+'defs' or node.get('id')=='face_base':out.append(copy.deepcopy(node))
 E.ElementTree(out).write(tmp/(name+'.svg'),encoding='utf-8',xml_declaration=True)
old={g.get('id'):g for g in baseline.findall(N+'g')};new={g.get('id'):g for g in saved.findall(N+'g')}
report={'input':str(source),'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256((dest/'character.svg').read_bytes()).hexdigest(),'changed_parts':[k for k in old if E.tostring(old[k])!=E.tostring(new[k])],'other_part_groups_exact_equal':all(E.tostring(old[k])==E.tostring(new[k]) for k in old if k!='face_base'),'original_shape_element_exact_equal':E.tostring(baseline.find('.//*[@id="face_base_shape"]'))==E.tostring(saved.find('.//*[@id="face_base_shape"]')),'original_contour_group_exact_equal':E.tostring(baseline.find('.//*[@id="face_base_contour"]'))==E.tostring(saved.find('.//*[@id="face_base_contour"]')),'original_contour_gradient_exact_equal':E.tostring(baseline.find('.//*[@id="face_contour_color"]'))==E.tostring(saved.find('.//*[@id="face_contour_color"]')),'top_level_group_ids_and_order_equal':list(old)==list(new),'root_attributes_equal':baseline.attrib==saved.attrib,'unique_ids':len([e.get('id') for e in saved.iter() if e.get('id')])==len(set(e.get('id') for e in saved.iter() if e.get('id'))),'part_count':len(set(g.get('data-part') for g in saved.findall(N+'g'))),'new_effect_groups':[],'new_filters':len(saved.findall('.//'+N+'filter'))-len(baseline.findall('.//'+N+'filter')),'note':'Only the specified step-3 SVG, current palette and color reference were read as artwork inputs; no historical step-4 output was loaded or copied.'}
(tmp/'structure-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False,indent=2))
