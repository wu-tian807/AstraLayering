from pipeline import *
import sys
stage=sys.argv[1]
f=BASE/'stages'/stage
note=sys.stdin.read().strip()
assert note
text='# '+stage+' 实际外观检查\n\nActor `/root/workflow_runner`。\n\n'+note+'\n\n'
for p in sorted(f.glob('*')):
 if p.suffix in ['.png','.svg']:text+=f'- `{p.name}` SHA-256 `{hashlib.sha256(p.read_bytes()).hexdigest()}`\n'
(f/'appearance-review.md').write_text(text)
accept(stage)
