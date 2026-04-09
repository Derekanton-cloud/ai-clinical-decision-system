import uuid
import re
from datetime import datetime
from nlp.mlm_symptom_extractor import MLMSymptomExtractor
from utils.logger import get_logger

_log = get_logger("clinical_chatbot")

# ── Conversation states ──
STATE_INITIAL = "initial"
STATE_COLLECTING_SYMPTOMS = "collecting_symptoms"
STATE_ASK_DURATION = "ask_duration"
STATE_ASK_SEVERITY = "ask_severity"
STATE_ASK_TEMPERATURE = "ask_temperature"
STATE_ASK_AGE = "ask_age"
STATE_READY = "ready"

# ── Disease-symptom rules for preliminary suggestion ──
DISEASE_RULES: dict[str, list[str]] = {
    "Pneumonia": ["cough", "fever", "shortness of breath", "chest pain", "sputum production"],
    "Tuberculosis": ["cough", "night sweats", "weight loss", "fever", "blood in sputum"],
    "COVID-19": ["fever", "dry cough", "fatigue", "loss of taste", "loss of smell"],
    "Bronchitis": ["cough", "wheezing", "chest tightness", "sputum production", "fatigue"],
    "Asthma": ["wheezing", "shortness of breath", "chest tightness", "cough"],
    "Lung Cancer": ["persistent cough", "weight loss", "chest pain", "blood in sputum", "fatigue"],
}

# ── Recommended tests per disease ──
RECOMMENDED_TESTS: dict[str, list[str]] = {
    "Pneumonia": ["Chest X-ray", "Complete Blood Count (CBC)", "Sputum Culture", "Pulse Oximetry"],
    "Tuberculosis": ["Chest X-ray", "Sputum AFB Smear", "Mantoux Test", "QuantiFERON-TB Gold"],
    "COVID-19": ["RT-PCR Test", "Chest CT", "Complete Blood Count (CBC)", "D-Dimer"],
    "Bronchitis": ["Chest X-ray", "Pulmonary Function Test", "Sputum Culture"],
    "Asthma": ["Spirometry", "Peak Flow Measurement", "Allergy Testing"],
    "Lung Cancer": ["Chest CT", "PET Scan", "Biopsy", "Complete Blood Count (CBC)"],
}


