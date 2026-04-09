"""
Interactive AI Explanation Engine.

Combines Grad-CAM spatial results, SHAP feature importance, and model
confidence into structured natural-language explanations.
"""


# ── Lung region mapping based on normalised (x, y) coordinates ──
# Chest X-ray convention: (0,0) = top-left, (1,1) = bottom-right
# Patient's right = image left

def _region_label(x: float, y: float) -> str:
    """Map normalised Grad-CAM focus coordinates to an anatomical region."""
    lr = "right" if x < 0.5 else "left"
    ud = "upper" if y < 0.4 else ("middle" if y < 0.65 else "lower")
    return f"{lr} {ud} lung"


def _top_shap_features(feature_importance: dict, top_n: int = 3) -> list[str]:
    """Return the top-N positive SHAP feature names."""
    return [f for f, v in feature_importance.items() if v > 0.01][:top_n]


class ExplanationEngine:
    """
    Generate structured, human-readable explanations that unify
    imaging analysis (Grad-CAM), symptom analysis (SHAP), and
    model confidence into a single narrative.
    """

    def generate_explanation(
        self,
        predicted_disease: str,
        confidence: float,
        gradcam_result: dict | None = None,
        shap_result: dict | None = None,
        uncertainty_result: dict | None = None,
    ) -> dict:
        """
        Build a multi-part explanation.

        Args:
            predicted_disease: Predicted disease label.
            confidence: Primary model confidence.
            gradcam_result: Output from GradCAM.generate_heatmap().
            shap_result: Output from SHAPExplainer.explain().
            uncertainty_result: Output from UncertaintyEstimator.estimate().

        Returns:
            {
                "explanation": str,           # full narrative
                "imaging_explanation": str,   # Grad-CAM region note
                "symptom_explanation": str,   # SHAP feature note
                "confidence_explanation": str, # confidence / uncertainty note
                "region_detected": str | None  # anatomical region
            }
        """
        parts = []
        region_detected = None

        # ── 1. Main diagnosis sentence ──
        conf_pct = round(confidence * 100)
        parts.append(
            f"The AI detected {predicted_disease} with {conf_pct}% confidence."
        )

        # ── 2. Symptom analysis (SHAP) ──
        symptom_explanation = ""
        if shap_result and "feature_importance" in shap_result:
            top = _top_shap_features(shap_result["feature_importance"])
            if top:
                symptom_list = " and ".join(top) if len(top) <= 2 else (
                    ", ".join(top[:-1]) + ", and " + top[-1]
                )
                symptom_explanation = (
                    f"The most influential symptoms were {symptom_list}."
                )
                parts.append(symptom_explanation)

        # ── 3. Imaging analysis (Grad-CAM) ──
        imaging_explanation = ""
        if gradcam_result and "focus_region" in gradcam_result:
            focus = gradcam_result["focus_region"]
            x = focus.get("x", 0.5)
            y = focus.get("y", 0.5)
            intensity = focus.get("intensity", 0.0)
            region_detected = _region_label(x, y)

            if intensity > 0.3:
                imaging_explanation = (
                    f"The X-ray heatmap highlights the {region_detected} region "
                    f"consistent with pulmonary abnormality."
                )
            else:
                imaging_explanation = (
                    f"A mild area of interest was detected in the {region_detected} region."
                )
            parts.append(imaging_explanation)

        # ── 4. Confidence / uncertainty ──
        confidence_explanation = ""
        if uncertainty_result:
            unc = uncertainty_result.get("uncertainty", 0)
            agreement = uncertainty_result.get("model_agreement", 1.0)
            warning = uncertainty_result.get("warning")

            if warning:
                confidence_explanation = warning
            elif agreement >= 0.9:
                confidence_explanation = (
                    f"The model showed high internal agreement ({round(agreement * 100)}%) "
                    f"with low uncertainty ({round(unc, 3)})."
                )
            else:
                confidence_explanation = (
                    f"Model agreement was {round(agreement * 100)}% across stochastic passes "
                    f"with uncertainty {round(unc, 3)}."
                )
            parts.append(confidence_explanation)
        else:
            if confidence >= 0.85:
                confidence_explanation = "The model is highly confident in this prediction."
            elif confidence >= 0.6:
                confidence_explanation = "The model shows moderate confidence."
            else:
                confidence_explanation = (
                    "Confidence is below threshold. Consider additional diagnostic tests."
                )
            parts.append(confidence_explanation)

        return {
            "explanation": " ".join(parts),
            "imaging_explanation": imaging_explanation,
            "symptom_explanation": symptom_explanation,
            "confidence_explanation": confidence_explanation,
            "region_detected": region_detected,
        }
