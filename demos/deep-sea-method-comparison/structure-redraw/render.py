"""Raster previews for visual inspection only. Does not generate SVG geometry."""
from pathlib import Path
import json
import re
import xml.etree.ElementTree as E
import skia
from PIL import Image

HERE=Path(__file__).resolve().parent
NS='{http://www.w3.org/2000/svg}'
E.register_namespace('',NS[1:-1])

def png(svg, path, scale=2):
    dom=skia.SVGDOM.MakeFromStream(skia.MemoryStream(svg))
    s=skia.Surface(1024*scale,1536*scale)
    c=s.getCanvas();c.clear(skia.ColorWHITE);c.scale(scale,scale);dom.render(c)
    s.makeImageSnapshot().save(str(path))

def main():
    svg=(HERE/'深海少女_手绘分层.svg').read_bytes()
    png(svg,HERE/'手绘成图.png')
    root=E.fromstring(svg)
    for p in root.iter(NS+'path'):
        if p.get('fill')!='none':
            p.set('fill','none')
            if not p.get('stroke'):p.set('stroke','#547d92');p.set('stroke-width','.8')
    png(E.tostring(root),HERE/'手绘线稿.png')
    im=Image.open(HERE/'手绘成图.png');im.resize((640,960),Image.Resampling.LANCZOS).save(HERE/'预览缩略图.png')
    im=Image.open(HERE/'手绘线稿.png');im.resize((640,960),Image.Resampling.LANCZOS).save(HERE/'线稿缩略图.png')
    print('Rendered artwork and unfilled curve proof.')

if __name__=='__main__':main()
