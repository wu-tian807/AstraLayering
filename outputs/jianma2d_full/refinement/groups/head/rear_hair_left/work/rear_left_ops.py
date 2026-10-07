from pathlib import Path
import re, json, hashlib, xml.etree.ElementTree as E, subprocess
W=Path('outputs/jianma2d_full'); G=W/'refinement/groups/head/rear_hair_left'; A=W/'refinement/character.svg'; GUIDE=W/'block-layers/groups.svg'
S='http://www.w3.org/2000/svg'; E.register_namespace('',S)
IDS=['head_rear_hair_left_occipital_root','head_rear_hair_left_central_back_tail']
def tag(name):return '{'+S+'}'+name
def elem(name,attrs={},text=None):
 n=E.Element(tag(name),{k:str(v) for k,v in attrs.items()})
 if text is not None:n.text=text
 return n
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def span(text,id):
 m=re.search(r'<g\b[^>]*\bid="'+re.escape(id)+'"[^>]*>',text)
 if not m:raise ValueError(id)
 a=m.start();depth=0
 for m in re.finditer(r'<(/?)g\b[^>]*>',text[a:]):
  depth+=-1 if m[1] else 1
  if depth==0:return a,a+m.end()
 raise ValueError(id)
def group(id,file=A):
 s=file.read_text();a,b=span(s,id);return E.fromstring(s[a:b])
def put_groups(groups,file=A):
 s=file.read_text()
 for g in groups:
  txt=E.tostring(g,encoding='unicode')
  try:a,b=span(s,g.get('id'));s=s[:a]+txt+s[b:]
  except ValueError:s=s.replace('</svg>',txt+'\n</svg>',1)
 file.write_text(s)
def snapshot(path,groups=None):
 root=elem('svg',{'width':895,'height':1758,'viewBox':'0 0 895 1758'})
 for g in (groups if groups is not None else [group(i) for i in IDS]):root.append(g)
 path.parent.mkdir(parents=True,exist_ok=True);E.ElementTree(root).write(path,encoding='utf-8',xml_declaration=True)
def byid(g,id):return next(n for n in g.iter() if n.get('id')==id)
def note(g,t):g.append(elem('desc',text=t))
def finish(node,note_text,artifacts):
 st=W/'structure/groups.dispatch.json';state=json.loads(st.read_text());assert state['active']['target']=='n11',state['active']
 rec={'node':node,'worker':'group:head/rear_hair_left','worker_id':'/root/rear_left_repair','note':note_text,'artifacts':{str(p.relative_to(W)):sha(p) for p in artifacts},'guide_sha256':sha(GUIDE),'artwork_sha256':sha(A)}
 p=G/'checkpoints'/f'{node}.json';p.parent.mkdir(exist_ok=True);p.write_text(json.dumps(rec,ensure_ascii=False,indent=2)+'\n')
 cmd=['python3','workflow-next/live2d-layering/4.专项细化/tools/group_cursor.py','--file',str(W/'structure/groups.json'),'--state',str(st),'checkpoint','--pointer',node]
 print(subprocess.check_output(cmd,text=True).strip())
 workers=W/'workers.json';j=json.loads(workers.read_text());o=j['group:head/rear_hair_left'];o.setdefault('node_workers',{})[node]='/root/rear_left_repair';o['selected_node']=node;o['worker_id']='/root/rear_left_repair';workers.write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
 with (W/'运行记录.md').open('a') as f:f.write('\n- n11 `'+node+'` 实际成功并原生checkpoint：'+note_text+'；记录 `'+str(p.relative_to(W))+'`。\n')
 print('CHECKPOINT',node,rec['artwork_sha256'])
def preview_parts(d,line=False,edge=False):
 snapshot(d/'parts.svg')
 py=W/'.runtime/svg-preview/python/bin/python';tool=Path('workflow-next/live2d-layering/tools/svg_preview.py')
 ref=W/'references'/('line-reference.png' if line else 'base-subject.png')
 for kind,box,scale,id in [('root',(325,235,130,165),3,IDS[0]),('tail',(421,806,42,510),2,IDS[1])]:
  cmd=[str(py),str(tool),str(d/'parts.svg'),str(d/(kind+'.png')),'--only',id,'--reference',str(ref),'--crop',*map(str,box),'--scale',str(scale),'--columns','4' if edge else '3']
  if line:cmd+=['--reference-crop',*map(str,box)]
  if edge:cmd+=['--edge-overlay']
  subprocess.run(cmd,check=True,capture_output=True)
 print('VIEW',str(d/'root.png'),str(d/'tail.png'))
def preview_context(d):
 ids=[IDS[0],'neck_neck_skin','head_face_face_skin','head_face_ear_left','head_front_hair_scalp_cap','head_face_framing_hair_left_main_long_lock','head_face_framing_hair_left_ear_side_flyaway','head_earring_left']
 cmd=[str(W/'.runtime/svg-preview/python/bin/python'),'workflow-next/live2d-layering/tools/svg_preview.py',str(A),str(d/'context.png'),'--reference',str(W/'references/base-subject.png'),'--crop','325','235','130','165','--scale','3','--columns','3']
 for id in ids:cmd+=['--only',id]
 subprocess.run(cmd,check=True,capture_output=True)
