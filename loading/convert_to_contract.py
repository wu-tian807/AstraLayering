#!/usr/bin/env python3
"""
从 Astra demo HTML 抽出内联 SVG，转成 layer-contract.md 格式；
可选抽出参考原图。

支持两种来源：
  A) 深海少女式：<svg id="artwork"> + <script id="layerData">
  B) 公式服式：  <svg id="character-svg"> + <metadata id="layer-manifest"> + g.art-layer

用法:
  python3 convert_to_contract.py <input.html> <output.svg> [--ref <output.ref>]
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from html import escape as _escape
from pathlib import Path


def escape_attr(s: str) -> str:
    return _escape(str(s), quote=True)


def split_top_level_gs(text: str):
    """按 <g>/</g> 深度扫描，切出每个顶层 <g> 完整片段。

    注意：SVG 里存在自闭合的 `<g .../>`（空组），不能当成未闭合开标签。
    """
    tag_re = re.compile(r"<g\b[^>]*?/?>|</g>")
    depth = 0
    layer_start = -1
    layers = []
    for m in tag_re.finditer(text):
        token = m.group(0)
        if token == "</g>":
            depth -= 1
            if depth == 0 and layer_start >= 0:
                layers.append(text[layer_start : m.end()])
                layer_start = -1
            continue
        if token.endswith("/>"):
            # 自闭合：若出现在顶层则整段就是一层（少见）
            if depth == 0:
                layers.append(text[m.start() : m.end()])
            continue
        if depth == 0:
            layer_start = m.start()
        depth += 1
    return layers

def find_svg_block(html: str) -> tuple[str, str, str]:
    """返回 (open_tag, inner, full_svg)。优先 artwork，其次 character-svg，再任意 svg。"""
    for marker in ('<svg id="artwork"', '<svg id="character-svg"', "<svg "):
        idx = html.find(marker)
        if idx >= 0:
            break
    else:
        raise RuntimeError("没找到 <svg>")
    open_end = html.index(">", idx) + 1
    close = html.index("</svg>", open_end)
    open_tag = html[idx:open_end]
    inner = html[open_end:close]
    full = html[idx : close + len("</svg>")]
    return open_tag, inner, full


def extract_shared_prefix(inner: str) -> tuple[str, str]:
    """
    切出图层之前的共享前缀（title/desc/defs/metadata 等），
    以及第一个顶层 <g> 起的图层区。
    """
    m = re.search(r"<g\b", inner)
    if not m:
        return inner, ""
    return inner[: m.start()], inner[m.start() :]


def slim_manifest_layers(raw_layers: list) -> list:
    out = []
    for i, item in enumerate(raw_layers):
        out.append(
            {
                "id": item["id"],
                "name": item.get("name") or item["id"],
                "category": item.get("category") or "",
                "rank": int(item["rank"]) if "rank" in item else i,
            }
        )
    return out


def extract_reference(html: str, ref_path: Path | None) -> str | None:
    if not ref_path:
        return None
    m = re.search(
        r'<img[^>]*\bid="reference"[^>]*src="(data:image/([^;]+);base64,([^"]+))"',
        html,
    )
    if not m:
        # 宽松：任意带超长 data:image 的 img
        m = re.search(r'<img[^>]*src="(data:image/([^;]+);base64,([^"]+))"', html)
    if not m:
        print("警告: 没找到参考原图 data URI，跳过 --ref")
        return None
    mime = m.group(2).lower()
    raw = base64.b64decode(m.group(3))
    ext = {"jpeg": ".jpg", "jpg": ".jpg", "png": ".png", "webp": ".webp"}.get(mime, "." + mime.split("+")[0])
    out = ref_path if ref_path.suffix else ref_path.with_suffix(ext)
    if not ref_path.suffix:
        # 用户给的是无后缀路径
        out = Path(str(ref_path) + ext) if not str(ref_path).endswith(ext) else ref_path
    # 若用户指定了 .ref 之类，按 mime 改后缀
    if ref_path.suffix in {"", ".ref"} or ref_path.suffix not in {".png", ".jpg", ".jpeg", ".webp"}:
        out = ref_path.with_suffix(ext) if ref_path.suffix else Path(str(ref_path) + ext)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(raw)
    print(f"参考图: {out}（{len(raw) / 1024 / 1024:.2f} MB, {mime}）")
    return str(out)


def convert_azure(html: str) -> tuple[str, list]:
    """深海少女：layerData + svg#artwork。"""
    m = re.search(
        r'<script type="application/json" id="layerData">([\s\S]*?)</script>',
        html,
    )
    if not m:
        raise RuntimeError("azure 格式但没找到 #layerData")
    layer_data = json.loads(m.group(1))
    meta_by_id = {item["id"]: item for item in layer_data}

    open_tag, inner, _ = find_svg_block(html)
    view_box = re.search(r'viewBox="([^"]+)"', open_tag)
    width = re.search(r'width="([^"]+)"', open_tag)
    height = re.search(r'height="([^"]+)"', open_tag)

    prefix, layer_zone = extract_shared_prefix(inner)
    # azure 通常没有共享 defs 前缀；丢掉旧 title 等，契约只留 manifest
    raw_layers = split_top_level_gs(layer_zone or inner)

    return assemble(
        width=width.group(1) if width else "",
        height=height.group(1) if height else "",
        view_box=view_box.group(1) if view_box else "",
        raw_layers=raw_layers,
        meta_by_id=meta_by_id,
        shared_defs="",
        order_field="order",  # 1-based
    )


