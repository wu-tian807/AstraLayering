from n29_art import *
s=load()
s['parts']['nape_back_sheet']['base']='#C7CBDF'
s['parts']['inner_side_lock']['base']='#E5E5EF'
for k in KEYS:
    s['parts'][k]['material_note']='同族柔顺银白长发；冷灰紫底调。当前仅基色底面，转面、局部色、高光与外来投影尚未完成。'
    for q in s['parts'][k]['geometry']:
        if q['role']=='tone-boundary':
            q['desc']+='；4.1复核：参考实际偏低饱和灰紫而非鲜蓝。侧束维持宽银白芯，仅窄冷缘；后宽幕以较低明度的同族冷灰紫作基底。自身转面强弱留给4.2，外来投影不烘进本体基色。'
prepare('part_base_colors',s,'# 4.1 基色与材质分区\n\n已复核彩色参考：两件均为同族柔顺银发，没有耳饰、皮肤或衣料分区。后宽幕使用冷灰紫底调#C7CBDF，侧束使用较亮的银白底调#E5E5EF；两者沿完整表面覆盖，耳孔与开口不变。当前底调比参考深转面保守，后续4.2再落实自身大明暗，4.5独立处理确实存在的外来投影。\n\n保留全部可见压力笔触与隐藏几何，修正“灰蓝”的解释为实际参考的低饱和灰紫，不改坐标/绑定/树。继续沿用33条独立rendering记录。')
folder=G/FOLDERS['part_base_colors'];env=dict(os.environ,TMPDIR=str(folder/'tmp'),PYTHONDONTWRITEBYTECODE='1')
boards=[];jobs=[]
for i,box in enumerate([(310,270,160,180),(275,610,150,220),(300,1210,160,230)],1):
    out=folder/f'combination-{i}.png'
    cmd=[str(PY),str(R/'tools/svg_preview.py'),str(folder/'candidate.svg'),str(out),'--reference',str(W/'references/base-subject.png'),'--crop',*map(str,box),'--scale','4','--columns','3']
    p=subprocess.run(cmd,text=True,capture_output=True,env=env);assert p.returncode==0,p.stderr
    jobs.append({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr});boards.append(Image.open(out).convert('RGB'))
sheet=Image.new('RGB',(max(i.width for i in boards),sum(i.height for i in boards)),'white');y=0
for im in boards:sheet.paste(im,(0,y));y+=im.height
sheet.save(folder/'combination-sheet.png')
(folder/'combination-commands.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
