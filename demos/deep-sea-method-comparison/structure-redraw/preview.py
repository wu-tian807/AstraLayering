from pathlib import Path
import base64
import re

here=Path(__file__).resolve().parent
svg=re.sub(r'<\?xml[^>]*\?>','',(here/'深海少女_手绘分层.svg').read_text()).strip()
reference='data:image/png;base64,'+base64.b64encode((here/'reference.png').read_bytes()).decode()
html=(here/'preview-template.html').read_text().replace('__ARTWORK__',svg).replace('__REFERENCE__',reference)
(here/'绘制过程.html').write_text(html)
print('Hand-authored artwork playback saved.')
