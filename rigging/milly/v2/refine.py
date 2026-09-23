from pathlib import Path
p=Path(__file__).parent/'rig.js';s=p.read_text()
s=s.replace("pitch=p.bodyY*rad*.82*upper", "pitch=-p.bodyY*rad*.82*upper")
s=s.replace("const yaw=(p.headX+p.bodyX*.18)*rad, pitch=p.headY*rad*.77;", "const yaw=Math.tanh((p.headX+p.bodyX*.08)/33)*.52, pitch=-Math.tanh(p.headY/37)*.42;")
s=s.replace("depth=11+34*smooth(208,299,y);", "depth=18+12*smooth(208,299,y);")
s=s.replace("const r=78,z=64*Math.sqrt(Math.max(.09,1-(dx/r)**2));\n  depth=z+(kind==='nose'?13:0);", "depth=kind==='nose'?57:38;")
s=s.replace("if(kind==='back')depth=-depth*.68;", "if(kind==='back')depth=-12;")
s=s.replace('const perspective=1+clamp((zr-depth0)/950,-.07,.07);', 'const perspective=1+clamp((zr-depth0)/1550,-.035,.035);')
s=s.replace("function eyeValues(side)", '''function featureWarp(x,y,feature){
 // Art-directed limits: preserve the eye and mouth shapes while moving their
 // anchors over the face. This prevents far eyes from collapsing into slivers.
 let ax=505.6,ay=264.2;
 if(feature.side){ax=feature.side==='left'?463.3:549.1;ay=222.3;if(feature.kind==='brow'){ax=feature.side==='left'?458:552;ay=180}}
 if(feature.kind==='nose'){ax=505.6;ay=242}
 const yaw=Math.tanh((p.headX+p.bodyX*.08)/33)*.52,turn=Math.sin(yaw)/Math.sin(.385);
 const far=clamp((ax-505)/45,-1,1)*turn;
 const sx=1-.055*Math.abs(turn)-.065*far,sy=1-.025*Math.abs(p.headY)/30;
 const anchor=headWarp(ax,ay,feature.kind==='nose'?'nose':'features');
 const roll=(p.headZ*.82+p.bodyZ*.84)*rad;
 const d=rotate((x-ax)*sx,(y-ay)*sy,0,0,roll);
 return[anchor[0]+d[0],anchor[1]+d[1]];
}
function eyeValues(side)''')
s=s.replace("return headWarp(x,y,feature.kind==='nose'?'nose':'features');", "return featureWarp(x,y,feature);")
s=s.replace("if(rig==='face')return headWarp(x,y,feature.kind==='nose'?'nose':'face');", "if(rig==='face')return feature.kind==='nose'?featureWarp(x,y,feature):headWarp(x,y,'face');")
s=s.replace("manualTarget.headX=x*30;manualTarget.headY=y*25;manualTarget.gazeX=x*.35;manualTarget.gazeY=y*.25;", "manualTarget.headX=x*30;manualTarget.headY=-y*25;manualTarget.gazeX=x*.35;manualTarget.gazeY=y*.25;manualTarget.bodyX=x*5.8;manualTarget.bodyY=-y*4.2;manualTarget.bodyZ=-x*1.65;")
s=s.replace("rate=/head|body|arm|elbow|wrist/.test(key)?13:27", "rate=key.startsWith('body')?5.8:/head|arm|elbow|wrist/.test(key)?13:27")
s=s.replace("isCow?1.32:1", "isCow?1.8:1")
s=s.replace("const elastic=(22+p.hairStiffness*57)*(1+(i%4)*.06);", "const elastic=(22+p.hairStiffness*57)*(1+(i%4)*.06)*(isCow?.58:1);")
s=s.replace("const damping=2.6+p.hairDamping*8.2;", "const damping=(2.6+p.hairDamping*8.2)*(isCow?.72:1);")
s=s.replace("dy=(mid*.45+tip)*k2;", "dy=(mid*.45+tip*1.35)*k2;")
s=s.replace("headY:8", "headY:-8")
s=s.replace("if(e.key==='Escape')closeModal()", "if(e.key==='Escape'&&!$('reference-modal').classList.contains('hidden'))closeModal()")
p.write_text(s)
