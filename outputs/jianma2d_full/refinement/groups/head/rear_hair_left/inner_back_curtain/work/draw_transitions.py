from render_n29 import *
s=load();k='nape_back_sheet'
add_def(s,k,gradient('n29_nape_local_hue',[(0,'#B8B3C8',.05),('.22','#B8B3C8',.21),('.57','#CDD3E4',.22),(1,'#D9D6E7',.19)]))
plane(s,k,'soft_violet_local_color',s['parts'][k]['d'],'url(#n29_nape_local_hue)','同银发局部冷暖：颈段轻灰紫，肩腰转向冷灰，下返带弱中性紫，保持原明暗层级。')
add_def(s,k,blur('n29_nape_transition_soft',2.2))
ribbon(s,k,'inner_lavender_transition','M 393 313 C 394 378 364 449 359 486 C 355 528 389 584 391 626 C 384 691 357 749 350 809 C 345 881 364 958 385 1024 C 402 1081 408 1142 401 1198',16,'#D7D5E4','内转面弱灰紫过渡，覆盖背片隐藏面且避开无依据的外物投影。',.25,'n29_nape_transition_soft')
k='inner_side_lock';add_def(s,k,gradient('n29_side_core_tint',[(0,'#ECECF4',.26),('.17','#F1EDF4',.45),('.45','#DCE3EE',.35),('.72','#E9E8F3',.42),(1,'#E9EEF5',.48)]));add_def(s,k,blur('n29_side_transition_soft',1.8))
ribbon(s,k,'silvery_local_core','M 377 291 C 377 336 373 383 356 412 C 341 438 320 460 321 486 C 322 515 348 553 359 597 C 363 614 358 632 348 650 C 327 690 311 733 299 791 C 289 846 297 889 312 941 C 328 995 347 1054 352 1103 C 358 1154 345 1212 334 1269 C 323 1321 320 1363 330 1392 C 335 1406 345 1415 354 1420',17,'url(#n29_side_core_tint)','银白长束局部色沿曲率延续：肩旁微中性暖灰、腰髋偏冷白、下返微紫灰；这是本体色而非外来反光。',1,'n29_side_transition_soft')
prepare('part_color_transitions',s,'# 4.3 过渡色与局部色\n\n依据已实看参考的低饱和银灰发面，在后幕内转面补弱灰紫过渡，完整背片从颈至下返保持同一材料；侧束沿宽亮芯补中性暖灰与冷白的弱变化。没有新增材质块，明暗层次仍是后幕深、侧束浅。独立渲染关系仍为33层。')
combo('part_color_transitions')
