"""Inventory the three named local models; optionally copy without overwriting.

Uses only the standard library. Original archives and legacy local-assets are
read-only. ZIP members are inspected and CRC-checked, never extracted or run.
"""
import argparse
import hashlib
import json
import shutil
import stat
import struct
import zlib
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from zipfile import ZipFile

REPO = Path(__file__).resolve().parents[3]
BASE = REPO / "tutorial/live2d-guidance"
DEST = BASE / "model-originals"
PACKAGES = [
    ("milly-lier", Path(r"C:\Users\22129\Downloads\归档.zip")),
    ("cherry-cake-angel", Path(r"C:\Users\22129\Downloads\Compressed\A樱桃蛋糕天使免费版.zip")),
]
MODELS = {
    "milly": {"package": "milly-lier", "author": "卡米雷特",
              "source_url": "https://www.bilibili.com/video/BV16o4y187yV",
              "license_status": "conditional; package forbids redistribution of every included file",
              "license_original": "米粒模型说明.txt"},
    "lier": {"package": "milly-lier", "author": None, "source_url": None,
             "license_status": "unknown; no independent license file found"},
    "cherry-cake-angel": {"package": "cherry-cake-angel", "author": None,
                          "source_url": None,
                          "license_status": "restricted/unclear; prior texture inspection recorded no upload without permission, no resale, purchaser-only use; free filename grants no redistribution right"},
}


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def kind(name):
    name = name.lower()
    if name.endswith((".psd", ".psb")):
        return "layered_art"
    if name.endswith((".cmo3", ".can3", ".cmox", ".canx")):
        return "editable_cubism"
    if name.endswith((".moc3", ".moc")):
        return "compiled_runtime"
    if name.endswith(".model3.json"):
        return "runtime_entry"
    if name.endswith((".txt", ".md")):
        return "author_document"
    return "runtime_support_or_art"


def central_names(path):
    # Python may already replace ZipInfo.filename with the Unicode Path field.
    # Retain central-directory raw bytes to independently verify that field.
    data = path.read_bytes()
    end = data.rfind(b"PK\x05\x06", max(0, len(data) - 65557))
    if end < 0:
        raise ValueError("Missing ZIP end record")
    count = struct.unpack_from("<H", data, end + 10)[0]
    pos = struct.unpack_from("<I", data, end + 16)[0]
    names = []
    for _ in range(count):
        if data[pos:pos + 4] != b"PK\x01\x02":
            raise ValueError("Invalid central-directory signature")
        name_len, extra_len, comment_len = struct.unpack_from("<HHH", data, pos + 28)
        names.append(data[pos + 46:pos + 46 + name_len])
        pos += 46 + name_len + extra_len + comment_len
    return names


def member_name(info, raw):
    # Info-ZIP Unicode Path must be tied to the original name by its CRC.
    extra, pos = info.extra, 0
    while pos + 4 <= len(extra):
        tag, length = struct.unpack_from("<HH", extra, pos)
        payload = extra[pos + 4:pos + 4 + length]
        if len(payload) != length:
            raise ValueError("Truncated ZIP extra field")
        if tag == 0x7075 and len(payload) >= 5 and payload[0] == 1:
            if struct.unpack_from("<I", payload, 1)[0] != zlib.crc32(raw):
                raise ValueError("Unicode Path checksum mismatch")
            return payload[5:].decode("utf-8"), "infozip-unicode-path"
        pos += 4 + length
    if info.flag_bits & 0x800:
        return info.filename, "utf-8"
    try:
        return raw.decode("utf-8"), "utf-8-unflagged"
    except UnicodeDecodeError:
        pass
    return raw.decode("cp437"), "cp437"


def inspect_package(package_id, path):
    entries, seen = [], set()
    with ZipFile(path) as archive:
        names = central_names(path)
        if len(names) != len(archive.infolist()):
            raise ValueError("Central-directory entry count mismatch")
        for info, raw in zip(archive.infolist(), names):
            name, encoding = member_name(info, raw)
            parts = PurePosixPath(name).parts
            if not parts or ".." in parts or name.startswith("/") or "\\" in name or ":" in name:
                raise ValueError(f"Unsafe ZIP path: {name}")
            if name.casefold() in seen:
                raise ValueError(f"Duplicate ZIP path: {name}")
            seen.add(name.casefold())
            if stat.S_ISLNK(info.external_attr >> 16) or info.flag_bits & 1:
                raise ValueError(f"Symlink/encrypted member: {name}")
            directory = info.is_dir()
            metadata = parts[0] == "__MACOSX" or parts[-1] == ".DS_Store" or parts[-1].startswith("._")
            h, crc, total = hashlib.sha256(), 0, 0
            if not directory:
                with archive.open(info) as f:
                    for block in iter(lambda: f.read(1024 * 1024), b""):
                        h.update(block)
                        crc = zlib.crc32(block, crc)
                        total += len(block)
                if total != info.file_size or crc != info.CRC:
                    raise ValueError(f"ZIP CRC/length mismatch: {name}")
            entries.append({"path": name, "bytes": info.file_size,
                            "compressed_bytes": info.compress_size,
                            "sha256": h.hexdigest() if not directory else None,
                            "crc32": f"{info.CRC:08x}", "crc_verified": not directory,
                            "name_encoding": encoding, "directory": directory,
                            "metadata_only": metadata, "type": kind(name)})
    useful = [e for e in entries if not e["directory"] and not e["metadata_only"]]
    return {"id": package_id, "source_path": str(path), "bytes": path.stat().st_size,
            "sha256": digest(path), "path": f"archives/{path.name}",
            "entry_count": len(entries), "useful_file_count": len(useful),
            "all_file_crc_verified": True, "types": dict(Counter(e["type"] for e in useful)),
            "entries": entries}


