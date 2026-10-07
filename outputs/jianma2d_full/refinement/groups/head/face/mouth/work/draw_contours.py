from mouth import *
begin('part_contours')
UPPER_RIM='M 429.2 295.4 C 430.8 293.7 432.9 293.1 435.3 292.1 C 436.4 291.9 437.4 292.5 438.5 292.5 C 439.6 292.4 440.4 292.5 441.8 293 C 444 293.5 446.8 293.7 448.7 294.7'
SEAM='M 429.2 296.3 C 431.0 295.85 433.0 295.45 435.1 295.35 C 436.5 295.3 437.7 295.9 439.1 295.8 C 442.1 295.45 445.8 295.2 448.55 295.55'
LOWER_RIM='M 448.55 295.55 C 448.45 295.95 448.05 296.33 447.5 296.5 C 444.2 297.6 440.4 298.6 437.3 298.6 C 433.5 298.4 430.7 297.3 429.2 296.3'
for key in PAINT_ORDER:
 p=el('g',{'id':IDS[key],'data-part-path':GROUP+'/'+key});add(p,'desc',text='Complete '+key+' from approved local guide, including concealed overlap. Only current mouth group is authored; closed reference pose and mild asymmetry are preserved. No inferred teeth or tongue.')
 defs=add(p,'defs');clip=add(defs,'clipPath',{'id':IDS[key]+'_clip','clipPathUnits':'userSpaceOnUse'})
 paths=guide_paths(key)
 for source,d in paths:
  add(clip,'path',{'d':d})
  suffix='visible' if source.endswith('visible-surface') else ('hidden_overlap' if source.endswith('hidden-overlap') else 'hidden_surface')
  e=path(p,'surface_'+suffix,d,'Complete closed fill from '+source+'; visible and concealed portions retain the same connected surface. Concealed lip/skin margin is covered by skin-color paint later, not a thick visible lip.',fill={'upper_lip':'#e7dde3','lower_lip':'#eee5dc','mouth_interior':'#d7d8e1'}[key],stroke='none');e.set('data-guide-path-id',source)
 src=add(p,'g',{'id':IDS[key]+'_source_curves','fill':'none','stroke':'#827580','stroke-width':'0.22','stroke-linecap':'round','stroke-linejoin':'round'})
 for index,(source,d) in enumerate(paths):
  path(src,'complete_boundary_'+str(index),d,key+' closed fill boundary; overlaps mate at mouth corners. Hidden outer arc is only a placement/fill boundary; never ink it as visible swollen lip. Complete inner surface can be exposed by mild opening; no physical hole is cut here.',opacity='.24')
 if key=='upper_lip':
  path(src,'visible_rim',UPPER_RIM,'Upper lip left corner through offset cupid peak to right corner; outlines visible color region. Final edge is soft rose color with a narrow upper highlight, not a dark perimeter. No solid outer ink; retain as hidden color-placement source. Taper at both corners and keep continuous soft turn through the peak.',opacity='.65')
  path(src,'contact_seam',SEAM,'Upper lip contact against lower lip, from left corner(429.2,296.3) to right(448.55,295.55). Final thin muted warm line: short corner sections modestly stronger, middle light, both ends tapered, no black opening. Pressure varies along arc length; soft edges and no extra lower copy. Upper lip owns the shared line; lower lip uses the same reverse boundary.',opacity='.8')
 elif key=='lower_lip':
  path(src,'visible_rim',LOWER_RIM,'Lower lip joins both mouth corners along the exact approved soft lower arc. Final edge is diffuse color fading to face skin, with no hard outline and no separate mouth-slit object. Hidden y300.4 arc is not this visible lip edge; pale reflected light belongs to the visible surface.',opacity='.65')
 else:
  path(src,'inner_surface_boundary',paths[0][1],'Uniform mouth interior behind both lips. This closed smooth backing is not a visible oval opening in the neutral pose. Mild opening exposes its continuous central surface; boundary stays hidden under lips. Final no perimeter line, no guessed teeth, tongue or palate structure.',opacity='.35')
 save(p)
print(board('part_contours',line=True))
