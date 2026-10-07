from pipeline import *
s=load()
for k in IDS:
 pr='n28_'+k
 curve=next(a for a in s[k]['strokes'] if a['name'] in ['inner_sweep','ear_fold'])
 s[k]['defs'].append(f'<filter id="{pr}_local_soft" x="-35%" y="-35%" width="170%" height="170%"><feGaussianBlur stdDeviation=".36"/></filter>')
 add(s,k,'own_fold_soft',path(pr+'_own_fold_soft_shape',brush(curve['d'],1.6 if k!='ear_lock' else 1.2),k+'：本片卷曲自身的浅凹转折，以低透明柔灰扩展原结构线外侧；不是上一片遮光。随本片保存，首尾压力渐收，禁止双重深黑。',fill='#aab5ca',opacity='.13',filter='url(#'+pr+'_local_soft)'))
prepare('part_local_shading',s,'4.4 自身凹转只加极浅柔灰，顺原转面弧；参考主要深带来自叠片投影，不在此节点加重。右侧内沿连续，不复制左侧孔或另画黑色洞缘。',gap=True)
