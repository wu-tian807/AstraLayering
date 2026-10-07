from render_n29 import *
s=load();k='nape_back_sheet';add_def(s,k,blur('n29_nape_local_soft',.85))
ribbon(s,k,'ear_nape_groove','M 374 308 C 372 328 365 351 359 366',3.2,'#7F8BA6','耳后自身扇流凹沟，非上方part投影；顺扇流中间微深，端部渐隐，远离耳孔透明槽。',.31,'n29_nape_local_soft')
ribbon(s,k,'shoulder_hollow','M 377 395 C 361 431 346 462 347 486 C 347 512 362 543 373 565',6.5,'#8C96B0','宽幕肩背内凹转折，暗域低强度软边，隐藏段延续同发面；不描身体轮廓。',.27,'n29_nape_local_soft')
ribbon(s,k,'waist_inset','M 381 598 C 381 630 365 669 351 699',4.5,'#8A94AE','腰部S形返弯内侧自身凹面，小范围收窄，不重复铺全体暗面。',.23,'n29_nape_local_soft')
ribbon(s,k,'lower_return_hollow','M 379 1143 C 377 1182 369 1211 360 1237',2.8,'#A1ACC3','下返部自身凹沟，中段轻深、末端淡收，同4px隐藏补面颜色连续。',.23,'n29_nape_local_soft')
k='inner_side_lock';add_def(s,k,blur('n29_side_local_soft',.55))
ribbon(s,k,'shoulder_inner_hollow','M 331 453 C 322 469 323 488 330 505 C 335 516 342 528 346 539',2.5,'#9BA5BD','侧长束自身肩弯凹侧，短柔暗带，不沿外缘重复黑描边。',.28,'n29_side_local_soft')
ribbon(s,k,'waist_roll_corner','M 365 600 C 368 617 359 637 348 656',2.5,'#939FB9','腰部返弯角度加深，单束形体内凹，首尾渐隐。',.25,'n29_side_local_soft')
ribbon(s,k,'free_tail_inset','M 339 1310 C 332 1338 330 1370 335 1390 C 338 1404 345 1413 354 1419',2.2,'#95A3C0','自由单卷尾内勾微暗，宽度递减至末尖，不能成为第二条黑边或第二尖。',.29,'n29_side_local_soft')
regions={'nape_back_sheet':[(325,275,120,115),(315,435,125,145),(310,605,125,135),(330,1130,120,145)],'inner_side_lock':[(335,275,65,135),(300,440,80,160),(275,715,90,175),(310,1230,65,210)]}
prepare('part_local_shading',s,'# 4.4 局部暗部细化\n\n细化耳后发槽、肩背凹弯、腰部返折与下端内勾；沿已有结构曲线控制短柔色带，避免压黑整根发束和重复轮廓。两件所有新增暗部均为自身曲率结构，未画尚未确认caster的root投影。隐藏面沿同凹凸延续。',regions=regions)
combo('part_local_shading',[(315,290,145,115),(300,440,130,190),(290,610,135,170),(305,1240,95,190)])
