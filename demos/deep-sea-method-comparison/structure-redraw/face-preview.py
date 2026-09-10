"""Render facial review images; no raster data is used to construct SVG paths."""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import skia

HERE = Path(__file__).resolve().parent


def vector_crop(svg, box, scale):
    x, y, right, bottom = box
    surface = skia.Surface((right - x) * scale, (bottom - y) * scale)
    canvas = surface.getCanvas()
    canvas.clear(skia.ColorWHITE)
    canvas.scale(scale, scale)
    canvas.translate(-x, -y)
    dom = skia.SVGDOM.MakeFromStream(skia.MemoryStream(svg.read_bytes()))
    dom.render(canvas)
    return Image.open(BytesIO(bytes(surface.makeImageSnapshot().encodeToData()))).convert('RGB')


art = HERE / '深海少女_手绘分层.svg'
old = HERE / 'work/before-face-refinement-深海少女_手绘分层.svg'
vector_crop(art, (408, 176, 624, 352), 4).save(HERE / '面部精修特写.png')

box = (424, 216, 592, 338)
scale = 3
size = ((box[2] - box[0]) * scale, (box[3] - box[1]) * scale)
reference = Image.open(HERE / 'reference.png').convert('RGB')
panels = [reference.crop(box).resize(size, Image.Resampling.LANCZOS),
          vector_crop(old, box, scale), vector_crop(art, box, scale)]
pad, gap, header = 24, 20, 58
sheet = Image.new('RGB', (2 * pad + 3 * size[0] + 2 * gap, header + size[1] + pad), '#f4f5f7')
draw = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/System/Library/Fonts/STHeiti Medium.ttc', 23)
for i, (label, panel) in enumerate(zip(['原图参考', '精修前', '精修后'], panels)):
    x = pad + i * (size[0] + gap)
    draw.text((x, 20), label, fill='#273246', font=font)
    sheet.paste(panel, (x, header))
sheet.save(HERE / '面部精修对照.png')

# An additional review strip isolates the eye aperture change from this pass.
box = (433, 224, 574, 277)
size = ((box[2] - box[0]) * 3, (box[3] - box[1]) * 3)
prior_eye = HERE / 'work/before-orbit-refinement-深海少女_手绘分层.svg'
panels = [reference.crop(box).resize(size, Image.Resampling.LANCZOS),
          vector_crop(prior_eye, box, 3), vector_crop(art, box, 3)]
sheet = Image.new('RGB', (2 * pad + 3 * size[0] + 2 * gap, header + size[1] + pad), '#f4f5f7')
draw = ImageDraw.Draw(sheet)
for i, (label, panel) in enumerate(zip(['原图参考', '上一轮', '本次眼眶精修'], panels)):
    x = pad + i * (size[0] + gap)
    draw.text((x, 20), label, fill='#273246', font=font)
    sheet.paste(panel, (x, header))
sheet.save(HERE / '眼眶精修对照.png')
print('Saved facial and orbital close-ups and comparisons.')
