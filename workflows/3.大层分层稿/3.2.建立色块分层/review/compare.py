#!/usr/bin/env python3
"""同坐标对照色块渲染与彩图；依赖 Pillow。边界叠加仅供目视检查。"""
import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", required=True, type=Path)
    parser.add_argument("--rendered", required=True, type=Path,
                        help="从候选 SVG 渲染的色块 PNG，背景为透明或白色")
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--crop", type=int, nargs=4, metavar=("X", "Y", "W", "H"))
    parser.add_argument("--scale", type=int, default=1)
    args = parser.parse_args()
    if args.scale < 1:
        parser.error("scale 至少为 1")

    reference = Image.open(args.reference).convert("RGBA")
    rendered = Image.open(args.rendered).convert("RGBA")
    if reference.size != rendered.size:
        parser.error(f"画布不同：{reference.size} / {rendered.size}；按参考画布重新渲染后对照")

    def white(image):
        return Image.alpha_composite(Image.new("RGBA", image.size, "white"), image)

    source, candidate = white(reference), white(rendered)
    # 合成图的可见色界；在裁切前求边界，避免把裁切框当成部件边缘。
    coverage = Image.new("L", candidate.size, 0)
    for channel in candidate.convert("RGB").split():
        local_range = ImageChops.subtract(channel.filter(ImageFilter.MaxFilter(3)),
                                         channel.filter(ImageFilter.MinFilter(3)))
        coverage = ImageChops.lighter(coverage, local_range)
    coverage = coverage.point(lambda value: min(value * 3, 220))
    ink = Image.new("RGBA", candidate.size, (220, 20, 150, 0))
    ink.putalpha(coverage)
    overlay = Image.alpha_composite(source, ink)
    blend = Image.blend(source, candidate, 0.4)

    if args.crop:
        x, y, width, height = args.crop
        if min(x, y) < 0 or min(width, height) <= 0 or x + width > reference.width or y + height > reference.height:
            parser.error("裁切范围超出原画布")
        box = (x, y, x + width, y + height)
        source, candidate, overlay, blend = [im.crop(box) for im in (source, candidate, overlay, blend)]

    panels = [source, candidate, overlay, blend]
    if args.scale != 1:
        panels = [panel.resize((panel.width * args.scale, panel.height * args.scale), Image.Resampling.LANCZOS)
                  for panel in panels]
    args.out.mkdir(parents=True, exist_ok=True)
    for name, panel in zip(("reference", "candidate", "overlay", "blend"), panels):
        panel.convert("RGB").save(args.out / f"{name}.png")
    board = Image.new("RGB", (panels[0].width * 3, panels[0].height), "white")
    for index, panel in enumerate(panels[:3]):
        board.paste(panel.convert("RGB"), (index * panel.width, 0))
    board.save(args.out / "comparison.png")
    print(f"{args.out / 'comparison.png'}（从左到右：彩图、候选、可见色界叠加；透明叠加见 blend.png）")


if __name__ == "__main__":
    main()
