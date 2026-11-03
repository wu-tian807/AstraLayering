"""Render existing Cubism models read-only: unoccluded face and face+features at X=0/-30.
python render_faces.py <runtime-models root> <output directory>
Requires live2d-py, glfw, PyOpenGL, numpy, Pillow and an OpenGL display.
"""
from pathlib import Path
import sys,json,hashlib,re,gc,struct
import glfw,live2d
from OpenGL.GL import glReadPixels,GL_RGBA,GL_UNSIGNED_BYTE
import numpy as np
from PIL import Image
root=Path(sys.argv[1]);out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True);W,H=1400,1800
specs=[('haru','haru_greeter_ja/runtime/haru_greeter_t05.model3.json'),('hiyori','hiyori_en/hiyori_pro/runtime/hiyori_pro_t11.model3.json'),('miara','miara_en/runtime/miara_pro_t03.model3.json'),('natori','natori_en/runtime/natori_pro_t06.model3.json'),('koharu','koharu_haruto_ja/koharu/runtime/koharu.model3.json'),('haruto','koharu_haruto_ja/haruto/runtime/haruto.model3.json')]
assert glfw.init();glfw.window_hint(glfw.VISIBLE,False);win=glfw.create_window(W,H,'face-priors',None,None);assert win;glfw.make_context_current(win);live2d.init();live2d.glInit()
records=[]
for name,relative in specs:
 path=root/relative;setting=json.loads(path.read_text());moc=path.parent/setting['FileReferences']['Moc'];data=moc.read_bytes();off=lambda i:struct.unpack_from('<I',data,64+4*i)[0];n=struct.unpack_from('<I',data,off(0))[0];parents=list(struct.unpack_from('<%di'%n,data,off(9)));ids=[data[off(3)+64*k:off(3)+64*k+64].split(b'\0')[0].decode() for k in range(n)]
 def desc(i):
  found={i}
  while True:
   next_=found|{k for k,p in enumerate(parents) if p in found}
   if next_==found:return found
   found=next_
 def anc(i):
  found=set()
  while parents[i]>=0:i=parents[i];found.add(i)
  return found
 face={i for i,s in enumerate(ids) if re.search('face|head',s,re.I)};features={i for i,s in enumerate(ids) if re.search('eye|brow|nose|mouth|tear',s,re.I)};hair={i for i,s in enumerate(ids) if re.search('hair',s,re.I)}
 def keep(with_features):
  chosen=face|(features if with_features else set());result=set().union(*(desc(i)|anc(i) for i in chosen))
  result-=set().union(*(desc(i) for i in hair)) if hair else set()
  if not with_features:result-=set().union(*(desc(i) for i in features)) if features else set()
  return result
 def render(angle,with_features):
  # In-memory settings omit idle motions/physics/pose: only original keyforms run.
  static_setting=json.loads(json.dumps(setting))
  for key in ['Motions','Physics','Pose','Expressions']:static_setting['FileReferences'].pop(key,None)
  model=live2d.Model();model.LoadFromJsonString(json.dumps(static_setting,indent=2),root_path=str(path.parent.resolve())+'/');model.Resize(W,H);model.SetAutoBlink(False);model.SetAutoBreath(False);model.StopAllMotions();pids=model.GetPartIds();paramids=model.GetParamIds();kept=keep(with_features)
  angle_id='ParamAngleX' if 'ParamAngleX' in paramids else 'PARAM_ANGLE_X'
  assert angle_id in paramids,(name,paramids)
  controls=['ParamAngleX','ParamAngleY','ParamAngleZ','ParamBodyAngleX','ParamBodyAngleY','ParamBodyAngleZ','ParamEyeBallX','ParamEyeBallY','ParamMouthOpenY','ParamAllX','ParamAllY','ParamAllRotate','ParamBodyAngleZ2','ParamBodyAngleX2']
  controls+=['PARAM_ANGLE_X','PARAM_ANGLE_Y','PARAM_ANGLE_Z','PARAM_BODY_ANGLE_X','PARAM_BODY_ANGLE_Y','PARAM_BODY_ANGLE_Z','PARAM_EYE_BALL_X','PARAM_EYE_BALL_Y','PARAM_MOUTH_OPEN_Y']
  for _ in range(3):
   for key in controls:
    if key in paramids:model.SetParamById(key,angle if key==angle_id else 0)
   model.SaveParameters();model.Update(0)
   for i,p in enumerate(pids):
    if ids.index(p) not in kept:model.SetPartOpacity(i,0)
  actual=model.GetParamValueById(angle_id);assert abs(actual-angle)<1e-3,(name,angle,actual)
  assert all(abs(model.GetParamValueById(k))<1e-3 for k in controls if k in paramids and k!=angle_id),name
  live2d.clearBuffer(0,0,0,0);model.Draw();pixels=np.flipud(np.frombuffer(glReadPixels(0,0,W,H,GL_RGBA,GL_UNSIGNED_BYTE),np.uint8).reshape(H,W,4)).copy();del model;gc.collect();return pixels
 images={(angle,with_features):render(angle,with_features) for angle in [0,-30] for with_features in [False,True]}
 alpha=np.maximum.reduce([a[:,:,3] for a in images.values()]);ys,xs=np.where(alpha>10);assert len(xs)>0;bounds=[int(xs.min()),int(ys.min()),int(xs.max()+1),int(ys.max()+1)];pad=35;crop=[max(0,bounds[0]-pad),max(0,bounds[1]-pad),min(W,bounds[2]+pad),min(H,bounds[3]+pad)]
 folder=out/name;folder.mkdir(exist_ok=True)
 for (angle,with_features),a in images.items():Image.fromarray(a).crop(tuple(crop)).save(folder/(('features' if with_features else 'face')+('_front.png' if angle==0 else '_left.png')))
 refs=[moc,path,*[path.parent/p for p in setting['FileReferences']['Textures']]];records.append({'id':name,'model':relative,'angleX':{'baseline':0,'left':-30},'angleParameter':'PARAM_ANGLE_X' if name in ['koharu','haruto'] else 'ParamAngleX','disabledInMemory':['Motions','Physics','Pose','Expressions'],'fixedParameters':'Y/Z/body/gaze/mouth-open/all-transform=0; original other defaults','crop':crop,'faceParts':[ids[i] for i in sorted(face)],'featureParts':[ids[i] for i in sorted(features)],'excludedHairParts':[ids[i] for i in sorted(hair)],'sourceHashes':{str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in refs},'renderer':'live2d-py 1.0.0; SDK wrapper 5-r.5; actual Core 6.0.1; original runtime keyforms and masks; no image warp'});print('Rendered',name,flush=True)
(out/'sources.json').write_text(json.dumps(records,indent=2,ensure_ascii=False));glfw.destroy_window(win);glfw.terminate()
