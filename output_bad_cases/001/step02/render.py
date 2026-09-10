"""Render the actual SVG and proof the underlying components, not the reference."""
from pathlib import Path
import xml.etree.ElementTree as ET
import copy
import skia
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
NS='{http://www.w3.org/2000/svg}'
ET.register_namespace('',NS[1:-1])

def render(root,path,scale=1.5):
    raw=ET.tostring(root,encoding='utf-8') if not isinstance(root,bytes) else root
    dom=skia.SVGDOM.MakeFromStream(skia.MemoryStream(raw))
    assert dom is not None
    surface=skia.Surface(round(1024*scale),round(1536*scale))
    canvas=surface.getCanvas();canvas.clear(skia.ColorWHITE);canvas.scale(scale,scale)
    dom.render(canvas)
    surface.makeImageSnapshot().save(str(path))

def main():
    root=ET.fromstring((HERE/'02_完整分层结构草图.svg').read_bytes())
    work=HERE/'work';work.mkdir(exist_ok=True)
    render(root,HERE/'结构草图_预览.png')
    im=Image.open(HERE/'结构草图_预览.png')
    im.resize((512,768),Image.Resampling.LANCZOS).save(work/'thumbnail.png')
    im.crop((round(300*1.5),round(14*1.5),round(680*1.5),round(309*1.5))).resize((1140,885)).save(work/'head.png')

    groups=root.findall(NS+'g')
    stages=[13,19,28,len(groups)]
    board=Image.new('RGB',(256*4,424),'#ffffff')
    dr=ImageDraw.Draw(board)
    font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',13)
    for j,count in enumerate(stages):
        stage=copy.deepcopy(root)
        for g in stage.findall(NS+'g')[count:]: stage.remove(g)
        fn=work/f'stage-{count}.png';render(stage,fn,scale=.5)
        image=Image.open(fn).resize((256,384),Image.Resampling.LANCZOS)
        board.paste(image,(j*256,30));dr.text((j*256+10,8),f'01 - {count:02d}',font=font,fill='#536776')
    board.save(work/'replay-stages.png')

    # Isolate real SVG groups; never synthesize replacement proof geometry.
    selections={
      'complete-face': {'ear-sl-complete','ear-sr-complete','face-complete','face-nose-mouth','brow-sl-complete','brow-sr-complete','eye-sl-complete','eye-sr-complete'},
      'complete-back-hair': {'hair-back-complete'},
      'complete-tails': {g.get('id') for g in groups if g.get('id','').startswith('tail-')},
    }
    for name,ids in selections.items():
        proof=copy.deepcopy(root)
        for g in proof.findall(NS+'g'):
            if g.get('id') not in ids: proof.remove(g)
        render(proof,work/(name+'.png'),scale=1)
        if name!='complete-tails':
            im=Image.open(work/(name+'.png')).crop((385,23,640,292)).resize((765,807))
            im.save(work/(name+'-close.png'))
    wire=copy.deepcopy(root)
    for p in wire.iter(NS+'path'):
        if p.get('data-role')=='surface':
            p.set('fill','none');p.set('stroke','#a4b1b9');p.set('stroke-width','1')
    render(wire,work/'complete-wireframe.png',scale=1)
    print('Rendered full SVG, thumbnail, 4 replay prefixes, isolated head/back hair/tails, and complete wireframe.')

if __name__=='__main__':main()
