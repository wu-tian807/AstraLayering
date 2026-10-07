"""n29 only: two authored continuous child silhouettes, preserving accepted outline."""
from pathlib import Path
import json,xml.etree.ElementTree as E
W=Path.cwd();N=W/'refinement/groups/head/rear_hair_left/inner_back_curtain/2.直属拆分与色块/2.2.直属轮廓色块'
# Exact De Casteljau subdivision joins the accepted neck/back silhouette at its
# actual intersections. This does not flatten curves, clip children to a parent,
# or use the old author-path count as the physical part split.
def blend(a,b,t):return tuple((1-t)*a[i]+t*b[i] for i in range(2))
def split(p,t):
 a,b,c=[blend(p[i],p[i+1],t) for i in range(3)];d,e=blend(a,b,t),blend(b,c,t);q=blend(d,e,t);return [p[0],a,d,q],[q,e,c,p[-1]]
def curve(p):return 'C '+' '.join(f'{v:.9f}'.rstrip('0').rstrip('.') for q in p[1:] for v in q)
neck_lower=[(357,379),(380,375),(402,367),(411,353)]
back_left=[(382,304),(380,346),(378,382),(363,413)]
neck_upper=[(414,308),(397,295),(385,278),(371,262)]
back_cap=[(382,304),(385,298),(391,292),(399,290)]
neck_to_back=curve(split(neck_lower,.27204214999384335)[0])+' '+curve(split(back_left,.6139771247234033)[1])
# The hidden attachment's upper edge sits one pixel within the accepted envelope.
# It stays under the fixed root/head and avoids exposing the top cap during overlap.
def lower_cap(p):return [(x,y+1) for x,y in p]
cap=curve(lower_cap(list(reversed(split(back_cap,.8611196001081339)[1]))))+' '+curve(lower_cap(split(neck_upper,.39449776417322846)[1]))
sheet='M 371 263 C 362 281 354 309 347 333 L 327 381 L 357 379 '+neck_to_back+' C 350 434 332 454 327 477 C 323 495 329 514 344 533 C 351 548 361 578 368 608 L 367 621 C 356 641 334 677 331 704 C 309 761 302 820 307 873 C 316 921 337 981 355 1041 C 368 1080 371 1122 367 1154 C 366 1195 356 1226 355 1264 C 362 1240 374 1217 390 1205.7 C 404 1197.7 418 1197.7 431 1208 C 434 1215 437 1222 440 1226 L 443 1223 L 443 306 C 430 303 414 298 399 291 '+cap+' Z M 358 284 C 350 301 342 317 343 330 C 343 334 344 337 345 340 C 350 321 355 302 358 284 Z'
# Visible left edge and free tip retain the accepted current-side silhouette.
# Only the occluded right seam opens by at most four viewport px into the back
# sheet, tapering to the untouched free-tip root and ear root.
lock='M 371 264 C 369 276 371 291 373 305 C 371 344 367 382 350 413 C 337 435 315 454 311 477 C 308 495 314 514 329 535 C 338 552 347 580 352 607 L 348 623 C 336 644 314 675 307 704 C 286 760 277 820 283 873 C 292 927 312 988 328 1041 C 341 1080 345 1122 341 1154 C 337 1194 326 1234 319 1278 C 313 1322 315 1367 324 1393 C 331 1410 344 1421 360 1423 C 339 1414 335 1391 341 1360 C 350 1321 358 1297 358 1264 C 359 1226 369 1195 370 1154 C 374 1122 375 1080 362 1041 C 344 981 323 921 314 873 C 309 820 316 761 338 704 C 341 677 363 641 374 621 L 375 608 C 368 578 358 548 351 533 C 336 514 330 495 334 477 C 338 454 354 434 366 413 C 381 382 383 346 385 304 C 385 287 380 273 371 264 Z'
clip='M 0 0 H 895 V 1758 H 0 Z M 352.2 302.7 C 351.7 310 349.0 319.5 346.0 332.8 C 344.1 330.3 343.4 325.4 345.5 318.2 C 347.6 311.5 350.2 306.6 352.2 302.7 Z'
ids=['part-head-rear-hair-left-inner-back-curtain-nape-back-sheet','part-head-rear-hair-left-inner-back-curtain-inner-side-lock']
base='head/rear_hair_left/inner_back_curtain/'
fragments=[]
for i,(name,d,fill) in enumerate([('nape_back_sheet',sheet,'#D8B476'),('inner_side_lock',lock,'#8F9DDD')]):
 g=E.Element('g',{'id':ids[i],'data-part-path':base+name,'fill':fill,'stroke':'none','clip-path':'url(#n29-inner-curtain-ear-opening-clip)'})
 if i==0:
  defs=E.SubElement(g,'defs');cp=E.SubElement(defs,'clipPath',{'id':'n29-inner-curtain-ear-opening-clip','clipPathUnits':'userSpaceOnUse'});E.SubElement(cp,'path',{'id':'n29-inner-curtain-ear-opening-geometry','d':clip,'clip-rule':'evenodd'})
 E.SubElement(g,'path',{'id':ids[i]+'-shape','d':d,'fill-rule':'evenodd','stroke':'none'})
 fragments.append(E.tostring(g,encoding='unicode'))
source=(N/'input-groups.svg').read_text();marker='id="group-head-rear-hair-left-outer-back-curtain"';assert source.count(marker)==1
new='\n  '.join(fragments)+'\n  '
position=source.rfind('<',0,source.index(marker))
candidate=source[:position]+new+source[position:]
(N/'candidate-groups.svg').write_text(candidate)
(N/'drawn-child-fragments.svg.txt').write_text(new)
(N/'curve-join-record.json').write_text(json.dumps({'nape_strategy':'One continuous nape-to-back outline follows outer union; author neck and hidden paths are not separate objects. Exact cubic subdivision retains the visible neck/back outer curves; the fully occluded upper attachment cap is inset 1 px within the parent envelope.','neck_back_join':[375.30729149875265,374.80714501414417],'upper_union_join':[395.78527568802195,291.0540208147124],'side_lock_strategy':'Whole root-to-tip strip; accepted outer edge and free tip retained, occluded inner edge extended up to 4 px inside nape, returning to the original edge by y1154 and keeping the entire y1154–1423 lower edge unchanged; no horizontal slicing.','parts':ids},ensure_ascii=False,indent=2)+'\n')
print('Wrote two independent closed part containers; all input bytes retained outside insertion.')
