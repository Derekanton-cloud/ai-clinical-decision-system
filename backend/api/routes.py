from fastapi import APIRouter, UploadFile, File, Form, Depends
from reports.report_generator import ReportGenerator
from auth.auth_handler import get_current_user
from database.models import User
from pydantic import BaseModel

router = APIRouter()
# Keep optional ML artifacts out of application startup.  Free-tier workers
# must be able to boot and serve core patient/case workflows without them.
prediction_service = None
chatbot = None
clinical_chatbot = None
report_generator = None
gradcam = None
shap_explainer = None

def _prediction_service():
    global prediction_service
    if prediction_service is None:
        from services.prediction_service import PredictionService
        prediction_service = PredictionService()
    return prediction_service

def _chatbot():
    global chatbot
    if chatbot is None:
        from chatbot.medical_chatbot import MedicalChatbot
        chatbot = MedicalChatbot()
    return chatbot

def _clinical_chatbot():
    global clinical_chatbot
    if clinical_chatbot is None:
        from chatbot.clinical_chatbot_engine import ClinicalChatbotEngine
        clinical_chatbot = ClinicalChatbotEngine()
    return clinical_chatbot

def _report_generator():
    global report_generator
    if report_generator is None:
        report_generator = ReportGenerator()
    return report_generator

def _gradcam():
    global gradcam
    if gradcam is None:
        from explainability.gradcam import GradCAM
        gradcam = GradCAM()
    return gradcam

def _shap_explainer():
    global shap_explainer
    if shap_explainer is None:
        from explainability.shap_explainer import SHAPExplainer
        shap_explainer = SHAPExplainer()
    return shap_explainer


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
    patient_name: str = "Not Provided"
    patient_code: str = "N/A"
    hospital_name: str = "General Hospital"
    requesting_clinician: str = "AI Clinical Team"
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
    from models.artifact_status import model_artifact_status
    from fastapi import HTTPException
    available, reason = model_artifact_status()
    if not available:
        raise HTTPException(status_code=503, detail=f"Chest X-ray analysis is unavailable: {reason}")
    image_bytes = await xray.read()
    result = _prediction_service().predict(image_bytes, symptoms)
    return result


@router.post("/chatbot")
async def chat(request: ChatRequest, current_user: User = Depends(get_current_user)):
    response = _chatbot().get_response(request.message, request.conversation_id)
    return response


@router.post("/generate-report")
async def generate_report(request: ReportRequest, current_user: User = Depends(get_current_user)):
    report = _report_generator().generate(
        predicted_disease=request.predicted_disease,
        confidence=request.confidence,
        risk_level=request.risk_level,
        symptoms=request.symptoms,
        patient_age=request.patient_age,
        patient_name=request.patient_name,
        patient_code=request.patient_code,
        hospital_name=request.hospital_name,
        requesting_clinician=request.requesting_clinician,
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
    from models.artifact_status import model_artifact_status
    available, detail = model_artifact_status()
    return {"status": "healthy", "xray_model": "available" if available else "unavailable", "xray_model_detail": detail, "clinical_note": "Not a diagnostic device"}


@router.post("/explain/gradcam")
async def explain_gradcam(xray: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    image_bytes = await xray.read()
    result = _gradcam().generate_heatmap(image_bytes)
    return result


class SHAPRequest(BaseModel):
    symptoms: str
    predicted_disease: str


@router.post("/explain/shap")
async def explain_shap(request: SHAPRequest, current_user: User = Depends(get_current_user)):
    result = _shap_explainer().explain(request.symptoms, request.predicted_disease)
    return result


@router.post("/enhance-xray")
async def enhance_xray(xray: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    from fastapi import HTTPException
    raise HTTPException(status_code=503, detail="X-ray enhancement is unavailable because validated denoiser weights are not installed.")


# ── Clinical Chatbot (BioBERT-powered) ────────────────────────


@router.post("/clinical-chatbot")
async def clinical_chat(request: ChatRequest, current_user: User = Depends(get_current_user)):
    """BioBERT-powered clinical interview chatbot with symptom extraction."""
    response = _clinical_chatbot().process_message(
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
    bot = _clinical_chatbot()
    session = bot.sessions.get(conversation_id)
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
    result = _prediction_service().predict(
        image_bytes=image_bytes,
        symptoms=symptoms if symptoms else "none reported",
    )

    # Attach chatbot clinical context to result
    result["chatbot_context"] = clinical_context
    result["chatbot_symptoms"] = symptoms

    return result
