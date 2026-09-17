#!/usr/bin/env python3
"""Render a full SVG or a same-canvas diagnostic selection."""
import argparse
from pathlib import Path
from svg_common import (canvas, crop_box, flatten, output_path, read_svg,
                        render_svg, select, sha256, write_json)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source")
    p.add_argument("output", help="Diagnostic PNG, separate from source")
    p.add_argument("--scale", type=int, choices=range(1, 9), default=1)
    p.add_argument("--crop", type=int, nargs=4, metavar=("X", "Y", "W", "H"))
    p.add_argument("--background", default="transparent", help="transparent, white or a CSS color")
    for flag in ("id", "part", "hide-id", "hide-part", "hide-role", "hide-stage"):
        p.add_argument("--" + flag, action="append", default=[], help="Exact match; repeatable")
    p.add_argument("--manifest", help="Optional JSON with source hash and diagnostic settings")
    args = p.parse_args()
    try:
        dest = output_path(args.output, [args.source])
        if args.manifest:
            output_path(args.manifest, [args.source, args.output])
        before = sha256(args.source)
        root = read_svg(args.source)
        size, vb = canvas(root)
        box = crop_box(args.crop, size, args.scale)
        select(root, args.id, args.part, args.hide_id, args.hide_part, args.hide_role, args.hide_stage)
        image = render_svg(args.source, args.scale, root)
        if args.background != "transparent":
            image = flatten(image, args.background)
        image.crop(box).save(dest, format="PNG")
        if sha256(args.source) != before:
            raise ValueError("Source changed during rendering; discard this diagnostic")
        if args.manifest:
            write_json(args.manifest, {"source": str(Path(args.source).resolve()),
                       "sha256": before, "canvas": size, "viewBox": vb, "settings": vars(args)},
                       [args.source, args.output])
        print(dest)
    except (ValueError, OSError) as exc:
        p.exit(2, f"Error: {exc}\n")


if __name__ == "__main__":
    main()
