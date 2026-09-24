from pathlib import Path
from copy import deepcopy
import xml.etree.ElementTree as E
import json,hashlib
from PIL import Image
E.register_namespace('', 'http://www.w3.org/2000/svg')
root=Path('reviews/kind_blocks/evidence-v1')
src=Path('reviews/kind_blocks/candidate-v1.svg')
r=E.parse(src).getroot()
ns={'s':'http://www.w3.org/2000/svg'}
kinds=sorted({g.get('data-kind') for g in r if g.get('data-kind')})
jobs=[dict(source=str(src),output=str(root/'candidate-render.png'))]
variants={f'isolated-{k}': lambda g,k=k:g.get('data-kind')==k for k in kinds}
variants.update({'no-front-hair-ornaments':lambda g:g.get('id') not in ['hair-front','ornaments-front','eyes','mouth','crown-back','crown-tassels'], 'rear-hair-only':lambda g:g.get('id')=='hair-back','head-base-only':lambda g:g.get('id') in ['face','body'], 'body-arms-lower':lambda g:g.get('data-kind') in ['body','arms','lower_body']})
for name,pred in variants.items():
 v=deepcopy(r)
 for g in list(v):
  if g.get('data-kind') and not pred(g):v.remove(g)
 p=root/'variants'/f'{name}.svg'
 E.ElementTree(v).write(p,encoding='utf-8',xml_declaration=True)
 jobs.append(dict(source=str(p),output=str(root/f'{name}.png')))
(root/'render-jobs.json').write_text(json.dumps(jobs,indent=2))
summary={'candidate':str(src),'version':'candidate-v1','sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'reference_dimensions':Image.open('references/base-subject.png').size,'canvas':r.attrib,'kinds':kinds,'groups':[dict(id=g.get('id'),kind=g.get('data-kind'),paths=[p.get('id') for p in g])for g in r if g.get('data-kind')]}
(root/'manifest.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print('Prepared',len(jobs),'renders')
