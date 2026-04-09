"""
Dataset Loader Module for AI Clinical Decision Support System.

Provides reusable data loading functions for:
1. Chest X-ray image dataset (PyTorch DataLoaders)
2. Symptom text dataset (HuggingFace Dataset format)
"""

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import datasets, transforms
from sklearn.model_selection import train_test_split

_DEFAULT_NUM_WORKERS = 0 if sys.platform == "win32" else 4


# ──────────────────────────────────────────────
# 1. Chest X-ray Image Dataset
# ──────────────────────────────────────────────

# ImageNet normalization constants
IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


def get_xray_transforms(split: str = "train") -> transforms.Compose:
    """
    Return image transforms for a given split.
    Training split includes augmentation; val/test do not.
    """
    if split == "train":
        return transforms.Compose([
            transforms.Resize((256, 256)),
            transforms.RandomCrop(224),
            transforms.RandomHorizontalFlip(p=0.5),
            transforms.RandomRotation(degrees=15),
            transforms.ColorJitter(brightness=0.1, contrast=0.1),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])
    else:
        return transforms.Compose([
            transforms.Resize(256),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD),
        ])


def load_xray_dataset(
    data_dir: str = "datasets/chest_xray",
    batch_size: int = 32,
    num_workers: int = _DEFAULT_NUM_WORKERS,
) -> dict[str, DataLoader]:
    """
    Load chest X-ray dataset using torchvision ImageFolder.

    Expected directory structure:
        datasets/chest_xray/
            train/
                pneumonia/
                normal/
            test/
                pneumonia/
                normal/
            val/
                pneumonia/
                normal/

    Returns:
        Dictionary with 'train', 'val', 'test' DataLoaders.
    """
    data_path = Path(data_dir)
    loaders = {}

    for split in ("train", "val", "test"):
        split_path = data_path / split
        if not split_path.exists():
            print(f"[WARNING] Split directory not found: {split_path}")
            continue

        dataset = datasets.ImageFolder(
            root=str(split_path),
            transform=get_xray_transforms(split),
        )

        sampler = None
        shuffle = (split == "train")
        if split == "train":
            # WeightedRandomSampler to handle class imbalance
            targets = dataset.targets
            class_counts = np.bincount(targets)
            class_weights = 1.0 / class_counts.astype(np.float32)
            sample_weights = torch.tensor(
                [class_weights[t] for t in targets], dtype=torch.float64
            )
            sampler = WeightedRandomSampler(
                weights=sample_weights,
                num_samples=len(sample_weights),
                replacement=True,
            )
            shuffle = False  # mutually exclusive with sampler

        loaders[split] = DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=shuffle,
            sampler=sampler,
            num_workers=num_workers,
            pin_memory=torch.cuda.is_available(),
            drop_last=(split == "train"),
        )

        print(
            f"[{split.upper()}] Loaded {len(dataset)} images "
            f"({len(dataset.classes)} classes: {dataset.classes})"
        )

    return loaders


# ──────────────────────────────────────────────
# 2. Symptom Text Dataset
# ──────────────────────────────────────────────

# Disease label mapping
DISEASE_LABELS = {
    "Pneumonia": 0,
    "Tuberculosis": 1,
    "COVID-19": 2,
    "Lung Cancer": 3,
    "Pleural Effusion": 4,
    "Normal": 5,
}


def load_symptom_dataset(
    csv_path: str = "datasets/symptom_dataset.csv",
    test_size: float = 0.2,
    random_state: int = 42,
) -> dict:
    """
    Load symptom CSV dataset and return in HuggingFace Dataset-compatible format.

    Expected CSV columns:
        symptoms_text   - free-text symptom description
        disease_label   - target disease name
        age             - patient age
        severity_score  - severity (0.0–1.0)

    Returns:
        Dictionary with 'train' and 'test' splits, each containing:
            - symptoms_text: list[str]
            - disease_label: list[str]
            - label: list[int]  (encoded)
            - age: list[int]
            - severity_score: list[float]
    """
    df = pd.read_csv(csv_path)

    # Validate required columns
    required = {"symptoms_text", "disease_label", "age", "severity_score"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing columns in CSV: {missing}")

    # Encode disease labels to integers
    df["label"] = df["disease_label"].map(DISEASE_LABELS)
    unknown = df[df["label"].isna()]["disease_label"].unique()
    if len(unknown) > 0:
        raise ValueError(f"Unknown disease labels found: {unknown}")
    df["label"] = df["label"].astype(int)

    # Stratified train/test split
    train_df, test_df = train_test_split(
        df,
        test_size=test_size,
        random_state=random_state,
        stratify=df["label"],
    )

    def df_to_dict(split_df: pd.DataFrame) -> dict:
        return {
            "symptoms_text": split_df["symptoms_text"].tolist(),
            "disease_label": split_df["disease_label"].tolist(),
            "label": split_df["label"].tolist(),
            "age": split_df["age"].tolist(),
            "severity_score": split_df["severity_score"].tolist(),
        }

    train_data = df_to_dict(train_df)
    test_data = df_to_dict(test_df)

    print(f"[TRAIN] {len(train_data['label'])} samples")
    print(f"[TEST]  {len(test_data['label'])} samples")
    print(f"Label distribution (train): {pd.Series(train_data['label']).value_counts().to_dict()}")

    return {"train": train_data, "test": test_data}


# ──────────────────────────────────────────────
# 3. Utility functions
# ──────────────────────────────────────────────

def get_class_weights(loader: DataLoader) -> torch.Tensor:
    """Compute inverse-frequency class weights for imbalanced datasets."""
    targets = []
    for _, labels in loader:
        targets.extend(labels.tolist())
    class_counts = np.bincount(targets)
    weights = 1.0 / class_counts.astype(np.float32)
    weights = weights / weights.sum() * len(weights)
    return torch.tensor(weights, dtype=torch.float32)


def get_label_map(loader: DataLoader) -> dict[int, str]:
    """Return index→class_name mapping from an ImageFolder DataLoader."""
    dataset = loader.dataset
    if hasattr(dataset, "class_to_idx"):
        return {v: k for k, v in dataset.class_to_idx.items()}
    return {}


# ──────────────────────────────────────────────
# CLI entry point for quick testing
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
    DATASETS_DIR = os.path.join(SCRIPT_DIR, "..", "datasets")

    parser = argparse.ArgumentParser(description="Test dataset loaders")
    parser.add_argument("--xray-dir", default=os.path.join(DATASETS_DIR, "chest_xray"))
    parser.add_argument("--symptom-csv", default=os.path.join(DATASETS_DIR, "symptom_dataset.csv"))
    parser.add_argument("--batch-size", type=int, default=32)
    args = parser.parse_args()

    print("=" * 50)
    print("Testing X-ray Dataset Loader")
    print("=" * 50)
    xray_loaders = load_xray_dataset(args.xray_dir, batch_size=args.batch_size)
    for split, loader in xray_loaders.items():
        batch = next(iter(loader))
        print(f"  {split}: batch shape = {batch[0].shape}, labels = {batch[1][:8]}")

    print()
    print("=" * 50)
    print("Testing Symptom Dataset Loader")
    print("=" * 50)
    symptom_data = load_symptom_dataset(args.symptom_csv)
    print(f"  Train sample: {symptom_data['train']['symptoms_text'][0]}")
    print(f"  Train label:  {symptom_data['train']['disease_label'][0]}")
