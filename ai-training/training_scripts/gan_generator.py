"""
DCGAN for Synthetic Chest X-ray Generation.

Generates synthetic chest X-ray images for dataset augmentation.

Architecture:
    Generator:     latent vector (100) → 1×64×64 grayscale X-ray
    Discriminator: 1×64×64 image → real/fake probability
"""

import os
import sys
import time

import numpy as np
import torch
import torch.nn as nn
from torch.optim import Adam
from torch.utils.data import DataLoader
from torchvision import transforms, datasets
from torchvision.utils import save_image
from PIL import Image

# ── paths ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(SCRIPT_DIR, "..", "datasets")
OUTPUT_DIR = os.path.join(DATASETS_DIR, "generated_xrays")
CHECKPOINT_DIR = os.path.join(SCRIPT_DIR, "..", "..", "backend", "models")

# ── hyperparameters ──
LATENT_DIM = 100
IMAGE_SIZE = 64
CHANNELS = 1  # grayscale X-rays
FEATURE_G = 64
FEATURE_D = 64


def _weights_init(m):
    """DCGAN-style weight initialization."""
    classname = m.__class__.__name__
    if "Conv" in classname:
        nn.init.normal_(m.weight.data, 0.0, 0.02)
    elif "BatchNorm" in classname:
        nn.init.normal_(m.weight.data, 1.0, 0.02)
        nn.init.constant_(m.bias.data, 0)


# ──────────────────────────────────────────────
# Generator
# ──────────────────────────────────────────────

class Generator(nn.Module):
    """DCGAN Generator: latent vector → 1×64×64 image."""

    def __init__(self):
        super().__init__()
        self.main = nn.Sequential(
            # latent → 512×4×4
            nn.ConvTranspose2d(LATENT_DIM, FEATURE_G * 8, 4, 1, 0, bias=False),
            nn.BatchNorm2d(FEATURE_G * 8),
            nn.ReLU(True),
            # → 256×8×8
            nn.ConvTranspose2d(FEATURE_G * 8, FEATURE_G * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURE_G * 4),
            nn.ReLU(True),
            # → 128×16×16
            nn.ConvTranspose2d(FEATURE_G * 4, FEATURE_G * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURE_G * 2),
            nn.ReLU(True),
            # → 64×32×32
            nn.ConvTranspose2d(FEATURE_G * 2, FEATURE_G, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURE_G),
            nn.ReLU(True),
            # → 1×64×64
            nn.ConvTranspose2d(FEATURE_G, CHANNELS, 4, 2, 1, bias=False),
            nn.Tanh(),
        )

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        return self.main(z)


# ──────────────────────────────────────────────
# Discriminator
# ──────────────────────────────────────────────

