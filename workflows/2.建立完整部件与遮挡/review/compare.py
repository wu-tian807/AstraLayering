#!/usr/bin/env python3
"""Create aligned side-by-side, whole-composite overlay and pixel-difference evidence."""
import argparse
from pathlib import Path
from PIL import Image, ImageChops
from svg_common import (crop_box, flatten, image_info, load_image, output_path,
                        sha256, write_json)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("reference", help="PNG/JPG or SVG")
    p.add_argument("candidate", help="SVG or raster; exact same canvas required")
    p.add_argument("output_prefix", help="Produces -side.png, -overlay.png, -diff.png and .json")
    p.add_argument("--scale", type=int, choices=range(1, 9), default=1)
    p.add_argument("--crop", type=int, nargs=4, metavar=("X", "Y", "W", "H"))
    p.add_argument("--alpha", type=float, default=0.5, help="Whole candidate opacity in overlay")
    p.add_argument("--background", default="white")
    p.add_argument("--diff-gain", type=int, choices=range(1, 17), default=4)
    args = p.parse_args()
    try:
        if not 0 <= args.alpha <= 1:
            raise ValueError("Alpha must be between 0 and 1")
        sources = [args.reference, args.candidate]
        stamps = [sha256(s) for s in sources]
        infos = [image_info(s) for s in sources]
        if infos[0][0] != infos[1][0]:
            raise ValueError(f"Canvas mismatch {infos[0][0]} vs {infos[1][0]}; verify reference version, no automatic alignment")
        size = infos[0][0]
        svg_views = [info[1] for info in infos if info[1] is not None]
        if len(svg_views) == 2 and svg_views[0] != svg_views[1]:
            raise ValueError("viewBox mismatch; verify the coordinate mapping")
        if len(svg_views) == 1 and svg_views[0] != (0, 0, *size):
            raise ValueError("SVG coordinates differ from raster pixels; provide an explicitly mapped diagnostic copy")
        if size[0] * size[1] * args.scale ** 2 > 100_000_000:
            raise ValueError("Comparison exceeds 100 megapixels per image")
        box = crop_box(args.crop, size, args.scale)
        outputs = {key: output_path(args.output_prefix + suffix, sources) for key, suffix in
                   [("side", "-side.png"), ("overlay", "-overlay.png"), ("diff", "-diff.png"), ("manifest", ".json")]}
        a, b = [flatten(load_image(s, args.scale), args.background).crop(box) for s in sources]
        side = Image.new("RGB", (a.width * 2, a.height))
        side.paste(a, (0, 0)); side.paste(b, (a.width, 0))
        side.save(outputs["side"])
        Image.blend(a, b, args.alpha).save(outputs["overlay"])
        delta = ImageChops.difference(a, b)
        delta.point([min(255, i * args.diff_gain) for i in range(256)] * 3).save(outputs["diff"])
        bbox = delta.getbbox()
        if [sha256(s) for s in sources] != stamps:
            raise ValueError("An input changed during comparison; discard these diagnostics")
        write_json(outputs["manifest"], {
            "inputs": [{"path": str(Path(s).resolve()), "sha256": h} for s, h in zip(sources, stamps)],
            "canvas": size, "viewBoxes": [i[1] for i in infos], "crop_xywh": args.crop,
            "scale": args.scale, "background": args.background, "candidate_alpha": args.alpha,
            "diff_gain": args.diff_gain, "difference_bbox_in_output_crop_pixels": bbox,
            "identical_render": bbox is None, "side_order": ["reference", "candidate"],
            "outputs": {k: str(v) for k, v in outputs.items()},
            "note": "Pixel differences locate changes; they are not a visual quality verdict. Equal dimensions do not establish reference identity."
        }, sources)
        print(outputs["manifest"])
    except (ValueError, OSError) as exc:
        p.exit(2, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