def convert_native(html: str) -> tuple[str, list]:
    """公式服：character-svg + layer-manifest + art-layer。"""
    open_tag, inner, _ = find_svg_block(html)
    view_box = re.search(r'viewBox="([^"]+)"', open_tag)
    width = re.search(r'width="([^"]+)"', open_tag)
    height = re.search(r'height="([^"]+)"', open_tag)

    meta_m = re.search(
        r'<metadata id="layer-manifest">([\s\S]*?)</metadata>',
        inner,
    )
    meta_by_id = {}
    if meta_m:
        payload = json.loads(meta_m.group(1))
        for item in payload.get("layers", payload if isinstance(payload, list) else []):
            meta_by_id[item["id"]] = item

    prefix, layer_zone = extract_shared_prefix(inner)
    defs_parts = [dm.group(0) for dm in re.finditer(r"<defs\b[\s\S]*?</defs>", prefix)]
    shared_defs = "\n".join(defs_parts)

    candidates = split_top_level_gs(layer_zone)
    art = [g for g in candidates if "art-layer" in g[: g.index(">") + 1]]
    raw_layers = art or candidates

    return assemble(
        width=width.group(1) if width else "",
        height=height.group(1) if height else "",
        view_box=view_box.group(1) if view_box else "",
        raw_layers=raw_layers,
        meta_by_id=meta_by_id,
        shared_defs=shared_defs,
        order_field="rank",
    )
