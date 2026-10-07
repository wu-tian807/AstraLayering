from pipeline import *
s=load()
for k in IDS:
 pr='n27_'+k
 for n in s[k]['nodes']:
  if n['name']!='base':n['attrs']='display="none"'
 s[k]['defs'].append(f'<filter id="{pr}_line_soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.055"/></filter>')
 filled=[]
 for a in s[k]['strokes']:
  chunks=[d.strip() for d in re.split(r'(?=M )',a['d']) if d.strip()]
  for j,d in enumerate(chunks):
   token=re.findall(r'[-+]?(?:\d*\.\d+|\d+)',d)
   gid=pr+'_ink_fade_'+a['name']+str(j)
   s[k]['defs'].append(f'<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{token[0]}" y1="{token[1]}" x2="{token[-2]}" y2="{token[-1]}"><stop offset="0" stop-color="#7c8699" stop-opacity=".12"/><stop offset=".2" stop-color="#7c8699" stop-opacity=".74"/><stop offset=".74" stop-color="#7c8699" stop-opacity=".9"/><stop offset="1" stop-color="#7c8699" stop-opacity=".08"/></linearGradient>')
   filled.append(path(pr+'_brush_'+a['name']+'_'+str(j),brush(d,a['width']),f'来源 {pr}_source_{a["name"]} 第{j+1}段；'+a['desc']+'；perfect-freehand 1.2.0显式压力：两端低压、弧中上升，起收锥度3/4倍笔宽；长度渐变实现淡入淡出，0.055px滤镜单独软化边缘。',fill='url(#'+gid+')',stroke='none',filter='url(#'+pr+'_line_soft)'))
 add(s,k,'brush_lines',''.join(filled))
prepare('part_brush_lines',s,'3.5 逐条用perfect-freehand 1.2.0显式压力生成闭合笔触，源线与定位线隐藏保留。耳片双M开口分两段，不产生跨孔笔桥。尖端有独立几何收笔与透明渐隐，轻微滤镜只处理笔触软边。',gap=True,line=True)
subprocess.run([PY,TOOL,str(BASE/'stages/part_brush_lines/candidate.svg'),str(BASE/'stages/part_brush_lines/preview-white.png'),'--scale','1'],check=True)
