from pathlib import Path
import re, json, xml.etree.ElementTree as ET
base=Path('block-layers/character.svg').read_text()
s=base

def replace_group(part,group):
 global s
 s,n=re.subn(r'<g id="'+re.escape(part)+r'"[^>]*>.*?</g>',lambda m:group,s,flags=re.S)
 assert n==1,(part,n)
def change_path(part,d):
 pat=r'(<g id="'+re.escape(part)+r'"[^>]*>.*?<path d=")[^"]*'
 global s
 s,n=re.subn(pat,lambda m:m.group(1)+d,s,count=1,flags=re.S)
 assert n==1

# Source-coordinate traced cheek, jaw and rounded chin; the cap above the visible face stays closed beneath the hair.
contour='M 398.5,214.8 C 400.82,225.13 403.05,235.47 411,245.8 C 416.88,253.44 424.5,261 438.1,267.8 C 441.3,269.4 443,269.7 445.6,269.6 C 448.2,269.6 450.2,268.7 452.6,267.1 C 460,262 469.2,255 475.8,247.2 C 483.4,238.2 486.9,227.6 489,216.7'
fill='M 393,133 C 405,109 429,101 444,103 C 466,101 488,115 495,136 C 503,157 502,184 498,204 C 495,210 491,214 489,216.7 C 486.9,227.6 483.4,238.2 475.8,247.2 C 469.2,255 460,262 452.6,267.1 C 450.2,268.7 448.2,269.6 445.6,269.6 C 443,269.7 441.3,269.4 438.1,267.8 C 424.5,261 416.88,253.44 411,245.8 C 403.05,235.47 400.82,225.13 398.5,214.8 C 396,209 392,207 391,204 C 387,181 385,154 393,133 Z'
face=f'''<g id="face_base" data-part="face_base" data-kind="face"><title>头脸底形 · 校准底色与独立轮廓</title>
  <g id="face_base_fill" data-part="face_base" data-kind="face" data-role="base-color" fill="#FDF4F3"><path id="face_base_shape" d="{fill}" fill-rule="evenodd"/></g>
  <g id="face_base_contour" data-part="face_base" data-kind="face" data-role="visible-contour" fill="none" stroke="url(#face_contour_color)" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"><path id="face_visible_outline" d="{contour}"/></g>
</g>'''
replace_group('face_base',face)
s=s.replace('<desc>','<defs><linearGradient id="face_contour_color" gradientUnits="userSpaceOnUse" x1="398.5" y1="0" x2="489" y2="0"><stop offset="0" stop-color="#8C7379"/><stop offset="0.15" stop-color="#694E57"/><stop offset="0.35" stop-color="#8F747A"/><stop offset="0.51" stop-color="#BD9C9E"/><stop offset="0.65" stop-color="#93777E"/><stop offset="0.86" stop-color="#503E4E"/><stop offset="1" stop-color="#8B717B"/></linearGradient></defs>\n<desc>',1)
change_path('hair_crown','M 444,94 C 425,86 402,94 389,106 C 378,115 374,128 372,142 C 368,150 367,158 369,165 C 364,173 367,181 370,186 C 365,195 369,203 374,209 C 371,217 378,224 386,225 C 392,207 399,184 405,169 C 411,149 422,139 432,145 C 438,148 441,153 444,158 C 447,153 450,148 456,145 C 468,141 476,152 482,169 C 490,191 495,213 503,225 C 512,223 518,216 514,209 C 520,202 520,195 516,189 C 522,181 518,174 516,168 C 520,158 515,150 514,143 C 512,127 507,115 496,106 C 481,94 463,87 444,94 Z')
change_path('hair_front_right','M 444,137 C 439,128 432,124 424,125 C 411,125 401,136 394,149 C 386,164 382,184 374,195 C 370,200 369,206 374,211 C 378,217 385,217 390,213 C 400,207 406.7,189.6 410,176.8 C 413.8,163.4 419,150.6 430.4,152.4 C 435.1,153.2 439.7,157.5 443.5,162 C 444.7,155 445.2,142 444,137 Z')
change_path('hair_front_left','M 444,137 C 449,129 456,125 465,126 C 478,127 488,137 495,151 C 503,167 507,187 514,198 C 518,204 516,210 511,213 C 506,216 500,216 495,212 C 486.8,204.5 481.9,190.1 478.5,177.3 C 474.9,163.1 469.3,150.3 458.8,152.5 C 453.5,153.3 448.2,157.6 444,162 C 443,155 443,142 444,137 Z')
# Restrict side-lock corrections to the segment beside the face; all shoulder and lower lock curves are preserved.
s=s.replace('M 410,158 C 408,172 406,188 405,202 C 405,225 400,245 395,265', 'M 410,158 C 410,172 406,190 401,202 C 398.2,215 397,230 394,244 C 392,254 393,261 395,265')
s=s.replace('M 478,158 C 480,172 482,188 483,202 C 483,225 488,245 493,265', 'M 478,158 C 478,172 482,190 487,202 C 489.8,215 491,230 494,244 C 496,254 495,261 493,265')
change_path('ear_right','M 395,209 C 390,204 385,209 387,215 C 388,220 392.5,224.5 397.1,223.8 C 399,222.5 400,219.2 400.3,216.9 C 398.2,215.1 397,211 395,209 Z')
change_path('ear_left','M 493,209 C 498,204 503,209 501.5,215 C 500.5,220 497,224 492,223.5 C 490,222 488.8,219.2 488.5,216.9 C 490.7,215.1 491,211 493,209 Z')
# Metadata only: the other 40 source parts are byte-preserved.
s=s.replace('剑妈 · 46 个独立部件色块分层稿','剑妈 · 完整分层稿 · face 脸型底色与轮廓精修')
s=s.replace('原图坐标系。各具名组以 data-part 对应 parts.yaml，纯色无描线；隐藏底形保存于路径自身，背景透明。','原图坐标系 941×1672。face_base 为闭合肤色底形及独立可见脸缘线；邻接头发内缘完成校准，其余部件保留上轮分层稿。各部件以 data-part 对应 parts.yaml，隐藏补全保留，背景透明。')
Path('refinement/groups/face/2.脸型校准与绘制/character.svg').write_text(s)
ns={'s':'http://www.w3.org/2000/svg'};r0=ET.fromstring(base);r1=ET.fromstring(s)
g0={g.get('id'):ET.tostring(g) for g in r0.findall('s:g',ns)};g1={g.get('id'):ET.tostring(g) for g in r1.findall('s:g',ns)}
report={'changed_groups':[k for k in g0 if g0[k]!=g1[k]],'unchanged_groups':[k for k in g0 if g0[k]==g1[k]],'all_original_top_level_ids_preserved':list(g0)==list(g1),'canvas_equal':r0.attrib==r1.attrib,'original_part_count':len(set(g.get('data-part') for g in r0.findall('s:g',ns))),'final_part_count':len(set(g.get('data-part') for g in r1.findall('s:g',ns))),'all_ids_unique':len([e.get('id') for e in r1.iter() if e.get('id')])==len(set(e.get('id') for e in r1.iter() if e.get('id')))}
Path('tmp/refinement-face/structure-check.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='unchanged_groups'},ensure_ascii=False,indent=2))
