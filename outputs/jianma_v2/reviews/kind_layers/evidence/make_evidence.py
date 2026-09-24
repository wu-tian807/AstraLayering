from pathlib import Path
from copy import deepcopy
from lxml import etree as ET
import json
P=Path('reviews/kind_layers/evidence'); (P/'variants').mkdir(exist_ok=True)
root=ET.parse('reviews/kind_layers/candidate-v1.svg').getroot(); ns={'s':'http://www.w3.org/2000/svg'}
groups=root.findall('s:g',ns); jobs=[]
def save(name, keep):
 r=deepcopy(root)
 for g in r.findall('s:g',ns):
  if not keep(g): r.remove(g)
 svg=P/'variants'/f'{name}.svg'; svg.write_bytes(ET.tostring(r))
 jobs.append({'source':str(svg),'output':str(P/f'{name}.png')})
for kind in sorted({g.get('data-kind') for g in groups}): save('isolated-'+kind,lambda g,k=kind:g.get('data-kind')==k)
for name, kinds in [('without-hair-details',{'face','body','arms','lower_body','eyes','mouth'}),('rear-hair-only',set())]:
 save(name,lambda g,ks=kinds,n=name: g.get('data-kind') in ks if ks else g.get('id')=='hair-back')
for n in [4,5,6,7]:
 ids={g.get('id') for g in groups[:n]};save(f'prefix-{n}',lambda g,ids=ids:g.get('id') in ids)
(P/'render-jobs.json').write_text(json.dumps(jobs))
