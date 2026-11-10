import io
import base64
import os

import numpy as np
import torch
import torch.nn.functional as F
from torchvision import transforms
from torchvision.models import efficientnet_b0
from torch import nn
from PIL import Image
from models.artifact_status import model_artifact_status

# ── paths (same model the backend uses for prediction) ──
_MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "models")
_WEIGHTS_PATH = os.path.join(_MODEL_DIR, "xray_model.pt")

CLASS_NAMES = ["normal", "pneumonia"]

_PREPROCESS = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std=[0.229, 0.224, 0.225]),
])


def _build_model(num_classes: int = 2) -> nn.Module:
    model = efficientnet_b0(weights=None)
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, num_classes)
    return model


class GradCAM:
    """
    Real Grad-CAM explainability for EfficientNet-B0.
    Hooks into the last convolutional layer to produce class activation maps
    that highlight which regions of an X-ray drove the prediction.
    """

    _shared_model = None
    _shared_device = None

    def __init__(self):
        available, reason = model_artifact_status()
        if not available:
            raise RuntimeError(f"Grad-CAM is unavailable: {reason}")
        if GradCAM._shared_model is None:
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model = _build_model(num_classes=len(CLASS_NAMES))

            if os.path.exists(_WEIGHTS_PATH):
                state_dict = torch.load(_WEIGHTS_PATH, map_location=device, weights_only=True)
                model.load_state_dict(state_dict)
                print(f"[GradCAM] Loaded weights from {_WEIGHTS_PATH} on {device}")
            model.to(device)
            model.eval()
            GradCAM._shared_model = model
            GradCAM._shared_device = device

        self.model = GradCAM._shared_model
        self.device = GradCAM._shared_device

        # Last conv block in EfficientNet-B0: model.features[-1]
        self.target_layer = self.model.features[-1]

        # Storage for hooked tensors
        self._activations = None
        self._gradients = None

        # Register hooks
        self.target_layer.register_forward_hook(self._forward_hook)
        self.target_layer.register_full_backward_hook(self._backward_hook)

    # ── hooks ──

    def _forward_hook(self, module, input, output):
        self._activations = output.detach()

    def _backward_hook(self, module, grad_input, grad_output):
        self._gradients = grad_output[0].detach()

    # ── core ──

    def _compute_cam(self, input_tensor: torch.Tensor) -> tuple[np.ndarray, int, float]:
        """Run forward + backward and return (heatmap_0-1, predicted_idx, confidence)."""
        input_tensor = input_tensor.to(self.device).requires_grad_(True)

        logits = self.model(input_tensor)
        probs = F.softmax(logits, dim=1)
        confidence, idx = probs[0].max(0)
        idx_val = idx.item()

        # Back-prop the predicted class score
        self.model.zero_grad()
        logits[0, idx_val].backward()

        # Grad-CAM weights: global-average-pool the gradients
        weights = self._gradients.mean(dim=(2, 3), keepdim=True)   # (1, C, 1, 1)
        cam = (weights * self._activations).sum(dim=1, keepdim=True)  # (1, 1, H, W)
        cam = F.relu(cam)

        # Normalise to [0, 1]
        cam = cam.squeeze().cpu().numpy()
        if cam.max() > 0:
            cam = cam / cam.max()

        return cam, idx_val, confidence.item()

    # ── public API ──

    def generate_heatmap(self, image_bytes: bytes) -> dict:
        """
        Generate a real Grad-CAM heatmap for the given X-ray image.
        Returns base64-encoded overlay image and focus region metadata.
        """
        # Open & preprocess
        original = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        original_resized = original.resize((224, 224))
        input_tensor = _PREPROCESS(original_resized).unsqueeze(0)

        # Compute Grad-CAM
        cam, pred_idx, confidence = self._compute_cam(input_tensor)

        # Resize CAM to image dimensions
        cam_resized = np.array(
            Image.fromarray((cam * 255).astype(np.uint8)).resize((224, 224), Image.BILINEAR)
        ).astype(np.float32) / 255.0

        # Apply JET-style colormap (red = hot, blue = cold)
        heatmap_colored = self._apply_colormap(cam_resized)

        # Overlay on original image
        img_array = np.array(original_resized).astype(np.float32)
        overlay = (img_array * 0.55 + heatmap_colored * 0.45).clip(0, 255).astype(np.uint8)
        overlay_img = Image.fromarray(overlay)

        # Encode to base64
        buffer = io.BytesIO()
        overlay_img.save(buffer, format="PNG")
        heatmap_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        # Compute focus region (centroid of high-activation area)
        focus = self._compute_focus_region(cam_resized)

        return {
            "heatmap_image": f"data:image/png;base64,{heatmap_b64}",
            "predicted_class": CLASS_NAMES[pred_idx].capitalize(),
            "confidence": round(confidence, 4),
            "focus_region": focus,
        }

    # ── helpers ──

    @staticmethod
    def _apply_colormap(cam: np.ndarray) -> np.ndarray:
        """Convert single-channel [0,1] heatmap to RGB JET-style colormap."""
        h, w = cam.shape
        colored = np.zeros((h, w, 3), dtype=np.float32)

        # Blue → Cyan → Green → Yellow → Red
        colored[:, :, 0] = np.clip(1.5 - np.abs(cam * 4 - 3), 0, 1) * 255  # R
        colored[:, :, 1] = np.clip(1.5 - np.abs(cam * 4 - 2), 0, 1) * 255  # G
        colored[:, :, 2] = np.clip(1.5 - np.abs(cam * 4 - 1), 0, 1) * 255  # B

        return colored

    @staticmethod
    def _compute_focus_region(cam: np.ndarray) -> dict:
        """Find the centroid of the high-activation region (threshold > 0.5)."""
        mask = cam > 0.5
        if mask.sum() == 0:
            # Fall back to the whole map
            mask = cam > cam.mean()

        ys, xs = np.where(mask)
        if len(xs) == 0:
            return {"x": 0.5, "y": 0.5, "intensity": 0.0}

        # Normalise centroid to [0, 1] range
        cx = float(xs.mean() / cam.shape[1])
        cy = float(ys.mean() / cam.shape[0])
        intensity = float(cam[mask].mean())

        return {"x": round(cx, 4), "y": round(cy, 4), "intensity": round(intensity, 4)}
