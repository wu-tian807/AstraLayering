"""Inspect the two supplied SVGs and render controlled comparison images.

Requirements: numpy, scipy, Pillow, resvg-py. Source SVGs are never changed.
Run from any directory: python /path/to/physics-band-analysis/analyze.py
The experiments are display/geometry inspections, not the author's optimizer.
"""
from collections import Counter
from copy import deepcopy
from io import BytesIO
from pathlib import Path
import gzip
import hashlib
import json
import re
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image, ImageDraw, ImageFont
import resvg_py
from scipy.spatial import cKDTree

HERE = Path(__file__).resolve().parent
IMAGES = HERE / "images"
IMAGES.mkdir(exist_ok=True)
NS = "{http://www.w3.org/2000/svg}"
ET.register_namespace("", NS[1:-1])
FILES = {"baseline": "character_baseline.svg", "physics-band": "character-physics-band.svg"}
ROOTS = {key: ET.parse(HERE / "sources" / name).getroot() for key, name in FILES.items()}
COMMAND = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]")
NUMBER = re.compile(r"[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
GRAPHICS = {"path", "circle", "ellipse", "rect", "line", "polygon", "polyline", "use"}


def tag(element):
    return element.tag.split("}")[-1]


def quantiles(values):
    return dict(zip(["min", "p05", "median", "p95", "max"],
                    map(float, np.quantile(values, [0, .05, .5, .95, 1]))))


def summary(key, root):
    data = (HERE / "sources" / FILES[key]).read_bytes()
    paths = list(root.iter(NS + "path"))
    commands = Counter(c for p in paths for c in COMMAND.findall(p.get("d", "")))
    counts = Counter(tag(e) for e in root.iter())
    paint = Counter()

    def inspect(e, inherited=None, in_defs=False):
        props = dict(inherited or {"fill": "black", "stroke": "none"})
        props.update({k: v for k, v in e.attrib.items() if k in props})
        in_defs = in_defs or tag(e) == "defs"
        if tag(e) in GRAPHICS and not in_defs:
            kind = ("fill" if props["fill"] != "none" else "") + ("+stroke" if props["stroke"] != "none" else "")
            paint[kind or "none"] += 1
        for child in e:
            inspect(child, props, in_defs)

    inspect(root)
    ids = [e.get("id") for e in root.iter() if e.get("id")]
    return {
        "file": FILES[key], "bytes": len(data),
        "gzip_bytes_level9": len(gzip.compress(data, compresslevel=9, mtime=0)),
        "sha256": hashlib.sha256(data).hexdigest(),
        "root_attributes": root.attrib,
        "title": root.findtext(NS + "title"), "description": root.findtext(NS + "desc"),
        "elements_including_definitions": dict(counts),
        "commands_including_definitions": dict(commands),
        "path_d_bytes": sum(len(p.get("d", "").encode()) for p in paths),
        "path_subpaths": commands["M"] + commands["m"],
        "subpaths_per_path": quantiles([len(re.findall("[Mm]", p.get("d", ""))) for p in paths]),
        "cubic_segments_per_path": quantiles([len(re.findall("[Cc]", p.get("d", ""))) for p in paths]),
        "top_level_groups": [{"id": e.get("id"), "children": len(e), "attributes": e.attrib}
                             for e in root if tag(e) == "g"],
        "paint_of_non_def_elements_without_use_expansion": dict(paint),
        "duplicate_ids": [i for i, n in Counter(ids).items() if n > 1],
        "coverage_paths": [{"id": p.get("id"), "opacity": p.get("fill-opacity"),
                            "subpaths": len(re.findall("[Mm]", p.get("d", "")))}
                           for p in paths if "coverage" in (p.get("id") or "")],
    }


def inspect_bands(root):
    circles = list(root.iter(NS + "circle"))
    centers = np.array([(float(e.get("cx")), float(e.get("cy"))) for e in circles])
    radii = np.array([float(e.get("r")) for e in circles])
    tree = cKDTree(centers)
    records = []
    for p in root.iter(NS + "path"):
        chunks = [(m[1], list(map(float, NUMBER.findall(m[2]))))
                  for m in re.finditer(r"([MLCZ])([^MLCZ]*)", p.get("d"))]
        split = next(i for i, c in enumerate(chunks) if c[0] == "L")
        assert chunks[0][0] == "M" and chunks[-1][0] == "Z"
        assert all(c[0] == "C" for c in chunks[1:split] + chunks[split + 1:-1])
        a0 = np.array(chunks[0][1])
        an = np.array(chunks[split - 1][1][-2:])
        bn = np.array(chunks[split][1])
        b0 = np.array(chunks[-2][1][-2:])
        mids = np.array([(a0 + b0) / 2, (an + bn) / 2])
        widths = np.array([np.linalg.norm(a0 - b0), np.linalg.norm(an - bn)])
        distances, nodes = tree.query(mids)
        records.append({"id": p.get("id"), "side_cubics": [split - 1, len(chunks) - split - 2],
                        "endpoints": mids.tolist(), "endpoint_widths": widths.tolist(),
                        "circle_indices": nodes.tolist(), "circle_distance": distances.tolist(),
                        "radius_error": abs(radii[nodes] - widths / 2).tolist()})
    degrees = Counter(n for r in records for n in r["circle_indices"])
    group = root.find(NS + "g")
    return {
        "all_band_command_structure": "M C+ L C+ Z",
        "band_count": len(records), "circle_count": len(circles),
        "endpoint_count": 2 * len(records),
        "nearest_circle_distance_svg_units": quantiles([v for r in records for v in r["circle_distance"]]),
        "circle_radius_vs_half_endpoint_width_error": quantiles([v for r in records for v in r["radius_error"]]),
        "endpoint_width_svg_units": quantiles([v for r in records for v in r["endpoint_widths"]]),
        "circle_radius_svg_units": quantiles(radii),
        "node_degree_histogram": dict(sorted(Counter(degrees.get(n, 0) for n in range(len(circles))).items())),
        "first_child_type": tag(group[0]), "last_child_type": tag(group[-1]),
        "all_bands_precede_all_circles": all(tag(e) == "path" for e in list(group)[:len(records)])
            and all(tag(e) == "circle" for e in list(group)[len(records):]),
        "selected_bands": [r for r in records if r["id"] in {"band-0", "band-371", "band-665", "band-738"}],
        "scope": "Endpoint widths are geometric end-cap widths, not a measured continuous pen-pressure profile."
    }


def render(root, box=None, scale=1):
    variant = deepcopy(root)
    if box is None:
        box = (0, 0, 1024, 1536)
    x0, y0, x1, y1 = box
    variant.set("viewBox", f"{x0} {y0} {x1-x0} {y1-y0}")
    variant.set("width", str(round((x1-x0)*scale)))
    variant.set("height", str(round((y1-y0)*scale)))
    data = resvg_py.svg_to_bytes(svg_string=ET.tostring(variant, encoding="unicode"),
                                 background="white", skip_system_fonts=True)
    return Image.open(BytesIO(data)).convert("RGB")


def panel(name, images, labels):
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 22)
    except OSError:
        font = ImageFont.load_default()
    width, height = images[0].size
    result = Image.new("RGB", (len(images)*(width+8)+8, height+42), "#eef0f3")
    draw = ImageDraw.Draw(result)
    for i, (img, label) in enumerate(zip(images, labels)):
        x = 8+i*(width+8)
        draw.text((x, 7), label, fill="#263346", font=font)
        result.paste(img, (x, 34))
    result.save(IMAGES / name)


