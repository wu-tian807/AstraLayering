from pathlib import Path
from PIL import Image, ImageChops,ImageFilter,ImageDraw
p=Path('tmp/block-drawing/v2');orig=Image.open('references/base-subject.png').convert('RGB');v=Image.open('block-layers/preview.png').convert('RGB')
regions={'toes':((358,1570,528,1644),['foot_left','foot_right'],6),'hand_right':((200,785,265,883),['hand_right'],6),'hand_left':((620,785,685,883),['hand_left'],6),'anklets':((380,1460,510,1588),['foot_chain_left','foot_chain_right'],4),'crown':((390,43,490,101),['headdress_center'],6),'earring_right':((368,215,414,335),['earring_right'],6),'earring_left':((478,215,521,335),['earring_left'],6)}
for name,(b,parts,scale) in regions.items():
 mask=Image.new('L',orig.size)
 iso=Image.new('RGB',orig.size,'white')
 for part in parts:
  im=Image.open('tmp/block-drawing/isolated/'+part+'.png').convert('RGB')
  m=ImageChops.difference(im,Image.new('RGB',im.size,'white')).convert('L').point(lambda x:255 if x else 0)
  mask=ImageChops.lighter(mask,m);iso.paste(im,(0,0),m)
 edge=ImageChops.subtract(mask,mask.filter(ImageFilter.MinFilter(3)))
 overlay=orig.copy();overlay.paste((226,0,161),(0,0),edge)
 crops=[z.crop(b).resize(((b[2]-b[0])*scale,(b[3]-b[1])*scale)) for z in [orig,v,iso,overlay]]
 sheet=Image.new('RGB',(sum(z.width for z in crops),crops[0].height+20),'white');d=ImageDraw.Draw(sheet)
 for i,c in enumerate(crops):sheet.paste(c,(i*c.width,20));d.text((i*c.width+5,5),['Reference','v2 composite','Part isolated','v2 part boundary'][i],fill='black')
 sheet.save(p/(name+'-comparison.png'))
 blend=Image.blend(orig.crop(b),v.crop(b),.5).resize(crops[0].size);blend.save(p/(name+'-blend.png'))
