#!/usr/bin/env python3
"""Read/write flat workflow options using only the Python 3 standard library."""

import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import time


def valid_name(name):
    return isinstance(name, str) and re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", name)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate option: " + key)
        result[key] = value
    return result


def read_options(path):
    with path.open(encoding="utf-8-sig") as source:
        options = json.load(source, object_pairs_hook=unique_object)
    if not isinstance(options, dict):
        raise ValueError("options.json must contain a flat object.")
    for key, value in options.items():
        if not valid_name(key) or type(value) not in (bool, int, str):
            raise ValueError("Options require valid names and boolean, integer or string values.")
    return options


def parse_value(raw, value_type):
    if value_type == "boolean":
        if raw not in ("true", "false"):
            raise ValueError("Boolean values must be true or false.")
        return raw == "true"
    if value_type == "integer":
        if not re.fullmatch(r"-?[0-9]+", raw):
            raise ValueError("Invalid integer value.")
        return int(raw)
    return raw


@contextmanager
def write_lock(root):
    lock = root / ".options.json.lock"
    deadline = time.monotonic() + 10
    while True:
        try:
            descriptor = os.open(str(lock), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            break
        except FileExistsError:
            if time.monotonic() >= deadline:
                raise ValueError("Cannot acquire .options.json.lock; check active writers.")
            time.sleep(0.1)
    try:
        os.close(descriptor)
        yield
    finally:
        lock.unlink()


def write_options(path, options):
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", newline="\n", dir=str(path.parent),
            prefix=".options-", suffix=".json", delete=False
        ) as target:
            temporary = Path(target.name)
            json.dump(options, target, ensure_ascii=False, indent=2, allow_nan=False)
            target.write("\n")
            target.flush()
            os.fsync(target.fileno())
        os.replace(str(temporary), str(path))
        temporary = None
    finally:
        if temporary is not None:
            temporary.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("set", "get"):
        sub = commands.add_parser(command)
        sub.add_argument("--work-root", required=True, type=Path)
        sub.add_argument("name")
        if command == "set":
            sub.add_argument("value")
            sub.add_argument("--type", choices=("boolean", "integer", "string"), default="boolean")
    args = parser.parse_args()
    if not args.work_root.is_absolute():
        parser.error("--work-root must be an absolute path.")
    if not valid_name(args.name):
        parser.error("Invalid option name.")

    path = args.work_root / "options.json"
    if args.command == "get":
        options = read_options(path)
        if args.name not in options:
            raise ValueError("Option is not set: " + args.name)
        value = options[args.name]
    else:
        value = parse_value(args.value, args.type)
        args.work_root.mkdir(parents=True, exist_ok=True)
        with write_lock(args.work_root):
            options = read_options(path) if path.exists() else {}
            options[args.name] = value
            write_options(path, options)
    print(json.dumps({args.name: value}, ensure_ascii=True))


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