def copy_verified(source, destination, expected_hash):
    if source.is_symlink():
        raise ValueError(f"Refusing symlink source: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if digest(destination) != expected_hash:
            raise ValueError(f"Existing destination differs; no overwrite: {destination}")
    else:
        shutil.copy2(source, destination)
    if digest(destination) != expected_hash or destination.stat().st_size != source.stat().st_size:
        raise ValueError(f"Copy mismatch: {destination}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--copy", action="store_true", help="copy verified bytes and write manifest")
    args = parser.parse_args()
    packages = [inspect_package(pid, path) for pid, path in PACKAGES]
    by_package = {p["id"]: p for p in packages}
    files, models, hashes = [], [], defaultdict(list)
    old = json.loads((BASE / "local-assets/local-copy-manifest.json").read_text(encoding="utf-8-sig"))
    old_hashes = {item["path"]: item["sha256"] for item in old}
    old_verified = 0
    for model_id, details in MODELS.items():
        source = BASE / "local-assets" / model_id
        members = by_package[details["package"]]["entries"]
        model_files = []
        for path in sorted(source.rglob("*")):
            if path.is_symlink():
                raise ValueError(f"Symlink in legacy assets: {path}")
            if not path.is_file():
                continue
            relative = path.relative_to(source).as_posix()
            sha256 = digest(path)
            old_key = f"local-assets/{model_id}/{relative}"
            if old_key in old_hashes:
                if old_hashes[old_key] != sha256:
                    raise ValueError(f"Prior manifest hash mismatch: {path}")
                old_verified += 1
            matching = [e for e in members if not e["directory"] and not e["metadata_only"]
                        and e["sha256"] == sha256 and e["bytes"] == path.stat().st_size]
            if len(matching) != 1 or not matching[0]["path"].endswith("/" + relative):
                raise ValueError(f"Cannot uniquely match ZIP member: {path}")
            record = {"model": model_id, "path": f"{model_id}/{relative}",
                      "source_path": str(path), "bytes": path.stat().st_size,
                      "sha256": sha256, "type": kind(relative),
                      "package": details["package"], "zip_member": matching[0]["path"]}
            files.append(record)
            model_files.append(record)
            hashes[sha256].append(record["path"])
        counts = dict(Counter(f["type"] for f in model_files))
        models.append({"id": model_id, **details, "file_count": len(model_files),
                       "bytes": sum(f["bytes"] for f in model_files), "types": counts,
                       "has_layered_art": counts.get("layered_art", 0) > 0,
                       "has_editable_cubism": counts.get("editable_cubism", 0) > 0,
                       "has_compiled_runtime": counts.get("compiled_runtime", 0) > 0,
                       "redistribution_allowed": False})
    if len(files) != sum(p["useful_file_count"] for p in packages) or old_verified != len(old):
        raise ValueError("Package or prior-manifest coverage incomplete")
    if args.copy:
        for p in packages:
            copy_verified(Path(p["source_path"]), DEST / p["path"], p["sha256"])
        for f in files:
            copy_verified(Path(f["source_path"]), DEST / f["path"], f["sha256"])
    pending_path = Path(r"C:\Users\22129\Downloads\natori_arm_research_2026-10-02_publication.zip")
    manifest = {"schema_version": 1, "verified_at_utc": datetime.now(timezone.utc).isoformat(),
                "scope": "only the two named Downloads ZIPs and three legacy local-assets model directories",
                "local_root": str(DEST), "copied_and_hash_verified": args.copy,
                "copy_policy": "copy only; preserve sources; identical destinations reused; conflicting destinations refused",
                "git_policy": "all payloads ignored; only readme.md and manifest.json allowed",
                "packages": packages, "models": models, "files": files,
                "deduplication": {"legacy_and_archive_hash_matches": len(files),
                                  "prior_manifest_files_verified": old_verified,
                                  "unique_asset_hashes": len(hashes),
                                  "duplicate_asset_groups": [v for v in hashes.values() if len(v) > 1],
                                  "policy": "one extracted copy per model in the canonical folder; original ZIPs retained separately"},
                "totals": {"archives": len(packages), "asset_files": len(files),
                           "archive_bytes": sum(p["bytes"] for p in packages),
                           "asset_bytes": sum(f["bytes"] for f in files)},
                "pending": [{"id": "natori-arm-2026-10-02", "checked_path": str(pending_path),
                             "present": pending_path.is_file(), "status": "not found at the named local path"},
                            {"id": "official-models-and-oct1-8-reports",
                             "status": "five Library bundle IDs received, not imported locally; supported download returned HTTP 403; see readme.md"}]}
    if args.copy:
        target = DEST / "manifest.json"
        target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"copied": args.copy, "totals": manifest["totals"],
                      "models": [{"id": m["id"], "files": m["file_count"], "types": m["types"]} for m in models],
                      "deduplication": manifest["deduplication"],
                      "archives": [{"path": p["path"], "sha256": p["sha256"], "entries": p["entry_count"]} for p in packages]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
