from pathlib import Path
from PIL import Image, ImageDraw
import subprocess,json
import numpy as np
root=Path('/Users/wutian/Desktop/coding/AstraLayering/rigging/milly')
out=root/'v2/evidence/reference-review'
sequences={'turn-1':[round(1.8+i*.1,2) for i in range(18)],'turn-2':[round(4.4+i*.1,2) for i in range(18)],'nod':[round(14.6+i*.1,2) for i in range(18)]}
keytimes=[0,.5,1,3,4.5,6,8,9,12,15,18,24]
pick={round(t*30) for a in sequences.values() for t in a}|{round(t*30) for t in keytimes}
ff=root/'tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
p=subprocess.Popen([str(ff),'-v','error','-i',str(root/'reference.mp4'),'-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
n=0
while True:
 b=p.stdout.read(1920*1080*3)
 if len(b)!=1920*1080*3:break
 if n in pick:
  im=Image.fromarray(np.frombuffer(b,np.uint8).reshape(1080,1920,3))
  im.save(out/f'exact-{n/30:05.2f}.jpg',quality=94)
 n+=1
for name,times in sequences.items():
 canvas=Image.new('RGB',(6*320,3*382),'#eee9e4');d=ImageDraw.Draw(canvas)
 for i,t in enumerate(times):
  im=Image.open(out/f'exact-{t:05.2f}.jpg').crop((0,120,850,1080)).resize((320,361))
  x=i%6*320;y=i//6*382;canvas.paste(im,(x,y+21));d.text((x+6,y+4),f'{t:.2f} s',fill='black')
 canvas.save(out/f'sequence-{name}.jpg',quality=94)
json.dump({'fps':30,'selection':'Exact source frame n=round(t*30); no fps resampling.','sequences':sequences,'keytimes':keytimes},open(out/'exact-frame-times.json','w'),indent=2)
print('saved exact reference frames and three contact sheets')
