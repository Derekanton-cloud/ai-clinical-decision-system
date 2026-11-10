import io
import os

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import efficientnet_b0
from PIL import Image

# ── paths ──
_MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
_WEIGHTS_PATH = os.path.join(_MODEL_DIR, "xray_model.pt")
_MANIFEST_PATH = os.path.join(_MODEL_DIR, "xray_model.manifest.json")
from models.artifact_status import model_artifact_status

# ── class labels (must match training order) ──
CLASS_NAMES = ["normal", "pneumonia"]

# ── ImageNet normalisation (same as training) ──
_PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def _build_model(num_classes: int = 2) -> nn.Module:
    """Recreate the same EfficientNet-B0 architecture used during training."""
    model = efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


class DiseaseModel:
    """EfficientNet-B0 disease classification model for chest X-rays."""

    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.available, self.unavailable_reason = model_artifact_status()
        self.model = None
        if self.available:
            self.model = _build_model(num_classes=len(CLASS_NAMES))
            state_dict = torch.load(_WEIGHTS_PATH, map_location=self.device, weights_only=True)
            self.model.load_state_dict(state_dict)
            self.model.to(self.device)
            self.model.eval()
            print(f"[DiseaseModel] Manifested weights loaded on {self.device}")

    def predict_from_image(self, image_bytes: bytes) -> dict:
        """Run real EfficientNet inference on an X-ray image."""
        if not self.available or self.model is None:
            return {"available": False, "reason": self.unavailable_reason}
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _PREPROCESS(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            logits = self.model(tensor)
            probs = F.softmax(logits, dim=1)[0]

        confidence, idx = probs.max(0)

        threshold = 0.6
        if confidence < threshold:
            disease = "Low Confidence"
        else:
            disease = CLASS_NAMES[idx.item()].capitalize()  # "Normal" or "Pneumonia"

        return {
            "disease": disease,
            "confidence": round(confidence.item(), 4),
        }

    def predict_from_symptoms(self, symptoms: str) -> dict:
        """Run inference on symptom text. Returns disease prediction."""
        symptom_keywords = {
            "cough": "Pneumonia",
            "fever": "Tuberculosis",
            "breathless": "COVID-19",
            "weight loss": "Lung Cancer",
            "chest pain": "Pleural Effusion",
        }
        predicted = "Pneumonia"
        for keyword, disease in symptom_keywords.items():
            if keyword in symptoms.lower():
                predicted = disease
                break

        matched = sum(keyword in symptoms.lower() for keyword in symptom_keywords)
        return {"disease": predicted, "confidence": None, "matched_rule_count": matched,
                "model_type": "rule-based suggestion", "clinical_validation": False}
