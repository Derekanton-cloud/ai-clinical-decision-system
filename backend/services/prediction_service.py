from models.disease_model import DiseaseModel
from models.risk_model import RiskModel
from models.uncertainty_model import UncertaintyEstimator
from models.patient_embedding import PatientEmbeddingModel
from generative.diffusion_enhancer import DiffusionEnhancer
from services.case_similarity import CaseSimilarityEngine
from services.guideline_engine import GuidelineEngine
from services.progression_model import ProgressionModel
from services.explanation_engine import ExplanationEngine
from services.counterfactual_engine import CounterfactualEngine
from services.analytics_export import AnalyticsExporter
from explainability.gradcam import GradCAM
from explainability.shap_explainer import SHAPExplainer
from utils.logger import get_logger

_log = get_logger("prediction")


class PredictionService:
    def __init__(self):
        self.model = DiseaseModel()
        self.risk_model = RiskModel()
        self.uncertainty_estimator = UncertaintyEstimator(n_passes=10)
        self.embedding_model = PatientEmbeddingModel()
        self.enhancer = DiffusionEnhancer()
        self.gradcam = GradCAM()
        self.shap_explainer = SHAPExplainer()
        self.case_engine = CaseSimilarityEngine()
        self.guideline_engine = GuidelineEngine()
        self.progression_model = ProgressionModel()
        self.explanation_engine = ExplanationEngine()
        self.counterfactual_engine = CounterfactualEngine(self.model)
        self.analytics = AnalyticsExporter()

    def predict(self, image_bytes: bytes, symptoms: str, enhance: bool = True) -> dict:
        # Optionally enhance X-ray via diffusion denoising before CNN inference
        if enhance:
            _log.info("Enhancing X-ray via diffusion denoiser")
            image_bytes = self.enhancer.enhance_xray_tensor(image_bytes)

        image_result = self.model.predict_from_image(image_bytes)
        symptom_result = self.model.predict_from_symptoms(symptoms)

        # Combine predictions — prefer the higher-confidence result
        if image_result["confidence"] >= symptom_result["confidence"]:
            primary = image_result
        else:
            primary = symptom_result

        disease = primary["disease"]
        confidence = primary["confidence"]

        # ── Uncertainty estimation (Monte Carlo Dropout) ──
        uncertainty_result = self.uncertainty_estimator.estimate(image_bytes)

        # ── Patient embedding (multimodal 141-dim) ──
        patient_embedding = self.embedding_model.generate_embedding(
            image_bytes=image_bytes,
            symptoms=symptoms,
            risk_score=0.5,  # placeholder until risk is computed
            confidence=confidence,
        )

        # ── Risk prediction via XGBoost ──
        risk_result = self.risk_model.predict_risk(
            predicted_disease=disease,
            confidence=confidence,
            symptoms=symptoms,
        )
        risk_score = risk_result["risk_score"]
        risk_level = risk_result["risk_level"]

        # ── Case similarity search (with multimodal embedding) ──
        similar_cases = self.case_engine.find_similar_cases(
            predicted_disease=disease,
            confidence=confidence,
            risk_score=risk_score,
            symptoms=symptoms,
            multimodal_embedding=patient_embedding,
        )

        # ── Clinical guideline recommendations ──
        guidelines = self.guideline_engine.generate_guideline(disease, risk_level)

        # ── Disease progression timeline ──
        progression = self.progression_model.predict_progression(disease, risk_score)

        # ── Grad-CAM explainability ──
        gradcam_result = self.gradcam.generate_heatmap(image_bytes)

        # ── SHAP symptom explainability ──
        shap_result = self.shap_explainer.explain(symptoms, disease)

        # ── Interactive explanation ──
        explanation_result = self.explanation_engine.generate_explanation(
            predicted_disease=disease,
            confidence=confidence,
            gradcam_result=gradcam_result,
            shap_result=shap_result,
            uncertainty_result=uncertainty_result,
        )

        # ── Counterfactual analysis ──
        counterfactuals = self.counterfactual_engine.generate_counterfactuals(
            symptoms=symptoms,
            original_disease=disease,
            top_k=3,
        )

        # ── Analytics logging ──
        self.analytics.log_prediction(
            predicted_disease=disease,
            confidence=confidence,
            risk_score=risk_score,
            risk_level=risk_level,
        )

        _log.info(
            "Prediction: %s | confidence=%.4f | uncertainty=%.4f | risk=%.4f (%s)",
            disease, confidence, uncertainty_result["uncertainty"], risk_score, risk_level,
        )

        return {
            "predicted_disease": disease,
            "confidence": confidence,

            "uncertainty": uncertainty_result["uncertainty"],
            "model_agreement": uncertainty_result["model_agreement"],
            "uncertainty_warning": uncertainty_result["warning"],

            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_timeline": risk_result["timeline"],

            "similar_cases": similar_cases,

            "clinical_recommendations": guidelines["recommendations"],

            "disease_progression": progression,

            "explanation": explanation_result["explanation"],
            "imaging_explanation": explanation_result["imaging_explanation"],
            "symptom_explanation": explanation_result["symptom_explanation"],
            "confidence_explanation": explanation_result["confidence_explanation"],
            "region_detected": explanation_result["region_detected"],

            "counterfactuals": counterfactuals,

            "image_prediction": image_result,
            "symptom_prediction": symptom_result,
        }
