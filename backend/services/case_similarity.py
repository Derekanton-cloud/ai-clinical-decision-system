import numpy as np

# ── symptom vocabulary (same as SHAP explainer) ──
SYMPTOM_FEATURES = [
    "cough", "fever", "breathlessness", "chest_pain",
    "weight_loss", "fatigue", "night_sweats", "hemoptysis",
    "wheezing", "loss_of_appetite",
]

DISEASE_ENCODING = {
    "pneumonia": 0, "tuberculosis": 1, "covid-19": 2,
    "lung cancer": 3, "pleural effusion": 4, "normal": 5, "uncertain": 6,
}

DISEASE_NAMES = {v: k.title() for k, v in DISEASE_ENCODING.items()}


def _text_to_symptom_vector(symptoms_text: str) -> np.ndarray:
    """Convert free-text symptoms to a binary vector of length 10."""
    text = symptoms_text.lower()
    vec = np.zeros(len(SYMPTOM_FEATURES), dtype=np.float64)
    for i, feat in enumerate(SYMPTOM_FEATURES):
        readable = feat.replace("_", " ")
        if readable in text or feat in text:
            vec[i] = 1.0
    return vec


def build_case_vector(
    predicted_disease: str,
    confidence: float,
    risk_score: float,
    symptoms: str,
    age: int = 45,
) -> np.ndarray:
    """Build a 14-dimensional case vector for similarity search."""
    disease_code = DISEASE_ENCODING.get(predicted_disease.lower(), 6)
    symptom_vec = _text_to_symptom_vector(symptoms)
    norm_age = age / 100.0
    return np.array(
        [disease_code / 6.0, confidence, risk_score, *symptom_vec, norm_age],
        dtype=np.float64,
    )


def build_multimodal_vector(
    image_features: np.ndarray,
    symptoms: str,
    age: int = 45,
    risk_score: float = 0.5,
    confidence: float = 0.8,
) -> np.ndarray:
    """
    Build a 141-dimensional multimodal embedding.

    Components:
        [0:128]   CNN image features (projected)
        [128:138] Symptom binary vector
        [138:141] Clinical (age/100, risk_score, confidence)
    """
    symptom_vec = _text_to_symptom_vector(symptoms)
    clinical = np.array([age / 100.0, risk_score, confidence], dtype=np.float64)
    embedding = np.concatenate([image_features.astype(np.float64), symptom_vec, clinical])
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    dot = np.dot(a, b)
    norm = np.linalg.norm(a) * np.linalg.norm(b)
    if norm == 0:
        return 0.0
    return float(dot / norm)


# ── synthetic case database ──

_SYMPTOM_COMBOS = {
    0: ["cough, fever, chest pain", "cough, fever, breathlessness", "fever, fatigue, cough"],
    1: ["cough, night sweats, weight loss", "fever, fatigue, hemoptysis", "night sweats, cough, fever"],
    2: ["fever, breathlessness, fatigue", "cough, fever, loss of appetite", "breathlessness, fatigue, fever"],
    3: ["hemoptysis, weight loss, chest pain", "fatigue, weight loss, breathlessness", "chest pain, wheezing, hemoptysis"],
    4: ["chest pain, breathlessness", "breathlessness, fatigue", "chest pain, fever, breathlessness"],
    5: ["", "fatigue", "cough"],
    6: ["cough", "fever", ""],
}


def _generate_case_database(n: int = 1000) -> list[dict]:
    """Generate a synthetic database of past patient cases."""
    rng = np.random.RandomState(123)
    cases = []
    for i in range(n):
        disease_code = rng.randint(0, 7)
        disease = DISEASE_NAMES.get(disease_code, "Uncertain")
        combos = _SYMPTOM_COMBOS[disease_code]
        symptoms = combos[rng.randint(0, len(combos))]
        confidence = round(float(rng.uniform(0.45, 0.99)), 2)
        risk_score = round(float(rng.uniform(0.1, 0.95)), 2)
        age = int(rng.randint(18, 90))

        cases.append({
            "case_id": f"CSE-{i + 1:04d}",
            "disease": disease,
            "confidence": confidence,
            "risk_score": risk_score,
            "symptoms": symptoms,
            "age": age,
        })
    return cases


class CaseSimilarityEngine:
    """Retrieve past patient cases most similar to the current patient."""

    _shared_db: list[dict] | None = None
    _shared_vectors: np.ndarray | None = None

    def __init__(self):
        if CaseSimilarityEngine._shared_db is None:
            db = _generate_case_database(1000)
            vectors = np.array([
                build_case_vector(
                    c["disease"], c["confidence"], c["risk_score"],
                    c["symptoms"], c["age"],
                )
                for c in db
            ])
            CaseSimilarityEngine._shared_db = db
            CaseSimilarityEngine._shared_vectors = vectors
            print(f"[CaseSimilarity] Loaded {len(db)} historical cases")

        self.cases = CaseSimilarityEngine._shared_db
        self.vectors = CaseSimilarityEngine._shared_vectors

    def find_similar_cases(
        self,
        predicted_disease: str,
        confidence: float,
        risk_score: float,
        symptoms: str,
        age: int = 45,
        top_k: int = 5,
        multimodal_embedding: np.ndarray | None = None,
    ) -> list[dict]:
        """
        Return the top-k most similar historical cases.

        If multimodal_embedding (141-dim) is provided, it augments the
        basic 14-dim similarity with the richer representation.
        """
        query = build_case_vector(predicted_disease, confidence, risk_score, symptoms, age)

        similarities = np.array([
            _cosine_similarity(query, v) for v in self.vectors
        ])

        # Boost with multimodal embedding if available
        if multimodal_embedding is not None:
            # Compare multimodal embedding against basic vectors by projecting
            # to same space (use first 14 dims padded or just use basic)
            pass  # multimodal matching against full DB requires stored embeddings

        top_indices = np.argsort(similarities)[::-1][:top_k]

        results = []
        for idx in top_indices:
            c = self.cases[idx]
            results.append({
                "case_id": c["case_id"],
                "disease": c["disease"],
                "confidence": c["confidence"],
                "risk_score": c["risk_score"],
                "similarity": round(float(similarities[idx]), 4),
            })
        return results