class Discriminator(nn.Module):
    """DCGAN Discriminator: 1×64×64 image → real/fake."""

    def __init__(self):
        super().__init__()
        self.main = nn.Sequential(
            # 1×64×64 → 64×32×32
            nn.Conv2d(CHANNELS, FEATURE_D, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            # → 128×16×16
            nn.Conv2d(FEATURE_D, FEATURE_D * 2, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURE_D * 2),
            nn.LeakyReLU(0.2, inplace=True),
            # → 256×8×8
            nn.Conv2d(FEATURE_D * 2, FEATURE_D * 4, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURE_D * 4),
            nn.LeakyReLU(0.2, inplace=True),
            # → 512×4×4
            nn.Conv2d(FEATURE_D * 4, FEATURE_D * 8, 4, 2, 1, bias=False),
            nn.BatchNorm2d(FEATURE_D * 8),
            nn.LeakyReLU(0.2, inplace=True),
            # → 1×1×1
            nn.Conv2d(FEATURE_D * 8, 1, 4, 1, 0, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.main(x).view(-1, 1).squeeze(1)


# ──────────────────────────────────────────────
# Data loading
# ──────────────────────────────────────────────

def _get_dataloader(data_dir: str, batch_size: int = 64) -> DataLoader:
    """Load chest X-ray training images as 64×64 grayscale."""
    transform = transforms.Compose([
        transforms.Grayscale(num_output_channels=1),
        transforms.Resize(IMAGE_SIZE),
        transforms.CenterCrop(IMAGE_SIZE),
        transforms.ToTensor(),
        transforms.Normalize([0.5], [0.5]),  # scale to [-1, 1]
    ])

    dataset = datasets.ImageFolder(root=data_dir, transform=transform)
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0,
        drop_last=True,
    )
    return loader


# ──────────────────────────────────────────────
# Training
# ──────────────────────────────────────────────

def train_gan(
    epochs: int = 25,
    batch_size: int = 64,
    lr: float = 0.0002,
    save_interval: int = 5,
) -> dict:
    """
    Train the DCGAN on chest X-ray images.

    Returns training history with generator and discriminator losses.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[GAN] Training on {device}")

    # Data
    train_dir = os.path.join(DATASETS_DIR, "chest_xray", "train")
    if not os.path.isdir(train_dir):
        print(f"ERROR: Training directory not found at {train_dir}")
        sys.exit(1)

    loader = _get_dataloader(train_dir, batch_size)
    print(f"[GAN] Loaded {len(loader.dataset)} training images")

    # Models
    gen = Generator().to(device)
    disc = Discriminator().to(device)
    gen.apply(_weights_init)
    disc.apply(_weights_init)

    # Optimizers & loss
    opt_g = Adam(gen.parameters(), lr=lr, betas=(0.5, 0.999))
    opt_d = Adam(disc.parameters(), lr=lr, betas=(0.5, 0.999))
    criterion = nn.BCELoss()

    # Fixed noise for visualisation
    fixed_noise = torch.randn(16, LATENT_DIM, 1, 1, device=device)

    history = {"g_losses": [], "d_losses": []}
    start = time.time()

    for epoch in range(1, epochs + 1):
        g_loss_sum = 0.0
        d_loss_sum = 0.0
        n_batches = 0

        for real_images, _ in loader:
            real_images = real_images.to(device)
            bs = real_images.size(0)
            real_label = torch.ones(bs, device=device)
            fake_label = torch.zeros(bs, device=device)

            # ── Train Discriminator ──
            disc.zero_grad()
            output_real = disc(real_images)
            loss_d_real = criterion(output_real, real_label)

            noise = torch.randn(bs, LATENT_DIM, 1, 1, device=device)
            fake_images = gen(noise)
            output_fake = disc(fake_images.detach())
            loss_d_fake = criterion(output_fake, fake_label)

            loss_d = loss_d_real + loss_d_fake
            loss_d.backward()
            opt_d.step()

            # ── Train Generator ──
            gen.zero_grad()
            output_fake = disc(fake_images)
            loss_g = criterion(output_fake, real_label)  # fool discriminator
            loss_g.backward()
            opt_g.step()

            g_loss_sum += loss_g.item()
            d_loss_sum += loss_d.item()
            n_batches += 1

        avg_g = g_loss_sum / n_batches
        avg_d = d_loss_sum / n_batches
        history["g_losses"].append(round(avg_g, 4))
        history["d_losses"].append(round(avg_d, 4))

        print(
            f"Epoch {epoch}/{epochs}  "
            f"D_loss: {avg_d:.4f}  G_loss: {avg_g:.4f}"
        )

        # Save sample images periodically
        if epoch % save_interval == 0 or epoch == epochs:
            os.makedirs(OUTPUT_DIR, exist_ok=True)
            with torch.no_grad():
                samples = gen(fixed_noise)
            save_image(
                samples,
                os.path.join(OUTPUT_DIR, f"samples_epoch_{epoch:03d}.png"),
                nrow=4,
                normalize=True,
            )

    elapsed = time.time() - start
    print(f"\n[GAN] Training complete in {elapsed / 60:.1f} min")

    # Save generator checkpoint
    os.makedirs(CHECKPOINT_DIR, exist_ok=True)
    gen_path = os.path.join(CHECKPOINT_DIR, "gan_generator.pt")
    torch.save(gen.state_dict(), gen_path)
    print(f"[GAN] Generator saved to {gen_path}")

    return history


# ──────────────────────────────────────────────
# Generation
# ──────────────────────────────────────────────

def generate_synthetic_images(
    n: int = 100,
    output_dir: str | None = None,
) -> list[str]:
    """
    Generate n synthetic chest X-ray images using the trained generator.

    Returns list of saved file paths.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    gen = Generator().to(device)
    gen_path = os.path.join(CHECKPOINT_DIR, "gan_generator.pt")

    if not os.path.exists(gen_path):
        print(f"ERROR: Generator weights not found at {gen_path}")
        print("Run train_gan() first.")
        return []

    gen.load_state_dict(torch.load(gen_path, map_location=device, weights_only=True))
    gen.eval()

    save_dir = output_dir or OUTPUT_DIR
    os.makedirs(save_dir, exist_ok=True)

    saved_paths = []
    batch_size = min(n, 64)

    with torch.no_grad():
        generated = 0
        while generated < n:
            bs = min(batch_size, n - generated)
            noise = torch.randn(bs, LATENT_DIM, 1, 1, device=device)
            fake_images = gen(noise)

            for i in range(bs):
                img = fake_images[i].cpu().squeeze(0)  # (64, 64)
                # Denormalise from [-1, 1] to [0, 255]
                img = ((img + 1) / 2 * 255).clamp(0, 255).byte().numpy()
                pil_img = Image.fromarray(img, mode="L")
                # Resize to 224×224 for CNN compatibility
                pil_img = pil_img.resize((224, 224), Image.BILINEAR)

                fname = f"synthetic_{generated + 1:04d}.png"
                fpath = os.path.join(save_dir, fname)
                pil_img.save(fpath)
                saved_paths.append(fpath)
                generated += 1

    print(f"[GAN] Generated {len(saved_paths)} synthetic X-ray images → {save_dir}")
    return saved_paths


# ──────────────────────────────────────────────
# CLI entry point
# ──────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DCGAN Chest X-ray Generator")
    parser.add_argument("--mode", choices=["train", "generate"], default="train")
    parser.add_argument("--epochs", type=int, default=25)
    parser.add_argument("--n", type=int, default=100, help="Number of images to generate")
    args = parser.parse_args()

    if args.mode == "train":
        train_gan(epochs=args.epochs)
    else:
        generate_synthetic_images(n=args.n)