def assemble(
    *,
    width: str,
    height: str,
    view_box: str,
    raw_layers: list[str],
    meta_by_id: dict,
    shared_defs: str,
    order_field: str,
) -> tuple[str, list]:
    id_def_re = re.compile(r'\bid="([^"]+)"')
    url_ref_re = re.compile(r"url\(#([^)]+)\)")

    private_ids_by_layer = {}
    refs_by_layer = {}
    rewritten = []
    manifest = []
    warnings = []
    seen_ids = set()

    # 共享 defs 里的 id 不算任何层的私有资源
    shared_ids = set(id_def_re.findall(shared_defs))

    for index, layer_html in enumerate(raw_layers):
        layer_html = layer_html.strip()
        if layer_html.endswith("/>") and layer_html.count("<g") == 1:
            # 顶层空组，跳过
            warnings.append(f"第 {index} 个顶层是空的自闭合 <g/>，已跳过")
            continue
        open_tag_end = layer_html.index(">") + 1
        open_tag = layer_html[:open_tag_end]
        close_at = layer_html.rfind("</g>")
        if close_at < 0:
            warnings.append(f"第 {index} 个顶层缺少 </g>，已跳过")
            continue
        body = layer_html[open_tag_end:close_at]
        id_match = re.search(r'\bid="([^"]+)"', open_tag)
        name_match = re.search(r'data-name="([^"]+)"', open_tag)
        cat_match = re.search(r'data-category="([^"]+)"', open_tag)
        layer_id = id_match.group(1) if id_match else None
        name_from_g = name_match.group(1) if name_match else None
        cat_from_g = cat_match.group(1) if cat_match else None
        meta = meta_by_id.get(layer_id) if layer_id else None

        if not layer_id:
            warnings.append(f"第 {index} 个顶层图层没有 id")
            continue
        if layer_id in seen_ids:
            warnings.append(f"id 重复: {layer_id}")
        seen_ids.add(layer_id)

        rank = index
        name = (meta or {}).get("name") or name_from_g or layer_id
        category = (meta or {}).get("category") or cat_from_g or ""

        if meta and order_field in meta:
            expected = meta[order_field]
            if order_field == "order" and expected != rank + 1:
                warnings.append(
                    f"{layer_id}: 原始 order={expected} 与实际文档顺序 rank={rank} 不一致"
                )
            if order_field == "rank" and int(expected) != rank:
                warnings.append(
                    f"{layer_id}: 原始 rank={expected} 与实际文档顺序 rank={rank} 不一致"
                )

        manifest.append({"id": layer_id, "name": name, "category": category, "rank": rank})

        private_ids = set(dm.group(1) for dm in id_def_re.finditer(body))
        private_ids_by_layer[layer_id] = private_ids
        refs_by_layer[layer_id] = set(rm.group(1) for rm in url_ref_re.finditer(body))

        new_open = (
            f'<g id="{layer_id}" data-name="{escape_attr(name)}" '
            f'data-category="{escape_attr(category)}" data-rank="{rank}">'
        )
        rewritten.append(new_open + body + "</g>")

    for layer_id, refs in refs_by_layer.items():
        for ref_id in refs:
            if ref_id in shared_ids:
                continue
            for other_id, private_ids in private_ids_by_layer.items():
                if other_id == layer_id:
                    continue
                if ref_id in private_ids:
                    warnings.append(
                        f"跨层引用违规: {layer_id} 引用了 {other_id} 私有声明的 #{ref_id}"
                    )

    # 悬空引用：不在本层私有、也不在共享 defs
    all_private = set()
    for s in private_ids_by_layer.values():
        all_private |= s
    defined = shared_ids | all_private | {m["id"] for m in manifest}
    for layer_id, refs in refs_by_layer.items():
        local = private_ids_by_layer[layer_id] | {layer_id} | shared_ids
        for ref_id in refs:
            if ref_id not in defined:
                warnings.append(f"悬空引用: {layer_id} -> #{ref_id}")
            elif ref_id not in local and ref_id not in shared_ids:
                # 引用了别的层的根 id（少见）也标一下
                if ref_id in {m["id"] for m in manifest if m["id"] != layer_id}:
                    warnings.append(f"跨层引用图层根节点: {layer_id} -> #{ref_id}")

    manifest_json = json.dumps({"version": "0.1", "layers": manifest}, ensure_ascii=False)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" id="character-svg" '
        f'width="{width}" height="{height}" viewBox="{view_box}" role="img">',
        f'<metadata id="layer-manifest">{manifest_json}</metadata>',
    ]
    if shared_defs:
        parts.append(shared_defs)
    parts.extend(rewritten)
    parts.append("</svg>")
    output = "\n".join(parts) + "\n"
    return output, warnings


def detect_and_convert(html: str) -> tuple[str, list, str]:
    if re.search(r'id="layerData"', html):
        out, warnings = convert_azure(html)
        return out, warnings, "azure/layerData"
    if re.search(r'id="layer-manifest"', html) or "art-layer" in html:
        out, warnings = convert_native(html)
        return out, warnings, "native/art-layer"
    raise RuntimeError("无法识别输入格式（需要 layerData 或 layer-manifest/art-layer）")


def main():
    ap = argparse.ArgumentParser(description="抽出内联 SVG 并转为契约格式")
    ap.add_argument("input_html")
    ap.add_argument("output_svg")
    ap.add_argument("--ref", help="抽出参考原图到该路径（后缀可按 mime 自动修正）")
    args = ap.parse_args()

    html = Path(args.input_html).read_text(encoding="utf-8")
    output, warnings, kind = detect_and_convert(html)
    out_path = Path(args.output_svg)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(output, encoding="utf-8")

    ref_out = None
    if args.ref:
        ref_out = extract_reference(html, Path(args.ref))

    print(f"识别格式: {kind}")
    print(f"输出文件: {out_path}（{len(output) / 1024 / 1024:.2f} MB）")
    print(f"警告数: {len(warnings)}")
    for w in warnings[:80]:
        print("  - " + w)
    if len(warnings) > 80:
        print(f"  ...还有 {len(warnings) - 80} 条")
    if ref_out:
        print(f"配对参考图: {ref_out}")


if __name__ == "__main__":
    main()
