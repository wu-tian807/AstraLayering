from pipeline import *
s=load()
for k in IDS:
 pr='n27_'+k
 s[k]['defs'] += [f'<linearGradient id="{pr}_volume_gradient" gradientUnits="userSpaceOnUse" x1="345" y1="223" x2="391" y2="243"><stop offset="0" stop-color="#bdc6d9" stop-opacity=".34"/><stop offset=".22" stop-color="#d4d9e7" stop-opacity=".12"/><stop offset=".62" stop-color="#ffffff" stop-opacity=".2"/><stop offset="1" stop-color="#c7cee0" stop-opacity=".12"/></linearGradient>',f'<filter id="{pr}_volume_soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation=".85"/></filter>']
 add(s,k,'volume_wash',path(pr+'_surface_volume',D[k],k+' 自身向左圆转的浅冷面及面中柔亮，沿完整同一发片连续，普通方向照明；不包含上一发片投下的暗带。',fill='url(#'+pr+'_volume_gradient)'))
 add(s,k,'volume_flank',path(pr+'_flank_shape',s['_regions'][k]['cool_flank'],k+'：沿3.3闭合范围铺自身窄侧面，蓝灰低对比，0.85px柔边；接触投影在4.5独立绘制。',fill='#b6c1d7',opacity='.31',filter='url(#'+pr+'_volume_soft)'))
prepare('part_volume',s,'4.2 建立轻冷左侧转面、中央浅亮和完整根的连续体积；只处理自身随形变化的明暗，卷底外来暗带保留给4.5。')
