from fastapi import APIRouter, UploadFile, File, Form, Depends
from services.prediction_service import PredictionService
from chatbot.medical_chatbot import MedicalChatbot
from chatbot.clinical_chatbot_engine import ClinicalChatbotEngine
from reports.report_generator import ReportGenerator
from explainability.gradcam import GradCAM
from explainability.shap_explainer import SHAPExplainer
from generative.diffusion_enhancer import DiffusionEnhancer
from auth.auth_handler import get_current_user
from database.models import User
from pydantic import BaseModel

router = APIRouter()
prediction_service = PredictionService()
chatbot = MedicalChatbot()
clinical_chatbot = ClinicalChatbotEngine()
report_generator = ReportGenerator()
gradcam = GradCAM()
shap_explainer = SHAPExplainer()
diffusion_enhancer = DiffusionEnhancer()


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    patient_age: int | None = None


class ReportRequest(BaseModel):
    predicted_disease: str
    confidence: float
    risk_level: str
    symptoms: str
    patient_age: str = "N/A"
    scan_type: str = "Chest X-ray"
    gradcam_explanation: str = ""
    shap_explanation: str = ""
    recommended_tests: list[str] | None = None
    uncertainty: float | None = None
    region_detected: str | None = None


@router.post("/predict-disease")
async def predict_disease(
    xray: UploadFile = File(...),
    symptoms: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    image_bytes = await xray.read()
    result = prediction_service.predict(image_bytes, symptoms)
    return result


@router.post("/chatbot")
async def chat(request: ChatRequest, current_user: User = Depends(get_current_user)):
    response = chatbot.get_response(request.message, request.conversation_id)
    return response


@router.post("/generate-report")
async def generate_report(request: ReportRequest, current_user: User = Depends(get_current_user)):
    report = report_generator.generate(
        predicted_disease=request.predicted_disease,
        confidence=request.confidence,
        risk_level=request.risk_level,
        symptoms=request.symptoms,
        patient_age=request.patient_age,
        scan_type=request.scan_type,
        gradcam_explanation=request.gradcam_explanation,
        shap_explanation=request.shap_explanation,
        recommended_tests=request.recommended_tests,
        uncertainty=request.uncertainty,
        region_detected=request.region_detected,
    )
    return report


@router.get("/health")
def health_check():
    return {"status": "healthy"}


@router.post("/explain/gradcam")
async def explain_gradcam(xray: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    image_bytes = await xray.read()
    result = gradcam.generate_heatmap(image_bytes)
    return result


class SHAPRequest(BaseModel):
    symptoms: str
    predicted_disease: str


@router.post("/explain/shap")
async def explain_shap(request: SHAPRequest, current_user: User = Depends(get_current_user)):
    result = shap_explainer.explain(request.symptoms, request.predicted_disease)
    return result


@router.post("/enhance-xray")
async def enhance_xray(xray: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    image_bytes = await xray.read()
    result = diffusion_enhancer.enhance_xray(image_bytes)
    return result


# ── Clinical Chatbot (BioBERT-powered) ────────────────────────


@router.post("/clinical-chatbot")
async def clinical_chat(request: ChatRequest, current_user: User = Depends(get_current_user)):
    """BioBERT-powered clinical interview chatbot with symptom extraction."""
    response = clinical_chatbot.process_message(
        request.message,
        request.conversation_id,
        request.patient_age,
    )
    return response


class ChatbotScanRequest(BaseModel):
    conversation_id: str


@router.post("/clinical-chatbot/scan")
async def clinical_chatbot_scan(
    xray: UploadFile = File(...),
    conversation_id: str = Form(...),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a scan from within a chatbot session.
    Merges chatbot-collected symptoms with AI radiology analysis.
    """
    image_bytes = await xray.read()

    # Get clinical context from chatbot session
    session = clinical_chatbot.sessions.get(conversation_id)
    symptoms = ""
    clinical_context = {}
    if session:
        symptoms = ", ".join(session["symptoms"]) if session["symptoms"] else ""
        clinical_context = {
            "duration": session.get("duration", ""),
            "severity": session.get("severity", ""),
            "temperature": session.get("temperature", ""),
            "age": session.get("age", ""),
        }

    # Run full prediction pipeline with chatbot-gathered symptoms
    result = prediction_service.predict(
        image_bytes=image_bytes,
        symptoms=symptoms if symptoms else "none reported",
    )

    # Attach chatbot clinical context to result
    result["chatbot_context"] = clinical_context
    result["chatbot_symptoms"] = symptoms

    return result
