from pathlib import Path
import re,xml.etree.ElementTree as ET,json,hashlib
src=Path('refinement/groups/face/2.脸型校准与绘制/character.svg');dest=Path('refinement/groups/face/3.关联部件校准');s=src.read_text();before=s
assert hashlib.sha256(src.read_bytes()).hexdigest()=='fd4ea60cc57831818d7cd1f0d663e9bcc18cb2c4a1d6698f458a1b9654dfbe43'

def path(part,d):
 global s
 pat=r'(<g id="'+re.escape(part)+r'"[^>]*>.*?<path d=")[^"]*'
 s,n=re.subn(pat,lambda m:m.group(1)+d,s,count=1,flags=re.S);assert n==1,part

# Keep the full eye as a single independent part; revise only its outer envelope.
path('eye_right','M 400.6,198.3 C 401.9,194.5 405.6,192.7 410.4,192.8 C 419.0,192.3 426.1,196.2 431.5,202.0 C 426.9,201.1 423.3,203.6 418.8,204.3 C 412.5,205.3 406.6,203.3 403.6,199.9 L 400.0,200.1 Z')
path('eye_left','M 455.3,201.8 C 459.9,196.4 465.8,193.3 472.3,192.7 C 477.7,192.3 482.3,193.3 484.5,195.5 L 487.5,195.1 C 487.6,198.4 484.9,200.1 482.4,201.4 C 477.6,205.4 468.8,205.6 463.0,202.1 C 460.4,200.8 457.8,201.1 455.3,201.8 Z')
# Hidden outer ends extend under the existing forelocks, without moving the forelocks or face.
path('brow_right','M 405.7,182.0 C 414.7,181.7 427.5,183.4 434.2,187.8 C 425.6,186.5 416.1,185.2 406.3,185.1 Z')
path('brow_left','M 454.1,188.1 C 460.4,183.5 472.0,181.7 482.0,181.9 L 482.3,185.1 C 472.8,185.2 462.6,186.1 454.1,188.1 Z')
# The source has two separated small alar marks, with no high hooked projection at y225.
path('nose','M 438.6,227.5 C 439.4,227.5 440.5,228.3 441.3,229.2 C 440.6,230.3 439.1,229.4 438.6,228.7 Z M 446.1,228.3 C 446.7,227.8 447.4,227.5 448.0,227.6 C 448.3,228.5 447.4,229.4 446.1,229.7 C 445.5,229.7 445.2,229.3 445.4,228.9 Z')
path('mouth','M 430.5,242.8 C 434.4,243.0 436.3,240.7 440.0,240.6 C 441.7,240.6 443.0,241.7 444.3,241.6 C 445.6,241.5 446.4,240.8 448.1,241.0 C 451.4,241.0 453.3,243.4 457.0,242.7 C 455.4,244.7 451.8,245.3 449.5,246.4 C 446.4,248.3 441.5,248.6 438.4,246.6 C 435.8,245.1 432.6,244.9 430.5,244.0 Z')
# The main stone's metal boundary reaches the meeting point of the forehead curves, around y162.
path('forehead_jewel','M 443.3,126.6 C 440.5,133.4 439.4,138.7 439.9,142.0 C 437.4,145.2 432.1,148.9 430.5,151.7 C 432.6,155.4 439.4,158.9 443.4,162.5 C 447.6,158.6 454.0,155.4 456.3,151.8 C 454.1,148.3 449.4,145.0 446.5,142.0 C 446.9,137.7 445.9,132.4 443.3,126.6 Z M 442.6,162.0 L 444.2,162.0 L 444.2,165.8 C 447.1,168.0 446.6,171.9 444.2,175.0 C 441.5,173.6 440.4,171.3 441.0,168.4 C 441.2,167.0 442.0,165.7 442.2,165.2 Z')
# Only the lower pendant is too long; preserve the complete existing upper assembly and open ring.
s=s.replace('M 393.3,260 L 395.2,260 L 395.7,265 C 398.9,270 397.6,273.8 394.8,277 C 391.8,273.5 391.4,269 393.5,265 Z','M 393.7,259.3 L 395.4,259.3 L 395.5,261.0 C 397.4,263.4 396.2,267.1 394.6,269.0 C 392.7,266.9 392.4,263.7 393.7,261.0 Z')
s=s.replace('剑妈 · 完整分层稿 · face 脸型底色与轮廓精修','剑妈 · 完整分层稿 · face 关联部件校准')
s=s.replace('face_base 为闭合肤色底形及独立可见脸缘线；邻接头发内缘完成校准，其余部件保留上轮分层稿。','face_base 沿用已校准的闭合肤色底形及独立可见脸缘线；眼眉鼻口及额饰、画面左耳坠末端完成关联几何校准，其余部件保留上轮分层稿。')
dest.mkdir(parents=True,exist_ok=True);(dest/'character.svg').write_text(s)
N='{http://www.w3.org/2000/svg}';a=ET.fromstring(before);b=ET.fromstring(s)
ag={x.get('id'):ET.tostring(x) for x in a.findall(N+'g')};bg={x.get('id'):ET.tostring(x) for x in b.findall(N+'g')}
changed=[{'part':g.get('data-part'),'kind':g.get('data-kind')} for g in b.findall(N+'g') if ag[g.get('id')]!=ET.tostring(g)]
attrs_a={x.get('id'):x.attrib for x in a.findall(N+'g')};attrs_b={x.get('id'):x.attrib for x in b.findall(N+'g')}
rep={'input_sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'output_sha256':hashlib.sha256((dest/'character.svg').read_bytes()).hexdigest(),'changed':changed,'face_base_exact_xml_equal':ag['face_base']==bg['face_base'],'face_contour_gradient_exact_xml_equal':ET.tostring(a.find(N+'defs'))==ET.tostring(b.find(N+'defs')),'all_top_level_group_attributes_equal':attrs_a==attrs_b,'all_top_level_ids_order_equal':list(ag)==list(bg),'root_attributes_equal':a.attrib==b.attrib,'part_count':len(set(g.get('data-part') for g in b.findall(N+'g'))),'unchanged_top_level_groups':[k for k in ag if ag[k]==bg[k]],'all_ids_unique':len([x.get('id') for x in b.iter() if x.get('id')])==len(set(x.get('id') for x in b.iter() if x.get('id')))}
Path('tmp/refinement-face-neighbors/structure-check.json').write_text(json.dumps(rep,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in rep.items() if k!='unchanged_top_level_groups'},ensure_ascii=False,indent=2))
