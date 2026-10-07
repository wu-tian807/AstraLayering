from render_n29 import *
n='part_rendered';f=G/FOLDERS[n];env=dict(os.environ,TMPDIR=str(f/'tmp'),PYTHONDONTWRITEBYTECODE='1');jobs=[]
for k,box in [('nape_back_sheet',(285,245,170,1035)),('inner_side_lock',(270,245,125,1190))]:
 cmd=[str(PY),str(R/'tools/svg_preview.py'),str(f/'candidate.svg'),str(f/(k+'-complete.png')),'--only',IDS[k],'--reference',str(W/'references/base-subject.png'),'--crop',*map(str,box),'--scale','2','--columns','3'];p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
cmd=[str(PY),str(R/'tools/svg_preview.py'),str(f/'candidate.svg'),str(f/'neighbor-surfaces.png'),'--reference',str(W/'references/base-subject.png'),'--crop','280','250','205','1190','--scale','2','--columns','3']
for id in [*IDS.values(),'head_rear_hair_left_occipital_root','head_face_framing_hair_left_main_long_lock','head_rear_hair_left_central_back_tail']:cmd+=['--only',id]
p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
cmd=[str(PY),str(R/'tools/svg_preview.py'),str(f/'candidate.svg'),str(f/'final-preview.png'),'--background','white'];p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
(f/'full-surface-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