evidence = {key: summary(key, root) for key, root in ROOTS.items()}
evidence["band_geometry"] = inspect_bands(ROOTS["physics-band"])
evidence["reduction"] = {
    "file_bytes_percent": 100*(1-evidence["physics-band"]["bytes"]/evidence["baseline"]["bytes"]),
    "cubic_segments_percent": 100*(1-evidence["physics-band"]["commands_including_definitions"]["C"]/
                                   evidence["baseline"]["commands_including_definitions"]["C"]),
}
evidence["notes"] = [
    "Counts include definitions. They are not the number of artist pen strokes or semantic parts.",
    "No source raster, generator code, paper citation, or optimization history was supplied.",
    "Metadata descriptions are source self-reports, not independently verified process records.",
    "Crops are rerendered vectors at the indicated scale, not enlarged PNG pixels.",
    "resvg is used for both SVGs; Skia SVGDOM omitted baseline masked geometry and is unsuitable here.",
]

for key, root in ROOTS.items():
    render(root).save(IMAGES / (key + ".png"))
panel("01-overall.png", [render(r, scale=.65) for r in ROOTS.values()], ["BASELINE", "PHYSICS-BAND"])
crops = {
    "02-head.png": ((325, 45, 660, 335), 2),
    "03-jaw.png": ((428, 245, 536, 292), 8),
    "04-hair.png": ((330, 217, 457, 325), 5),
    "05-folds.png": ((301, 405, 505, 548), 3),
    "06-hand.png": ((762, 687, 852, 824), 5),
}
for name, (box, scale) in crops.items():
    panel(name, [render(r, box, scale) for r in ROOTS.values()], ["BASELINE", "PHYSICS-BAND"])

