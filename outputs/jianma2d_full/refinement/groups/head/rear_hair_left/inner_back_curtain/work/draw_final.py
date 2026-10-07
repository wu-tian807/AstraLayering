from render_n29 import *
s=load()
for k,a in s['parts'].items():
 for q in a['geometry']:
  if q['name'].endswith('root_occlusion_source'):
   q['desc']+='；4.5实际复核结论：已核对，未确认本组独立外投影；已有脸颌投影沿用occipital层。此历史候选不是确定caster，保留隐藏定位，不新增raw。'
 for i,x in enumerate(a['defs']):
  if '_brush_' in x and '<linearGradient' in x:
   e=E.fromstring(x);y1=float(e.get('y1'));y2=float(e.get('y2'))
   dark=(126,139,164) if k=='nape_back_sheet' else (138,148,170);light=(155,167,188) if k=='nape_back_sheet' else (158,170,191)
   for stop in e:
    t=float(stop.get('offset'));y=y1+(y2-y1)*t;f=max(0,min(1,(y-330)/1000));rgb=[round(u+(v-u)*f) for u,v in zip(dark,light)];stop.set('stop-color','#'+''.join(f'{c:02X}' for c in rgb))
   a['defs'][i]=xml(e)
  elif 'id="n29_side_light_soft"' in x:a['defs'][i]=x.replace('stdDeviation="0.48"','stdDeviation="0.66"')
  elif 'id="n29_nape_light_soft"' in x:a['defs'][i]=x.replace('stdDeviation="0.58"','stdDeviation="0.75"')
 for i,x in enumerate(a['layers']):
  if 'silver_facing_lanes_' in x:a['layers'][i]=x.replace('opacity="0.77"','opacity="0.64"')
  if 'hidden_inner_sheen_' in x:a['layers'][i]=x.replace('opacity="0.19"','opacity="0.15"')
 a['material_note']='完整冷灰紫银白长发；后幕较暗、侧束宽亮芯，分段柔光和疏发流。隐藏面同材质连续。3.3root候选已核对未确认本组独立投影，已有脸颌影沿用occipital层。'
prepare('part_rendered',s,'# 4.7 线色融合与材质细化\n\n笔触几何、压力闭合paths、粗细与透明渐隐保留，只把梯度笔触颜色改为邻近灰紫发面的深色，上部稍深、下部稍浅。银白发脊适量柔化、内侧隐藏光泽降低强度，避免亮带像额外白描边。两条root历史候选desc补4.5已核对结论。\n\n参考接界预期：耳颈后幕明显深于前侧长束、同族偏冷灰紫；肩背在前侧主束之后延续灰发流，前束朝前脊更亮；髋旁和下返侧束为低饱和银灰、亮芯冷缘，腿肤明显偏暖。中央尾和本组相邻处维持同冷色系但不同体积，不能一律等明。完整隐藏面需保持同材质与同S形流。下面从最终候选逐项实看后记录结论，未以“不改邻件”替代依据。')
combo('part_rendered',[(315,270,155,160),(295,435,155,205),(280,660,145,190),(295,1215,185,230)])
n='part_rendered';f=G/FOLDERS[n];env=dict(os.environ,TMPDIR=str(f/'tmp'),PYTHONDONTWRITEBYTECODE='1');jobs=[]
for k,box in [('nape_back_sheet',(285,245,170,1035)),('inner_side_lock',(270,245,125,1190))]:
 cmd=[str(PY),str(R/'tools/svg_preview.py'),str(f/'candidate.svg'),str(f/(k+'-complete.png')),'--only',IDS[k],'--reference',str(W/'references/base-subject.png'),'--crop',*map(str,box),'--scale','2','--columns','3'];p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
cmd=[str(PY),str(R/'tools/svg_preview.py'),str(f/'candidate.svg'),str(f/'neighbor-surfaces.png'),'--reference',str(W/'references/base-subject.png'),'--crop','280','250','205','1190','--scale','2','--columns','3']
for id in [*IDS.values(),'head_rear_hair_left_occipital_root','head_face_framing_hair_left_main_long_lock','head_rear_hair_left_central_back_tail']:cmd+=['--only',id]
p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
cmd=[str(PY),str(R/'tools/svg_preview.py'),str(f/'candidate.svg'),str(f/'final-preview.png'),'--background','white'];p=subprocess.run(cmd,text=True,capture_output=True,env=env);jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});assert p.returncode==0,p.stderr
(f/'full-surface-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
