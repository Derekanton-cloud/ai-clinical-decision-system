"""
Dataset Augmentation Pipeline.

Uses the trained DCGAN generator to create synthetic chest X-ray images
and integrates them into the training dataset for CNN retraining.

Steps:
    1. Generate synthetic images via GAN
    2. Label them based on training condition
    3. Append to the training dataset
    4. Report augmentation statistics
"""

import csv
import os
import shutil
import sys
import time
from datetime import datetime, timezone

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(SCRIPT_DIR, "..", "datasets")
GENERATED_DIR = os.path.join(DATASETS_DIR, "generated_xrays")
TRAIN_DIR = os.path.join(DATASETS_DIR, "chest_xray", "train")
ANALYTICS_DIR = os.path.join(SCRIPT_DIR, "..", "..", "data")
ANALYTICS_CSV = os.path.join(ANALYTICS_DIR, "augmentation_logs.csv")

sys.path.insert(0, SCRIPT_DIR)


def generate_and_augment(
    n_per_class: int = 50,
    classes: list[str] | None = None,
) -> dict:
    """
    Generate synthetic X-rays and add them to the training set.

    Args:
        n_per_class: Number of synthetic images per class.
        classes: List of class folder names (default: detected from train dir).

    Returns:
        Summary dict with counts and paths.
    """
    from gan_generator import generate_synthetic_images

    if classes is None:
        classes = sorted([
            d for d in os.listdir(TRAIN_DIR)
            if os.path.isdir(os.path.join(TRAIN_DIR, d))
        ])

    print(f"[Augment] Classes: {classes}")
    print(f"[Augment] Generating {n_per_class} images per class")

    results = {"classes": {}, "total_generated": 0}

    for cls in classes:
        class_output_dir = os.path.join(GENERATED_DIR, cls)
        os.makedirs(class_output_dir, exist_ok=True)

        # Generate synthetic images
        paths = generate_synthetic_images(n=n_per_class, output_dir=class_output_dir)

        # Copy into training directory
        train_class_dir = os.path.join(TRAIN_DIR, cls)
        os.makedirs(train_class_dir, exist_ok=True)

        copied = 0
        for src_path in paths:
            fname = f"gan_{cls}_{os.path.basename(src_path)}"
            dst_path = os.path.join(train_class_dir, fname)
            shutil.copy2(src_path, dst_path)
            copied += 1

        results["classes"][cls] = {
            "generated": len(paths),
            "copied_to_train": copied,
            "output_dir": class_output_dir,
        }
        results["total_generated"] += len(paths)
        print(f"[Augment] {cls}: generated {len(paths)}, copied {copied} to training set")

    # Log to analytics CSV
    _log_augmentation(results)

    return results


def get_dataset_stats() -> dict:
    """Return current training dataset statistics per class."""
    stats = {}
    if not os.path.isdir(TRAIN_DIR):
        return stats

    for cls in sorted(os.listdir(TRAIN_DIR)):
        cls_dir = os.path.join(TRAIN_DIR, cls)
        if os.path.isdir(cls_dir):
            total = len([f for f in os.listdir(cls_dir) if os.path.isfile(os.path.join(cls_dir, f))])
            synthetic = len([f for f in os.listdir(cls_dir) if f.startswith("gan_")])
            stats[cls] = {
                "total": total,
                "original": total - synthetic,
                "synthetic": synthetic,
            }
    return stats


def _log_augmentation(results: dict) -> None:
    """Append augmentation run to analytics CSV for Power BI."""
    os.makedirs(ANALYTICS_DIR, exist_ok=True)
    fields = ["timestamp", "total_generated", "classes", "per_class_count"]
    write_header = not os.path.exists(ANALYTICS_CSV)

    with open(ANALYTICS_CSV, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        if write_header:
            writer.writeheader()

        class_names = ", ".join(results["classes"].keys())
        per_class = ", ".join(
            f"{c}={v['generated']}" for c, v in results["classes"].items()
        )

        writer.writerow({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "total_generated": results["total_generated"],
            "classes": class_names,
            "per_class_count": per_class,
        })


def remove_synthetic_images() -> int:
    """Remove all GAN-generated images from the training set."""
    removed = 0
    for cls in os.listdir(TRAIN_DIR):
        cls_dir = os.path.join(TRAIN_DIR, cls)
        if not os.path.isdir(cls_dir):
            continue
        for f in os.listdir(cls_dir):
            if f.startswith("gan_"):
                os.remove(os.path.join(cls_dir, f))
                removed += 1
    print(f"[Augment] Removed {removed} synthetic images from training set")
    return removed


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Dataset Augmentation Pipeline")
    parser.add_argument("--mode", choices=["augment", "stats", "clean"], default="stats")
    parser.add_argument("--n", type=int, default=50, help="Images per class")
    args = parser.parse_args()

    if args.mode == "augment":
        result = generate_and_augment(n_per_class=args.n)
        print(f"\nTotal generated: {result['total_generated']}")
    elif args.mode == "stats":
        stats = get_dataset_stats()
        for cls, s in stats.items():
            print(f"  {cls}: {s['total']} total ({s['original']} original, {s['synthetic']} synthetic)")
    elif args.mode == "clean":
        remove_synthetic_images()
