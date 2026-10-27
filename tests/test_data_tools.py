"""Small synthetic images test data handling; none measure AI accuracy."""
import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def load_module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


preparation = load_module("prepare_dataset")
evaluation = load_module("evaluate")


class DataToolsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name)
        self.raw = self.base / "raw"
        self.raw.mkdir()
        self.rows = []
        for day in range(1, 7):
            name = f"day{day}.jpg"
            Image.new("RGB", (100, 60), (day * 30, 100, 50)).save(self.raw / name)
            for number, label in enumerate(("empty", "occupied"), 1):
                self.rows.append({"image": name, "slot_id": f"A{number}", "label": label, "date": f"2026-10-{day:02}", "sequence": f"sequence{day}", "x": (number - 1) * 40, "y": 5, "width": 30, "height": 40, "lighting": "day"})
        self.manifest = self.base / "input.csv"

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self):
        with self.manifest.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=self.rows[0].keys())
            writer.writeheader()
            writer.writerows(self.rows)

    def test_splits_are_date_grouped_reproducible_and_all_classes_preserved(self):
        self.write_manifest()
        output = self.base / "prepared"
        summary = preparation.prepare(self.manifest, self.raw, output)
        self.assertEqual(summary["total_crops"], 12)
        with (output / "manifest.csv").open() as handle:
            result = list(csv.DictReader(handle))
        by_date = {}
        for row in result:
            by_date.setdefault(row["date"], set()).add(row["split"])
            with Image.open(output / row["crop"]) as image:
                self.assertEqual(image.size, (224, 224))
        self.assertTrue(all(len(splits) == 1 for splits in by_date.values()))
        self.assertEqual(set(summary["date_split"].values()), {"train", "validation", "test"})
        other = preparation.prepare(self.manifest, self.raw, self.base / "other")
        self.assertEqual(summary["date_split"], other["date_split"])

    def test_sequences_spanning_dates_never_leak(self):
        for row in self.rows:
            if row["date"] in ("2026-10-01", "2026-10-02"):
                row["sequence"] = "overnight-continuous-sequence"
        self.write_manifest()
        summary = preparation.prepare(self.manifest, self.raw, self.base / "prepared")
        self.assertEqual(summary["date_split"]["2026-10-01"], summary["date_split"]["2026-10-02"])

    def test_night_is_excluded(self):
        self.rows[-1]["lighting"] = "night"
        self.write_manifest()
        summary = preparation.prepare(self.manifest, self.raw, self.base / "prepared")
        self.assertEqual(summary["excluded_night_crops"], 1)
        self.assertEqual(summary["total_crops"], 11)

    def test_out_of_bounds_rejected_before_output_created(self):
        self.rows[-1]["width"] = 200
        self.write_manifest()
        output = self.base / "prepared"
        with self.assertRaisesRegex(ValueError, "beyond"):
            preparation.prepare(self.manifest, self.raw, output)
        self.assertFalse(output.exists())

    def test_source_escape_rejected(self):
        Image.new("RGB", (100, 100)).save(self.base / "outside.jpg")
        self.rows[0]["image"] = "../outside.jpg"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "inside"):
            preparation.prepare(self.manifest, self.raw, self.base / "prepared")

    def test_output_overwrite_rejected(self):
        self.write_manifest()
        output = self.base / "prepared"
        output.mkdir()
        (output / "keep.txt").write_text("keep me")
        with self.assertRaisesRegex(ValueError, "not empty"):
            preparation.prepare(self.manifest, self.raw, output)
        self.assertEqual((output / "keep.txt").read_text(), "keep me")

    def test_two_independent_dates_are_insufficient(self):
        self.rows = self.rows[:4]
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "at least 3"):
            preparation.prepare(self.manifest, self.raw, self.base / "prepared")

    def test_duplicate_image_slot_is_rejected(self):
        self.rows.append(dict(self.rows[0]))
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "duplicate"):
            preparation.prepare(self.manifest, self.raw, self.base / "prepared")

    def test_same_image_cannot_leak_via_conflicting_dates(self):
        self.rows[1]["date"] = "2026-10-06"
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "conflicting dates"):
            preparation.prepare(self.manifest, self.raw, self.base / "prepared")

    def test_evaluation_uncertainty_false_empty_and_frame_counts(self):
        rows = [
            {"frame_id": "f1", "slot_id": "A1", "truth": "empty", "status": "empty", "source": "model"},
            {"frame_id": "f1", "slot_id": "A2", "truth": "occupied", "status": "empty", "source": "model"},
            {"frame_id": "f1", "slot_id": "A3", "truth": "empty", "status": "uncertain", "source": "model"},
            {"frame_id": "f1", "slot_id": "A4", "truth": "occupied", "status": "occupied", "source": "model"},
            {"frame_id": "f2", "slot_id": "A1", "truth": "occupied", "status": "occupied", "source": "model"},
            {"frame_id": "demo", "slot_id": "A1", "truth": "empty", "status": "empty", "source": "demo"},
            {"frame_id": "f2", "slot_id": "A2", "truth": None, "status": "occupied", "source": "model"},
        ]
        result = evaluation.evaluate(rows)
        self.assertAlmostEqual(result["accuracy_all_slots"], 3 / 5)
        self.assertAlmostEqual(result["accuracy_decided_slots"], 3 / 4)
        self.assertAlmostEqual(result["coverage"], 4 / 5)
        self.assertAlmostEqual(result["false_empty_rate_among_occupied"], 1 / 3)
        self.assertEqual(result["complete_frames"], 1)
        self.assertEqual(result["incomplete_frames"], 1)
        # Count can match by cancellation even with wrong individual predictions.
        self.assertEqual(result["empty_count_exact_match_rate"], 1)
        self.assertEqual(result["excluded_records"], {"demo": 1, "missing_truth": 1})

    def test_all_uncertain_has_no_decided_accuracy(self):
        result = evaluation.evaluate([{"frame_id": "f1", "slot_id": "A1", "truth": "occupied", "status": "uncertain", "source": "model"}])
        self.assertIsNone(result["accuracy_decided_slots"])
        self.assertEqual(result["coverage"], 0)
        self.assertIsNone(result["empty_count_exact_match_rate"])

    def test_demo_only_cannot_claim_accuracy(self):
        with self.assertRaisesRegex(ValueError, "Demo"):
            evaluation.evaluate([{"source": "demo", "truth": "empty", "status": "empty"}])

    def test_duplicate_frame_slot_rejected(self):
        row = {"frame_id": "f1", "slot_id": "A1", "truth": "empty", "status": "empty", "source": "model"}
        with self.assertRaisesRegex(ValueError, "duplicate"):
            evaluation.evaluate([row, row])

    def test_json_mode_propagates_to_source(self):
        payload = {"mode": "model", "records": [{"frame_id": "f1", "slot_id": "A1", "truth": "empty", "status": "empty"}]}
        path = self.base / "result.json"
        path.write_text(json.dumps(payload))
        result = evaluation.evaluate(evaluation.load_records(path))
        self.assertEqual(result["accuracy_all_slots"], 1)


if __name__ == "__main__":
    unittest.main()
