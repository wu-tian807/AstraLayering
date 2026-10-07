from n29_art import *
def add_def(s,k,xml):s['parts'][k]['defs'].append(xml)
def plane(s,k,name,d,color,desc,opacity=1,soft=None):
 a={'fill':color,'stroke':'none','opacity':opacity,'data_role':'self-surface-tone'}
 if soft:a['filter']='url(#'+soft+')'
 s['parts'][k]['layers'].append(path('n29_'+k+'_'+name,d,desc,**a))
def gradient(id,stops,x1=0,y1=260,x2=0,y2=1430):
 return f'<linearGradient id="{id}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">'+''.join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o,c,a in stops)+'</linearGradient>'
def blur(id,v):return f'<filter id="{id}" x="-30%" y="-15%" width="160%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="{v}"/></filter>'
def combo(node,boxes=None,svg=None):
 folder=G/FOLDERS[node];env=dict(os.environ,TMPDIR=str(folder/'tmp'),PYTHONDONTWRITEBYTECODE='1');jobs=[];boards=[]
 if boxes is None:boxes=[(310,270,160,180),(275,610,150,220),(300,1210,160,230)]
 for i,box in enumerate(boxes,1):
  out=folder/f'combination-{i}.png';cmd=[str(PY),str(R/'tools/svg_preview.py'),str(svg or folder/'candidate.svg'),str(out),'--reference',str(W/'references/base-subject.png'),'--crop',*map(str,box),'--scale','4','--columns','3'];p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr;boards.append(Image.open(out).convert('RGB'))
 sheet=Image.new('RGB',(max(i.width for i in boards),sum(i.height for i in boards)),'white');y=0
 for im in boards:sheet.paste(im,(0,y));y+=im.height
 sheet.save(folder/'combination-sheet.png');(folder/'combination-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
def viewed(node,paths,observation):
 p=WORK/'actual-views-render.json';m=json.loads(p.read_text()) if p.exists() else {'actual_actor':ACTOR,'total_actor_loaded_images':0,'views':[]}
 folder=G/FOLDERS[node] if node in FOLDERS else WORK
 for f in paths:
  f=Path(f);im=Image.open(f);m['total_actor_loaded_images']+=1;m['views'].append({'actor_ordinal':m['total_actor_loaded_images'],'node':node,'path':str(f.relative_to(W)),'sha256':sha(f),'size':list(im.size),'loaded':'actual original-resolution image; sheets preserve source pixels','observation':str((folder/'实际观察.md').relative_to(W))})
 p.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');(folder/'实际观察.md').write_text(observation+'\n\n实际actor `'+ACTOR+'`；当前累计'+str(m['total_actor_loaded_images'])+'图。\n')
 return m['total_actor_loaded_images']
def ribbon(s,k,name,curve,width,color,desc,opacity=.5,soft=None,knots=None):
 from brush_paths import sample,outline
 for i,pts in enumerate(sample(curve,step=.65)):
  d,_,_=outline(pts,knots or [(0,.1),(.2,.7),(.55,.85),(.8,.6),(1,.05)],width)
  plane(s,k,name+'_'+str(i),d,color,desc+'；填色带源中心曲线：'+curve,opacity,soft)
