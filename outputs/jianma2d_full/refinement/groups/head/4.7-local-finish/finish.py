from pathlib import Path
import re,json
P=Path(__file__).resolve().parent
s=(P/'input-character.svg').read_text();changes=[]
def recolor_gradient(id,colors):
 global s
 p=r'(<(?:linear|radial)Gradient\b[^>]*\bid="'+re.escape(id)+r'"[^>]*>)(.*?)(</(?:linear|radial)Gradient>)'
 m=re.search(p,s,re.S);assert m,id
 old=re.findall(r'stop-color="([^"]+)"',m[2]);assert len(old)==len(colors)
 it=iter(colors);body=re.sub(r'stop-color="[^"]+"',lambda _:f'stop-color="{next(it)}"',m[2])
 s=s[:m.start()]+m[1]+body+m[3]+s[m.end():];changes.append({'id':id,'attribute':'stop-color','before':old,'after':colors})
def path_fill(id,value):
 global s
 p=r'<path\b[^>]*\bid="'+re.escape(id)+r'"[^>]*>'
 m=re.search(p,s);assert m,id
 old=re.search(r'\bfill="([^"]+)"',m[0])[1]
 after=re.sub(r'\bfill="[^"]+"',f'fill="{value}"',m[0])
 s=s[:m.start()]+after+s[m.end():];changes.append({'id':id,'attribute':'fill','before':old,'after':value})
def add_defs(id,text):
 global s
 p=r'(<defs\b[^>]*\bid="'+re.escape(id)+r'"[^>]*>)(.*?)(\s*</defs>)'
 m=re.search(p,s,re.S);assert m,id
 s=s[:m.start()]+m[1]+m[2]+'\n'+text+m[3]+s[m.end():]
def gradient(id,x1,y1,x2,y2,stops,desc):
 lines=[f'      <linearGradient id="{id}" gradientUnits="userSpaceOnUse" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">',f'        <desc>{desc}</desc>']
 lines += [f'        <stop offset="{offset}%" stop-color="{color}" />' for offset,color in stops]
 return '\n'.join(lines+['      </linearGradient>'])
recolor_gradient('r1s1_head_topknot_bun_outline_color',['#9296B3','#9296B4','#99A3BE'])
recolor_gradient('r1s1_head_topknot_bun_strand_line_color',['#9BA3BF','#9DA6C0','#9CA6C0'])
for side,x,y in [('left',383,292),('right',492,291)]:
 p=f'head_earring_{side}';prefix=f'finish47_{p}'
 defs=[gradient(prefix+'_crystal_edge',x-2,y-5,x+3,y+3,[(0,'#B3DEEA'),(38,'#99C8DB'),(100,'#5C91AF')], 'Crystal edge follows the pale cyan upper-left light into blue lower-right shade; existing pressure geometry and opacity stay intact.'),gradient(prefix+'_silver_edge',x-1.1,0,x+1.2,0,[(0,'#98A9BF'),(45,'#C7D6E7'),(62,'#F0F6FC'),(100,'#93A5BC')],'Silver edge shares the narrow central reflection and cool side shade of the continuous chain, including its hidden attachment.'),gradient(prefix+'_facet_line',x, y-8,x,y+7,[(0,'#BEE5EE'),(52,'#91C6D9'),(100,'#669EBB')], 'Facet ridge stays subordinate to the color planes and changes with the upper light and lower blue facet; no extra etched texture.')]
 add_defs('r1s1_'+p+'_defs','\n'.join(defs))
 for i in range(3 if side=='left' else 2):path_fill(f'{p}_contour_0_brush_{i}',f'url(#{prefix}_silver_edge)')
 path_fill(f'{p}_contour_1_brush_0',f'url(#{prefix}_crystal_edge)')
 path_fill(f'{p}_facet_ridge_brush_0',f'url(#{prefix}_facet_line)')
(P/'candidate.svg').write_text(s)
(P/'color-changes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2)+'\n')
print('Changed color attributes:',len(changes),'Added local line-color gradients:',6)
