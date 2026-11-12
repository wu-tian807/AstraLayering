from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

task = Path(sys.argv[1]).resolve()
output = task / 'nine-axis/step08_hair'
previous = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parents[3] / 'demos/tanuki-girl/nine-axis/step08_hair/previous-left.png'
reference = Image.open(output / 'references/left.png').convert('RGB')
old = Image.open(previous).convert('RGB')
new = Image.open(output / 'side-hair-rerun-x-30.png').convert('RGB')
try:
    font = ImageFont.truetype('DejaVuSans.ttf', 20)
except OSError:
    font = ImageFont.load_default(size=20)


def compare(bounds, destination, scale):
    x, y, width, height = bounds
    target = (round(width * scale), round(height * scale))
    ref = reference.crop((x - 319, y + 21, x - 319 + width, y + 21 + height))
    panels = [ref]
    for model in (old, new):
        sx, sy = model.width / 500, model.height / 570
        panels.append(model.crop((round((x - 460) * sx), round((y - 175) * sy),
                                  round((x + width - 460) * sx), round((y + height - 175) * sy))))
    result = Image.new('RGB', (target[0] * 3, target[1] + 36), '#20242b')
    draw = ImageDraw.Draw(result)
    for i, (title, panel) in enumerate(zip(('Reference', 'Previous', 'New'), panels)):
        result.paste(panel.resize(target, Image.Resampling.LANCZOS), (target[0] * i, 36))
        draw.text((target[0] * i + 12, 7), title, font=font, fill='white')
    result.save(output / destination)


compare((460, 175, 500, 570), 'side-hair-rerun-compare.png', 1.144)
compare((490, 205, 215, 340), 'side-hair-rerun-far-compare.png', 2)
compare((690, 190, 265, 365), 'side-hair-rerun-near-compare.png', 1.6)
frames = output / 'workspace/side-hair-rerun-frames'
angles = [(0, '0'), (8, '-7.5'), (12, '-15'), (16, '-22.5'), (24, '-30')]
tile_size = (round(355 * 1.7), round(145 * 1.7))
result = Image.new('RGB', (tile_size[0] * len(angles), tile_size[1] + 36), '#20242b')
draw = ImageDraw.Draw(result)
for i, (frame_index, angle) in enumerate(angles):
    frame = Image.open(frames / f'frame{frame_index:03d}.png').convert('RGB')
    sx, sy = frame.width / 500, frame.height / 570
    crop = frame.crop((round(60 * sx), round(20 * sy), round(415 * sx), round(165 * sy)))
    result.paste(crop.resize(tile_size, Image.Resampling.LANCZOS), (i * tile_size[0], 36))
    draw.text((i * tile_size[0] + 12, 7), f'X={angle}', font=font, fill='white')
result.save(output / 'side-hair-rerun-root-angles.png')
print('Created whole-head, far-hair, near-hair and root-angle comparisons.')
