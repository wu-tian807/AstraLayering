from PIL import Image,ImageDraw,ImageChops
from pathlib import Path
import numpy as np,json
p=Path('tmp/refinement-face-step5')
def white(im):return Image.alpha_composite(Image.new('RGBA',im.size,'white'),im.convert('RGBA')).convert('RGB')
def chk(size):
 im=Image.new('RGBA',size,(247,247,247,255));d=ImageDraw.Draw(im)
 for yy in range(0,size[1],5):
  for xx in range(0,size[0],5):
   if (xx//5+yy//5)%2:d.rectangle((xx,yy,xx+4,yy+4),fill=(218,224,229,255))
 return im
ref=white(Image.open('references/base-subject.png'));before=white(Image.open(p/'before-transparent.png'));after=white(Image.open(p/'after-transparent.png'));ims=[ref,before,after]
for name,box,scale in [('face',(390,148,500,275),5),('parts',(380,176,510,237),5),('head',(355,120,531,310),3),('nose',(430,211,457,241),12),('normal-head',(355,120,531,310),1)]:
 w,h=(box[2]-box[0])*scale,(box[3]-box[1])*scale
 out=Image.new('RGB',(w*3,h+32),'white');d=ImageDraw.Draw(out)
 for k,(im,title) in enumerate(zip(ims,['REFERENCE','INPUT STEP 4','STEP 5'])):
  out.paste(im.crop(box).resize((w,h)),(k*w,32));d.text((k*w+8,8),title,fill='black')
 out.save(p/(name+'-comparison.png'))
Image.blend(ref,after,.5).crop((355,120,531,310)).resize((704,760)).save(p/'head-overlay-50.png')
# Independent parts on a neutral checkerboard, without repositioning their local crops.
items=[('brow_right',(399,178,438,192),10),('brow_left',(450,178,489,192),10),('nose',(430,217,458,240),10),('ear_right',(383,203,407,228),10),('ear_left',(480,203,505,228),10),('blush_right',(390,195,431,238),7),('blush_left',(458,194,498,237),7)]
out=Image.new('RGB',(1100,810),'white');d=ImageDraw.Draw(out)
for i,(id,box,scale) in enumerate(items):
 im=Image.open(p/('isolated-'+id+'.png')).convert('RGBA').crop(box);bg=Image.alpha_composite(chk(im.size),im).convert('RGB');bg=bg.resize((bg.width*scale,bg.height*scale))
 x,y=[(12,34),(560,34),(12,237),(350,237),(650,237),(60,508),(600,508)][i]
 out.paste(bg,(x,y));d.text((x,y-19),id,fill='black')
out.save(p/'isolated-parts-checkerboard.png')
# Hide brows/nose/blush; show clean face alone and ear overlap.
out=Image.new('RGB',(1650,660),'white');d=ImageDraw.Draw(out)
for i,(fn,title) in enumerate([('features-hidden.png','BROWS / NOSE / BLUSH HIDDEN'),('face-clean.png','FACE BASE ALONE'),('ears-with-face.png','EARS BEHIND FACE')]):
 im=Image.open(p/fn).convert('RGBA').crop((385,150,507,277));im=Image.alpha_composite(chk(im.size),im).convert('RGB').resize((549,571));out.paste(im,(i*550,40));d.text((i*550+10,12),title,fill='black')
out.save(p/'hidden-features-and-ear-overlap.png')
# Pixel checks use the same transparent rendering/compositing method for both carry stages.
a=np.asarray(before);b=np.asarray(after);dif=np.max(np.abs(a.astype(int)-b.astype(int)),axis=2);ys,xs=np.where(dif>0)
validation=json.loads((p/'validation.json').read_text())
validation['render_difference_bbox_xyxy']=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)]
validation['render_changed_pixels']=int((dif>0).sum())
validation['render_change_outside_head_roi']=int((dif[:175]>0).sum()+(dif[240:]>0).sum())
validation['isolated_face_pixels_identical']=np.array_equal(np.array(Image.open(p/'face-clean-before.png')),np.array(Image.open(p/'face-clean.png')))
mask=np.array(Image.open(p/'face-mask.png').convert('RGBA'))[:,:,3]
leaks={}
for id in ['blush_right','blush_left','nose']:
 alpha=np.array(Image.open(p/('isolated-'+id+'.png')).convert('RGBA'))[:,:,3]
 leaks[id]=int(((mask==0)&(alpha>0)).sum())
validation['clipped_parts_pixels_outside_face']=leaks
validation['transparent_svg_canvas_corner_alpha']=Image.open(p/'after-transparent.png').getpixel((0,0))[3]
pr=Image.open('refinement/groups/face/5.脸部部件绘制/preview.png');validation['preview_size']=list(pr.size);validation['preview_corner_rgb']=list(pr.convert('RGB').getpixel((0,0)))
assert validation['render_change_outside_head_roi']==0
assert validation['isolated_face_pixels_identical']
assert all(x==0 for x in leaks.values())
# Difference visualization adds only a magnified color map, not a claim about source fidelity.
heat=np.zeros_like(a);heat[:,:,0]=np.minimum(dif*8,255);heat[:,:,1]=np.minimum(dif*3,255)
Image.fromarray(heat).crop((375,175,515,240)).resize((1120,520)).save(p/'before-after-difference.png')
(p/'validation.json').write_text(json.dumps(validation,ensure_ascii=False,indent=2));print(json.dumps(validation,ensure_ascii=False,indent=2))
