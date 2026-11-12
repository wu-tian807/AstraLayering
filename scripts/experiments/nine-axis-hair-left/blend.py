from pathlib import Path
import sys
from PIL import Image, ImageFilter
import numpy as np

p = Path(sys.argv[1]).resolve() / 'nine-axis/step08_hair'
im = Image.open(p / 'workspace/new-edge-source.png').convert('RGBA')
ref = Image.open(p / 'references/left.png').convert('RGBA')
if im.size != ref.size or im.size != (774, 774):
    raise ValueError('Expected model and reference at the same 774x774 canvas window')
matte = Image.new('RGBA', im.size, 'white')
matte.alpha_composite(im)
gray = np.asarray(matte.convert('L').filter(ImageFilter.GaussianBlur(.6)), dtype=np.float32) / 255
v = np.pad(gray, 1, mode='edge')
gx = (-v[:-2, :-2] + v[:-2, 2:] - 2 * v[1:-1, :-2] + 2 * v[1:-1, 2:] - v[2:, :-2] + v[2:, 2:]) / 4
gy = (-v[:-2, :-2] - 2 * v[:-2, 1:-1] - v[:-2, 2:] + v[2:, :-2] + 2 * v[2:, 1:-1] + v[2:, 2:]) / 4
m = np.hypot(gx, gy)
a = (np.rad2deg(np.arctan2(gy, gx)) + 180) % 180
thin = np.zeros_like(m)
for region, first, second in (
    (((a < 22.5) | (a >= 157.5)), np.roll(m, 1, 1), np.roll(m, -1, 1)),
    (((a >= 22.5) & (a < 67.5)), np.roll(np.roll(m, 1, 0), 1, 1), np.roll(np.roll(m, -1, 0), -1, 1)),
    (((a >= 67.5) & (a < 112.5)), np.roll(m, 1, 0), np.roll(m, -1, 0)),
    (((a >= 112.5) & (a < 157.5)), np.roll(np.roll(m, 1, 0), -1, 1), np.roll(np.roll(m, -1, 0), 1, 1))):
    keep = region & (m >= first) & (m >= second)
    thin[keep] = m[keep]
strong = thin > .15
weak = thin > .055
for _ in range(12):
    neighbours = np.asarray(Image.fromarray((strong * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
    grown = strong | (weak & neighbours)
    if np.array_equal(grown, strong):
        break
    strong = grown
alpha = np.asarray(im.getchannel('A')) > 8
coverage = np.asarray(Image.fromarray((alpha * 255).astype('uint8')).filter(ImageFilter.MaxFilter(3))) > 0
strong &= coverage
strong[[0, -1], :] = False
strong[:, [0, -1]] = False
edge_alpha = Image.fromarray((strong * 230).astype('uint8')).filter(ImageFilter.MaxFilter(3))
edge_alpha = edge_alpha.filter(ImageFilter.MinFilter(3)).point(lambda value: round(value * .82)).filter(ImageFilter.GaussianBlur(.25))
edge = Image.new('RGBA', im.size, (0, 205, 255, 0))
edge.putalpha(edge_alpha)
edge.save(p / 'new-edges.png')
blend = Image.alpha_composite(ref, edge)
blend.save(p / 'new-edge-on-reference.png')
blend.crop((141, 196, 641, 766)).resize((750, 855), Image.Resampling.LANCZOS).save(p / 'new-edge-on-reference-head.png')
print('Saved New edges over the reference.')
