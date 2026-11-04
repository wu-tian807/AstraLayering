"""Build labeled priors from original SDK renders, without altering geometry.
python build_reference_board.py <rendered model-faces directory> <output directory> [--direction left|up|down|left-up|left-down]
Default left preserves the original X layout. Up/down consume the shared Y render set.
Left-up/left-down consume the shared XY render set and crop.
"""
from pathlib import Path
import argparse,json,shutil,hashlib
from PIL import Image,ImageDraw,ImageFont
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('source',type=Path);parser.add_argument('output',type=Path)
parser.add_argument('--direction',choices=['left','up','down','left-up','left-down'],default='left')
args=parser.parse_args();src=args.source;out=args.output;out.mkdir(parents=True,exist_ok=True)
font_path='/usr/share/fonts/google-noto-cjk/NotoSansCJK-Regular.ttc'
font=lambda size:ImageFont.truetype(font_path,size,index=2)
specs=[
 ('haru','稍长鹅蛋脸','颊部较直，下颌渐收，圆钝尖颏'),
 ('hiyori','圆润鹅蛋脸','颊部饱满，下颌圆收，小尖颏'),
 ('miara','圆颊小尖颏','基准自带倾斜；只参考局部颊颌连续性'),
 ('natori','长窄脸','颧颊偏直，下颌向小尖颏收束'),
 ('koharu','短圆脸','宽颊、短下脸，圆弧下颌'),
 ('haruto','宽圆脸','下巴短，颊部宽，底缘扁圆')]
records=json.loads((src/'sources.json').read_text());by_id={r['id']:r for r in records};rows=[]
direction=args.direction;label={'left':'左转 X=-30','up':'上抬 X=0/Y=+25','down':'下俯 X=0/Y=-25','left-up':'左上 X=-30/Y=+25','left-down':'左下 X=-30/Y=-25'}[direction]
baseline='X=0' if direction=='left' else 'X=0/Y=0'
headers=[baseline+' 脸底轮廓',label+' 脸底轮廓',baseline+' 原脸＋五官',label+' 原脸＋五官']
keys=['face_front','face_'+direction,'features_front','features_'+direction]
for name,kind,note in specs:
 if direction in ['left-up','left-down']:
  r=by_id[name];assert r['axis']=='xy' and len(r['cropUnion'])==6,(name,'XY shared renders required')
  for key in ['face_'+direction,'features_'+direction]:
   for axis,value in [('X',-30),('Y',25 if direction=='left-up' else -25)]:
    check=r['renderedParameters'][key]['angleParameters'][axis]
    assert check['requested']==value and abs(check['actual']-value)<1e-3,(name,key,axis,check)
 folder=out/name;folder.mkdir(exist_ok=True)
 for key in keys:shutil.copyfile(src/name/(key+'.png'),folder/(key+'.png'))
 row=Image.new('RGB',(1480,390),'#292e38');d=ImageDraw.Draw(row)
 d.text((20,8),f'{name.capitalize()}｜{kind}',font=font(28),fill='#fff')
 d.text((20,46),note,font=font(20),fill='#aeb8c8')
 for j,key in enumerate(keys):
  im=Image.open(src/name/(key+'.png')).convert('RGBA')
  if j<2:
   # Flat coloring uses only the rendered face alpha. It preserves the exact outline.
   alpha=im.getchannel('A');im=Image.new('RGBA',im.size,'#f5d5c5');im.putalpha(alpha)
  im.thumbnail((340,265),Image.Resampling.LANCZOS)
  x=j*370+(370-im.width)//2;y=110+(265-im.height)//2;row.paste(im,(x,y),im)
  d.text((j*370+20,79),headers[j],font=font(21),fill='#d2ddf4')
 row.save(folder/'reference.jpg',quality=94);rows.append(row)
 by_id[name].update({'faceType':kind,'shapeNote':note,'baselineMeaning':baseline+' original model keyform; not a guarantee of zero baked inclination','boardFaceColumns':'flat recolor of rendered face alpha, no contour edits','files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.glob('*')}})
 if direction!='left':
  by_id[name].update({'boardDirection':direction,'angleMeaning':'Original model parameter, not a physical angle measurement or this character target','boardPosePair':['front',direction]})
  by_id[name]['sharedCropWithBothXYDirections' if direction in ['left-up','left-down'] else 'sharedCropWithBothYDirections']=True
board=Image.new('RGB',(1480,110+390*len(rows)+55),'#20252f');d=ImageDraw.Draw(board)
title={'left':'左转','up':'上抬','down':'下俯','left-up':'左上','left-down':'左下'}[direction]
d.text((20,12),title+'脸型补全先验｜已有模型真实 Cubism 渲染',font=font(32),fill='white')
d.text((20,59),'每行同裁框、同尺度；脸底轮廓按渲染 alpha 平涂。可见脸缘仍以本角色视频为准。',font=font(22),fill='#becadc')
for i,row in enumerate(rows):board.paste(row,(0,110+390*i))
d.text((20,board.height-43),'脸型标签是按实际轮廓的形状描述；原脸上的发影/装饰不是骨肉外缘。',font=font(21),fill='#becadc')
board.save(out/'model-face-priors.jpg',quality=94)
if direction in ['left-up','left-down']:
 for r in records:r['boardSha256']=hashlib.sha256((out/'model-face-priors.jpg').read_bytes()).hexdigest()
(out/'sources.json').write_text(json.dumps(records,indent=2,ensure_ascii=False)+'\n')