# Controlled ablations of the same physics-band geometry.
original = ROOTS["physics-band"]
no_nodes = deepcopy(original)
g = no_nodes.find(NS + "g")
for e in list(g):
    if tag(e) == "circle":
        g.remove(e)
opaque = deepcopy(original)
opaque.find(NS + "g").set("opacity", "1")
box = (394, 240, 449, 292)
panel("07-node-ablation.png", [render(r, box, 8) for r in [original, no_nodes]],
      ["ORIGINAL", "WITHOUT NODE CIRCLES"])
panel("08-opacity-ablation.png", [render(r, (431, 249, 527, 291), 6) for r in [original, opaque]],
      ["GROUP OPACITY 0.7785", "GROUP OPACITY 1.0"])

# Global white background removal demonstrates transparency, not recovered parts.
background_test = deepcopy(original)
for e in background_test:
    if tag(e) == "rect":
        e.set("fill", "#b8d8f0")
        break
render(background_test, (325, 45, 660, 335), 2).save(IMAGES / "09-background-through.png")

# A local coloring demonstration. The disk is an added, approximate base shape.
# It is intentionally not described as extracted/recovered character geometry.
recolored_ink = deepcopy(original)
for e in recolored_ink.find(NS + "g"):
    e.set("fill", "#2588d0")
added_base = deepcopy(original)
disk = ET.Element(NS + "path", {
    "id": "analysis-added-button-base",
    "d": "M489.4 328.4 A9.6 9.6 0 1 0 470.2 328.4 A9.6 9.6 0 1 0 489.4 328.4 Z",
    "fill": "#a5d1f0"
})
added_base.insert(list(added_base).index(added_base.find(NS + "g")), disk)
panel("10-fill-demo.png", [render(r, (464, 312, 495, 345), 9)
                           for r in [original, recolored_ink, added_base]],
      ["ORIGINAL INK", "INK FILL CHANGED", "ADDED BASE + INK"])

# Isolate an existing baseline category; do not invent anatomical completion.
isolated = deepcopy(ROOTS["baseline"])
for e in list(isolated):
    if tag(e) not in {"defs", "title", "desc"} and e.get("id") != "brown-lines":
        isolated.remove(e)
panel("11-baseline-isolation.png", [render(r, (377, 121, 596, 303), 3)
                                    for r in [ROOTS["baseline"], isolated]],
      ["BASELINE ASSEMBLED", "FACE / HAND INK GROUP ONLY"])

(HERE / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"reduction": evidence["reduction"], "band_geometry": evidence["band_geometry"]},
                 ensure_ascii=False, indent=2))
