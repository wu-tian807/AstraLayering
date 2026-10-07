from rear_left_ops import *
D=G/'4.rendering stack/4.5.投影处理/4.5.2.独立投影绘制';D.mkdir(exist_ok=True)
rows=[(IDS[0]+'_face_cast_shadow','M 376 272 C 381 289 389 304 396 319 C 396 334 392 348 383 359 C 375 369 366 376 354 381 L 459 392 L 466 288 Z',374,416,1.2,[(0,0),(.35,.18),(.65,.30),(1,.36)],'脸下颌在耳后发面内侧形成冷灰蓝遮光，左侧接触边沿(376,272)至(396,319)再下行(383,359)。颜色向右变深，约1–3px柔边；原始面延至x466/y392，超出receiver不裁，按登记跟随face_skin。'),(IDS[1]+'_left_leg_cast_shadow','M 429 818 C 430 870 435 930 434 984 C 434 1033 439 1078 441 1104 C 439 1140 435 1188 435 1218 C 435 1258 439 1300 441 1312 L 414 1330 L 412 800 Z',425,440,.6,[(0,.22),(.3,.16),(.7,.08),(1,0)],'左腿在尾束左侧窄带投影。右侧可见边随尾束当前弯曲向膝间收拢，蓝灰低对比、近接触稍实向中央软化；x412/y1330为受影外余量，raw完整保留。'),(IDS[1]+'_right_leg_cast_shadow','M 451 818 C 448 880 447 932 448 984 C 446 1039 442 1079 443 1103 C 444 1140 448 1189 448 1220 C 448 1258 445 1299 442 1312 L 468 1330 L 471 800 Z',441,455,.65,[(0,0),(.3,.05),(.7,.13),(1,.19)],'右腿向尾束右侧的浅冷阴影，向中央2px柔化，较左侧轻；raw延至x471/y1330，后置按receiver裁切，跟随右腿独立运动。')]
raw=[]
for id,path,x1,x2,blur,stops,desc in rows:
 g=elem('g',{'id':id});note(g,desc+' 本层独立渲染对象，无data-part-path，不改变物理树。')
 defs=elem('defs');g.append(defs);grad=elem('linearGradient',{'id':id+'_gradient','gradientUnits':'userSpaceOnUse','x1':x1,'y1':0,'x2':x2,'y2':0})
 for off,op in stops:grad.append(elem('stop',{'offset':off,'stop-color':'#7181A6','stop-opacity':op}))
 defs.append(grad);f=elem('filter',{'id':id+'_soft','x':'-8%','y':'-3%','width':'116%','height':'106%'});f.append(elem('feGaussianBlur',{'stdDeviation':blur}));defs.append(f)
 n=elem('path',{'id':id+'_raw','d':path,'fill':'url(#'+id+'_gradient)','stroke':'none','filter':'url(#'+id+'_soft)'});note(n,'完整未按receiver裁切的原始投影；可见部分依据参考，外部余量供相对动作。');g.append(n);raw.append(g)
s=A.read_text()
# Place raw layers above own receiving surfaces, before existing foreground scopes.
needle='<g id="head_rear_hair_right_occipital_root"';assert needle in s
insert='\n'.join(E.tostring(g,encoding='unicode') for g in raw)+'\n';assert all('id="'+g.get('id')+'"' not in s for g in raw);A.write_text(s.replace(needle,insert+needle,1))
snapshot(D/'raw-and-parts.svg',[group(i) for i in IDS]+raw)
(D/'说明.md').write_text('已绘3个独立投影同名g，所有raw保留receiver外余量，无生产mask/clip绑定。脸影在内侧头颈接触处较深，两腿侧影浅且窄；来源、硬软和运动余量写入desc。诊断combined只在本目录用原生rendering apply生成，不覆盖正式稿。\n')
