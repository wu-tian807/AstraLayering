from pathlib import Path
import base64
import re

here = Path(__file__).resolve().parent
svg = (here/'深海少女_平涂分层.svg').read_text()
svg = re.sub(r'<\?xml[^>]*\?>', '', svg).strip()
reference = 'data:image/jpeg;base64,' + base64.b64encode((here/'reference.jpg').read_bytes()).decode()
html = (here/'preview-template.html').read_text().replace('__ARTWORK__',svg).replace('__REFERENCE__',reference)
(here/'绘制过程.html').write_text(html)
print('Created self-contained drawing playback: 绘制过程.html')
