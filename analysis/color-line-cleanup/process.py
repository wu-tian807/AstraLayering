"""Deterministic cleanup of this front-facing, magenta-marked character image.

Requires Pillow and NumPy. No generation, tracing, or anatomical redrawing.
The gray suit is segmented by color within a configurable normalized ROI.
This is an image-specific experiment, not a general body segmentation model.

Usage: python3 process.py INPUT --output OUTPUT_DIR
"""

from argparse import ArgumentParser
from collections import deque
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def flood(binary, seed):
    h, w = binary.shape
    seen = np.zeros_like(binary)
    x, y = seed
    if not binary[y, x]:
        raise ValueError("The seed must lie inside the gray suit.")
    queue = deque([(x, y)])
    seen[y, x] = True
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and binary[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((nx, ny))
    return seen


def morph(mask, operation, size):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    filt = ImageFilter.MaxFilter(size) if operation == "dilate" else ImageFilter.MinFilter(size)
    return np.asarray(im.filter(filt)) > 127


def rgb_image(a):
    return Image.fromarray(np.clip(np.rint(a), 0, 255).astype(np.uint8))


def solid_layer(color, alpha):
    rgba = np.empty((*alpha.shape, 4), np.uint8)
    rgba[:, :, :3] = color
    rgba[:, :, 3] = np.clip(np.rint(alpha * 255), 0, 255).astype(np.uint8)
    return Image.fromarray(rgba)


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--strength", type=float, default=0.26)
    parser.add_argument("--roi", type=float, nargs=4, default=(0.355, 0.21, 0.645, 0.885))
    args = parser.parse_args()
    if not 0 <= args.strength <= 1:
        parser.error("--strength must lie between zero and one")
    out = args.output
    out.mkdir(parents=True, exist_ok=True)
    original = Image.open(args.input).convert("RGB")
    original.save(out / "source.png")
    src = np.asarray(original, dtype=np.float32)
    h, w = src.shape[:2]
    roi = np.zeros((h, w), bool)
    x0, y0, x1, y1 = args.roi
    roi[int(y0 * h):int(y1 * h), int(x0 * w):int(x1 * w)] = True
    red, green, blue = src.transpose(2, 0, 1)
    luminance = src.mean(axis=2)
    chroma = src.max(axis=2) - src.min(axis=2)

    # Saturated magenta carries class information. Small mixed-color fringes
    # are retained in the soft matte, then removed from the flat base.
    magenta_signal = np.minimum(red, blue) - green
    magenta_core = (magenta_signal > 25) & roi
    magenta_region = morph(magenta_core, "dilate", 7) & roi
    raw_alpha = np.clip((magenta_signal - 2.0) / 228.0, 0, 1) * magenta_region

    # Saturated green is a separate discard class. There are no such marks
    # in this source; it is still identified separately for the audit.
    green_signal = green - np.maximum(red, blue)
    discard_core = (green_signal > 30) & roi
    discard_region = morph(discard_core, "dilate", 7) & roi

    # Seeded color segmentation keeps the blue hair and warm skin outside.
    neutral = (chroma < 22) & (luminance > 145) & (luminance < 234)
    marker_pixels = ((magenta_signal > 5) & magenta_region) | discard_core
    candidates = (neutral | marker_pixels) & roi
    suit = flood(candidates, (int(w * .5), int(h * .4)))
    # Fill enclosed holes (small gray variations / dark knee marks), while
    # retaining the background gap that opens between the legs.
    outside = flood(~suit, (0, 0))
    suit = ~outside

    # Include just the adjacent neutral, dark outline, not the colored skin.
    near = morph(suit, "dilate", 5)
    outline_pixels = near & (chroma < 27) & (luminance < 235) & roi
    area = suit | outline_pixels

    interior = morph(suit, "erode", 7)
    sample = interior & ~magenta_region & ~discard_region & (luminance > 190)
    source_base = np.median(src[sample], axis=0)
    source_gray = float(source_base.mean())
    ink = np.array((40, 40, 40), np.float32)

    # Inside a narrow boundary band retain the existing silhouette and its
    # antialiasing. Unmarked interior dark lines are also deliberately kept:
    # their semantics cannot be inferred merely from the marker palette.
    source_ink = np.clip((source_gray - luminance) / (source_gray - ink.mean()), 0, 1)
    is_dark = (luminance < source_gray - 19) & (chroma < 30)
    dark_zone = morph(is_dark & area, "dilate", 3)
    ink_alpha = source_ink * dark_zone * area
    colored_marks = magenta_region & ((magenta_signal > 5) | (chroma > 30))
    ink_alpha[colored_marks | discard_core] = 0

    line_alpha = raw_alpha * suit * args.strength
    line_color = np.array((79, 75, 87), np.float32)

    def composite(base_color, strength=1):
        base = np.array(base_color, np.float32)
        clean = src.copy()
        painted = base * (1 - ink_alpha[:, :, None]) + ink * ink_alpha[:, :, None]
        clean[area] = painted[area]
        alpha = (line_alpha * strength)[:, :, None]
        clean = clean * (1 - alpha) + line_color * alpha
        return rgb_image(clean)

    flat = composite((217, 217, 217), 0)
    gray = composite((217, 217, 217))
    blue_result = composite((216, 226, 240))
    flat.save(out / "clean-flat.png")
    gray.save(out / "clean-gray.png")
    blue_result.save(out / "clean-blue.png")
    Image.fromarray((area * 255).astype(np.uint8)).save(out / "body-mask.png")
    Image.fromarray(np.rint(raw_alpha * suit * 255).astype(np.uint8)).save(out / "structure-mask.png")
    solid_layer(line_color, line_alpha).save(out / "structure-lines.png")

    # A close comparison reveals the original curve directions, without
    # inventing new paths to make the result appear anatomically improved.
    crop = (int(w * .36), int(h * .22), int(w * .64), int(h * .535))
    panel_w, panel_h = 344, 580
    font_path = "/System/Library/Fonts/STHeiti Light.ttc"
    try:
        font = ImageFont.truetype(font_path, 21)
        small = ImageFont.truetype(font_path, 16)
    except OSError:
        font = small = ImageFont.load_default()
    canvas = Image.new("RGB", (panel_w * 3 + 64, panel_h + 100), (248, 248, 247))
    draw = ImageDraw.Draw(canvas)
    panels = [(original, "原始标记", "洋红色 = 保留线"),
              (gray, "处理结果", "统一底色 · 线条强度 26%"),
              (blue_result, "改色验证", "相同线条 · 蓝灰底色")]
    for index, (im, title, subtitle) in enumerate(panels):
        x = 16 + index * (panel_w + 16)
        draw.text((x, 12), title, font=font, fill=(35, 39, 44))
        draw.text((x, 44), subtitle, font=small, fill=(93, 98, 104))
        panel = im.crop(crop).resize((panel_w, panel_h), Image.Resampling.LANCZOS)
        canvas.paste(panel, (x, 80))
    canvas.save(out / "comparison.png")

    # Verification checks only implementation properties, not anatomy.
    gray_array = np.asarray(gray)
    unchanged = bool(np.array_equal(gray_array[~area], np.asarray(original)[~area]))
    remaining_magenta = ((gray_array[:, :, 0].astype(float) - gray_array[:, :, 1] > 20)
                        & (gray_array[:, :, 2].astype(float) - gray_array[:, :, 1] > 20)
                        & area).sum()
    flat_check = interior & ~dark_zone & ~magenta_region & ~discard_region
    flat_spread = np.ptp(gray_array[flat_check], axis=0).tolist()
    audit = {
        "size": [w, h],
        "source_body_median_rgb": source_base.tolist(),
        "magenta_core_pixels": int(magenta_core.sum()),
        "green_discard_pixels": int(discard_core.sum()),
        "edited_pixels": int(area.sum()),
        "line_strength": args.strength,
        "outside_edit_mask_bit_identical": unchanged,
        "remaining_magenta_pixels_in_body": int(remaining_magenta),
        "flat_region_channel_spread": flat_spread,
        "geometry": "Original marker geometry and unmarked dark lines retained; no anatomy redrawn.",
        "limitations": [
            "Suit segmentation uses this image's neutral gray palette and a front-facing region of interest.",
            "Marker edge opacity is estimated because generated colors are not exact palette mixtures.",
            "Pixels hidden by opaque markers cannot be exactly recovered; the marked area uses the flat base."
        ]
    }
    (out / "audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(audit, ensure_ascii=False, indent=2))
    if not unchanged or remaining_magenta:
        raise RuntimeError("The compositing checks failed. Inspect audit.json before using the output.")


if __name__ == "__main__":
    main()
