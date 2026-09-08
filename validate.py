#!/usr/bin/env python3
"""验证 SVG 是否符合 loading/layer-contract.md。

用法：
    python3 validate.py path/to/character.svg

退出码：
    0  结构有效
    1  发现契约错误
    2  文件读取、XML 或 manifest JSON 解析失败
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


URL_REF_RE = re.compile(r"url\(\s*#([^) \t\r\n]+)\s*\)")
SLUG_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_.-]*$")


def local_name(name: str) -> str:
    return name.rsplit("}", 1)[-1]


def fail_parse(message: str) -> int:
    print(f"无法验证: {message}", file=sys.stderr)
    return 2


def validate(path: Path) -> tuple[list[str], list[str], dict[str, int]]:
    errors: list[str] = []
    warnings: list[str] = []

    try:
        root = ET.parse(path).getroot()
    except (OSError, ET.ParseError) as exc:
        raise ValueError(f"{path}: {exc}") from exc

    if local_name(root.tag) != "svg":
        errors.append("根节点必须是 <svg>")

    view_box = root.get("viewBox")
    if not view_box:
        errors.append("<svg> 缺少 viewBox")
    else:
        try:
            values = [float(v) for v in re.split(r"[\s,]+", view_box.strip())]
            if (
                len(values) != 4
                or not all(math.isfinite(v) for v in values)
                or values[2] <= 0
                or values[3] <= 0
            ):
                raise ValueError
        except ValueError:
            errors.append(f"viewBox 必须是 4 个有限数值且宽高大于 0: {view_box!r}")

    direct_children = list(root)
    manifests = [
        node
        for node in direct_children
        if local_name(node.tag) == "metadata"
        and node.get("id") == "layer-manifest"
    ]
    all_manifests = [
        node
        for node in root.iter()
        if local_name(node.tag) == "metadata"
        and node.get("id") == "layer-manifest"
    ]

    if len(all_manifests) != 1:
        errors.append(
            f"必须有且只有一份 <metadata id=\"layer-manifest\">，实际为 {len(all_manifests)}"
        )
    if all_manifests and not manifests:
        errors.append("layer-manifest 必须是 <svg> 的直接子节点")

    payload: object = {}
    manifest_layers: list[object] = []
    if len(all_manifests) == 1:
        text = (all_manifests[0].text or "").strip()
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError(
                f"layer-manifest 不是有效 JSON（第 {exc.lineno} 行第 {exc.colno} 列）"
            ) from exc

        if not isinstance(payload, dict):
            errors.append("layer-manifest JSON 必须是对象")
        else:
            if payload.get("version") != "0.1":
                errors.append("layer-manifest.version 必须是字符串 \"0.1\"")
            raw_layers = payload.get("layers")
            if not isinstance(raw_layers, list):
                errors.append("layer-manifest.layers 必须是数组")
            else:
                manifest_layers = raw_layers

    direct_groups = [
        node for node in direct_children if local_name(node.tag) == "g"
    ]

    manifest_by_id: dict[str, dict] = {}
    normalized_layers: list[dict] = []
    required = ("id", "name", "category", "rank")

    for index, item in enumerate(manifest_layers):
        where = f"manifest.layers[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{where} 必须是对象")
            continue

        missing = [field for field in required if field not in item]
        if missing:
            errors.append(f"{where} 缺少字段: {', '.join(missing)}")
            continue

        layer_id = item["id"]
        name = item["name"]
        category = item["category"]
        rank = item["rank"]

        if not isinstance(layer_id, str) or not SLUG_RE.fullmatch(layer_id):
            errors.append(
                f"{where}.id 必须是唯一英文 slug: {layer_id!r}"
            )
        if not isinstance(name, str) or not name.strip():
            errors.append(f"{where}.name 必须是非空字符串")
        if not isinstance(category, str) or not category.strip():
            errors.append(f"{where}.category 必须是非空字符串")
        if isinstance(rank, bool) or not isinstance(rank, int):
            errors.append(f"{where}.rank 必须是整数")
        elif rank != index:
            errors.append(
                f"{where}.rank 必须等于数组下标 {index}，实际为 {rank}"
            )

        if isinstance(layer_id, str):
            if layer_id in manifest_by_id:
                errors.append(f"manifest 图层 id 重复: {layer_id}")
            else:
                manifest_by_id[layer_id] = item
        normalized_layers.append(item)

    if len(direct_groups) != len(manifest_layers):
        errors.append(
            "manifest 图层数与 <svg> 直接子 <g> 数量不一致: "
            f"{len(manifest_layers)} != {len(direct_groups)}"
        )

    checked_count = min(len(direct_groups), len(manifest_layers))
    for index in range(checked_count):
        group = direct_groups[index]
        item = manifest_layers[index]
        if not isinstance(item, dict):
            continue

        group_id = group.get("id")
        expected_id = item.get("id")
        if group_id != expected_id:
            errors.append(
                f"第 {index} 层文档顺序不一致: manifest={expected_id!r}, <g>={group_id!r}"
            )

        mirrors = {
            "data-name": item.get("name"),
            "data-category": item.get("category"),
            "data-rank": str(item.get("rank")),
        }
        for attr, expected in mirrors.items():
            actual = group.get(attr)
            if actual != expected:
                errors.append(
                    f"图层 {expected_id!r} 的 {attr} 与 manifest 不一致: "
                    f"{actual!r} != {expected!r}"
                )

    # 全文 id 唯一性，同时记录每个 id 属于哪个顶层图层。
    id_owner: dict[str, str | None] = {}
    duplicate_ids: set[str] = set()
    element_owner: dict[int, str | None] = {}

    def walk(node: ET.Element, owner: str | None) -> None:
        element_owner[id(node)] = owner
        element_id = node.get("id")
        if element_id:
            if element_id in id_owner:
                duplicate_ids.add(element_id)
            else:
                id_owner[element_id] = owner
        for child in node:
            walk(child, owner)

    direct_group_ids = {id(node): node.get("id") for node in direct_groups}
    element_owner[id(root)] = None
    root_id = root.get("id")
    if root_id:
        id_owner[root_id] = None
    for child in direct_children:
        owner = direct_group_ids.get(id(child))
        walk(child, owner)

    for duplicate in sorted(duplicate_ids):
        errors.append(f"元素 id 重复: {duplicate}")

    # 检查 url(#id)、href="#id"、xlink:href="#id"。
    reference_count = 0
    for node in root.iter():
        source_owner = element_owner.get(id(node))
        refs: set[str] = set()
        for attr_name, value in node.attrib.items():
            refs.update(URL_REF_RE.findall(value))
            if local_name(attr_name) == "href" and value.startswith("#"):
                refs.add(value[1:])
        if local_name(node.tag) == "style" and node.text:
            refs.update(URL_REF_RE.findall(node.text))

        for target_id in refs:
            reference_count += 1
            if target_id not in id_owner:
                errors.append(
                    f"悬空引用: {source_owner or '<svg>'} -> #{target_id}"
                )
                continue
            target_owner = id_owner[target_id]
            if (
                source_owner is not None
                and target_owner is not None
                and source_owner != target_owner
            ):
                errors.append(
                    f"跨层私有资源引用: {source_owner} -> "
                    f"{target_owner} 内的 #{target_id}"
                )
            elif source_owner is None and target_owner is not None:
                errors.append(
                    f"全局内容引用了图层 {target_owner} 的私有资源 #{target_id}"
                )

    stats = {
        "layers": len(manifest_layers),
        "elements_with_id": len(id_owner),
        "references": reference_count,
        "warnings": len(warnings),
        "errors": len(errors),
    }
    return errors, warnings, stats


def main() -> int:
    parser = argparse.ArgumentParser(
        description="验证 SVG 是否符合 AstraLayering 图层契约"
    )
    parser.add_argument("svg", type=Path, help="待验证的 .svg 文件")
    parser.add_argument(
        "--json", action="store_true", help="以 JSON 输出验证结果"
    )
    args = parser.parse_args()

    try:
        errors, warnings, stats = validate(args.svg)
    except ValueError as exc:
        if args.json:
            print(
                json.dumps(
                    {"valid": False, "errors": [str(exc)], "warnings": []},
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 2
        return fail_parse(str(exc))

    if args.json:
        print(
            json.dumps(
                {
                    "valid": not errors,
                    "file": str(args.svg),
                    "stats": stats,
                    "errors": errors,
                    "warnings": warnings,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        status = "通过" if not errors else "失败"
        print(
            f"{status}: {args.svg} — {stats['layers']} 层，"
            f"{stats['elements_with_id']} 个 id，{stats['references']} 个引用"
        )
        for warning in warnings:
            print(f"警告: {warning}")
        for error in errors:
            print(f"错误: {error}", file=sys.stderr)

    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
