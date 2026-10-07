from pathlib import Path
import xml.etree.ElementTree as E,re,json,subprocess
N=Path('refinement/groups/head/rear_hair_left/outer_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块');text=(N/'candidate-r1.svg').read_text();root=E.fromstring(text);updates={}
def revise(name,changes):
 global text
 pid='node22-'+name.replace('_','-')+'-silhouette';el=next(x for x in root.iter() if x.get('id')==pid);old=el.get('d');new=old
 for before,after in changes:
  assert before in new,(name,before);new=new.replace(before,after)
 oldtag=re.search(r'<path\b[^>]*id="'+re.escape(pid)+r'"[^>]*>',text).group(0)
 text=text.replace(oldtag,oldtag.replace('d="'+old+'"','d="'+new+'"'),1);updates[name]={'old':old,'new':new}
oldroot='C 337 362 329 381 321 405 C 309 441 301 479 290 509 C 279 541 261 571 244 599'
newroot='C 338 362 330 381 322 405 C 310 441 302 479 291 509 C 280 541 262 571 245 599'
revise('upper_loop_lock',[
 ('M 321 405 C 309 441 301 479 290 509','M 322 405 C 310 441 302 479 291 509'),
 ('C 279 541 261 571 244 599','C 280 541 262 571 244 599'),
 ('C 275 591 293 564 300 538 C 309 511 317 474 324 452 C 327 435 325 418 321 405 Z','C 278 589 296 553 308 525 C 312 508 315 491 316 477 C 320 454 329 439 339 424 C 339 414 330 409 322 405 Z')])
revise('sweeping_long_lock',[(oldroot,newroot),('C 332 604 324 575 313 552 C 294 522 290 493 301 466 C 319 429 346 392 361 351 C 373 316 381 285 371 264 Z','C 332 604 324 575 313 552 C 301 525 305 500 312 482 C 318 464 329 445 339 428 C 349 407 359 377 365 351 C 375 316 380 285 371 264 Z')])
for name in ['outward_curl_lock','pointed_long_lock']:revise(name,[(oldroot,newroot)])
(N/'candidate-r2.svg').write_text(text);(N/'r2-changes.json').write_text(json.dumps({'design_reason':'Repair the upper-loop hidden attachment exceeding the narrow shoulder throat; widen sweeping lock hidden neck where its inner return crossed its outer edge. Separate the front three hidden roots 1 px inside the shared parent perimeter; the inner core retains the full parent outline. Visible loop arcs and free tips unchanged.','updates':updates},ensure_ascii=False,indent=2)+'\n')
cmd=['.runtime/svg-preview/python/bin/python','../../workflow-next/live2d-layering/tools/svg_containment.py','--parent-svg',str(N/'input-groups.svg'),'--candidate',str(N/'candidate-r2.svg'),'--groups','structure/groups.json','--group-path','head/rear_hair_left/outer_back_curtain','--out',str(N/'r2-bounds.json')];p=subprocess.run(cmd,text=True,capture_output=True);(N/'r2-bounds-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n');print(p.stdout,p.stderr)
