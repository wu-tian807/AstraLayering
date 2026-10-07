from pipeline import *
s=load()
for k in IDS:
 pr='n28_'+k
 cy={'upper_temple_lock':204,'middle_temple_lock':224,'lower_temple_lock':245,'ear_lock':265}[k]
 s[k]['defs'].append(f'<radialGradient id="{pr}_pearl_transition_paint" gradientUnits="userSpaceOnUse" cx="508" cy="{cy}" r="28" gradientTransform="translate(0 {cy*.25}) scale(1 .75)"><stop offset="0" stop-color="#eadfe9" stop-opacity=".18"/><stop offset=".48" stop-color="#f5edf4" stop-opacity=".10"/><stop offset="1" stop-color="#e5e4f1" stop-opacity="0"/></radialGradient>')
 add(s,k,'pearl_transition',path(pr+'_pearl_transition_shape',D[k],k+'：参考银发中面的细微珍珠紫灰过渡；低纯度低透明，面心浅暖、右侧既有冷面保留。完整形体内柔衰减，不制造粉色斑块、硬边或新材质。',fill='url(#'+pr+'_pearl_transition_paint)'))
prepare('part_color_transitions',s,'4.3 在冷侧面到银白面之间加入克制的珍珠紫灰过渡，依据参考保留整体低纯度；不改变大明暗和外缘。')
