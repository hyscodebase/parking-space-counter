#!/usr/bin/env python3
"""Rebuild disposable RGB crops from packaged full frames and fixed annotation boxes."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("directory", type=Path, nargs="?", default=Path(__file__).parent / "improvements-data" / "fullframe-test")
args = parser.parse_args()
root = args.directory.resolve()
records = json.loads((root / "manifest.json").read_text())
count = 0
for frame in records:
    source = (root / frame["file"]).resolve()
    if root not in source.parents:
        raise ValueError("Frame path escapes dataset")
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != frame["image_sha256"]:
        raise ValueError(f"Image hash mismatch: {frame['file']}")
    with Image.open(source) as image:
        image = image.convert("RGB")
        if image.size != (frame["width"], frame["height"]):
            raise ValueError("Image dimensions mismatch")
        for roi in frame["rois"]:
            x, y, w, h = map(int, roi["bbox"])
            crop = image.crop((x, y, x+w, y+h)).resize((224, 224), Image.Resampling.BILINEAR)
            dest = (root / roi["rgb_file"]).resolve()
            if root not in dest.parents:
                raise ValueError("Crop path escapes dataset")
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(crop.tobytes())
            count += 1
print(f"Rebuilt {count} RGB crops from {len(records)} full-frame images")
