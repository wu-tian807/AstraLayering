"""Persist the reviewer's manually supplied observations after actual views."""
from pathlib import Path
import json,sys,hashlib,datetime
r=Path('reviews/group_child_layers/head/rear_hair_left/outer_back_curtain');a=json.load(sys.stdin)
with (r/'审查.md').open('a') as f:f.write('\n'+a['markdown'].strip()+'\n')
d=json.loads((r/'actual-views.json').read_text())
for name in a.get('images',[]):
 p=r/'evidence'/name
 d['views'].append({'order':len(d['views'])+1,'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'detail':'original','actually_viewed':True,'component_path':a.get('path'),'component_id':a.get('id'),'observation':a['observation'],'judgement':a.get('judgement'),'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat()})
d['view_count']=len(d['views']);(r/'actual-views.json').write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
print('Recorded actual views:',d['view_count'])
