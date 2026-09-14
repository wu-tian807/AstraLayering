"""Sample matching canvas locations in the raster reference and rendered SVG."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib
import json
import shutil
import subprocess
import tempfile
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SOURCE = ROOT / 'outputs/case1_miku/step05-base-character/05-2_局部色彩与材质.svg'
REFERENCE = ROOT / 'outputs/case1_miku/references/base-character.png'
POINTS = [('A', '头顶亮面', 540, 90), ('B', '左长发暗面', 270, 600),
          ('C', '左长发浅色区', 200, 850), ('D', '左下回卷', 185, 1060)]
FONT_PATH = '/System/Library/Fonts/STHeiti Light.ttc'
F = lambda size: ImageFont.truetype(FONT_PATH, size)


def main():
    node = shutil.which('node') or str(Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
    js = """const os=require('node:os'),path=require('node:path');let sharp;
try{sharp=require('sharp')}catch{sharp=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp'))}
sharp(process.argv[1],{density:72}).png().toFile(process.argv[2]).catch(e=>{console.error(e);process.exit(1)});"""
    with tempfile.TemporaryDirectory(prefix='astra-hair-color-') as temp:
        output = str(Path(temp)/'render.png')
        subprocess.run([node, '-e', js, str(SOURCE), output], check=True)
        images = [Image.open(REFERENCE).convert('RGB'), Image.open(output).convert('RGB')]
        assert images[0].size == images[1].size == (1024, 1536)
        arrays = [np.asarray(im) for im in images]
        data = []
        for letter, name, x, y in POINTS:
            colors = [np.median(a[y-4:y+5, x-4:x+5], axis=(0,1)).astype(int).tolist() for a in arrays]
            data.append(dict(point=letter, region=name, center=[x,y], reference_rgb=colors[0],
                             svg_rgb=colors[1], reference_hex='#'+''.join(f'{c:02X}' for c in colors[0]),
                             svg_hex='#'+''.join(f'{c:02X}' for c in colors[1])))
        audit = dict(reference=str(REFERENCE.relative_to(ROOT)), source=str(SOURCE.relative_to(ROOT)),
                     source_sha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                     canvas=[1024,1536], method='Native-size SVG render; 9x9 componentwise median RGB at identical canvas coordinates; not screenshot sampling.',
                     interpretation='Rendered appearance includes shading and material layers. A location can change tone because a color band moved; these are not estimates of intrinsic hair albedo.',
                     samples=data)
        (HERE/'头发取色数据.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
        panel = Image.new('RGB', (1460,1250), '#f2f5f6');d=ImageDraw.Draw(panel)
        d.text((25,20),'头发颜色 / 同坐标取样，区分小色差与色带位置变化',font=F(27),fill='#20383e')
        for col,(im,title) in enumerate(zip(images,['参考彩图','阶段5终稿'])):
            x=25+col*360
            d.text((x,77),title,font=F(22),fill='#20383e')
            small=im.resize((340,510),Image.Resampling.LANCZOS);panel.paste(small,(x,120))
            for letter,name,px,py in POINTS:
                ax=x+px*340/1024;ay=120+py*510/1536
                d.ellipse((ax-5,ay-5,ax+5,ay+5),outline='#ad3046',width=2)
                d.text((ax+7,ay-10),letter,font=F(17),fill='#ad3046')
        for i,s in enumerate(data):
            x,y=770,115+i*265
            d.text((x,y),f"{s['point']}  {s['region']}  {tuple(s['center'])}",font=F(23),fill='#20383e')
            px,py=s['center']
            for col,(im,hexcolor) in enumerate(zip(images,[s['reference_hex'],s['svg_hex']])):
                xx=x+col*315
                crop=im.crop((px-16,py-16,px+17,py+17)).resize((125,125),Image.Resampling.NEAREST)
                panel.paste(crop,(xx,y+45))
                d.rectangle((xx+143,y+45,xx+283,y+128),fill=hexcolor)
                d.text((xx+143,y+144),hexcolor,font=F(20),fill='#20383e')
                d.text((xx,y+184),'参考' if col==0 else 'SVG',font=F(18),fill='#617b83')
        d.text((25,686),'取样方法',font=F(25),fill='#20383e')
        for i,line in enumerate(['直接读取原图和1024×1536 SVG渲染。','每点取中心9×9像素的RGB逐通道中位数。','右侧局部为33×33像素范围，中心用于取色。','同坐标不保证位于同一条亮暗带。','','A、C：明亮区域色差较小。','B：当前暗面颜色更暗。','D：参考暗色区对应到了当前浅色带，','     同时反映了色面分布差异。','','不据这四处取样推导统一调色参数。']):
            d.text((25,737+i*36),line,font=F(21),fill='#526d75')
        panel.save(HERE/'11_头发颜色取样.png',optimize=True)
        print(json.dumps(data,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()
