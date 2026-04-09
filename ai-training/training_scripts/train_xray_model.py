"""
Train EfficientNet-B0 for Chest X-ray Classification (Normal vs Pneumonia).

Transfer-learning pipeline:
  1. Load pretrained EfficientNet-B0
  2. Freeze backbone, train classifier head
  3. Save best model to backend/models/xray_model.pt
  4. Generate confusion matrix to docs/xray_confusion_matrix.png
"""

import os
import sys
import time

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
from sklearn.metrics import confusion_matrix, ConfusionMatrixDisplay, classification_report

# ── resolve paths relative to this script ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
DATASETS_DIR = os.path.join(SCRIPT_DIR, "..", "datasets")

MODEL_SAVE_PATH = os.path.join(PROJECT_ROOT, "backend", "models", "xray_model.pt")
CONFUSION_MATRIX_PATH = os.path.join(PROJECT_ROOT, "docs", "xray_confusion_matrix.png")

# allow importing dataset_loader from the same directory
sys.path.insert(0, SCRIPT_DIR)
from dataset_loader import load_xray_dataset


# ──────────────────────────────────────────────
# 1. Device detection
# ──────────────────────────────────────────────

def get_device() -> torch.device:
    if torch.cuda.is_available():
        dev = torch.device("cuda")
        print(f"Using GPU: {torch.cuda.get_device_name(0)}")
    else:
        dev = torch.device("cpu")
        print("Using CPU (no CUDA GPU detected)")
    return dev


# ──────────────────────────────────────────────
# 2. Model builder
# ──────────────────────────────────────────────

def build_model(num_classes: int = 2, freeze_backbone: bool = True) -> nn.Module:
    model = efficientnet_b0(weights=EfficientNet_B0_Weights.IMAGENET1K_V1)

    if freeze_backbone:
        for param in model.features.parameters():
            param.requires_grad = False

    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


# ──────────────────────────────────────────────
# 3. Training & validation loops
# ──────────────────────────────────────────────

def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = outputs.max(1)
        correct += preds.eq(labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total


@torch.no_grad()
def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss = 0.0
    correct = 0
    total = 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)

        outputs = model(images)
        loss = criterion(outputs, labels)

        running_loss += loss.item() * images.size(0)
        _, preds = outputs.max(1)
        correct += preds.eq(labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total


# ──────────────────────────────────────────────
# 4. Confusion matrix & classification report
# ──────────────────────────────────────────────

@torch.no_grad()
def generate_confusion_matrix(model, loader, device, class_names, save_path):
    model.eval()
    all_preds = []
    all_labels = []

    for images, labels in loader:
        images = images.to(device)
        outputs = model(images)
        _, preds = outputs.max(1)
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.numpy())

    cm = confusion_matrix(all_labels, all_preds)
    disp = ConfusionMatrixDisplay(confusion_matrix=cm, display_labels=class_names)
    fig, ax = plt.subplots(figsize=(6, 5))
    disp.plot(ax=ax, cmap="Blues", values_format="d")
    ax.set_title("X-ray Classification — Confusion Matrix")
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    fig.savefig(save_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"\nConfusion matrix saved to {save_path}")

    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds, target_names=class_names))


# ──────────────────────────────────────────────
# 5. Main training pipeline
# ──────────────────────────────────────────────

def main():
    # ── hyperparameters ──
    BATCH_SIZE = 32
    EPOCHS = 10
    LR = 1e-4

    device = get_device()

    # ── data ──
    xray_dir = os.path.join(DATASETS_DIR, "chest_xray")
    print(f"\nLoading dataset from {xray_dir}")
    loaders = load_xray_dataset(data_dir=xray_dir, batch_size=BATCH_SIZE)

    if "train" not in loaders:
        print("ERROR: Training split not found. Ensure datasets/chest_xray/train/ exists.")
        sys.exit(1)

    train_loader = loaders["train"]
    val_loader = loaders.get("val")
    test_loader = loaders.get("test")

    class_names = train_loader.dataset.classes  # ['normal', 'pneumonia']
    print(f"Classes: {class_names}\n")

    # ── model ──
    model = build_model(num_classes=len(class_names), freeze_backbone=True)
    model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=LR)

    # ── training ──
    best_val_acc = 0.0
    start_time = time.time()

    for epoch in range(1, EPOCHS + 1):
        # Unfreeze backbone after epoch 5 for fine-tuning
        if epoch == 6:
            print("\nUnfreezing backbone for fine-tuning...")
            for param in model.features.parameters():
                param.requires_grad = True
            optimizer = AdamW(model.parameters(), lr=LR * 0.1)

        train_loss, train_acc = train_one_epoch(model, train_loader, criterion, optimizer, device)

        log = (
            f"Epoch {epoch}/{EPOCHS}  "
            f"Train Loss: {train_loss:.4f}  "
            f"Train Accuracy: {train_acc:.4f}"
        )

        if val_loader:
            val_loss, val_acc = evaluate(model, val_loader, criterion, device)
            log += f"  Val Loss: {val_loss:.4f}  Val Accuracy: {val_acc:.4f}"

            if val_acc > best_val_acc:
                best_val_acc = val_acc
                os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
                torch.save(model.state_dict(), MODEL_SAVE_PATH)
                log += "  ★ best"
        else:
            # no val set — save based on train acc
            os.makedirs(os.path.dirname(MODEL_SAVE_PATH), exist_ok=True)
            torch.save(model.state_dict(), MODEL_SAVE_PATH)

        print(log)

    elapsed = time.time() - start_time
    print(f"\nTraining complete in {elapsed / 60:.1f} min")
    print(f"Best Val Accuracy: {best_val_acc:.4f}")
    print(f"Model saved to {MODEL_SAVE_PATH}")

    # ── reload best model for evaluation ──
    model.load_state_dict(torch.load(MODEL_SAVE_PATH, map_location=device, weights_only=True))
    model.to(device)

    # ── test evaluation ──
    eval_loader = test_loader or val_loader
    if eval_loader:
        test_loss, test_acc = evaluate(model, eval_loader, criterion, device)
        split_name = "Test" if test_loader else "Val"
        print(f"\nFinal {split_name} Accuracy: {test_acc:.4f}")

        generate_confusion_matrix(
            model, eval_loader, device, class_names, CONFUSION_MATRIX_PATH
        )


if __name__ == "__main__":
    main()
