from pipeline import *
s=load()
for k in IDS:
 pr='n27_'+k
 s[k]['defs'].append(f'<filter id="{pr}_ridge_soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation=".47"/></filter>')
 add(s,k,'ridge_light',path(pr+'_ridge_light_shape',s['_regions'][k]['ridge'],k+'：参考银发同面宽亮脊，沿3.3范围轻柔铺白，两端闭合收尖；随本片变形，不作为独立反光层，不覆盖孔口。',fill='#ffffff',opacity='.73' if k!='ear_lock' else '.48',filter='url(#'+pr+'_ridge_soft)'))
prepare('part_highlights',s,'4.6 沿原有亮脊范围铺柔白宽光，银发保持宽面柔光，耳侧亮部减弱；均随本片表面变化，未新增独立效果关系。',gap=True)
