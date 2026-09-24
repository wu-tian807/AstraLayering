from PIL import Image,ImageDraw
from pathlib import Path
import numpy as np,json
P=Path('tmp/refinement-face-step6');v=json.loads((P/'validation.json').read_text())
def rgba(fn):return Image.open(P/fn).convert('RGBA')
def white(im):return Image.alpha_composite(Image.new('RGBA',im.size,'white'),im.convert('RGBA')).convert('RGB')
def checker(size,step=5):
 im=Image.new('RGBA',size,(248,248,248,255));d=ImageDraw.Draw(im)
 for y in range(0,size[1],step):
  for x in range(0,size[0],step):
   if (x//step+y//step)%2:d.rectangle((x,y,x+step-1,y+step-1),fill=(211,218,226,255))
 return im
before=rgba('before-transparent.png');after=rgba('after-transparent.png');off=rgba('effects-off.png')
v['all_effects_off_exactly_equals_carry_rgba']=np.array_equal(np.array(before),np.array(off))
v['clean_face_exactly_equals_carry_rgba']=np.array_equal(np.array(rgba('clean-face-only.png')),np.array(rgba('clean-face-before.png')))
assert v['all_effects_off_exactly_equals_carry_rgba'] and v['clean_face_exactly_equals_carry_rgba']
wa=np.array(white(before));wb=np.array(white(after));dif=np.max(np.abs(wa.astype(int)-wb.astype(int)),axis=2);yy,xx=np.where(dif>0)
v['difference_bbox_xyxy']=[int(xx.min()),int(yy.min()),int(xx.max()+1),int(yy.max()+1)]
v['difference_pixels']=int((dif>0).sum());v['difference_outside_head']=int((dif[:145]>0).sum()+(dif[275:]>0).sum());assert v['difference_outside_head']==0
for e in v['effects']:
 id=e['id'];target=e['target'];alpha=np.array(rgba('isolate-'+id+'.png'))[:,:,3];mask=np.array(rgba('mask-'+target+'.png'))[:,:,3]
 e['pixels_outside_target_surface']=int(((alpha>0)&(mask==0)).sum());assert e['pixels_outside_target_surface']==0
 e['visible_combined_changed_pixels']=int(np.any(wb!=np.array(white(rgba('off-'+id+'.png'))),axis=2).sum());assert e['visible_combined_changed_pixels']>0
# Every effect has an isolated original-coordinate panel. The same target retains a visible orientation cue.
sheet=Image.new('RGB',(1230,1220),'white');d=ImageDraw.Draw(sheet)
for i,e in enumerate(v['effects']):
 id=e['id'];t=e['target'];box,scale=((385,148,505,273),3) if t=='face_base' else (((382,203,407,228),12) if t=='ear_right' else (((480,203,505,228),12) if t=='ear_left' else ((431,216,458,240),12)))
 im=rgba('isolate-'+id+'.png').crop(box);im=Image.alpha_composite(checker(im.size),im).convert('RGB');im=im.resize((im.width*scale,im.height*scale))
 x,y=(i%3)*410+10,(i//3)*405+38;sheet.paste(im,(x,y));d.text((x,y-25),id,fill='black')
sheet.save(P/'isolated-effects-checkerboard.png')
# Show each disabled effect with the complete surrounding face at unchanged coordinates.
sheet=Image.new('RGB',(1230,1310),'white');d=ImageDraw.Draw(sheet)
for i,e in enumerate(v['effects']):
 im=white(rgba('off-'+e['id']+'.png')).crop((380,146,512,278)).resize((396,396));x,y=(i%3)*410+7,(i//3)*435+32;sheet.paste(im,(x,y));d.text((x,y-22),'OFF '+e['id'],fill='black')
sheet.save(P/'individual-effects-off.png')
# Source and matching casts hidden together; no source-related effect remains in these SVGs.
sources=sorted({e['source'] for e in v['effects'] if e['source']});sheet=Image.new('RGB',(1200,860),'white');d=ImageDraw.Draw(sheet)
for i,source in enumerate(sources+['ALL']):
 fn='all-sources-and-casts-off.png' if source=='ALL' else 'source-and-cast-off-'+source+'.png'
 im=white(rgba(fn)).crop((380,146,512,278)).resize((396,396));x,y=(i%3)*400,(i//3)*430+30;sheet.paste(im,(x,y));d.text((x+6,y-22),'SOURCE + CASTS OFF: '+source,fill='black')
sheet.save(P/'sources-and-casts-off.png')
ref=white(Image.open('references/base-subject.png'));ims=[ref,white(before),white(after)]
for name,box,scale in [('face',(390,148,500,275),5),('head',(355,120,531,310),3),('normal-head',(355,120,531,310),1),('forehead',(400,149,490,184),8),('nose',(430,215,458,239),12)]:
 w,h=(box[2]-box[0])*scale,(box[3]-box[1])*scale;out=Image.new('RGB',(w*3,h+32),'white');d=ImageDraw.Draw(out)
 for k,(im,title) in enumerate(zip(ims,['REFERENCE','INPUT STEP 5 / EFFECTS OFF','STEP 6 / EFFECTS ON'])):
  out.paste(im.crop(box).resize((w,h)),(k*w,32));d.text((k*w+8,8),title,fill='black')
 out.save(P/(name+'-comparison.png'))
Image.blend(ref,white(after),.5).crop((355,120,531,310)).resize((704,760)).save(P/'head-overlay-50.png')
heat=np.zeros_like(wa);heat[:,:,0]=np.minimum(dif*9,255);heat[:,:,1]=np.minimum(dif*3,255);Image.fromarray(heat).crop((380,145,513,275)).resize((665,650)).save(P/'effects-difference.png')
v['preview_size']=list(Image.open('refinement/groups/face/6.投影与高光效果/preview.png').size)
v['svg_canvas_corner_alpha']=after.getpixel((0,0))[3];v['preview_corner_rgb']=list(Image.open('refinement/groups/face/6.投影与高光效果/preview.png').convert('RGB').getpixel((0,0)))
(P/'validation.json').write_text(json.dumps(v,ensure_ascii=False,indent=2))
print(json.dumps({k:v[k] for k in ['all_effects_off_exactly_equals_carry_rgba','clean_face_exactly_equals_carry_rgba','difference_bbox_xyxy','difference_pixels','difference_outside_head']},indent=2))
print([(e['id'],e['visible_combined_changed_pixels'],e['pixels_outside_target_surface']) for e in v['effects']])
