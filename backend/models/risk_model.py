import numpy as np
import xgboost as xgb

# ── disease encoding ──
DISEASE_ENCODING = {
    "pneumonia": 0,
    "tuberculosis": 1,
    "covid-19": 2,
    "lung cancer": 3,
    "pleural effusion": 4,
    "normal": 5,
    "uncertain": 6,
}

# ── risk level mapping ──
RISK_LEVELS = [
    (0.25, "Low"),
    (0.50, "Moderate"),
    (0.75, "High"),
    (1.01, "Critical"),
]

# ── disease-specific baseline risk & progression rates ──
_DISEASE_RISK_PROFILE = {
    0: {"base": 0.45, "progression": 0.025},  # Pneumonia
    1: {"base": 0.55, "progression": 0.030},  # Tuberculosis
    2: {"base": 0.40, "progression": 0.028},  # COVID-19
    3: {"base": 0.70, "progression": 0.035},  # Lung Cancer
    4: {"base": 0.50, "progression": 0.020},  # Pleural Effusion
    5: {"base": 0.10, "progression": 0.002},  # Normal
    6: {"base": 0.30, "progression": 0.010},  # Uncertain
}


def _build_xgb_model() -> xgb.XGBRegressor:
    """Train an XGBoost regressor on synthetic clinical data."""
    rng = np.random.RandomState(42)
    n_samples = 2000

    # Generate synthetic training features:
    # [age, disease_code, confidence, symptom_severity, num_symptoms]
    ages = rng.randint(18, 90, size=n_samples).astype(np.float32)
    disease_codes = rng.randint(0, 7, size=n_samples).astype(np.float32)
    confidences = rng.uniform(0.3, 1.0, size=n_samples).astype(np.float32)
    severities = rng.uniform(0.0, 1.0, size=n_samples).astype(np.float32)
    num_symptoms = rng.randint(0, 11, size=n_samples).astype(np.float32)

    X_train = np.column_stack([ages, disease_codes, confidences, severities, num_symptoms])

    # Generate realistic target risk scores
    y_train = np.zeros(n_samples, dtype=np.float32)
    for i in range(n_samples):
        d = int(disease_codes[i])
        profile = _DISEASE_RISK_PROFILE.get(d, _DISEASE_RISK_PROFILE[6])
        base = profile["base"]

        # Risk increases with age, confidence, severity, and symptom count
        age_factor = (ages[i] - 18) / 72.0 * 0.15
        conf_factor = confidences[i] * 0.20
        sev_factor = severities[i] * 0.20
        sym_factor = (num_symptoms[i] / 10.0) * 0.10

        risk = base + age_factor + conf_factor + sev_factor + sym_factor
        risk += rng.normal(0, 0.03)  # slight noise
        y_train[i] = np.clip(risk, 0.0, 1.0)

    model = xgb.XGBRegressor(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        objective="reg:squarederror",
        random_state=42,
    )
    model.fit(X_train, y_train, verbose=False)
    return model


def _count_symptoms(symptoms_text: str) -> int:
    """Count recognized symptoms in free text."""
    keywords = [
        "cough", "fever", "breathlessness", "chest pain",
        "weight loss", "fatigue", "night sweats", "hemoptysis",
        "wheezing", "loss of appetite",
    ]
    text = symptoms_text.lower()
    return sum(1 for kw in keywords if kw in text)


def _symptom_severity(symptoms_text: str, num_symptoms: int) -> float:
    """Estimate severity from symptom count and high-severity keywords."""
    severe_keywords = ["hemoptysis", "breathlessness", "chest pain", "weight loss"]
    text = symptoms_text.lower()
    severe_count = sum(1 for kw in severe_keywords if kw in text)
    base = num_symptoms / 10.0
    severity_boost = severe_count * 0.15
    return min(base + severity_boost, 1.0)


class RiskModel:
    """XGBoost-based clinical risk prediction model."""

    _shared_model: xgb.XGBRegressor | None = None

    def __init__(self):
        if RiskModel._shared_model is None:
            RiskModel._shared_model = _build_xgb_model()
            print("[RiskModel] XGBoost risk model trained and ready")
        self.model = RiskModel._shared_model

    def predict_risk(
        self,
        predicted_disease: str,
        confidence: float,
        symptoms: str,
        age: int = 45,
    ) -> dict:
        """
        Predict clinical risk score, level, and 7-day timeline.

        Returns:
            {
                "risk_score": float,
                "risk_level": str,
                "timeline": [float * 7]
            }
        """
        disease_code = DISEASE_ENCODING.get(predicted_disease.lower(), 6)
        num_sym = _count_symptoms(symptoms)
        severity = _symptom_severity(symptoms, num_sym)

        features = np.array(
            [[age, disease_code, confidence, severity, num_sym]],
            dtype=np.float32,
        )

        risk_score = float(np.clip(self.model.predict(features)[0], 0.0, 1.0))

        # Map to risk level
        risk_level = "Critical"
        for threshold, level in RISK_LEVELS:
            if risk_score < threshold:
                risk_level = level
                break

        # Generate 7-day risk timeline projection
        profile = _DISEASE_RISK_PROFILE.get(disease_code, _DISEASE_RISK_PROFILE[6])
        progression = profile["progression"]
        timeline = [
            round(min(risk_score + progression * day, 1.0), 4)
            for day in range(7)
        ]

        return {
            "risk_score": round(risk_score, 4),
            "risk_level": risk_level,
            "timeline": timeline,
        }
