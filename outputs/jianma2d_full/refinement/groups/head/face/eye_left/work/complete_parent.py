from pathlib import Path
import hashlib,json,re,os,subprocess,xml.etree.ElementTree as E
from PIL import Image,ImageDraw
W=Path('.');S=Path('../../workflow-next/live2d-layering');P=W/'refinement/groups/head/face/eye_left';B=P/'1.父级轮廓补全';PY='.runtime/svg-preview/python/bin/python';ENV=dict(os.environ,TMPDIR=str((P/'work').resolve()));ident='group-head-face-eye-left';pathid='head-face-eye-left-occluded-ocular-bed';NS='http://www.w3.org/2000/svg';E.register_namespace('',NS)
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert json.loads(Path('structure/groups.dispatch.json').read_text())['active']=={'target':'n23','route':'generic','pointer':None}
text=(B/'input/guide.svg').read_text();m=re.search(r'<g\b[^>]*\bid="'+ident+r'"[^>]*>',text);assert m
# This side is lower and rounder; temporal corner remains behind crossing hair.
d='M 386.2 248.9 C 387.0 241.8 393.4 237.6 401.4 237.1 C 409.8 236.6 417.0 241.5 419.0 249.9 C 417.5 257.5 411.4 262.7 403.3 263.0 C 395.1 263.2 387.5 257.4 386.2 248.9 Z'
p=E.Element('{'+NS+'}path',{'id':pathid,'d':d,'stroke':'none'});E.SubElement(p,'{'+NS+'}desc').text='左眼被上下睑、外侧交叉发丝遮住的连续眼球底面，仅补父级隐藏范围。上方约237.1至原眼裂上缘，下方延至263.0，外角根部延至386.2承接发丝后表面。依据本侧更低更圆的可见下弧及两眼角走向单独构造，非右眼镜像；原眼裂、外端睫毛尖和独立睑褶两条raw路径原样保留。最终眼睑/面皮必须遮住隐藏余量，不能把补全弧当作放大的可见眼裂。'
blob='\n    '+E.tostring(p,encoding='unicode');candidate=text[:m.end()]+blob+text[m.end():];(B/'candidate.svg').write_text(candidate)
assert candidate.replace(blob,'',1)==text
before=E.parse(B/'input/guide.svg').getroot();after=E.parse(B/'candidate.svg').getroot();a=next(e for e in before.iter() if e.get('id')==ident);b=next(e for e in after.iter() if e.get('id')==ident)
old=[E.tostring(e,encoding='unicode').strip() for e in a];kept=[E.tostring(e,encoding='unicode').strip() for e in b if e.get('id')!=pathid];assert old==kept
r=subprocess.run([PY,str(S/'tools/svg_containment.py'),'--parent-svg',str(B/'input/guide.svg'),'--candidate',str(B/'candidate.svg'),'--groups','structure/groups.json','--group-path','head/face','--out',str(B/'evidence/parent-containment.json')],capture_output=True,text=True,env=ENV);print(r.stdout,r.stderr);assert r.returncode==0
for args in [[PY,str(S/'tools/svg_preview.py'),str(B/'candidate.svg'),str(B/'evidence/after-local.png'),'--only',ident,'--reference','references/base-subject.png','--edge-overlay','--crop','374','226','54','45','--scale','4','--columns','3'],[PY,str(S/'tools/svg_preview.py'),str(B/'candidate.svg'),str(B/'evidence/whole-blend.png'),'--reference','references/base-subject.png','--columns','3']]:
 r=subprocess.run(args,capture_output=True,text=True,env=ENV);print(r.stdout,r.stderr);assert r.returncode==0
ims=[]
for name in ['before-local.png','after-local.png']:
 im=Image.open(B/'evidence'/name).convert('RGB');im.thumbnail((648,430));ims.append(im)
whole=Image.open(B/'evidence/whole-blend.png').convert('RGB');whole.thumbnail((1296,540))
height=max(i.height for i in ims)+34;board=Image.new('RGB',(1296,height+whole.height+30),'white');draw=ImageDraw.Draw(board);draw.text((6,5),'n23 left-eye parent: BEFORE',fill='black');draw.text((654,5),'AFTER: hidden ocular bed only; original visible paths unchanged',fill='black')
for x,im in zip([0,648],ims):board.paste(im,(x,28))
draw.text((6,height+5),'Full guide/reference/blend: upper/lower lids and iris remain for later stages.',fill='black');board.paste(whole,((1296-whole.width)//2,height+30));board.save(B/'evidence/inspection-montage.png')
report=json.loads((B/'evidence/parent-containment.json').read_text());target=next(e for e in report['results'] if e['path']=='head/face/eye_left');checks={'target':'n23','node':'group_completion','logical_worker':'group:head/face/eye_left','worker_id':'/root/workflow_runner/arm_right','new_independent_context':False,'existing_paths_unchanged':len(old),'other_svg_bytes_unchanged':True,'added_path':pathid,'outside_samples':target['outside_samples'],'default_scale':report['scale'],'alpha_threshold':report['alpha_threshold'],'parent_scope':'head/face','parent_expanded':False,'direct_mirror_used':False}
(B/'evidence/checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
print(B/'evidence/inspection-montage.png')
