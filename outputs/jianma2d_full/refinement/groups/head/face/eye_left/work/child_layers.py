from pathlib import Path
import xml.etree.ElementTree as E,re,json,subprocess,os
W=Path('.');S=Path('../../workflow-next/live2d-layering');P=W/'refinement/groups/head/face/eye_left/2.直属拆分与色块/2.2.直属轮廓色块';E.register_namespace('','http://www.w3.org/2000/svg');NS='{http://www.w3.org/2000/svg}';ENV=dict(os.environ,TMPDIR=str((P/'evidence').resolve()))
source=(P/'input/guide.svg').read_text();root=E.fromstring(source);parent=next(e for e in root.iter() if e.get('id')=='group-head-face-eye-left');old={e.get('id'):e for e in parent if e.tag==NS+'path'};children=[]
def group(name,kind,color,note):
 ident=kind+'-head-face-eye-left-'+name.replace('_','-');g=E.Element(NS+'g',{'id':ident,'data-'+kind+'-path':'head/face/eye_left/'+name,'fill':color,'stroke':'none'});E.SubElement(g,NS+'desc').text=note;children.append(g);return g
def path(g,key,d,note,origin=None):
 e=E.SubElement(g,NS+'path',{'id':g.get('id')+'--'+key,'d':d,'fill':g.get('fill'),'stroke':'none'});E.SubElement(e,NS+'desc').text=note
 if origin:e.set('data-source-path',origin)
 return e
sclera=group('sclera','part','#77B8AB','左眼完整连续眼白底面，保留两侧、虹膜后、上下睑后及画面左发丝后表面；父补全外弧不是新可见眼裂。中央无孔洞，未按当前虹膜/发丝遮挡切碎。')
path(sclera,'ocular-bed',old['head-face-eye-left-occluded-ocular-bed'].get('d'),'原父级完整隐藏底面逐段保留，眼白同一表面延续。','head-face-eye-left-occluded-ocular-bed')
path(sclera,'opening-underlay','M 419.3 250.5 C 416.5 244.2 408.2 240.9 398.9 240.7 C 392.2 240.4 388.3 242.2 386.4 245 L 388 248.1 C 387.7 249.8 387.9 251.5 389 253.2 C 392.4 257.4 397.3 260.1 403.8 260 C 410.7 260 416 257.1 418 252.1 L 419.3 250.5 Z','沿原眼裂上下边缘形成连续底面，与ocular-bed充分重叠；剔除只属于上睫毛的外端尖角，没有剔除眼球被发丝挡住的表面。')
iris=group('iris','group','#7295D8','本侧完整较低较圆虹膜/瞳孔视线组件的整体轮廓，补足上睑后上弧；仅组轮廓，不画瞳孔或纹理。左上主角膜反光是后续独立highlight，非part。')
path(iris,'complete-iris','M 403.8 239.05 C 410.2 239.00 414.95 244.05 414.90 250.10 C 414.80 254.60 412.75 258.60 409.40 259.50 C 406.10 260.20 401.50 260.35 398.50 258.90 C 395.20 257.15 394.40 252.10 394.65 247.25 C 394.90 242.30 398.00 239.05 403.8 239.05 Z','当前可见约x395–415、y245–260；完整上弧向上睑后延至239.05。依据本侧局部参考单独拟合，不镜像右眼，也不裁成当前眼裂。')
# Find the exact lower union handoff between original nasal edge and ocular bed.
curve=[(419.,249.9),(417.5,257.5),(411.4,262.7),(403.3,263.)]
def lerp(a,b,t):return tuple(x+(y-x)*t for x,y in zip(a,b))
def split(c,t):
 a,b,d=[lerp(c[i],c[i+1],t) for i in range(3)];e,f=lerp(a,b,t),lerp(b,d,t);g=lerp(e,f,t);return [c[0],a,e,g],[g,f,d,c[3]]
def cross(t):
 q=split(curve,t)[0][-1];return (q[0]-418)*(-1.6)-(q[1]-252.1)*1.3
lo,hi=0.,.2
assert cross(lo)*cross(hi)<0
for _ in range(80):
 mid=(lo+hi)/2
 if cross(mid)*cross(lo)>0:lo=mid
 else:hi=mid
