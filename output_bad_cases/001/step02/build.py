"""Hand-authored structural SVG. The source and SVG both run back to front.

No raster tracing. Opaque neutral surfaces are closed, complete component
boundaries. They can receive path fills without changing their geometry.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as ET

HERE = Path(__file__).resolve().parent
SVG = 'http://www.w3.org/2000/svg'
INK = 'http://www.inkscape.org/namespaces/inkscape'
ET.register_namespace('', SVG)
ET.register_namespace('inkscape', INK)
def tag(s): return f'{{{SVG}}}{s}'

class Drawing:
    def __init__(self):
        self.root = ET.Element(tag('svg'), {
            'id':'structure', 'width':'1024', 'height':'1536',
            'viewBox':'0 0 1024 1536', 'version':'1.1',
            'role':'img', 'aria-labelledby':'art-title art-desc',
            'stroke-linecap':'round', 'stroke-linejoin':'round',
            'shape-rendering':'geometricPrecision'})
        ET.SubElement(self.root, tag('title'), {'id':'art-title'}).text = '双马尾角色 · 第二步结构草图'
        ET.SubElement(self.root, tag('desc'), {'id':'art-desc'}).text = (
            '按参考图手工规划贝塞尔轮廓。SVG 的绘制组和路径以实际 DOM 顺序从下层到上层排列，'
            'data-order 是组顺序，data-step 是全局路径顺序，均从 1 开始。'
            'surface 路径闭合且保留遮挡下的完整几何，白色或浅灰填充仅用于草图遮挡，可直接替换 fill。'
            '完整脸、后发头壳、马尾根部、肢体连接均未按可见区域裁断。'
            '不包含参考位图。将根元素 class 设为 xray（或浏览器打开 SVG#structure）可检查所有完整底形。'
            'guide 是可删除的结构流向线。耳朵及隐藏连接是保守推断，不能视为原图的可见事实。')
        self.defs = ET.SubElement(self.root, tag('defs'))
        ET.SubElement(self.root, tag('style')).text = '''
          svg.xray [data-role="surface"], svg:target [data-role="surface"] {
            fill: #ffffff !important; fill-opacity: .045 !important;
            stroke: #8999a3 !important; stroke-width: 1.15 !important;
          }
          svg.xray [data-role="guide"], svg:target [data-role="guide"] { opacity:.8; }
          svg.xray [data-role="contour"], svg:target [data-role="contour"] { opacity:.32; }
        '''
        self.meta=ET.SubElement(self.root,tag('metadata'),{'id':'drawing-notes'})
        self.layers=[]; self.g=None; self.step=0; self.ink='#596570'

    def layer(self, ident, label, note='', ink='#596570'):
        n=len(self.layers)+1
        self.g=ET.SubElement(self.root,tag('g'),{
            'id':ident,'data-order':str(n),
            f'{{{INK}}}groupmode':'layer',f'{{{INK}}}label':f'{n:02d} {label}'})
        ET.SubElement(self.g,tag('title')).text=label
        ET.SubElement(self.g,tag('desc')).text=note
        self.layers.append({'id':ident,'label':label,'order':n})
        self.ink=ink

    def path(self, d, role='detail', fill='none', stroke=None, width=1.2,
             opacity=None, dash=None, clip=None, ident=None):
        self.step+=1
        attrs={'id':ident or f'{self.g.get("id")}-p{self.step:03}',
               'data-step':str(self.step),'data-role':role,
               'd':' '.join(d.split()),'fill':fill}
        if stroke: attrs.update(stroke=stroke,**{'stroke-width':str(width)})
        if opacity is not None: attrs['opacity']=str(opacity)
        if dash: attrs['stroke-dasharray']=dash
        if clip: attrs['clip-path']=f'url(#{clip})'
        return ET.SubElement(self.g,tag('path'),attrs)

    def surface(self,d,fill='#ffffff',outline=True,width=2.05,ident=None):
        assert d.strip()[-1].upper()=='Z', 'Every fillable component must close.'
        return self.path(d,'surface',fill,self.ink if outline else None,width,ident=ident)

    def line(self,d,width=1.2,opacity=None,ink=None,role='detail'):
        return self.path(d,role,stroke=ink or self.ink,width=width,opacity=opacity)

    def guide(self,d,dash=None):
        return self.path(d,'guide',stroke='#9aabb5',width=.95,opacity=.58,dash=dash)

    def oval(self,cx,cy,rx,ry,fill='none',width=1.2,clip=None,role='detail',stroke=None):
        k=.5522847498
        d=f'M{cx-rx:g} {cy:g} C{cx-rx:g} {cy-ry*k:g} {cx-rx*k:g} {cy-ry:g} {cx:g} {cy-ry:g} C{cx+rx*k:g} {cy-ry:g} {cx+rx:g} {cy-ry*k:g} {cx+rx:g} {cy:g} C{cx+rx:g} {cy+ry*k:g} {cx+rx*k:g} {cy+ry:g} {cx:g} {cy+ry:g} C{cx-rx*k:g} {cy+ry:g} {cx-rx:g} {cy+ry*k:g} {cx-rx:g} {cy:g} Z'
        return self.path(d,role,fill,stroke or self.ink,width,clip=clip)

    def clip(self,ident,d):
        c=ET.SubElement(self.defs,tag('clipPath'),{'id':ident,'clipPathUnits':'userSpaceOnUse'})
        ET.SubElement(c,tag('path'),{'d':d})

    def save(self):
        self.meta.text=json.dumps({'stage':'structure sketch','units':'reference pixels',
            'screen_left':'sl','screen_right':'sr','drawing_order':'SVG document order, back to front',
            'layers':self.layers,'drawable_path_count':self.step,
            'fill_rule':'Each surface is a complete closed component; no subtractive occlusion masks.',
            'replay':'Show successive groups by data-order, or successive paths by data-step. Resource paths do not count.',
            'guide_lines':'Non-fillable construction strokes may be hidden independently.'},ensure_ascii=False,indent=2)
        ET.indent(self.root,space='  ')
        path=HERE/'02_完整分层结构草图.svg'
        path.write_bytes(ET.tostring(self.root,encoding='utf-8',xml_declaration=True))
        print(f'{path.name}: {len(self.layers)} groups, {self.step} ordered drawable paths')

def main():
    from hair import rear_hair, front_hair
    from figure import body, hip_hand, peace_hand
    from head import face, accessories
    d=Drawing()
    d.layer('paper','背景','独立白色背景；隐藏本组即可检查透明间隙。')
    d.surface('M0 0 H1024 V1536 H0 Z',outline=False,ident='paper-surface')
    rear_hair(d)
    body(d)
    hip_hand(d)
    face(d)
    accessories(d)
    front_hair(d)
    peace_hand(d)
    d.save()

if __name__=='__main__': main()
