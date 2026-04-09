"""
Monte Carlo Dropout Uncertainty Estimation.

Enables dropout at inference time and runs multiple stochastic forward
passes through the EfficientNet CNN to estimate prediction uncertainty.
"""

import io
import os

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import efficientnet_b0
from PIL import Image

_MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
_WEIGHTS_PATH = os.path.join(_MODEL_DIR, "xray_model.pt")
CLASS_NAMES = ["normal", "pneumonia"]

_PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

UNCERTAINTY_THRESHOLD = 0.15


def _build_model(num_classes: int = 2) -> nn.Module:
    model = efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


def _enable_mc_dropout(model: nn.Module):
    """Set all Dropout layers to train mode to enable stochastic dropout."""
    for m in model.modules():
        if isinstance(m, nn.Dropout):
            m.train()


class UncertaintyEstimator:
    """
    Estimate prediction uncertainty via Monte Carlo Dropout.

    Runs N stochastic forward passes with dropout enabled, then computes
    mean probability, variance, and model agreement across passes.
    """

    _shared_model: nn.Module | None = None
    _shared_device: torch.device | None = None

    def __init__(self, n_passes: int = 10):
        self.n_passes = n_passes

        if UncertaintyEstimator._shared_model is None:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model = _build_model(num_classes=len(CLASS_NAMES))

            if os.path.exists(_WEIGHTS_PATH):
                state_dict = torch.load(
                    _WEIGHTS_PATH, map_location=device, weights_only=True
                )
                model.load_state_dict(state_dict)

            model.to(device)
            model.eval()
            UncertaintyEstimator._shared_model = model
            UncertaintyEstimator._shared_device = device
            print(f"[UncertaintyEstimator] Model loaded on {device}")

        self.model = UncertaintyEstimator._shared_model
        self.device = UncertaintyEstimator._shared_device

    def estimate(self, image_bytes: bytes) -> dict:
        """
        Run Monte Carlo Dropout inference.

        Returns:
            {
                "prediction": str,
                "confidence": float,
                "uncertainty": float,      # prediction variance
                "model_agreement": float,   # fraction of passes agreeing
                "warning": str | None
            }
        """
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _PREPROCESS(image).unsqueeze(0).to(self.device)

        # Enable dropout layers for stochastic inference
        _enable_mc_dropout(self.model)

        all_probs = []
        all_preds = []

        for _ in range(self.n_passes):
            with torch.no_grad():
                logits = self.model(tensor)
                probs = F.softmax(logits, dim=1)[0]
            all_probs.append(probs.cpu())
            all_preds.append(probs.argmax().item())

        # Restore full eval mode
        self.model.eval()

        # Stack: (n_passes, num_classes)
        stacked = torch.stack(all_probs)

        # Mean probability per class
        mean_probs = stacked.mean(dim=0)
        predicted_idx = mean_probs.argmax().item()
        confidence = round(mean_probs[predicted_idx].item(), 4)

        # Prediction variance (uncertainty)
        variance = stacked[:, predicted_idx].var().item()
        uncertainty = round(variance, 4)

        # Model agreement — fraction of passes that agree with majority
        agreement = round(sum(1 for p in all_preds if p == predicted_idx) / self.n_passes, 4)

        prediction = CLASS_NAMES[predicted_idx].capitalize()

        warning = None
        if uncertainty > UNCERTAINTY_THRESHOLD:
            warning = "Low model confidence. Additional imaging recommended."

        return {
            "prediction": prediction,
            "confidence": confidence,
            "uncertainty": uncertainty,
            "model_agreement": agreement,
            "warning": warning,
        }
