"""Recolor copies for actual eye-occlusion inspection; never change the candidate."""
from pathlib import Path
import hashlib
import json
import xml.etree.ElementTree as ET

source = Path('step03-base-character/03-2_面部与表情.svg')
destination = Path('step03-base-character/review-step2-evidence-v1')
expected = '904427adaa5b7cbf19f22451d9bbe7765f5525f042b1cbc7e6b3917a11e3bc28'
original = source.read_bytes()
assert hashlib.sha256(original).hexdigest() == expected
root = ET.fromstring(original)
ids = {element.get('id'): element for element in root.iter() if element.get('id')}
colors = {'head-face-shape': '#f9d8cf'}
for side in ('left', 'right'):
    colors[f'eye-{side}-sclera-shape'] = '#bce8f4'
    colors[f'eye-{side}-iris-shape'] = '#ad7755'
    colors[f'eye-{side}-eyelid-upper-shape'] = '#f9d8cf'
    colors[f'eye-{side}-eyelid-lower-shape'] = '#f9d8cf'
    colors[f'eye-{side}-highlight-main'] = '#ffffff'
colors['eye-left-highlight-small'] = '#ffffff'
for element_id, color in colors.items():
    ids[element_id].set('fill', color)
ET.register_namespace('', 'http://www.w3.org/2000/svg')
ET.ElementTree(root).write(destination / 'eye-occlusion-diagnostic.svg', encoding='utf-8', xml_declaration=True)
(destination / 'eye-occlusion-diagnostic.json').write_text(json.dumps({
    'candidate': str(source.resolve()), 'candidate_sha256': expected,
    'purpose': 'Differentiate the actually visible sclera, iris, and eyelids after original compositing. Geometry, order, and strokes are unchanged.',
    'fills': colors,
}, ensure_ascii=False, indent=2) + '\n')