class ClinicalChatbotEngine:
    """
    Stateful clinical interview chatbot powered by BioBERT symptom extraction.
    Guides the patient through a structured symptom-collection interview,
    then produces disease suggestions and recommended tests.
    """

    def __init__(self):
        self.extractor = MLMSymptomExtractor()
        self.sessions: dict[str, dict] = {}

    # ── public API ──────────────────────────────────────────────

    def process_message(
        self,
        message: str,
        conversation_id: str | None = None,
        patient_age: str | int | None = None,
    ) -> dict:
        """
        Process a user message within a conversation.
        Returns response dict with keys:
            conversation_id, response, timestamp,
            state, detected_symptoms, disease_suggestions, recommended_tests,
            ready_for_scan
        """
        if conversation_id is None or conversation_id not in self.sessions:
            conversation_id = conversation_id or str(uuid.uuid4())
            self.sessions[conversation_id] = self._new_session()

        session = self.sessions[conversation_id]

        if patient_age is not None and str(patient_age).strip():
            session["age"] = str(patient_age).strip()

        session["history"].append({"role": "user", "content": message, "ts": _now()})

        # Extract symptoms only when user is describing symptoms.
        # This prevents control replies like "that's all" or age values from adding noise.
        extraction = {"detected_symptoms": [], "symptom_scores": {}}
        should_extract = session["state"] in {STATE_INITIAL, STATE_COLLECTING_SYMPTOMS, STATE_READY}
        if session["state"] == STATE_COLLECTING_SYMPTOMS and self._is_negative(message):
            should_extract = False

        if should_extract:
            extraction = self.extractor.extract_symptoms(message)
            new_symptoms = extraction["detected_symptoms"]
            for s in new_symptoms:
                if s not in session["symptoms"]:
                    session["symptoms"].append(s)
        else:
            new_symptoms = []

        # State machine
        response_text = self._advance_state(session, message, new_symptoms)

        # Compute disease suggestions once we have symptoms
        suggestions = self._suggest_diseases(session["symptoms"])
        tests = self._recommend_tests(suggestions)

        session["history"].append({"role": "assistant", "content": response_text, "ts": _now()})

        return {
            "conversation_id": conversation_id,
            "response": response_text,
            "timestamp": _now(),
            "state": session["state"],
            "detected_symptoms": session["symptoms"],
            "symptom_scores": extraction["symptom_scores"],
            "disease_suggestions": suggestions,
            "recommended_tests": tests,
            "ready_for_scan": session["state"] == STATE_READY,
            "clinical_context": self._build_clinical_context(session),
        }

    # ── state machine ──────────────────────────────────────────

    def _advance_state(self, session: dict, message: str, new_symptoms: list[str]) -> str:
        state = session["state"]

        if state == STATE_INITIAL:
            session["state"] = STATE_COLLECTING_SYMPTOMS
            if new_symptoms:
                return (
                    f"I've detected the following symptoms: {', '.join(new_symptoms)}. "
                    "Are there any other symptoms you're experiencing? "
                    "Please describe everything you've been feeling."
                )
            return (
                "Welcome to the clinical assessment. "
                "Please describe your symptoms in detail — for example, "
                "'I have a persistent cough, fever, and difficulty breathing.'"
            )

        if state == STATE_COLLECTING_SYMPTOMS:
            # If user says "no" / "that's all" / "nothing else", move on
            if self._is_negative(message) and session["symptoms"]:
                session["state"] = STATE_ASK_DURATION
                return "How long have you been experiencing these symptoms? (e.g., 3 days, 1 week)"

            if new_symptoms:
                return (
                    f"Noted: {', '.join(new_symptoms)}. "
                    f"Your current symptom list: {', '.join(session['symptoms'])}. "
                    "Anything else, or shall I continue with the assessment?"
                )
            if session["symptoms"]:
                return (
                    f"Current symptoms: {', '.join(session['symptoms'])}. "
                    "Any additional symptoms? Say 'no' if that's everything."
                )
            return "I didn't catch any specific symptoms. Could you describe what you're feeling in more detail?"

        if state == STATE_ASK_DURATION:
            session["duration"] = message.strip()
            session["state"] = STATE_ASK_SEVERITY
            return (
                "On a scale of 1-10, how would you rate the overall severity of your symptoms? "
                "(1 = very mild, 10 = extremely severe)"
            )

        if state == STATE_ASK_SEVERITY:
            session["severity"] = message.strip()
            session["state"] = STATE_ASK_TEMPERATURE
            return "Have you measured your temperature? If so, what was the reading? (e.g., 38.5°C or 101.3°F)"

        if state == STATE_ASK_TEMPERATURE:
            session["temperature"] = message.strip()
            if session.get("age"):
                session["state"] = STATE_READY
                return self._build_final_summary(session, used_registered_age=True)

            session["state"] = STATE_ASK_AGE
            return "What is the patient's age?"

        if state == STATE_ASK_AGE:
            session["age"] = message.strip()
            session["state"] = STATE_READY
            return self._build_final_summary(session, used_registered_age=False)

        # STATE_READY — free conversation
        if new_symptoms:
            for s in new_symptoms:
                if s not in session["symptoms"]:
                    session["symptoms"].append(s)

        suggestions = self._suggest_diseases(session["symptoms"])
        if suggestions:
            top_disease = suggestions[0][0]
            tests = RECOMMENDED_TESTS.get(top_disease, [])
            return (
                f"Based on your symptoms, {top_disease} remains the most likely condition "
                f"(match: {suggestions[0][1]:.0%}). "
                f"Recommended tests: {', '.join(tests)}. "
                "Upload a chest X-ray for a comprehensive AI analysis, or ask me anything else."
            )
        return (
            "I'm here to help. You can describe additional symptoms, "
            "ask about specific conditions, or upload a chest X-ray for analysis."
        )

    # ── helpers ─────────────────────────────────────────────────

    @staticmethod
    def _new_session() -> dict:
        return {
            "state": STATE_INITIAL,
            "symptoms": [],
            "duration": "",
            "severity": "",
            "temperature": "",
            "age": "",
            "history": [],
        }

    @staticmethod
    def _is_negative(text: str) -> bool:
        normalized = re.sub(r"[^a-z0-9\s]", "", text.strip().lower())
        normalized = re.sub(r"\s+", " ", normalized)
        negatives = {
            "no",
            "nope",
            "nothing",
            "none",
            "no more",
            "done",
            "n a",
            "thats all",
            "that is all",
            "thats it",
            "that is it",
            "all",
        }
        return normalized in negatives

    @staticmethod
    def _suggest_diseases(symptoms: list[str]) -> list[tuple[str, float]]:
        """Score each disease by fraction of its key symptoms that match."""
        if not symptoms:
            return []

        symptom_set = {s.lower() for s in symptoms}
        scores: list[tuple[str, float]] = []

        for disease, disease_symptoms in DISEASE_RULES.items():
            matched = sum(1 for ds in disease_symptoms if ds.lower() in symptom_set)
            if matched > 0:
                score = matched / len(disease_symptoms)
                scores.append((disease, score))

        scores.sort(key=lambda x: x[1], reverse=True)
        return scores

    @staticmethod
    def _recommend_tests(suggestions: list[tuple[str, float]]) -> list[str]:
        """Collect unique tests from top disease suggestions."""
        seen: set[str] = set()
        tests: list[str] = []
        for disease, _ in suggestions[:3]:
            for test in RECOMMENDED_TESTS.get(disease, []):
                if test not in seen:
                    seen.add(test)
                    tests.append(test)
        return tests

    @staticmethod
    def _build_clinical_context(session: dict) -> dict:
        """Build a context dict that can be passed to PredictionService."""
        return {
            "symptoms": ", ".join(session["symptoms"]),
            "duration": session["duration"],
            "severity": session["severity"],
            "temperature": session["temperature"],
            "age": session["age"],
        }

    def _build_final_summary(self, session: dict, used_registered_age: bool) -> str:
        suggestions = self._suggest_diseases(session["symptoms"])
        tests = self._recommend_tests(suggestions)

        summary_lines = [
            "Thank you. Here is the clinical summary:",
            f"  • Symptoms: {', '.join(session['symptoms'])}",
            f"  • Duration: {session['duration']}",
            f"  • Severity: {session['severity']}/10",
            f"  • Temperature: {session['temperature']}",
            f"  • Age: {session['age']}",
            "",
        ]

        if used_registered_age:
            summary_lines.append("Using age from the registered patient profile.")
            summary_lines.append("")

        if suggestions:
            summary_lines.append("Preliminary disease suggestions:")
            for disease, score in suggestions[:3]:
                summary_lines.append(f"  • {disease} (match: {score:.0%})")
            summary_lines.append("")

        if tests:
            summary_lines.append("Recommended diagnostic tests:")
            for test in tests:
                summary_lines.append(f"  • {test}")
            summary_lines.append("")

        summary_lines.append(
            "You can now upload a chest X-ray scan for AI-powered radiology analysis, "
            "or continue asking questions."
        )
        return "\n".join(summary_lines)


def _now() -> str:
    return datetime.now().isoformat()
