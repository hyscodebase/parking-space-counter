#!/usr/bin/env python3
"""Evaluate labelled model results, excluding illustrative demo predictions."""
from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


def load_records(path):
    path = Path(path)
    if path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8-sig", newline="") as handle:
            return list(csv.DictReader(handle))
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict) or not isinstance(payload.get("records"), list):
        raise ValueError("JSON must be a records array or an object with records")
    if any(not isinstance(record, dict) for record in payload["records"]):
        raise ValueError("Every record must be an object")
    return [dict(record, source=record.get("source", payload.get("mode"))) for record in payload["records"]]


def evaluate(records):
    accepted, exclusions, seen = [], Counter(), set()
    for number, row in enumerate(records, 1):
        if not isinstance(row, dict):
            raise ValueError(f"Record {number}: expected an object")
        if row.get("source") == "demo":
            exclusions["demo"] += 1
            continue
        if row.get("source") != "model":
            raise ValueError(f"Record {number}: source must be model or demo (or set JSON mode)")
        truth = row.get("truth")
        if truth is None or truth == "":
            exclusions["missing_truth"] += 1
            continue
        if truth not in ("empty", "occupied"):
            raise ValueError(f"Record {number}: truth must be empty or occupied")
        if row.get("status") not in ("empty", "occupied", "uncertain"):
            raise ValueError(f"Record {number}: status must be empty, occupied or uncertain")
        frame, slot = row.get("frame_id"), row.get("slot_id")
        if not isinstance(frame, str) or not frame.strip() or slot not in ("A1", "A2", "A3", "A4"):
            raise ValueError(f"Record {number}: nonempty frame_id and A1–A4 slot_id required")
        key = (frame, slot)
        if key in seen:
            raise ValueError(f"Record {number}: duplicate frame_id/slot_id; use distinct IDs for independent runs")
        seen.add(key)
        if row.get("confidence") not in (None, ""):
            try:
                confidence = float(row["confidence"])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"Record {number}: confidence must be a numeric probability") from exc
            if not math.isfinite(confidence) or not 0 <= confidence <= 1:
                raise ValueError(f"Record {number}: confidence must be a probability from 0 to 1")
        accepted.append(row)
    if not accepted:
        raise ValueError("No labelled model records remain. Demo results cannot establish model accuracy.")
    total = len(accepted)
    decided = [row for row in accepted if row["status"] != "uncertain"]
    correct = sum(row["truth"] == row["status"] for row in accepted)
    occupied = sum(row["truth"] == "occupied" for row in accepted)
    false_empty = sum(row["truth"] == "occupied" and row["status"] == "empty" for row in accepted)
    empty_predictions = sum(row["status"] == "empty" for row in accepted)
    matrix = {truth: {prediction: 0 for prediction in ("empty", "occupied", "uncertain")} for truth in ("empty", "occupied")}
    frames = defaultdict(list)
    for row in accepted:
        matrix[row["truth"]][row["status"]] += 1
        frames[row["frame_id"]].append(row)
    frame_results = []
    for frame, rows in frames.items():
        if {row["slot_id"] for row in rows} != {"A1", "A2", "A3", "A4"}:
            continue
        actual = sum(row["truth"] == "empty" for row in rows)
        predicted = sum(row["status"] == "empty" for row in rows)
        frame_results.append({"frame_id": frame, "true_empty_count": actual, "predicted_empty_count": predicted, "absolute_error": abs(actual - predicted), "exact_match": actual == predicted})
    complete = len(frame_results)
    return {
        "labelled_model_slots": total, "excluded_records": dict(exclusions),
        "accuracy_all_slots": correct / total,
        "accuracy_decided_slots": correct / len(decided) if decided else None,
        "coverage": len(decided) / total, "uncertain_slots": total - len(decided),
        "false_empty_count": false_empty,
        "false_empty_rate_among_occupied": false_empty / occupied if occupied else None,
        "empty_precision": (empty_predictions - false_empty) / empty_predictions if empty_predictions else None,
        "confusion_matrix": matrix,
        "complete_frames": complete, "incomplete_frames": len(frames) - complete,
        "empty_count_exact_match_rate": sum(frame["exact_match"] for frame in frame_results) / complete if complete else None,
        "empty_count_mean_absolute_error": sum(frame["absolute_error"] for frame in frame_results) / complete if complete else None,
        "frame_results": frame_results,
        "definitions": {
            "accuracy_all_slots": "Correct classifications divided by all labelled slots; uncertain counts as incorrect.",
            "accuracy_decided_slots": "Correct classifications divided by non-uncertain slots.",
            "coverage": "Non-uncertain slots divided by all labelled slots.",
            "false_empty_rate_among_occupied": "Occupied slots reported empty divided by all truly occupied slots.",
            "empty_count": "Uncertain slots are never counted as empty; only fully labelled A1–A4 frames are evaluated.",
            "null": "The denominator is zero, so this metric cannot be calculated.",
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Labelled exported JSON or CSV")
    parser.add_argument("--output", type=Path, help="Optional new JSON file; existing files are not overwritten")
    args = parser.parse_args()
    try:
        result = evaluate(load_records(args.input))
        rendered = json.dumps(result, ensure_ascii=False, indent=2)
        if args.output:
            with args.output.open("x", encoding="utf-8") as handle:
                handle.write(rendered + "\n")
    except (ValueError, OSError) as exc:
        parser.exit(2, f"Error: {exc}\n")
    print(rendered)


if __name__ == "__main__":
    main()
