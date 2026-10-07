from pathlib import Path
import xml.etree.ElementTree as E,re,json,subprocess
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');text=(N/'candidate-r2.svg').read_text();root=E.fromstring(text);updates=[]
for el in root.iter():
 pid=el.get('id','')
 if not pid.startswith('node22-') or not pid.endswith('-silhouette'):continue
 old=el.get('d');new=old;reasons=[]
 if pid=='node22-upper-loop-lock-silhouette':
  new=new.replace('C 312 508 315 491 316 477 C 320 454','C 312 508 313.5 491 315 477 C 319 454');reasons.append('Retain r3 true shoulder-throat correction; no visible loop arc changes.')
 if 'C 254 636 243 664 235 693 C 223 737 210 776 194 811' in new:
  new=new.replace('C 254 636 243 664 235 693 C 223 737 210 776 194 811','C 254 636 243 664 235.125 693 C 223.125 737 210.125 776 194.125 811');reasons.append('New child front-sheet edge placed 0.125px inside the true upper opening; hole remains open. No parent/clip/tolerance change.')
 if pid=='node22-inner-forked-lock-silhouette':
  new=new.replace('C 332 1234 343 1194 346 1154','C 331.875 1234 342.875 1194 346 1154');reasons.append('Inner right return control points 0.125px toward its own filled interior; shared end anchors retained; max curve change0.09375px.')
 if pid=='node22-pointed-long-lock-silhouette':
  new=new.replace('C 176 1492 213 1469 239 1449','C 176 1491.75 213 1468.75 239 1449');reasons.append('Oblique tip lower curve control points0.25px upward toward filled interior; both visible tip/junction endpoints retained; max curve change0.1875px.')
 if new!=old:
  tag=re.search(r'<path\b[^>]*id="'+re.escape(pid)+r'"[^>]*>',text).group(0);text=text.replace(tag,tag.replace('d="'+old+'"','d="'+new+'"'),1);updates.append({'id':pid,'reasons':reasons,'before':old,'after':new})
(N/'candidate-r4.svg').write_text(text);(N/'r4-changes.json').write_text(json.dumps({'discarded_representation':'r3 exact subdivisions retained as diagnostics; final candidate resumes original cubic segmentation','new_child_fitting_adjustments_are_geometry_changes':True,'parent_and_threshold_unchanged':True,'updates':updates},ensure_ascii=False,indent=2)+'\n')
cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_containment.py','--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r4.svg'),'--groups','structure/groups.json','--group-path','head/rear_hair_left/outer_back_curtain','--out',str(N/'r4-bounds.json')];p=subprocess.run(cmd,text=True,capture_output=True);(N/'r4-bounds-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n');print(p.stdout,p.stderr)
