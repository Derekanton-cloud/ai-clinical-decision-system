import numpy as np
import shap


# ── symptom vocabulary ──
SYMPTOM_FEATURES = [
    "cough",
    "fever",
    "breathlessness",
    "chest_pain",
    "weight_loss",
    "fatigue",
    "night_sweats",
    "hemoptysis",
    "wheezing",
    "loss_of_appetite",
]

DISEASES = ["Pneumonia", "Tuberculosis", "COVID-19", "Lung Cancer", "Pleural Effusion"]

# Disease–symptom association weights (rows = diseases, cols = symptoms).
# Values represent how strongly each symptom contributes to each disease.
_DISEASE_SYMPTOM_WEIGHTS = np.array([
    # cough  fever  breath chest  wloss  fatigue nsweats hemo   wheeze appetite
    [  0.40,  0.35,  0.30,  0.25,  0.05,  0.20,  0.10,  0.05,  0.15,  0.10],  # Pneumonia
    [  0.30,  0.35,  0.15,  0.15,  0.30,  0.25,  0.40,  0.25,  0.05,  0.20],  # Tuberculosis
    [  0.35,  0.40,  0.40,  0.20,  0.05,  0.35,  0.05,  0.02,  0.10,  0.15],  # COVID-19
    [  0.20,  0.10,  0.25,  0.30,  0.40,  0.30,  0.15,  0.35,  0.10,  0.30],  # Lung Cancer
    [  0.10,  0.15,  0.35,  0.40,  0.10,  0.20,  0.05,  0.05,  0.10,  0.10],  # Pleural Effusion
], dtype=np.float64)


def _text_to_feature_vector(symptoms_text: str) -> np.ndarray:
    """Convert free-text symptoms into a binary feature vector."""
    text = symptoms_text.lower()
    vec = np.zeros(len(SYMPTOM_FEATURES), dtype=np.float64)
    for i, feat in enumerate(SYMPTOM_FEATURES):
        readable = feat.replace("_", " ")
        if readable in text or feat in text:
            vec[i] = 1.0
    return vec


def _predict_fn(feature_matrix: np.ndarray, disease_idx: int) -> np.ndarray:
    """Score function for a single disease — takes (N, num_features) and returns (N, 1)."""
    raw = feature_matrix @ _DISEASE_SYMPTOM_WEIGHTS[disease_idx]
    # Normalise to [0, 1] via sigmoid-like scaling
    scores = 1.0 / (1.0 + np.exp(-3.0 * (raw - 0.5)))
    return scores.reshape(-1, 1)


class SHAPExplainer:
    """
    SHAP explainer for symptom-based predictions.
    Uses KernelExplainer to compute real Shapley values showing how
    each symptom contributes to the predicted disease score.
    """

    def __init__(self):
        # Background dataset: all-zeros baseline (no symptoms present)
        self._background = np.zeros((1, len(SYMPTOM_FEATURES)), dtype=np.float64)
        # Cache explainers per disease to avoid recreating each call
        self._explainers: dict[int, shap.KernelExplainer] = {}

    def _get_explainer(self, disease_idx: int) -> shap.KernelExplainer:
        if disease_idx not in self._explainers:
            def model_fn(X: np.ndarray) -> np.ndarray:
                return _predict_fn(X, disease_idx)
            self._explainers[disease_idx] = shap.KernelExplainer(model_fn, self._background)
        return self._explainers[disease_idx]

    def explain(self, symptoms: str, predicted_disease: str) -> dict:
        """
        Compute SHAP values for a symptom-based prediction.
        Returns feature importance values for visualisation.
        """
        # Resolve disease index
        disease_idx = 0
        for i, d in enumerate(DISEASES):
            if d.lower() == predicted_disease.lower():
                disease_idx = i
                break

        explainer = self._get_explainer(disease_idx)

        # Convert input symptoms to feature vector
        x = _text_to_feature_vector(symptoms).reshape(1, -1)

        # Compute SHAP values
        shap_values = explainer.shap_values(x, nsamples=128, silent=True)
        sv = np.array(shap_values).squeeze()  # shape (num_features,)

        # Build feature importance dict with readable names
        feature_importance = {}
        for i, feat in enumerate(SYMPTOM_FEATURES):
            readable = feat.replace("_", " ")
            feature_importance[readable] = round(float(sv[i]), 4)

        # Sort by absolute importance (descending)
        feature_importance = dict(
            sorted(feature_importance.items(), key=lambda kv: abs(kv[1]), reverse=True)
        )

        base_value = round(float(np.array(explainer.expected_value).squeeze()), 4)

        # Build human-readable explanation
        top_features = [
            f for f, v in feature_importance.items() if v > 0.01
        ][:3]
        if top_features:
            top_str = ", ".join(top_features)
            explanation = (
                f"The model predicted {predicted_disease}. "
                f"The most contributing symptoms were: {top_str}."
            )
        else:
            explanation = (
                f"The model predicted {predicted_disease}. "
                f"No single symptom had a dominant contribution."
            )

        return {
            "predicted_disease": predicted_disease,
            "feature_importance": feature_importance,
            "base_value": base_value,
            "explanation": explanation,
        }
