#!/usr/bin/env python3
"""Crop fixed-camera parking spaces and split by complete capture dates.

This script deliberately does not download data or infer labels. A human-reviewed
CSV connects source images, their labels, and the selected pixel rectangles.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
from collections import Counter
from datetime import date
from pathlib import Path

from PIL import Image, ImageOps

LABELS = {"empty": "empty", "occupied": "occupied", "빈자리": "empty", "사용 중": "occupied"}
NIGHT = {"night", "야간", "dusk", "twilight", "새벽", "황혼"}
REQUIRED = {"image", "slot_id", "label", "date", "x", "y", "width", "height"}


def read_manifest(manifest: Path, image_root: Path):
    """Validate the entire input before writing any image output."""
    root = image_root.resolve(strict=True)
    records, seen, image_dates = [], set(), {}
    skipped_night = 0
    assumed_daylight = 0
    sizes = {}
    with manifest.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing manifest columns: {', '.join(sorted(missing))}")
        for line, raw in enumerate(reader, 2):
            row = {k: (v or "").strip() for k, v in raw.items() if k is not None}
            lighting = row.get("lighting", "").casefold()
            if lighting in NIGHT:
                skipped_night += 1
                continue
            if not lighting:
                assumed_daylight += 1
            try:
                label = LABELS[row["label"].casefold()]
            except KeyError as exc:
                raise ValueError(f"Line {line}: label must be empty/occupied or 빈자리/사용 중") from exc
            try:
                captured = date.fromisoformat(row["date"]).isoformat()
                if captured != row["date"]:
                    raise ValueError("Date must use ISO hyphens")
            except ValueError as exc:
                raise ValueError(f"Line {line}: date must be YYYY-MM-DD") from exc
            if not row["image"] or not row["slot_id"]:
                raise ValueError(f"Line {line}: image and slot_id are required")
            path = (root / row["image"]).resolve(strict=True)
            if not path.is_relative_to(root) or not path.is_file():
                raise ValueError(f"Line {line}: image must be a file inside image-root")
            if path in image_dates and image_dates[path] != captured:
                raise ValueError(f"Line {line}: one source image cannot have conflicting dates")
            image_dates[path] = captured
            key = (str(path), row["slot_id"])
            if key in seen:
                raise ValueError(f"Line {line}: duplicate image/slot_id")
            seen.add(key)
            try:
                x, y, width, height = [int(row[k]) for k in ("x", "y", "width", "height")]
            except ValueError as exc:
                raise ValueError(f"Line {line}: crop coordinates must be integer pixels") from exc
            if min(x, y) < 0 or min(width, height) <= 0:
                raise ValueError(f"Line {line}: crop must have nonnegative x/y and positive width/height")
            if path not in sizes:
                with Image.open(path) as image:
                    sizes[path] = ImageOps.exif_transpose(image).size
            image_width, image_height = sizes[path]
            if x + width > image_width or y + height > image_height:
                raise ValueError(f"Line {line}: crop extends beyond the image ({image_width}x{image_height})")
            records.append({
                "path": path, "image": path.relative_to(root).as_posix(),
                "slot_id": row["slot_id"], "label": label, "date": captured,
                "sequence": row.get("sequence", ""), "lighting": lighting or "assumed_day",
                "x": x, "y": y, "width": width, "height": height,
            })
    if not records:
        raise ValueError("No daytime records remain after filtering")
    if set(r["label"] for r in records) != {"empty", "occupied"}:
        raise ValueError("Both empty and occupied labels are required")
    # A sequence can span midnight: merge its dates before splitting.
    return records, skipped_night, assumed_daylight


def assign_splits(records, seed=42, validation_ratio=0.15, test_ratio=0.15):
    if not (0 < validation_ratio < 1 and 0 < test_ratio < 1 and validation_ratio + test_ratio < 1):
        raise ValueError("Validation and test ratios must be positive and sum to less than 1")
    dates = sorted({r["date"] for r in records})
    parent = {d: d for d in dates}

    def find(d):
        while parent[d] != d:
            parent[d] = parent[parent[d]]
            d = parent[d]
        return d

    sequences = {}
    for row in records:
        if row["sequence"]:
            previous = sequences.setdefault(row["sequence"], row["date"])
            parent[find(row["date"])] = find(previous)
    groups = sorted({find(d) for d in dates})
    if len(groups) < 3:
        raise ValueError("Need at least 3 independent date/sequence groups for train/validation/test")
    random.Random(seed).shuffle(groups)
    n_test = max(1, round(len(groups) * test_ratio))
    n_validation = max(1, round(len(groups) * validation_ratio))
    while n_test + n_validation >= len(groups):
        if n_test >= n_validation and n_test > 1:
            n_test -= 1
        elif n_validation > 1:
            n_validation -= 1
        else:
            raise ValueError("Not enough independent groups")
    mapping = {}
    for index, group in enumerate(groups):
        mapping[group] = "test" if index < n_test else "validation" if index < n_test + n_validation else "train"
    return {d: mapping[find(d)] for d in dates}


def prepare(manifest, image_root, output, seed=42, validation_ratio=0.15, test_ratio=0.15, size=224):
    manifest, image_root, output = Path(manifest), Path(image_root), Path(output)
    root, destination = image_root.resolve(), output.resolve()
    if destination == root or destination.is_relative_to(root) or root.is_relative_to(destination):
        raise ValueError("Output must be separate from image-root, with neither containing the other")
    if destination.exists() and (not destination.is_dir() or any(destination.iterdir())):
        raise ValueError("Output already exists and is not empty; use a new output directory")
    if not 32 <= size <= 2048:
        raise ValueError("Image size must be between 32 and 2048 pixels")
    records, skipped, assumed = read_manifest(manifest, image_root)
    splits = assign_splits(records, seed, validation_ratio, test_ratio)
    counts = {split: Counter() for split in ("train", "validation", "test")}
    for row in records:
        counts[splits[row["date"]]][row["label"]] += 1
    if set(counts["train"]) != {"empty", "occupied"}:
        raise ValueError("Training split is missing a class; collect varied dates or choose another seed")
    for split in counts:
        for label in ("empty", "occupied"):
            (destination / split / label).mkdir(parents=True, exist_ok=True)
    output_rows = []
    for row in records:
        split = splits[row["date"]]
        digest = hashlib.sha256(f"{row['image']}\0{row['slot_id']}".encode()).hexdigest()[:20]
        relative = Path(split) / row["label"] / f"{digest}.jpg"
        with Image.open(row["path"]) as original:
            image = ImageOps.exif_transpose(original).convert("RGB")
            x, y, width, height = (row[k] for k in ("x", "y", "width", "height"))
            # Matches browser cropRegion: rectangular ROI is resized to a square.
            image.crop((x, y, x + width, y + height)).resize((size, size), Image.Resampling.LANCZOS).save(destination / relative, quality=95)
        output_rows.append({**{k: v for k, v in row.items() if k != "path"}, "split": split, "crop": relative.as_posix()})
    with (destination / "manifest.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(output_rows[0]))
        writer.writeheader()
        writer.writerows(output_rows)
    warnings = []
    for label in ("empty", "occupied"):
        if counts["train"][label] < 150:
            warnings.append(f"train/{label}: {counts['train'][label]} images; proposal target is at least 150")
    for split in ("validation", "test"):
        if len(counts[split]) < 2:
            warnings.append(f"{split} is missing a class; class-specific evaluation will be incomplete")
    if assumed:
        warnings.append(f"{assumed} rows omitted lighting; manually verify all are daytime")
    report = {
        "seed": seed, "image_size": size, "split_unit": "date, joined across shared sequence IDs",
        "date_split": splits, "counts": {split: dict(count) for split, count in counts.items()},
        "excluded_night_crops": skipped, "total_crops": len(records), "warnings": warnings,
        "note": "No augmentation, oversampling, model training or test accuracy is claimed by this preparation step.",
    }
    (destination / "summary.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--image-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--validation-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--size", type=int, default=224)
    args = parser.parse_args()
    try:
        result = prepare(**vars(args))
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Error: {exc}\n")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
