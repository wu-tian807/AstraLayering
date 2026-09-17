"""Read-only SVG diagnostics. Temporary variants never replace the source."""
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET

from PIL import Image

SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
RESOURCES = {"defs", "style", "metadata", "title", "desc", "clipPath", "mask",
             "linearGradient", "radialGradient", "pattern", "marker", "symbol", "filter"}
DRAWABLE = {"path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
            "text", "image", "use", "foreignObject"}


def tag(node):
    return node.tag.rsplit("}", 1)[-1]


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read_svg(path):
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError as exc:
        raise ValueError(f"Invalid SVG XML: {path}: {exc}") from exc
    if tag(root) != "svg":
        raise ValueError(f"Not an SVG: {path}")
    return root


def pixel_length(value):
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)(?:px)?\s*", value or "")
    return float(match[1]) if match else None


def canvas(root):
    raw = root.get("viewBox")
    vb = tuple(float(v) for v in re.split(r"[\s,]+", raw.strip())) if raw else None
    if vb and (len(vb) != 4 or vb[2] <= 0 or vb[3] <= 0):
        raise ValueError("Invalid viewBox")
    w, h = pixel_length(root.get("width")), pixel_length(root.get("height"))
    if w is None or h is None:
        if vb is None:
            raise ValueError("SVG needs pixel dimensions or a viewBox")
        w, h = vb[2:]
    if not all(math.isfinite(v) and v > 0 for v in (w, h)):
        raise ValueError("Invalid SVG canvas")
    if w != round(w) or h != round(h):
        raise ValueError("Fractional canvas size: specify an explicit pixel canvas in a diagnostic copy")
    return (int(w), int(h)), vb or (0.0, 0.0, w, h)


def output_path(path, sources):
    path = Path(path).resolve()
    if path in {Path(p).resolve() for p in sources}:
        raise ValueError("Output must not overwrite an input")
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def write_json(path, data, sources=()):
    output_path(path, sources).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def hide(node):
    # Inline !important also wins over class-based display rules.
    node.set("style", node.get("style", "").rstrip(";") + ";display:none!important")


def select(root, ids=(), parts=(), hide_ids=(), hide_parts=(), hide_roles=(), hide_stages=()):
    """Keep the tree/resources intact; hide only paint outside the selection."""
    selectors = [("id", ids), ("data-part", parts), ("id", hide_ids),
                 ("data-part", hide_parts), ("data-role", hide_roles),
                 ("data-stage", hide_stages)]
    for attr, values in selectors:
        for value in values:
            if not any(n.get(attr) == value and (n is not root or attr not in {"data-role", "data-stage"})
                       for n in root.iter()):
                raise ValueError(f"Selector matched nothing: {attr}={value}")
    isolating = bool(ids or parts)

    def visit(node, selected=False, resource=False):
        resource = resource or tag(node) in RESOURCES
        if resource:
            return
        selected = selected or node.get("id") in ids or node.get("data-part") in parts
        if (node.get("id") in hide_ids or node.get("data-part") in hide_parts
                or (node is not root and (node.get("data-role") in hide_roles
                                          or node.get("data-stage") in hide_stages))):
            hide(node)
        if isolating and tag(node) in DRAWABLE and not selected:
            hide(node)
        for child in node:
            visit(child, selected, resource)
    visit(root)


def node_runtime():
    explicit = os.environ.get("REVIEW_NODE")
    if explicit:
        return explicit
    bundled = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
    return shutil.which("node") or (str(bundled) if bundled.is_file() else "node")


def render_svg(path, scale=1, root=None):
    root = root if root is not None else read_svg(path)
    size, vb = canvas(root)
    if not isinstance(scale, int) or not 1 <= scale <= 8:
        raise ValueError("Scale must be an integer from 1 to 8")
    if size[0] * size[1] * scale * scale > 100_000_000:
        raise ValueError("Render exceeds 100 megapixels; use a smaller scale")
    # Explicit viewport dimensions avoid backend DPI/unit surprises.
    root.set("viewBox", " ".join(map(str, vb)))
    root.set("width", str(size[0] * scale))
    root.set("height", str(size[1] * scale))
    with tempfile.TemporaryDirectory(prefix="astra-review-") as work:
        svg = Path(work) / "candidate.svg"
        png = Path(work) / "render.png"
        ET.ElementTree(root).write(svg, encoding="utf-8", xml_declaration=True)
        try:
            subprocess.run([node_runtime(), str(Path(__file__).with_name("render_backend.cjs")),
                            str(svg), str(png)], check=True, capture_output=True, text=True)
        except FileNotFoundError as exc:
            raise ValueError("Node.js unavailable; set REVIEW_NODE to its executable") from exc
        except subprocess.CalledProcessError as exc:
            raise ValueError("SVG rendering failed: " + exc.stderr.strip()) from exc
        with Image.open(png) as image:
            result = image.convert("RGBA")
    if result.size != (size[0] * scale, size[1] * scale):
        raise ValueError(f"Renderer returned an unexpected canvas: {result.size}")
    return result


def image_info(path):
    if Path(path).suffix.lower() == ".svg":
        size, vb = canvas(read_svg(path))
        return size, vb
    with Image.open(path) as im:
        return im.size, None


def load_image(path, scale=1):
    if Path(path).suffix.lower() == ".svg":
        return render_svg(path, scale)
    with Image.open(path) as im:
        result = im.convert("RGBA")
    if scale != 1:
        result = result.resize((result.width * scale, result.height * scale), Image.Resampling.LANCZOS)
    return result


def flatten(image, background):
    base = Image.new("RGBA", image.size, background)
    base.alpha_composite(image)
    return base.convert("RGB")


def crop_box(values, size, scale):
    if values is None:
        return (0, 0, size[0] * scale, size[1] * scale)
    x, y, w, h = values
    if min(x, y) < 0 or min(w, h) <= 0 or x + w > size[0] or y + h > size[1]:
        raise ValueError("Crop must be inside the original canvas: x y width height")
    return (x * scale, y * scale, (x + w) * scale, (y + h) * scale)
