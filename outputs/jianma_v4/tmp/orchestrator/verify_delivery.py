from pathlib import Path
from collections import Counter
import hashlib, json, subprocess, xml.etree.ElementTree as ET
from PIL import Image
root=Path(__file__).resolve().parents[2]
source=Path('/Users/wutian/Desktop/coding/AstraLayering/workflows')
parts=json.loads(subprocess.check_output(['ruby','-ryaml','-rjson','-e','puts JSON.generate(YAML.load_file(ARGV[0]))',str(root/'structure/parts.yaml')]))['parts']
svg=root/'block-layers/character.svg'
preview=root/'block-layers/preview.png'
tree=ET.parse(svg)
ids=[x.get('id') for x in tree.iter() if x.get('id')]
actual={x.get('data-part') for x in tree.iter() if x.get('data-part')}
expected={p['id'] for p in parts}
kinds={p['id']:p['kind'] for p in parts}
assert actual==expected, {'missing':sorted(expected-actual),'unexpected':sorted(actual-expected)}
assert not [k for k,v in Counter(ids).items() if v>1], 'duplicate SVG ids'
for x in tree.iter():
    if x.get('data-part'):
        assert x.get('data-kind')==kinds[x.get('data-part')], x.attrib
assert not any(x.tag.rsplit('}',1)[-1]=='image' for x in tree.iter()), 'embedded raster'
ref=Image.open(root/'references/base-subject.png')
out=Image.open(preview)
assert ref.size==out.size, (ref.size,out.size)
assert tree.getroot().get('viewBox').replace(',',' ').split()==['0','0',str(ref.width),str(ref.height)]
files=['options.yaml','references/original.png','references/submitted-original.jpg','references/base-garment.jpg','references/base-subject.png','references/kind-groups.png','references/base-subject.prompt.txt','references/kind-groups.prompt.txt','structure/parts.yaml','block-layers/character.svg','block-layers/preview.png','reviews/kind_blocks/审查.md']
manifest={'parts':len(expected),'canvas':list(ref.size),'svg_groups':sum(x.tag.rsplit('}',1)[-1]=='g' for x in tree.iter()),'files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in files}}
(root/'delivery-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(manifest,ensure_ascii=False,indent=2))
