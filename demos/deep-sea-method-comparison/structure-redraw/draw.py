"""Hand-authored SVG construction. No bitmap tracing or contour extraction.

Every artistic contour/control point is specified in this source and the two
companion drawing modules. Python only serializes the SVG and its build log.
"""
from pathlib import Path
import json
import xml.etree.ElementTree as E

HERE=Path(__file__).resolve().parent
NS='http://www.w3.org/2000/svg'
INK='http://www.inkscape.org/namespaces/inkscape'
E.register_namespace('',NS)
E.register_namespace('inkscape',INK)
def T(n): return '{'+NS+'}'+n

HAIR='#45afed'; HAIR_LIGHT='#49b1f0'; HAIR_BACK='#3fa5e4'; HAIR_INK='#347d9f'
SKIN='#fcf1ed'; SKIN_INK='#89858a'; DRESS='#20242d'; CLOTH_INK='#131923'; BLUE='#358fe1'

class Drawing:
    def __init__(self):
        self.root=E.Element(T('svg'),{'id':'character-svg','width':'1024','height':'1536','viewBox':'0 0 1024 1536','version':'1.1','role':'img','shape-rendering':'geometricPrecision'})
        E.SubElement(self.root,T('title')).text='深海少女 · 手写贝塞尔平涂重绘'
        E.SubElement(self.root,T('desc')).text='按角色造型手写的 SVG。发束、衣片、身体与五官分别建立独立部件；每条曲线以少量控制点明确描绘轮廓或结构线。未使用自动描摹、分色轮廓拟合或位图嵌入。元数据记录本文件先构建路径、再进行填色的完整顺序。'
        self.manifest_node=E.SubElement(self.root,T('metadata'),{'id':'layer-manifest'})
        self.history_node=E.SubElement(self.root,T('metadata'),{'id':'drawing-sequence'})
        E.SubElement(self.root,T('metadata'),{'id':'construction-method'}).text=json.dumps({'method':'manually authored SVG Bezier paths and elliptical curves','source_size':[1024,1536],'coordinate_system':'reference image coordinates; L/R mean image left/right','automatic_tracing':False,'embedded_raster':False,'construction_sources':['draw.py','hair.py','figure.py'],'hidden_surfaces':'Geometric continuation of independently authored components beneath overlapping parts.'},ensure_ascii=False)
        self.layers=[];self.shapes=[];self.g=None
    def layer(self,pid,name,category):
        item={'id':pid,'name':name,'category':category,'rank':len(self.layers)}
        self.layers.append(item)
        self.g=E.SubElement(self.root,T('g'),{'id':pid,'data-name':name,'data-category':category,'data-rank':str(item['rank']),'{'+INK+'}groupmode':'layer','{'+INK+'}label':name,'stroke-linecap':'round','stroke-linejoin':'round'})
        E.SubElement(self.g,T('title')).text=name
    def path(self,d,fill='none',stroke=None,width=1,role=None,opacity=None):
        assert self.g is not None
        pid=f"{self.g.get('id')}-p{len(list(self.g)):02}"
        attrs={'id':pid,'d':d,'fill':'none','data-draw-step':str(len(self.shapes)+1),'data-role':role or ('outline' if fill=='none' else 'surface')}
        if stroke:attrs.update(stroke=stroke,**{'stroke-width':str(width)})
        if opacity is not None:attrs['opacity']=str(opacity)
        node=E.SubElement(self.g,T('path'),attrs)
        self.shapes.append((node,fill,self.g.get('id')))
        return node
    def line(self,d,stroke,width=1,opacity=None):
        return self.path(d,stroke=stroke,width=width,opacity=opacity)
    def oval(self,cx,cy,rx,ry,fill,stroke=None,width=1,opacity=None):
        k=.55228475
        d=f'M{cx-rx:g},{cy:g} C{cx-rx:g},{cy-ry*k:g} {cx-rx*k:g},{cy-ry:g} {cx:g},{cy-ry:g} C{cx+rx*k:g},{cy-ry:g} {cx+rx:g},{cy-ry*k:g} {cx+rx:g},{cy:g} C{cx+rx:g},{cy+ry*k:g} {cx+rx*k:g},{cy+ry:g} {cx:g},{cy+ry:g} C{cx-rx*k:g},{cy+ry:g} {cx-rx:g},{cy+ry*k:g} {cx-rx:g},{cy:g} Z'
        return self.path(d,fill,stroke,width,opacity=opacity)
    def save(self):
        history=[];n=len(self.shapes)
        for i,(node,fill,layer) in enumerate(self.shapes):
            history.append({'step':i+1,'action':'draw-path','target':node.get('id'),'layer':layer})
        # No fill is applied until every hand-authored geometry has been built.
        for i,(node,fill,layer) in enumerate(self.shapes):
            node.set('fill',fill);node.set('data-final-fill',fill)
            node.set('data-fill-step',str(n+i+1))
            history.append({'step':n+i+1,'action':'fill-path' if fill!='none' else 'retain-outline','target':node.get('id'),'layer':layer,'fill':fill})
        self.manifest_node.text=json.dumps({'version':'0.1','layers':self.layers},ensure_ascii=False)
        self.history_node.text=json.dumps({'version':'1.0','kind':'hand-authored-svg-construction','path_count':n,'phase1':{'first':1,'last':n,'action':'draw-path'},'phase2':{'first':n+1,'last':2*n,'action':'apply-final-fill-and-retain-structural-lines'},'events':history},ensure_ascii=False)
        E.indent(self.root,space='  ')
        (HERE/'深海少女_手绘分层.svg').write_bytes(E.tostring(self.root,encoding='utf-8',xml_declaration=True))
        (HERE/'绘制顺序.json').write_text(json.dumps({'layers':self.layers,'events':history},ensure_ascii=False,indent=2))
        print(f'{len(self.layers)} semantic layers; {n} hand-authored paths; {2*n} recorded steps')

def main():
    from hair import rear_hair, front_hair
    from figure import trains, body, dress, face
    a=Drawing();a.layer('background','白色背景','背景');a.path('M0 0H1024V1536H0Z','#fefefe')
    trains(a);rear_hair(a);body(a);dress(a);face(a);front_hair(a);a.save()

if __name__=='__main__':main()
