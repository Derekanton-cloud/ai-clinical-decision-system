import uuid
from datetime import datetime


class MedicalChatbot:
    """
    Medical assistant chatbot that provides clinical guidance.
    Uses placeholder responses — replace with a real LLM (e.g., BioGPT, Med-PaLM) for production.
    """

    RESPONSES = {
        "pneumonia": (
            "Based on the symptoms you described, pneumonia is a possibility. "
            "Common signs include persistent cough, fever, and difficulty breathing. "
            "I recommend a chest X-ray and complete blood count. "
            "Please consult with a pulmonologist for a definitive diagnosis."
        ),
        "tuberculosis": (
            "Tuberculosis (TB) typically presents with chronic cough, night sweats, "
            "weight loss, and fever. A sputum test and chest X-ray are essential. "
            "If confirmed, a 6-month course of anti-TB medication is standard treatment."
        ),
        "covid": (
            "COVID-19 symptoms can range from mild to severe. Key indicators include "
            "fever, dry cough, fatigue, and loss of taste or smell. "
            "PCR testing is recommended. Isolate and monitor oxygen levels."
        ),
        "chest pain": (
            "Chest pain can have many causes including cardiac, pulmonary, and musculoskeletal. "
            "Given the clinical context, I recommend an ECG, troponin levels, and chest X-ray "
            "to rule out acute conditions."
        ),
        "default": (
            "I understand your concern. Based on the information provided, I recommend "
            "further diagnostic evaluation. Please provide more details about the symptoms, "
            "duration, and any relevant medical history for a more specific assessment."
        ),
    }

    def __init__(self):
        self.conversations: dict[str, list] = {}

    def get_response(self, message: str, conversation_id: str | None = None) -> dict:
        if conversation_id is None:
            conversation_id = str(uuid.uuid4())

        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []

        # Store user message
        self.conversations[conversation_id].append(
            {"role": "user", "content": message, "timestamp": datetime.now().isoformat()}
        )

        # Generate response based on keyword matching
        response_text = self._get_matching_response(message)

        self.conversations[conversation_id].append(
            {"role": "assistant", "content": response_text, "timestamp": datetime.now().isoformat()}
        )

        return {
            "conversation_id": conversation_id,
            "response": response_text,
            "timestamp": datetime.now().isoformat(),
        }

    def _get_matching_response(self, message: str) -> str:
        message_lower = message.lower()
        for keyword, response in self.RESPONSES.items():
            if keyword in message_lower:
                return response
        return self.RESPONSES["default"]
