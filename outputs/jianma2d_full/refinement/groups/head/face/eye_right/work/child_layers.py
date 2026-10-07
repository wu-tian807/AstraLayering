from pathlib import Path
import xml.etree.ElementTree as E,re,copy,json,subprocess,os
W=Path('.');S=Path('../../workflow-next/live2d-layering');P=W/'refinement/groups/head/face/eye_right/2.直属拆分与色块/2.2.直属轮廓色块';E.register_namespace('','http://www.w3.org/2000/svg');NS='{http://www.w3.org/2000/svg}'
source=(P/'input/guide.svg').read_text();root=E.fromstring(source);parent=next(e for e in root.iter() if e.get('id')=='group-head-face-eye-right');old={e.get('id'):e for e in parent if e.tag==NS+'path'}
children=[]
def group(name,kind,color,note):
 ident=kind+'-head-face-eye-right-'+name.replace('_','-');g=E.Element(NS+'g',{'id':ident,'data-'+kind+'-path':'head/face/eye_right/'+name,'fill':color,'stroke':'none'});E.SubElement(g,NS+'desc').text=note;children.append(g);return g
def path(g,key,d,note,origin=None):
 e=E.SubElement(g,NS+'path',{'id':g.get('id')+'--'+key,'d':d,'fill':g.get('fill'),'stroke':'none'});E.SubElement(e,NS+'desc').text=note
 if origin:e.set('data-source-path',origin)
 return e
sclera=group('sclera','part','#77B8AB','完整连续眼白底面：两侧可见楔面、虹膜后底面和上下睑后余量同属一面。新增父边缘不是可见眼裂，正式由上下睑覆盖；无中央孔洞。')
path(sclera,'ocular-bed',old['head-face-eye-right-occluded-ocular-bed'].get('d'),'沿父级完整底面，同一眼白表面的隐藏范围。','head-face-eye-right-occluded-ocular-bed')
path(sclera,'opening-underlay','M 453 248.9 C 456 241.3 465.5 238 477 236.9 C 482.5 236.5 486.3 238.4 488.7 243.8 C 489.4 247.1 486.6 251.5 482.7 254 C 477.5 257.3 467.5 258 461 255.8 C 457 254.1 454.4 251.1 453 248.9 Z','两眼角与当前眼裂下缘完整连续底面，与ocular-bed重叠并连成完整眼白；不含外端睫毛尖。')
iris=group('iris','group','#7295D8','完整蓝虹膜/瞳孔视线组件的整体范围；上弧在上睑后补圆，下缘延续本侧平缓轮廓。只做整组轮廓，不绘瞳孔、纹理或反光；主角膜反光留后续独立highlight。')
path(iris,'complete-iris','M 468.9 236.2 C 475.4 236.0 479.0 241.0 478.6 246.5 C 478.4 251.0 476.1 255.2 472.8 256.2 C 470.0 257.15 466.2 257.15 463.6 256.1 C 460.2 254.5 459.05 250.1 459.3 245.2 C 459.6 240.3 462.8 236.35 468.9 236.2 Z','本侧可见约x459–479、y241–257，向上补成完整弧以藏在上睑后。保留完整形体供视线位移；没有裁掉被睑遮挡的上部。')
lower=group('lower_eyelid','part','#E7A182','完整细下睑：上缘沿原参考可见眼裂下弧，两端与上睑相接；下方覆盖父补全的2–3px隐藏余量。色块的下外弧是搭接边，不能作为可见扩大眼裂。')
path(lower,'complete-lid','M 453 248.9 C 454.7 251.0 457.2 253.85 461.18 255.45 C 467.6 257.64 477.3 256.95 482.45 253.65 C 486.2 251.15 488.8 247.1 488.3 243.95 L 488.7 243.8 C 488.99605633 245.19569411 488.66604588 246.78815205 487.89153702 248.35041340 C 486.42435481 253.61414963 481.20830542 258.64615424 474.40000000 259.82000000 C 467.54074089 260.71823631 460.81484185 258.28247067 456.50918122 252.97384946 C 454.94092268 251.61053776 453.78285198 250.13019598 453.00000000 248.90000000 Z','连续下睑：内侧沿参考下眼缘略内收形成真实薄边，外侧由原eye-envelope与occluded-ocular-bed交点分割曲线拼接，隐藏下弧内收0.08px以保守保持父范围，覆盖隐藏余量；一条闭合路径，无缝隙、额外孔洞或新增父范围。')
upper=group('upper_eyelid','group','#B58AC6','完整上睑组轮廓：保留原上缘与外端睫毛尖、原睑褶全部范围，并含上睑后的皮肤底面余量。当前上眼裂以睫毛带下缘为准；不在本步拆内部part或绘正式细节。')
path(upper,'upper-overlap','M 454 248.9 C 456.8 238.8 463.6 234.7 471 234.5 C 480 234.3 486.7 237.4 488.2 243.9 L 488.7 243.8 C 482.1 240.8 464.2 240.6 457.7 245.4 C 456.2 246.3 454.7 247.8 454 248.9 Z','父级上方隐藏余量到参考睫毛下缘之间的连续上睑范围，覆盖眼白与虹膜上弧；不把父补全弧作为新眼裂。')
path(upper,'upper-rim','M 453 248.9 C 456 241.3 465.5 238 477 236.9 C 482.5 236.5 486.3 238.4 489.3 240 L 495.3 242 L 491.5 243.1 L 492 245.7 L 488.7 243.8 C 482.1 240.8 464.2 240.6 457.7 245.4 C 456.2 246.3 454.7 247.8 453 248.9 Z','上缘、外端睫毛尖按原eye-envelope完整保留，内侧下缘按参考粗上睫毛带确定；发丝遮挡不裁掉上睑外端。')
path(upper,'lid-fold',old['head-face-eye-right-lid-fold'].get('d'),'原弧形睑褶全部范围，后续由上睑group再拆内部结构。','head-face-eye-right-lid-fold')
start=source.index('<g id="group-head-face-eye-right"');depth=0
for t in re.finditer(r'<g\b[^>]*>|</g>',source[start:]):
 depth+=-1 if t.group()=='</g>' else (0 if t.group().endswith('/>') else 1)
 if depth==0:end=start+t.end();break
addition='\n  '+'\n  '.join(E.tostring(g,encoding='unicode') for g in children)
candidate=P/'candidate.svg';candidate.write_text(source[:end]+addition+source[end:]);assert candidate.read_text().replace(addition,'',1)==source
ids=[e.get('id') for e in E.parse(candidate).getroot().iter() if e.get('id')];assert len(ids)==len(set(ids))
for g in children:
 for e in g:
  if e.tag==NS+'path':assert e.get('d').strip().endswith('Z')
record={'parent_raw_bytes_unchanged':True,'other_prior_svg_bytes_unchanged':True,'children':[{'id':g.get('id'),'binding':g.get('data-group-path') or g.get('data-part-path'),'path_count':len([e for e in g if e.tag==NS+'path'])} for g in children],'independent_highlight_deferred':True}
(P/'evidence/ownership.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
r=subprocess.run(['.runtime/svg-preview/python/bin/python',str(S/'tools/svg_containment.py'),'--parent-svg',str(P/'input/guide.svg'),'--candidate',str(candidate),'--groups','structure/groups.json','--group-path','head/face/eye_right','--out',str(P/'轮廓检查.json')],text=True,capture_output=True,env=dict(os.environ,TMPDIR=str(P.resolve())));print(r.stdout,r.stderr);r.check_returncode()
