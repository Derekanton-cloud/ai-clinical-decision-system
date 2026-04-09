"""
Multimodal Patient Embedding.

Creates a unified vector representation by combining:
    - CNN image features  (128-dim from EfficientNet penultimate layer)
    - Symptom vector      (10-dim binary)
    - Clinical features   (age, risk_score, confidence → 3-dim)

Final embedding length ≈ 141.
"""

import io
import os

import numpy as np
import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import efficientnet_b0
from PIL import Image

_MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
_WEIGHTS_PATH = os.path.join(_MODEL_DIR, "xray_model.pt")

_PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])

SYMPTOM_FEATURES = [
    "cough", "fever", "breathlessness", "chest_pain",
    "weight_loss", "fatigue", "night_sweats", "hemoptysis",
    "wheezing", "loss_of_appetite",
]


def _build_feature_extractor(num_classes: int = 2) -> tuple[nn.Module, int]:
    """Build EfficientNet and return (model, feature_dim)."""
    model = efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model, in_features  # in_features = 1280 for EfficientNet-B0


def _text_to_symptom_vector(symptoms_text: str) -> np.ndarray:
    text = symptoms_text.lower()
    vec = np.zeros(len(SYMPTOM_FEATURES), dtype=np.float64)
    for i, feat in enumerate(SYMPTOM_FEATURES):
        readable = feat.replace("_", " ")
        if readable in text or feat in text:
            vec[i] = 1.0
    return vec


class PatientEmbeddingModel:
    """
    Generate unified multimodal embeddings for patient cases.

    Combines CNN image features, symptom vectors, and clinical data
    into a single normalised vector for similarity search and analysis.
    """

    _shared_model: nn.Module | None = None
    _shared_device: torch.device | None = None
    _shared_projection: nn.Linear | None = None
    _feature_dim: int = 1280

    def __init__(self):
        if PatientEmbeddingModel._shared_model is None:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model, feat_dim = _build_feature_extractor(num_classes=2)
            PatientEmbeddingModel._feature_dim = feat_dim

            if os.path.exists(_WEIGHTS_PATH):
                state_dict = torch.load(
                    _WEIGHTS_PATH, map_location=device, weights_only=True
                )
                model.load_state_dict(state_dict)

            model.to(device)
            model.eval()

            # Projection layer: 1280 → 128
            proj = nn.Linear(feat_dim, 128, bias=False)
            nn.init.xavier_uniform_(proj.weight)
            proj.to(device)
            proj.eval()

            PatientEmbeddingModel._shared_model = model
            PatientEmbeddingModel._shared_device = device
            PatientEmbeddingModel._shared_projection = proj
            print(f"[PatientEmbedding] Model loaded on {device}")

        self.model = PatientEmbeddingModel._shared_model
        self.device = PatientEmbeddingModel._shared_device
        self.projection = PatientEmbeddingModel._shared_projection

        # Hook to capture features before classifier
        self._features = None
        self.model.avgpool.register_forward_hook(self._feature_hook)

    def _feature_hook(self, module, input, output):
        self._features = output.detach()

    def extract_image_features(self, image_bytes: bytes) -> np.ndarray:
        """Extract 128-dim CNN feature embedding from an X-ray image."""
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        tensor = _PREPROCESS(image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            _ = self.model(tensor)
            # self._features shape: (1, 1280, 1, 1)
            flat = self._features.flatten(1)  # (1, 1280)
            projected = self.projection(flat)  # (1, 128)

        return projected.squeeze(0).cpu().numpy()

    def generate_embedding(
        self,
        image_bytes: bytes,
        symptoms: str,
        age: int = 45,
        risk_score: float = 0.5,
        confidence: float = 0.8,
    ) -> np.ndarray:
        """
        Generate a unified 141-dim patient embedding.

        Components:
            [0:128]   CNN image features (projected)
            [128:138] Symptom binary vector
            [138:141] Clinical features (age/100, risk_score, confidence)
        """
        image_features = self.extract_image_features(image_bytes)  # 128-dim
        symptom_vec = _text_to_symptom_vector(symptoms)  # 10-dim
        clinical = np.array([age / 100.0, risk_score, confidence], dtype=np.float64)  # 3-dim

        embedding = np.concatenate([image_features, symptom_vec, clinical])

        # L2 normalise
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm

        return embedding

    def generate_embedding_from_features(
        self,
        image_features: np.ndarray,
        symptoms: str,
        age: int = 45,
        risk_score: float = 0.5,
        confidence: float = 0.8,
    ) -> np.ndarray:
        """Generate embedding when image features are already extracted."""
        symptom_vec = _text_to_symptom_vector(symptoms)
        clinical = np.array([age / 100.0, risk_score, confidence], dtype=np.float64)
        embedding = np.concatenate([image_features, symptom_vec, clinical])
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        return embedding