t=(lo+hi)/2;_,suffix=split(curve,t);pt=suffix[0];s=(pt[0]-418)/1.3;assert 0<s<1
fmt=lambda p:f'{p[0]:.10f} {p[1]:.10f}'
lower_d='M 388 248.1 C 387.8 249.8 388.2 251.25 389.25 252.9 C 392.6 257.05 397.4 259.78 403.8 259.68 C 410.6 259.68 415.7 256.92 417.7 251.95 L 419.3 250.5 L '+fmt(pt)+' C '+' '.join(fmt(q) for q in suffix[1:])+' C 395.1 263.2 387.5 257.4 386.2 248.9 L 388 248.1 Z'
lower=group('lower_eyelid','part','#E7A182','左眼完整连续细下睑，从被白发遮挡的画面左外角沿较低较圆下弧接向右内眼角；下方搭接隐藏面不作为可见第二眼圈。')
path(lower,'complete-lid',lower_d,'单闭合下睑带：前三段C为本侧可见接触缘，中央比原下弧内收约0.32px形成细缘；鼻侧连接原眼角并在原直线/父眼球底弧的精确交点接入完整隐藏下外弧。外角保留发丝后覆盖，最终隐藏外弧无描边。')
upper=group('upper_eyelid','group','#B58AC6','完整上睑组：原上缘、画面左睫毛尖与独立睑褶均归本组；交叉白发处保持连续。上方皮肤余量覆盖完整眼白/虹膜上弧，内部继续留子组处理。')
path(upper,'upper-overlap','M 386.2 248.9 C 387.0 241.8 393.4 237.6 401.4 237.1 C 409.8 236.6 417.0 241.5 419.0 249.9 L 418.7 250.05 C 415.8 248.0 409.3 246.0 402.2 245.65 C 396.2 244.7 390.6 245.2 388 248.1 L 386.2 248.9 Z','父级上方隐藏底面的上睑承接皮肤，到本侧睫毛下缘；完整上弧不是扩大后的眼裂。鼻侧隐藏搭接端收于418.7,250.05，由upper-rim保留原419.3,250.5眼角；避免闭合直线超出父级曲边，不改原可见边缘。')
path(upper,'upper-rim','M 419.3 250.5 C 416.5 244.2 408.2 240.9 398.9 240.7 C 392.2 240.4 388.3 242.2 386.4 245 L 382.2 246.8 L 385.3 249.9 L 388 248.1 C 390.6 245.2 396.2 244.7 402.2 245.65 C 409.3 246.0 415.8 248.0 419.3 250.5 Z','原eye-envelope上边界与左外睫毛尖完整沿用；内侧下缘由左眼参考较低的上睫毛带确定，白发交叉处不切断。')
path(upper,'lid-fold',old['head-face-eye-left-lid-fold'].get('d'),'原本侧独立睑褶全部范围沿用，后续由上睑group继续拆分。','head-face-eye-left-lid-fold')
start=source.index('<g id="group-head-face-eye-left"');depth=0
for token in re.finditer(r'<g\b[^>]*>|</g>',source[start:]):
 depth+=-1 if token.group()=='</g>' else (0 if token.group().endswith('/>') else 1)
 if depth==0:end=start+token.end();break
addition='\n  '+'\n  '.join(E.tostring(g,encoding='unicode') for g in children);candidate=P/'candidate.svg';candidate.write_text(source[:end]+addition+source[end:]);assert candidate.read_text().replace(addition,'',1)==source
ids=[e.get('id') for e in E.parse(candidate).getroot().iter() if e.get('id')];assert len(ids)==len(set(ids))
for g in children:
 for e in g:
  if e.tag==NS+'path':assert e.get('d').strip().endswith('Z')
record={'parent_raw_bytes_unchanged':True,'other_prior_svg_bytes_unchanged':True,'children':[{'id':g.get('id'),'binding':g.get('data-group-path') or g.get('data-part-path'),'path_count':len([e for e in g if e.tag==NS+'path'])} for g in children],'independent_highlight_deferred':True,'direct_mirror_used':False}
(P/'evidence/ownership.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');(P/'evidence/lower-lid-union.json').write_text(json.dumps({'parent_curve':curve,'line_start':[418,252.1],'line_end':[419.3,250.5],'bed_t':t,'line_t':s,'intersection':pt,'suffix':suffix,'final_path':lower_d,'hidden_edge_inset_px':0},indent=2)+'\n')
r=subprocess.run(['.runtime/svg-preview/python/bin/python',str(S/'tools/svg_containment.py'),'--parent-svg',str(P/'input/guide.svg'),'--candidate',str(candidate),'--groups','structure/groups.json','--group-path','head/face/eye_left','--out',str(P/'轮廓检查.json')],text=True,capture_output=True,env=ENV);print(r.stdout,r.stderr);r.check_returncode()
