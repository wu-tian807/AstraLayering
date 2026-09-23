from pathlib import Path
import sys,subprocess,json
import numpy as np
sys.path.insert(0,str(Path(__file__).parent/'tools'))
import imageio_ffmpeg
f=imageio_ffmpeg.get_ffmpeg_exe()
video='/Users/wutian/Downloads/1124230907-1-208.mp4'
p=subprocess.Popen([f,'-v','error','-i',video,'-vf','fps=15','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE)
left=[('browLY',-1,1),('browLX',-1,1),('browLForm',-1,1),('browLAngle',-1,1),('headX',-30,30),('headY',-30,30),('headZ',-30,30),('eyeLOpen',0,1),('eyeROpen',0,1),('eyeLSmile',0,1),('eyeRSmile',0,1),('breath',0,1)]
right=[('mouthOpen',0,1),('mouthForm',-1,1),('armL',-30,30),('elbowL',-30,30),('wristL',-10,10),('handL',-1,1),('bodyX',-10,10),('bodyY',-10,10),('bodyZ',-10,10),('skirt1',-1,1),('skirt2',-1,1),('skirt3',-1,1)]
tracks={k:[] for k,_,_ in left+right}; n=0;missing={k:0 for k in tracks}
while True:
 b=p.stdout.read(1920*1080*3)
 if len(b)<1920*1080*3:break
 a=np.frombuffer(b,dtype=np.uint8).reshape(1080,1920,3)
 for col,defs in enumerate([left,right]):
  x0,x1=(966,1150) if col==0 else (1359,1543)
  for row,(key,lo,hi) in enumerate(defs):
   y=248+row*59; s=a[y-12:y+13,x0-3:x1+4].astype(float)
   mask=(s[:,:,0]>160)&(s[:,:,1]<105)&(s[:,:,2]<110)&(s[:,:,0]-s[:,:,1]>75)
   yy,xx=np.where(mask)
   if len(xx)>2:val=lo+(np.median(xx)+x0-3-x0)/(x1-x0)*(hi-lo)
   else:val=tracks[key][-1] if n else (lo+hi)/2;missing[key]+=1
   tracks[key].append(round(float(np.clip(val,lo,hi)),4))
 n+=1
out={'fps':15,'duration':n/15,'source':'1124230907-1-208.mp4','method':'Red slider marker centers measured from every 15 fps frame. Not original Cubism motion data.','tracks':tracks,'missing':missing}
(Path(__file__).resolve().parent/'motion-tracks.json').write_text(json.dumps(out,separators=(',',':')))
for k,v in tracks.items():print(k,min(v),max(v),'missing',missing[k], 'samples',[v[int(t*15)] for t in [0,2,3,4.5,9,12,18,24]])
