from mouth import *
begin('part_volume')
for key in PAINT_ORDER:
 p=part(key)
 face=grad(p,'face_volume','radialGradient',{'gradientUnits':'userSpaceOnUse','cx':'0','cy':'0','r':'1','gradientTransform':'translate(433 245) scale(78 108)'},[(0,'#ffefe9',1),(.48,'#ffebe5',1),(.78,'#fbe3de',1),(1,'#eac9c7',1)])
 warmth=grad(p,'face_chin_warmth','radialGradient',{'gradientUnits':'userSpaceOnUse','cx':'0','cy':'0','r':'1','gradientTransform':'translate(437 311) scale(23 13)'},[(0,'#f2bcb6',.13),(.4,'#f2bcb6',.091),(1,'#f2bcb6',0)])
 for e in p:
  if e.tag.endswith('path') and '_surface_' in (e.get('id') or ''):e.set('fill',face)
 g=add(p,'g',{'id':IDS[key]+'_volume','clip-path':'url(#'+IDS[key]+'_clip)'})
 add(g,'rect',{'x':'425','y':'288','width':'28','height':'16','fill':warmth})
 if key=='mouth_interior':
  depth=grad(p,'inner_depth','radialGradient',{'gradientUnits':'userSpaceOnUse','cx':'0','cy':'0','r':'1','gradientTransform':'translate(438.1 295.4) scale(9.8 5.5)'},[(0,'#875a65',1),(.4,'#94636c',1),(.62,'#b18487',.85),(.78,'#cca29e',0),(1,'#cca29e',0)])
  d=guide_paths(key)[0][1];path(g,'inner_depth',d,'Whole inner backing retains full opaque physical shape. A smooth muted depth field occupies the normally exposed central area; its concealed peripheral lap blends to the same face field before the raw edge, avoiding a dark antialiasing ring in closed pose. No hole, display suppression or inferred anatomy.',fill=depth,stroke='none')
 else:
  d=next(d for source,d in guide_paths(key) if source.endswith('visible-surface'))
  if key=='upper_lip':
   fill=grad(p,'lip_volume','linearGradient',{'gradientUnits':'userSpaceOnUse','x1':'438','y1':'291.5','x2':'438','y2':'296.4'},[(0,'#f4b8b0',1),(.3,'#eda7a2',1),(.5,'#eb9896',1),(1,'#dfa0a0',1)]);soft=blur(p,'visible_edge_soft',.24)
  else:
   fill=grad(p,'lip_volume','linearGradient',{'gradientUnits':'userSpaceOnUse','x1':'438','y1':'295.2','x2':'438','y2':'299.0'},[(0,'#edb7b7',1),(.45,'#f7d0cb',1),(.85,'#fce4de',1),(1,'#ffeae5',1)]);soft=blur(p,'visible_edge_soft',.36)
  path(g,'lip_volume',d,'Visible lip volume uses the approved contour; a separate soft color edge blends into its complete skin lap. Upper and lower pink regions stay within reference thin-lip silhouette, not the hidden oval. Same face-field parameters continue through the entire concealed overlap.',fill=fill,filter=soft,stroke='none')
 under_brush(p,g);save(p)
print(board('part_volume',context=True))
