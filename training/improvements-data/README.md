---
language:
- en

license: cc-by-4.0

pretty_name: PKLot Parking Space Occupancy Detection Dataset

task_categories:
- object-detection

tags:
- object-detection
- parking
- parking-occupancy
- smart-city
- surveillance
- computer-vision
- ultralytics
- yolo

size_categories:
- 10K<n<100K

configs:
- config_name: default
  data_files:
  - split: train
    path: data/images/train/metadata.jsonl
  - split: validation
    path: data/images/valid/metadata.jsonl
  - split: test
    path: data/images/test/metadata.jsonl
---

<h1 align="center">PKLot: Parking Space Occupancy Detection Dataset</h1>

<p align="center">
  <img src="pklot_banner.jpg" alt="PKLot Dataset Banner"/>
</p>

![Task](https://img.shields.io/badge/Task-Object%20Detection-blue?style=flat-square)
![Dataset](https://img.shields.io/badge/Dataset-PKLot-0aa1a7?style=flat-square)
![Format](https://img.shields.io/badge/Format-YOLO%20Compatible-orange?style=flat-square)
![Classes](https://img.shields.io/badge/Classes-2-success?style=flat-square)
![Splits](https://img.shields.io/badge/Splits-Train%20%7C%20Val%20%7C%20Test-blueviolet?style=flat-square)
![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey?style=flat-square)

> **Unofficial redistribution of the PKLot parking-lot database, reformatted into a standardized YOLO-compatible detection layout, under the original CC BY 4.0 license.**

## Dataset Description

- **Homepage:** https://web.inf.ufpr.br/vri/databases/parking-lot-database/
- **Paper:** https://doi.org/10.1016/j.eswa.2015.02.009

## Disclaimer

This repository is **not** an official release of the PKLot dataset.

PKLot was created by Paulo R. L. de Almeida, Luiz S. Oliveira, Alceu S. Britto Jr, Eunelson J. Silva Jr, and Alessandro L. Koerich, and is distributed by the Vision, Robotics and Imaging laboratory (UFPR). The original authors retain all copyright and intellectual property rights (to the extent applicable under the dataset's CC BY 4.0 license — see [License](#license) below). This repository does **not** claim ownership of any images, annotations, or metadata.

This repository exists for two purposes:

1. To reorganize the dataset into a standardized YOLO/Ultralytics-compatible detection layout with explicit train/validation/test splits (the official release has none).
2. To provide a lighter download source: the official archive is about 4.9 GB because it also contains ~695k pre-cropped single-space patches, which are not needed for detection and are not included here.

This redistribution is sourced directly from the official `PKLot.tar.gz` published by the laboratory, not from a third-party mirror.

**Framing caveat.** PKLot's own task is *per-space classification*: parking-space locations are fixed per camera and a model only decides occupied or vacant. This repository instead exposes every labelled space as a bounding box, so a detector must localise *and* classify it. Because each of the three cameras never moves, spaces sit at near-identical pixel positions in every frame and a detector can partly memorise locations. Scores on this repository are **not comparable** to free-form car detection or to the per-space classification results in the literature.

---

# Dataset Overview

PKLot contains 12,417 full-resolution (1280x720) frames captured from three fixed cameras overlooking two parking lots, under sunny, cloudy, and rainy conditions, over many days. One lot is imaged from two different angles, giving three camera views: `PUCPR`, `UFPR04`, and `UFPR05`. Every frame has an XML descriptor marking each parking space and whether it is occupied.

---

# Changes from the Official Release

- **Full-frame images only.** The official archive's `PKLotSegmented` tree (per-space classification crops) is not included.
- **Annotation format converted.** The official ground truth is per-frame XML listing each space as a rotated rectangle plus a 4-point contour, with an `occupied` flag. Each space's box here is the **axis-aligned bounding box of its contour polygon**, clipped to the frame, exported as YOLO `class x_center y_center width height` (normalized) and as absolute-pixel COCO `[x, y, w, h]` in `metadata.jsonl`. Class `0` is `vacant` and class `1` is `occupied`, matching the XML's own `occupied="0"/"1"` values.
- **A subset of boxes use a different geometry source.** 7,671 labelled spaces (1.1% of all boxes, all in `UFPR04`) have no contour in the official XML, only a rotated rectangle. For those, the box is the axis-aligned extent of the rotated rectangle. Where both exist the two agree on average (mean IoU about 0.85), but the rotated-rectangle box is looser, so those `UFPR04` boxes are slightly less tight than the rest.
- **Unlabelled spaces were dropped, not guessed.** 25,773 spaces in the XML carry no `occupied` attribute. They have no class, so they are not annotated here and remain in the image as unlabelled background. The remaining **693,755** labelled spaces are all kept. (The official page cites "around 695,900" space patches for the segmented variant; the labelled-space count in the XML descriptors is 693,755.)
- **One frame was skipped.** `PUCPR/Sunny/2012-11-06/2012-11-06_18_48_46.jpg` has no XML descriptor, so its labels are unknown. This leaves 12,416 images.
- **Train/validation/test splits were created here.** The official release has no split. Frames are time-lapse captures from fixed cameras, so a random image split would place near-duplicate frames on both sides. Whole **(camera, capture day)** groups are instead assigned to a split, per camera, with a seeded shuffle, targeting about 70/15/15 by image count. No capture day appears in more than one split. Capture day is taken from the **filename timestamp**: 198 frames (145 in `PUCPR`, 53 in `UFPR05`) sit in a folder whose date differs from their filename timestamp.
- **File names were flattened and prefixed with the camera name** (e.g. `PUCPR_2012-09-11_15_16_58.jpg`) so they are unique across cameras. The upstream `weather/date` folder hierarchy is not preserved, so the weather label is not recoverable from this repository's layout alone.
- No image pixel content was modified.

Because every camera appears in every split, results measure generalisation to **unseen days on seen cameras**, not to new parking lots.

---

# Dataset Structure

```text
<repo>/
├── README.md
├── pklot_banner.jpg
└── data/
    ├── data.yaml
    ├── images/
    │   ├── train/   (*.jpg + metadata.jsonl)
    │   ├── valid/   (*.jpg + metadata.jsonl)
    │   └── test/    (*.jpg + metadata.jsonl)
    └── labels/
        ├── train/   (*.txt, mirrors images)
        ├── valid/
        └── test/
```

where:

* `data/images/<split>/` contains the 1280x720 RGB frames, plus a `metadata.jsonl` (`file_name` and `objects.bbox` as absolute-pixel COCO `[x, y, w, h]` with `objects.categories`) that drives the Hugging Face dataset viewer.
* `data/labels/<split>/` contains one YOLO-format `.txt` annotation file per image (`class x_center y_center width height`, normalized), mirroring the image layout.
* `data/data.yaml` is the Ultralytics dataset configuration file (class names, split paths, relative to `data/`).
* Splits (as verified in this repository): **train** 8,346 images / 466,306 boxes &middot; **valid** 1,981 images / 104,014 boxes &middot; **test** 2,089 images / 123,435 boxes (12,416 images / 693,755 boxes total).

### Split composition

| Split | Days | PUCPR | UFPR04 | UFPR05 | Sunny | Cloudy | Rainy |
|-------|------|-------|--------|--------|-------|--------|-------|
| train | 69   | 2,983 | 2,589  | 2,774  | 4,775 | 2,725  | 846   |
| valid | 15   | 705   | 617    | 659    | 829   | 760    | 392   |
| test  | 16   | 785   | 585    | 719    | 1,308 | 677    | 104   |

(Image counts. Weather is from the upstream folder each frame came from.) All three cameras and all three weather conditions appear in every split, but **rainy frames are scarce in the test split** (104 images), so per-condition conclusions there rest on little data.

### Classes (2)

| id | class name | instances (all splits) | share |
|----|------------|------------------------|-------|
| 0  | `vacant`   | 357,978                | 51.6% |
| 1  | `occupied` | 335,777                | 48.4% |

The classes are close to balanced. Frames are dense: on average about 56 labelled spaces per image (median 40, max 100), and boxes are small (median about 0.35% of image area).

---

# Dataset Sources

## Original Paper

**PKLot – A robust dataset for parking lot classification**

Paulo R. L. de Almeida, Luiz S. Oliveira, Alceu S. Britto Jr, Eunelson J. Silva Jr, Alessandro L. Koerich

Expert Systems with Applications, 42(11), 4937-4949, 2015. DOI: [10.1016/j.eswa.2015.02.009](https://doi.org/10.1016/j.eswa.2015.02.009)

## Official Resources

- **Official Database Page:** https://web.inf.ufpr.br/vri/databases/parking-lot-database/

---

# Attribution

**All credit for collecting and annotating this dataset belongs entirely to the original PKLot authors: Paulo R. L. de Almeida, Luiz S. Oliveira, Alceu S. Britto Jr, Eunelson J. Silva Jr, and Alessandro L. Koerich.**

This repository only reformats their annotations into a detection layout and adds train/validation/test splits, for improved usability. It does not modify, reinterpret, or take credit for the underlying imagery or annotations.

If you use this dataset in your research, **please cite the original publication below.** The official page asks that users acknowledge the source by citing this paper.

---

# License

PKLot is released by its creators under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license, as stated on the [official database page](https://web.inf.ufpr.br/vri/databases/parking-lot-database/) and in the `licence` file inside the official archive.

Accordingly:

- Attribution to the original authors is required.
- Commercial and non-commercial use are both permitted.
- No share-alike obligation (derivative works are not required to use the same license).

This repository is distributed under the same CC BY 4.0 license.

---

# Citation

If you use this dataset, please cite:

```bibtex
@article{almeida2015pklot,
  title={PKLot -- A robust dataset for parking lot classification},
  author={de Almeida, Paulo R. L. and Oliveira, Luiz S. and Britto Jr, Alceu S. and Silva Jr, Eunelson J. and Koerich, Alessandro L.},
  journal={Expert Systems with Applications},
  volume={42},
  number={11},
  pages={4937--4949},
  year={2015},
  doi={10.1016/j.eswa.2015.02.009}
}
```

---

# Acknowledgements

We sincerely thank Paulo R. L. de Almeida, Luiz S. Oliveira, Alceu S. Britto Jr, Eunelson J. Silva Jr, Alessandro L. Koerich, and the UFPR Vision, Robotics and Imaging laboratory for creating and publicly releasing this valuable parking-occupancy benchmark.
