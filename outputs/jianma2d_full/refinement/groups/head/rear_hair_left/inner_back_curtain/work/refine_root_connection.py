from render_n29 import *
s=load();k='nape_back_sheet'
add_def(s,k,gradient('n29_nape_root_connection',[(0,'#B6BAD1',1),('.25','#C8CBDF',1),('.46','#CFD2E4',1),('.6','#C1C5DC',1),('.8','#ADB2CC',1),(1,'#A9AEC8',1)],340,310,425,335))
add_def(s,k,blur('n29_nape_root_connection_soft',15))
plane(s,k,'root_same_material_connection','M 270 210 L 470 210 L 470 403 L 270 403 Z','url(#n29_nape_root_connection)','4.7实看相邻occipital根后，当前完整nape根区接同族横向灰紫色域；下缘15px柔化向自身S转面连续。自身材质接色，非外物投影或receiver遮罩。',.97,'n29_nape_root_connection_soft')
a=s['parts'][k]['layers'];a.insert(2,a.pop())
prepare('part_rendered',s,'# 4.7 线色融合与材质细化（接色修正版）\n\n第一轮完整面与相邻occipital/main_long_lock/central_tail实看发现：nape隐藏根部与occipital下沿有过深断层。保留revision-001原候选和图，当前只在nape根区接入相邻同族横向灰紫色域，并以15px软过渡退向自身背部S转面。旧Geometry和所有相邻部件未改。\n\n最终笔触已调为同面深灰紫，压力paths/起收与透明渐隐不变；侧束亮带略柔化。两条root候选desc明确已核对、未确认本组独立外投影，已有脸颌影沿用occipital层。\n\n参考接界要求：后幕比前侧主束深而同冷灰紫，肩后承接连续，侧长束髋旁和卷尾是亮芯冷缘，腿肤偏暖，中央尾与侧束同色系且保留各自转面。最终按完整面、4×接界和组合逐项复查。')
combo('part_rendered',[(315,270,155,160),(295,435,155,205),(280,660,145,190),(295,1215,185,230)])
