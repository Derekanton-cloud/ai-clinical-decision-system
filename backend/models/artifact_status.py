"""Checkpoint provenance checks with no ML-runtime dependency."""
import json
from pathlib import Path

MODEL_DIR = Path(__file__).resolve().parent
WEIGHTS_PATH = MODEL_DIR / "xray_model.pt"
MANIFEST_PATH = MODEL_DIR / "xray_model.manifest.json"
CLASS_NAMES = ["normal", "pneumonia"]


def model_artifact_status() -> tuple[bool, str]:
    if not WEIGHTS_PATH.is_file():
        return False, "Trained chest X-ray weights are not installed."
    if not MANIFEST_PATH.is_file():
        return False, "Weights exist but have no deployment provenance manifest."
    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
        if manifest.get("architecture") != "efficientnet_b0" or manifest.get("class_names") != CLASS_NAMES:
            return False, "Model manifest is incompatible with the deployed architecture."
    except (OSError, json.JSONDecodeError):
        return False, "Model provenance manifest is invalid."
    return True, "available"
