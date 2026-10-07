from pathlib import Path
import re,json,hashlib,subprocess,xml.etree.ElementTree as E
P=Path('refinement/groups/head/face/mouth');B=P/'2.直属拆分与色块/2.2.直属轮廓色块';NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
text=(B/'input/guide.svg').read_text();root=E.fromstring(text);parent=next(e for e in root.iter() if e.get('id')=='group-head-face-mouth');bed=next(e.get('d') for e in parent if e.get('id')=='head-face-mouth-occluded-oral-bed')
upper_visible='M 429.2 295.4 C 430.8 293.7 432.9 293.1 435.3 292.1 C 436.4 291.9 437.4 292.5 438.5 292.5 C 439.6 292.4 440.4 292.5 441.8 293 C 444 293.5 446.8 293.7 448.7 294.7 C 448.85 295.0 448.85 295.3 448.55 295.55 C 445.8 295.2 442.1 295.45 439.1 295.8 C 437.7 295.9 436.5 295.3 435.1 295.35 C 433.0 295.45 431.0 295.85 429.2 296.3 Z'
lower_visible='M 429.2 296.3 C 431.0 295.85 433.0 295.45 435.1 295.35 C 436.5 295.3 437.7 295.9 439.1 295.8 C 442.1 295.45 445.8 295.2 448.55 295.55 C 448.45 295.95 448.05 296.33 447.5 296.5 C 444.2 297.6 440.4 298.6 437.3 298.6 C 433.5 298.4 430.7 297.3 429.2 296.3 Z'
upper_hidden='M 429.7 295.5 C 430.2 292.4 433.3 290.8 438.4 290.7 C 443.1 290.6 447.5 291.8 448.2 294.9 L 448.0 295.6 C 445.4 295.1 442.2 295.4 439.1 295.8 C 437.7 295.9 436.5 295.3 435.1 295.35 C 433.0 295.45 431.0 295.85 429.7 296.1 Z'
lower_hidden='M 448.2 294.9 C 448.3 297.9 443.5 300.5 438.3 300.4 C 433.4 300.4 430.1 298.4 429.7 295.5 L 429.8 295.9 C 431.1 295.5 433.0 295.15 435.1 295.05 C 436.5 295.0 437.7 295.6 439.1 295.5 C 442.1 295.15 445.8 294.95 448.2 295.3 Z'
parts=[('mouth_interior','#727DB4',[(bed,'hidden-surface','上下唇之后的完整内侧底面，沿已批准oral-bed连续保留；闭口时由上下唇/面皮搭接覆盖。没有可见牙舌，不增加猜测的内部部件。')]),('lower_lip','#DFA06F',[(lower_hidden,'hidden-overlap','下唇/面皮后连续搭接余量，沿父级下弧；上侧窄重叠由上唇覆盖，下边界不能显影成厚唇。'),(lower_visible,'visible-surface','从原闭口包络沿用较柔和下缘；上界与上唇闭口接界使用相同反向Bezier，嘴角和下唇中央连续。')]),('upper_lip','#B889B9',[(upper_hidden,'hidden-overlap','上唇/面皮后搭接余量，沿父级上弧；可见唇峰与闭口轮廓由另一保留曲线决定，不能将本隐藏弧染成厚唇。'),(upper_visible,'visible-surface','原上唇略偏左唇峰、中央转折与较平右唇缘逐段保留；闭口接界轻微不对称，嘴角收细。')])]
blobs=[]
for key,color,paths in parts:
 ident='part-head-face-mouth-'+key.replace('_','-');g=E.Element('{'+NS+'}g',{'id':ident,'data-part-path':'head/face/mouth/'+key,'fill':color,'stroke':'none'})
 for d,suffix,note in paths:
  e=E.SubElement(g,'{'+NS+'}path',{'id':ident+'-'+suffix,'d':d,'stroke':'none'});E.SubElement(e,'{'+NS+'}desc').text=note
 blobs.append(E.tostring(g,encoding='unicode'))
m=re.search(r'<g\b[^>]*\bid="group-head-face-mouth"[^>]*>',text);depth=0;end=None
for token in re.finditer(r'<g\b[^>]*>|</g>',text[m.start():]):
 depth+=-1 if token.group()=='</g>' else (0 if token.group().endswith('/>') else 1)
 if depth==0:end=m.start()+token.start();break
assert end is not None
addition='\n    '+'\n    '.join(blobs)+'\n  ';candidate=text[:end]+addition+text[end:];assert candidate.replace(addition,'',1)==text
(B/'candidate.svg').write_text(candidate)
ids=[e.get('id') for e in E.fromstring(candidate).iter() if e.get('id')];assert len(ids)==len(set(ids))
(B/'evidence/scope-check.json').write_text(json.dumps({'parent_raw_and_other_svg_bytes_unchanged':True,'new_direct_parts':[key for key,_,_ in parts],'duplicate_ids':False,'candidate_sha256':hashlib.sha256(candidate.encode()).hexdigest()},ensure_ascii=False,indent=2)+'\n')
r=subprocess.run(['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_containment.py','--parent-svg',str(B/'input/guide.svg'),'--candidate',str(B/'candidate.svg'),'--groups','structure/groups.json','--group-path','head/face/mouth','--out',str(B/'轮廓检查.json')],text=True,capture_output=True)
print(r.stdout,r.stderr);assert r.returncode==0
