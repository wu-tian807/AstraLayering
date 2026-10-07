from n29_art import *
from brush_paths import sample,outline
from importlib.metadata import version
assert version('perfect-freehand')=='1.2.0'
s=load();evidence=[]
# Individual pressure knots reflect each curve's written structural intent.
profiles={
 'ear_opening':[(0,.08),(.27,.51),(.61,.68),(.84,.32),(1,.04)],
 'nape_shoulder':[(0,.11),(.38,.53),(.65,.7),(.86,.38),(1,.06)],
 'long_outer_edge':[(0,.06),(.12,.36),(.25,.6),(.32,.29),(.49,.62),(.71,.42),(.89,.71),(1,.04)],
 'long_inner_edge':[(0,.04),(.13,.66),(.31,.48),(.54,.58),(.71,.36),(.89,.43),(1,.03)],
 'nape_ear_fan':[(0,.04),(.24,.32),(.65,.6),(1,.04)],
 'nape_neck_turn':[(0,.05),(.36,.51),(.7,.43),(1,.04)],
 'nape_continuous_flow':[(0,.04),(.19,.68),(.32,.26),(.5,.5),(.69,.43),(.86,.58),(1,.04)],
 'nape_inner_flow':[(0,.03),(.22,.55),(.43,.29),(.7,.42),(1,.03)],
 'nape_lower_return':[(0,.03),(.42,.51),(.71,.4),(1,.03)],
 'side_root_flow':[(0,.04),(.24,.5),(.56,.66),(.81,.35),(1,.04)],
 'side_waist_to_knee':[(0,.04),(.3,.48),(.48,.68),(.69,.32),(.86,.43),(1,.04)],
 'side_free_tip_flow':[(0,.04),(.26,.46),(.57,.66),(.82,.34),(1,.02)],
 'nape_ear_filament':[(0,.02),(.32,.4),(.69,.48),(1,.02)],
 'nape_shoulder_filament':[(0,.02),(.43,.53),(.72,.38),(1,.02)],
 'nape_back_filament':[(0,.02),(.48,.55),(.75,.29),(1,.02)],
 'nape_lower_filament':[(0,.02),(.34,.42),(.71,.38),(1,.02)],
 'side_upper_filament':[(0,.02),(.33,.36),(.61,.48),(1,.02)],
 'side_hip_filament':[(0,.02),(.39,.44),(.67,.51),(1,.02)],
 'side_tail_filament':[(0,.02),(.34,.47),(.61,.54),(.82,.29),(1,.02)],
}
for k in KEYS:
    a=s['parts'][k];a['geometry_hidden']=True;a['brush']=[]
    for q in a['geometry']:
        if q['final']!='visible':continue
        name=q['name'];knots=profiles[name]
        if q['role']=='contour':size,opacity,blur=1.05,.82,.085
        elif q['role']=='structure':size,opacity,blur=.74,q['opacity'],.13
        else:size,opacity,blur=.46,q['opacity'],.13
        for j,points in enumerate(sample(q['d'])):
            rid=f'n29_{k}_brush_{name}_{j}'
            d,inputs,options=outline(points,knots,size)
            begin,end=points[0],points[-1]
            a['defs'].append(f'<linearGradient id="{rid}_fade" gradientUnits="userSpaceOnUse" x1="{begin.real}" y1="{begin.imag}" x2="{end.real}" y2="{end.imag}"><stop offset="0" stop-color="#727C8F" stop-opacity="0"/><stop offset=".07" stop-color="#727C8F" stop-opacity=".72"/><stop offset=".20" stop-color="#727C8F"/><stop offset=".79" stop-color="#727C8F"/><stop offset=".95" stop-color="#727C8F" stop-opacity=".5"/><stop offset="1" stop-color="#727C8F" stop-opacity="0"/></linearGradient>')
            a['defs'].append(f'<filter id="{rid}_soft" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="{blur}"/></filter>')
            a['brush'].append(path(rid,d,q['desc']+'；本笔触由原曲线密集采样、显式pressure与perfect-freehand 1.2.0生成。独立渐变处理首尾透明，Gaussian仅处理边软化，非几何平滑；源线保留在隐藏geometry。',fill=f'url(#{rid}_fade)',stroke='none',opacity=opacity,filter=f'url(#{rid}_soft)',data_source_curve=f'n29_{k}_source_{name}',data_brush='perfect-freehand-1.2.0',data_explicit_pressure='true'))
            evidence.append(dict(part=k,source=name,subpath=j,pressure_knots=knots,options=options,edge_softness_sigma=blur,opacity=opacity,points=inputs))
folder=G/FOLDERS['part_brush_lines'];folder.mkdir(parents=True,exist_ok=True)
(folder/'brush-samples.json').write_text(json.dumps({'dependency':'perfect-freehand==1.2.0','strokes':evidence},ensure_ascii=False,indent=2)+'\n')
prepare('part_brush_lines',s,'# 3.5 画笔重绘\n\n按19条可显影源曲线的逐条描述设置独立压力节点，耳孔多子路分别采样，共20笔。每点显式(x,y,pressure)，simulate_pressure=False、streamline=0，perfect-freehand==1.2.0生成闭合填色轮廓。原导线、明暗虚线与纯隐藏闭合边全部保留在隐藏geometry。首尾透明渐变与小半径软化分开实现，不用普通stroke冒充压力笔触。\n\n环境探测曾发现svgpathtools未安装；无需安装或替代perfect-freehand，当前源线全部是M/L/C，使用本组显式Bezier采样器处理并保存每点压力证据。',line=True)
cmd=[str(PY),str(R/'tools/svg_preview.py'),str(folder/'candidate.svg'),str(folder/'preview-white.png'),'--background','white']
p=subprocess.run(cmd,text=True,capture_output=True,env=dict(os.environ,TMPDIR=str(folder/'tmp'),PYTHONDONTWRITEBYTECODE='1'));assert p.returncode==0,p.stderr
(folder/'preview-command.json').write_text(json.dumps({'argv':cmd,'exit_code':p.returncode,'stdout':p.stdout,'stderr':p.stderr},ensure_ascii=False,indent=2)+'\n')
