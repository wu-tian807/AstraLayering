"""Reproduce the 2026-10-08 authorized portrait edit from the archived SVG.

This is an authoring operation, never a runtime deformation. Keep facial region
coordinates intact so existing expression keyforms still address the same art.
"""
import hashlib
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

BASE_SHA = '5bce80aa35a0331f34f1905d03886d0a4c2318ab623b8420a5e52561a5a5cae9'
text = Path(sys.argv[1]).read_bytes().decode('utf8')
assert hashlib.sha256(text.encode()).hexdigest() == BASE_SHA, 'Expected archived dressed portrait'
root = ET.fromstring(text)
index = {e.get('id'): e for e in root.iter() if e.get('id')}

def number(v):
    return f'{v:.4f}'.rstrip('0').rstrip('.') or '0'

def hair_point(x, y):
    # Keep the inner fringe / visible forehead open. Take volume out of the
    # outer temple mass, fading to the original temple and long-hair silhouette by the ear.
    t = min(1, max(0, (y - 145) / 90))
    weight = 1 - t*t*(3-2*t)
    distance = abs(x - 444)
    inset = max(0, distance - 40) * .34 * weight
    return x - math.copysign(inset, x-444), y + max(0, 215-y)*.085

def warp_path(d):
    tokens = re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?', d)
    commands = {v for v in tokens if v.isalpha()}
    assert commands <= set('MLCQZ'), commands
    out, i = [], 0
    while i < len(tokens):
        if tokens[i].isalpha(): out.append(tokens[i]); i += 1
        else:
            x,y = hair_point(float(tokens[i]),float(tokens[i+1]))
            out += [number(x), number(y)]; i += 2
    return ' '.join(out)

# Exact duplicated silhouettes in masks / projections must get the same edit.
paths = set()
for g in root:
    if (g.get('id') or '').startswith(('hair_', 'headdress', 'streamer')):
        paths.update(e.get('d') for e in g.iter() if e.get('d'))
mapped = {d: warp_path(d) for d in paths}
text = re.sub(r'\bd="([^"]*)"', lambda m: 'd="'+mapped.get(m[1],m[1])+'"', text)

def attrs(id, updates):
    global text
    pattern = r'<[A-Za-z][^>]*\bid="'+re.escape(id)+r'"[^>]*>'
    def edit(m):
        tag = m[0]
        for name,value in updates.items():
            attr = name+'="'+str(value)+'"'
            if re.search(r'\b'+re.escape(name)+r'="',tag):
                tag = re.sub(r'\b'+re.escape(name)+r'="[^"]*"',lambda _:attr,tag)
            else: tag = tag[:-2]+' '+attr+'/>' if tag.endswith('/>') else tag[:-1]+' '+attr+'>'
        return tag
    text, count = re.subn(pattern,edit,text)
    assert count == 1, (id,count)

# A compact rounded skull, smooth temples, fuller mandibular transition, and a
# short rounded chin. Fill, receiver masks and jaw cast use this exact contour.
face = ('M 400,148 C 407,129 424,121 444,121 '
        'C 464,121 481,129 488,148 C 494,164 495,187 492,204 '
        'C 491,209 490,213 489,217 '
        'C 486,230 481,240 473,248 '
        'C 465,255 457,260 450,263 '
        'C 447.6,264.2 445.8,264.6 444,264.6 '
        'C 442.2,264.6 440.4,264.2 438,263 '
        'C 431,260 423,255 415,248 '
        'C 407,240 402,230 399,217 '
        'C 398,213 397,209 396,204 C 393,187 394,164 400,148 Z')
original_face = index['face_base_shape'].get('d')
text = text.replace('d="'+original_face+'"','d="'+face+'"')
attrs('face_visible_outline', {'d': ('M 399,217 C 402,230 407,240 415,248 '
      'C 423,255 431,260 438,263 C 440.4,264.2 442.2,264.6 444,264.6 '
      'C 445.8,264.6 447.6,264.2 450,263 C 457,260 465,255 473,248 C 481,240 486,230 489,217')})
attrs('face_base_contour', {'stroke-width': '.7'})

# Uniform author transforms live on the region parents. All eyelid/lash/iris
# paths, masks and all expression extremes are transformed together.
for side in ['right','left']:
    local = 'translate(419.5 198.5) scale(1.015 1.09) translate(-419.5 -198.5)'
    attrs('eye_'+side, {'transform': ('matrix(-1 0 0 1 888 0) ' if side=='left' else '') + local})
    cx = 419 if side=='right' else 469
    attrs('brow_'+side, {'transform': f'translate({cx} 185.7) scale(.98 .83) translate(-{cx} -185)'})
    attrs('blush_'+side, {'opacity':'.62'})
attrs('mouth', {'transform':'translate(444 243) scale(.9 1) translate(-444 -244)'})

# Replace the two dark disks with a small alar turn and an understated nostril.
# These paths belong to the nose, so head perspective carries them with skin.
for id,d in [
    ('nose_mark_right','M 441.2 224 C 440.4 225 440.2 226 440.7 226.7 C 441.1 227.2 441.8 227.5 442.5 227.6'),
    ('nose_mark_left','M 445.4 227.8 Q 446.4 227.1 447.1 228.1'),
]:
    replacement=f'<path id="{id}" d="{d}" fill="none" stroke="#A87583" stroke-width=".62" stroke-linecap="round" opacity=".72"/>'
    text,count=re.subn(r'<ellipse\b[^>]*\bid="'+id+r'"[^>]*/>',replacement,text)
    assert count==1
attrs('nose_marks',{'opacity':'.8'})
attrs('nose_self_shadow',{'opacity':'.4'})
attrs('fx_nose_tip_highlight',{'opacity':'.25'})
attrs('nose_warm_form',{'rx':'6.5','ry':'6.5','cy':'227.5'})

text = text.replace('<title>鼻子 · 简化标记与独立自身暖影</title>', '<title>鼻子 · 轻侧鼻线、鼻翼转折与克制暖影</title>')
Path(sys.argv[2]).parent.mkdir(parents=True,exist_ok=True)
Path(sys.argv[2]).write_bytes(text.encode('utf8'))
print(hashlib.sha256(text.encode()).hexdigest(),len(text.encode()),'bytes')
