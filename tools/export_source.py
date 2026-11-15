#!/usr/bin/env python3
"""Export project source files into one readable text file."""

import argparse
import os
from pathlib import Path


SOURCE_SUFFIXES = {
    ".bat",
    ".c",
    ".cc",
    ".cmd",
    ".cpp",
    ".css",
    ".h",
    ".hh",
    ".hpp",
    ".html",
    ".js",
    ".json",
    ".mjs",
    ".py",
    ".sh",
    ".ts",
    ".tsx",
    ".xml",
    ".yaml",
    ".yml",
}
IGNORED_DIRS = {
    ".git",
    ".npm",
    "__pycache__",
    "build",
    "cache",
    "dist",
    "node_modules",
}
IGNORED_FILES = {
    "package-lock.json",
    "qrcode.min.js",
}
ROOT_SOURCE_FILES = {"Dockerfile", "Makefile"}


def is_source_file(path):
    return (
        path.name not in IGNORED_FILES
        and (path.suffix.lower() in SOURCE_SUFFIXES or path.name in ROOT_SOURCE_FILES)
    )


def source_files(root, output):
    output = output.resolve()
    for current, dirs, filenames in os.walk(root):
        dirs[:] = sorted(name for name in dirs if name not in IGNORED_DIRS)
        for filename in sorted(filenames):
            path = Path(current) / filename
            if path.resolve() != output and is_source_file(path):
                yield path


def main():
    root = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(
        description="Combine project source files into one text file."
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=root / "SunPlay_source.txt",
        help="output file (default: SunPlay_source.txt in the project root)",
    )
    args = parser.parse_args()
    output = args.output if args.output.is_absolute() else root / args.output
    output.parent.mkdir(parents=True, exist_ok=True)

    files = list(source_files(root, output))
    with output.open("w", encoding="utf-8", newline="\n") as bundle:
        for index, path in enumerate(files):
            if index:
                bundle.write("\n------------------\n")
            bundle.write(f"{path.relative_to(root).as_posix()}\n")
            bundle.write("-----------\n")
            content = path.read_text(encoding="utf-8", errors="replace")
            bundle.write(content)
            if not content.endswith("\n"):
                bundle.write("\n")

    print(f"Exported {len(files)} source files to {output}")


if __name__ == "__main__":
    main()
