import torch
import numpy as np
from transformers import BertTokenizer, BertModel
from utils.logger import get_logger

_log = get_logger("mlm_symptom_extractor")

# Clinical symptom vocabulary for embedding-based matching
SYMPTOM_VOCABULARY = [
    "cough", "fever", "shortness of breath", "chest pain", "fatigue",
    "night sweats", "weight loss", "sputum production", "wheezing",
    "chills", "headache", "sore throat", "runny nose", "body aches",
    "loss of taste", "loss of smell", "nausea", "vomiting", "diarrhea",
    "difficulty breathing", "rapid heartbeat", "dizziness", "confusion",
    "bluish lips", "persistent cough", "blood in sputum", "chest tightness",
    "muscle pain", "joint pain", "skin rash", "swollen lymph nodes",
    "abdominal pain", "back pain", "dry cough", "productive cough",
    "high fever", "low grade fever", "malaise", "loss of appetite",
]


class MLMSymptomExtractor:
    """
    Uses BioBERT (dmis-lab/biobert-base-cased-v1.1) to extract and match
    clinical symptoms from free-text patient descriptions via contextual
    embedding similarity.
    """

    _shared_model = None
    _shared_tokenizer = None
    _shared_vocab_embeddings = None

    def __init__(self, model_name: str = "dmis-lab/biobert-base-cased-v1.1"):
        self.model_name = model_name
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        if MLMSymptomExtractor._shared_model is None:
            _log.info("Loading BioBERT model: %s on %s", model_name, self.device)
            MLMSymptomExtractor._shared_tokenizer = BertTokenizer.from_pretrained(model_name)
            MLMSymptomExtractor._shared_model = BertModel.from_pretrained(model_name).to(self.device)
            MLMSymptomExtractor._shared_model.eval()

        self.tokenizer = MLMSymptomExtractor._shared_tokenizer
        self.model = MLMSymptomExtractor._shared_model

        if MLMSymptomExtractor._shared_vocab_embeddings is None:
            # Pre-compute symptom vocabulary embeddings
            MLMSymptomExtractor._shared_vocab_embeddings = self._embed_vocabulary()
            _log.info("BioBERT loaded — %d symptom embeddings cached", len(SYMPTOM_VOCABULARY))

        self.vocab_embeddings = MLMSymptomExtractor._shared_vocab_embeddings

    # ── public API ──────────────────────────────────────────────

    def extract_symptoms(self, text: str, z_threshold: float = 1.0) -> dict:
        """
        Extract symptoms from free-text by computing cosine similarity
        between the input embedding and each symptom in the vocabulary.
        Uses z-score selection: only symptoms with similarity > mean + z_threshold * std
        are returned, ensuring adaptive filtering regardless of baseline similarity.

        Returns:
            {
                "detected_symptoms": ["cough", "fever", ...],
                "symptom_scores": {"cough": 0.82, "fever": 0.71, ...},
                "symptom_string": "cough, fever, ...",
                "raw_text": <original text>,
            }
        """
        text_embedding = self._embed_text(text)

        # Compute all similarities first
        all_scores: dict[str, float] = {}
        for symptom, symptom_emb in zip(SYMPTOM_VOCABULARY, self.vocab_embeddings):
            all_scores[symptom] = self._cosine_similarity(text_embedding, symptom_emb)

        # Adaptive z-score filtering
        values = list(all_scores.values())
        mean_sim = float(np.mean(values))
        std_sim = float(np.std(values))
        cutoff = mean_sim + z_threshold * std_sim

        scores = {s: round(v, 4) for s, v in all_scores.items() if v >= cutoff}

        # Deduplicate overlapping symptoms (e.g. "cough" vs "persistent cough")
        detected = self._deduplicate_symptoms(scores)

        symptom_string = ", ".join(sorted(detected.keys()))

        _log.info("Extracted %d symptoms from text (%d chars)", len(detected), len(text))

        return {
            "detected_symptoms": sorted(detected.keys()),
            "symptom_scores": detected,
            "symptom_string": symptom_string,
            "raw_text": text,
        }

    # ── internal helpers ────────────────────────────────────────

    def _embed_text(self, text: str) -> np.ndarray:
        """Get mean-pooled [CLS] + token embeddings for a text string."""
        tokens = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding=True,
        ).to(self.device)

        with torch.no_grad():
            output = self.model(**tokens)

        # Mean-pool over token dimension
        embedding = output.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()
        return embedding

    def _embed_vocabulary(self) -> list[np.ndarray]:
        """Pre-compute embeddings for all symptom phrases."""
        embeddings = []
        for symptom in SYMPTOM_VOCABULARY:
            prompt = f"The patient presents with {symptom}."
            embeddings.append(self._embed_text(prompt))
        return embeddings

    @staticmethod
    def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    @staticmethod
    def _deduplicate_symptoms(scores: dict[str, float]) -> dict[str, float]:
        """
        When overlapping terms are detected (e.g. 'cough' and 'persistent cough'),
        keep only the more specific (longer) term.
        """
        sorted_symptoms = sorted(scores.keys(), key=len, reverse=True)
        kept: dict[str, float] = {}
        for symptom in sorted_symptoms:
            # Skip if a longer term already covers this symptom
            if any(symptom in longer and symptom != longer for longer in kept):
                continue
            kept[symptom] = scores[symptom]
        return kept
