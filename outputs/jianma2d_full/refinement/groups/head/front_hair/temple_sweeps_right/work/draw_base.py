from pipeline import *
s=load()
for k in IDS:
 for n in s[k]['nodes']:
  if n['name']=='base':
   n['content']=n['content'].replace('#e9ecf2','#e7eaf2').replace('中性浅色仅供线稿查看，隐藏根与可见面连续，无左侧孔。','4.1重新对照右侧彩参，固有色为低纯度略冷银白，非金属、不发光；隐藏根与可见面同一材质连续，保留右侧连续内沿。')
prepare('part_base_colors',s,'4.1 独立复核右侧银白发面，以低纯度略冷银白铺完整基色；同材质完整根与卷底延续，现有29条rendering关系保持。')
