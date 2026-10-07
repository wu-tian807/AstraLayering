from render_n29 import *
s=load();n='cast_shadow_relations'
prepare(n,s,'# 4.5.1 外来投影核定待观察\n\n先保留SVG，逐项核对3.3耳后候选与当前正式caster。颈侧深色已经按自身转面保留；已登记的occipital_root脸投影属于邻组，不能重复登记。具体判断以本节点实际根部参考/guide/组合观察为准。',regions={k:[(340,250,85,145)] for k in KEYS})
f=G/FOLDERS[n];env=dict(os.environ,TMPDIR=str(f/'tmp'),PYTHONDONTWRITEBYTECODE='1');boards=[];jobs=[]
for i,(svg,ids) in enumerate([(W/'block-layers/groups.svg',['part-head-front-hair-fringe-left-broad-lock','part-head-front-hair-fringe-left-fine-lock']),(W/'block-layers/groups.svg',['part-head-face-framing-hair-left-main-long-lock','part-head-rear-hair-left-occipital-root']),(f/'candidate.svg',[])],1):
 out=f/f'caster-evidence-{i}.png';cmd=[str(PY),str(R/'tools/svg_preview.py'),str(svg),str(out),'--reference',str(W/'references/base-subject.png'),'--crop','335','245','100','160','--scale','4','--columns','4','--edge-overlay']
 for id in ids:cmd.extend(['--only',id])
 p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr;boards.append(Image.open(out).convert('RGB'))
sheet=Image.new('RGB',(max(a.width for a in boards),sum(a.height for a in boards)),'white');y=0
for a in boards:sheet.paste(a,(0,y));y+=a.height
sheet.save(f/'caster-evidence-sheet.png');(f/'caster-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
