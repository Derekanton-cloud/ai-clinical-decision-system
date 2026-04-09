"""
Counterfactual Explanation Engine.

Generates "what-if" explanations by iteratively modifying the symptom
vector and re-running predictions to discover the minimal change that
would alter the diagnosis.
"""

import random

SYMPTOM_FEATURES = [
    "cough", "fever", "breathlessness", "chest_pain",
    "weight_loss", "fatigue", "night_sweats", "hemoptysis",
    "wheezing", "loss_of_appetite",
]


def _parse_symptoms(symptoms_text: str) -> set[str]:
    """Extract symptom keywords present in free text."""
    text = symptoms_text.lower()
    present = set()
    for feat in SYMPTOM_FEATURES:
        readable = feat.replace("_", " ")
        if readable in text or feat in text:
            present.add(readable)
    return present


def _symptoms_to_text(symptom_set: set[str]) -> str:
    return ", ".join(sorted(symptom_set)) if symptom_set else ""


class CounterfactualEngine:
    """
    Generate counterfactual explanations showing what minimal symptom
    changes would alter the AI diagnosis.
    """

    def __init__(self, disease_model):
        """
        Args:
            disease_model: Instance of DiseaseModel with predict_from_symptoms().
        """
        self.model = disease_model

    def generate_counterfactuals(
        self,
        symptoms: str,
        original_disease: str,
        top_k: int = 3,
    ) -> list[dict]:
        """
        Produce up to top_k counterfactual scenarios.

        Strategy:
            1. Remove each present symptom one at a time.
            2. Add each absent symptom one at a time.
            3. Keep only scenarios where the diagnosis changes.
            4. Return top_k sorted by confidence (descending).
        """
        present = _parse_symptoms(symptoms)
        all_symptoms = {f.replace("_", " ") for f in SYMPTOM_FEATURES}
        absent = all_symptoms - present
        original_lower = original_disease.lower()

        candidates: list[dict] = []

        # ── Removal scenarios ──
        for symptom in present:
            modified = present - {symptom}
            modified_text = _symptoms_to_text(modified)
            if not modified_text:
                continue

            result = self.model.predict_from_symptoms(modified_text)
            if result["disease"].lower() != original_lower:
                candidates.append({
                    "change": f"remove {symptom}",
                    "modified_symptoms": modified_text,
                    "new_prediction": result["disease"],
                    "confidence": result["confidence"],
                })

        # ── Addition scenarios ──
        for symptom in absent:
            modified = present | {symptom}
            modified_text = _symptoms_to_text(modified)

            result = self.model.predict_from_symptoms(modified_text)
            if result["disease"].lower() != original_lower:
                candidates.append({
                    "change": f"add {symptom}",
                    "modified_symptoms": modified_text,
                    "new_prediction": result["disease"],
                    "confidence": result["confidence"],
                })

        # ── Swap scenarios (remove one, add another) ──
        for rem in present:
            for add in absent:
                modified = (present - {rem}) | {add}
                modified_text = _symptoms_to_text(modified)

                result = self.model.predict_from_symptoms(modified_text)
                if result["disease"].lower() != original_lower:
                    candidates.append({
                        "change": f"replace {rem} with {add}",
                        "modified_symptoms": modified_text,
                        "new_prediction": result["disease"],
                        "confidence": result["confidence"],
                    })

        # Deduplicate by (change description, new_prediction)
        seen = set()
        unique = []
        for c in candidates:
            key = (c["change"], c["new_prediction"])
            if key not in seen:
                seen.add(key)
                unique.append(c)

        # Sort by confidence descending and return top_k
        unique.sort(key=lambda c: c["confidence"], reverse=True)
        return unique[:top_k]
