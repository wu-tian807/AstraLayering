#!/usr/bin/env python3
"""List SVG parts/resources and optionally compare element structure by stable ID."""
import argparse
from collections import Counter
import json
from pathlib import Path
import re
from svg_common import canvas, read_svg, sha256, tag, write_json


def inspect(path):
    root = read_svg(path)
    nodes = list(root.iter())
    ids = Counter(n.get("id") for n in nodes if n.get("id"))
    parents = {c: p for p in nodes for c in p}
    refs, external = set(), set()
    for n in nodes:
        values = list(n.attrib.values()) + ([n.text or ""] if tag(n) == "style" else [])
        for value in values:
            for url in re.findall(r"url\(\s*['\"]?([^)'\"\s]+)['\"]?\s*\)", value):
                (refs if url.startswith("#") else external).add(url[1:] if url.startswith("#") else url)
        for key, value in n.attrib.items():
            if key.rsplit("}", 1)[-1] == "href":
                (refs if value.startswith("#") else external).add(value[1:] if value.startswith("#") else value)
    size, vb = canvas(root)
    part_groups = [n for n in nodes if tag(n) == "g" and (n.get("data-part") or n.find("{*}title") is not None)]
    report = {
        "source": str(Path(path).resolve()), "sha256": sha256(path), "canvas": size, "viewBox": vb,
        "element_counts": dict(Counter(tag(n) for n in nodes)),
        "duplicate_ids": sorted(k for k, count in ids.items() if count > 1),
        "missing_local_references": sorted(refs - ids.keys()),
        "external_or_data_references": sorted(external),
        "image_elements": sum(tag(n) == "image" for n in nodes),
        "script_elements": sum(tag(n) == "script" for n in nodes),
        "groups": [{"id": n.get("id"), "part": n.get("data-part"),
                    "title": n.findtext("{*}title", ""), "role": n.get("data-role"),
                    "stage": n.get("data-stage")} for n in part_groups],
        "roles": dict(Counter(n.get("data-role") for n in nodes if n.get("data-role"))),
        "stages": dict(Counter(n.get("data-stage") for n in nodes if n.get("data-stage"))),
        "note": "Static XML inventory only; does not validate path geometry, visual quality, CSS cascade or hidden completeness."
    }

    def location(n):
        if n not in parents:
            return "/svg"
        parent = parents[n]
        anchor = "#" + parent.get("id") if parent.get("id") else location(parent)
        return anchor + "/" + str(list(parent).index(n))

    records = {n.get("id"): {"tag": tag(n), "attributes": dict(n.attrib),
                             "text": (n.text or "").strip(), "location": location(n)}
               for n in nodes if n.get("id")}
    return report, records


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("source")
    p.add_argument("--baseline", help="Earlier SVG to compare; changes are evidence, not automatic failures")
    p.add_argument("--output", help="Write report JSON; otherwise stdout")
    args = p.parse_args()
    try:
        report, current = inspect(args.source)
        if args.baseline:
            old_report, previous = inspect(args.baseline)
            if report["duplicate_ids"] or old_report["duplicate_ids"]:
                raise ValueError("Cannot compare by ID while either SVG has duplicate IDs")
            changes = []
            for key in sorted(current.keys() & previous.keys()):
                a, b = previous[key], current[key]
                attrs = {name: {"before": a["attributes"].get(name), "after": b["attributes"].get(name)}
                         for name in sorted(a["attributes"].keys() | b["attributes"].keys())
                         if a["attributes"].get(name) != b["attributes"].get(name)}
                others = {name: {"before": a[name], "after": b[name]}
                          for name in ("tag", "location", "text") if a[name] != b[name]}
                if attrs or others:
                    changes.append({"id": key, "attributes": attrs, **others})
            report["comparison"] = {
                "baseline": old_report["source"], "baseline_sha256": old_report["sha256"],
                "canvas_changed": report["canvas"] != old_report["canvas"] or report["viewBox"] != old_report["viewBox"],
                "added_ids": sorted(current.keys() - previous.keys()),
                "removed_ids": sorted(previous.keys() - current.keys()), "changed_elements": changes,
                "limitation": "ID-based comparison does not enumerate changes to unnamed nodes. Use rendered comparison too."
            }
        if args.output:
            write_json(args.output, report, [args.source] + ([args.baseline] if args.baseline else []))
            print(args.output)
        else:
            print(json.dumps(report, ensure_ascii=False, indent=2))
        return 1 if report["duplicate_ids"] or report["missing_local_references"] else 0
    except (ValueError, OSError) as exc:
        p.exit(2, f"Error: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
