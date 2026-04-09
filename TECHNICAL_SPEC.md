# TECHNICAL SPECIFICATION

## Emotion-Aware Clinical Decision Support System Using Multimodal AI

This document is the full technical reference for the AI Clinical Decision Support System (CDSS), including architecture, models, data flow, implementation status, and operational details.

## 1. System Overview

The platform is designed to assist clinicians in respiratory disease assessment by combining:

- Medical imaging (chest X-ray)
- Clinical text input (chatbot/symptoms)
- Risk modeling and uncertainty estimation
- Explainable AI outputs
- Case tracking and monitoring

Primary outcomes:

- Disease prediction
- Risk stratification
- Explainable evidence (image + symptom level)
- Case documentation and report generation
- Analytics export for dashboarding

## 2. Multimodal Architecture

```text
Doctor Input
   |
   +-- Clinical Chatbot (NLP)
   |      |
   |      +-- BioBERT symptom extraction
   |
   +-- X-ray Upload (Imaging)
          |
          +-- Diffusion denoising/enhancement
          +-- EfficientNet CNN classification
          +-- Monte Carlo dropout uncertainty
          +-- Grad-CAM heatmap

Multimodal fusion (image + symptoms + confidence)
   |
   +-- XGBoost risk prediction
   +-- SHAP symptom importance
   +-- Case similarity retrieval
   +-- Counterfactual what-if analysis
   +-- Clinical recommendation engine
   +-- Report generator (JSON + PDF base64)
   +-- Analytics export (CSV for Power BI)
```

## 3. AI Components, Purpose, and Rationale

| Component | Purpose | Why used | Repo status |
|---|---|---|---|
| EfficientNet-B0 CNN | Chest X-ray classification | Efficient and strong CNN baseline for medical images | Implemented |
| Diffusion Enhancer | Image denoising and contrast cleanup | Better robustness for low-quality/noisy scans | Implemented |
| BioBERT | Clinical symptom extraction from text | Better clinical language understanding than generic BERT usage | Implemented |
| XGBoost Risk Model | Severity/risk prediction | Strong tabular performance and practical interpretability | Implemented |
| Grad-CAM | Visual explanation over X-ray | Highlights suspected region to improve clinical trust | Implemented |
| SHAP | Symptom-level feature contribution | Transparent feature contribution analysis | Implemented |
| Monte Carlo Dropout | Uncertainty estimation | Safety-oriented reliability signal for predictions | Implemented |
| Patient Embeddings + Similarity | Retrieve similar historical cases | Comparative context for clinical decision support | Implemented (core path) |
| Counterfactual Engine | What-if symptom perturbation | Explains how small changes alter diagnosis | Implemented |
| GAN/Augmentation utilities | Training-time diversity | Supports more robust model training experiments | Present in training module |

## 4. Code-Verified Implementation Reality

### 4.1 Confirmed active in prediction pipeline

- Diffusion enhancement
- EfficientNet image inference
- Symptom-path inference
- Monte Carlo uncertainty estimation
- XGBoost risk scoring
- Grad-CAM and SHAP explainability
- Case similarity retrieval
- Counterfactual generation
- Clinical recommendation composition
- Report generation data payload
- CSV analytics logging

### 4.2 Current limitations and caveats

- The deployed CNN class labels are currently binary in code/weights configuration (Normal, Pneumonia).
- Additional disease labels appear primarily through symptom-based logic.
- Case similarity uses a synthetic historical case set and 14-dimensional active matching; full persistent multimodal retrieval (141-dim across stored embeddings) is scaffolded but not fully enabled.
- Analytics page uses polished static demo charts and optional Power BI iframe embedding; not all widgets are backend-driven yet.

## 5. Datasets and Training Assets

Available in repository:

- ai-training/datasets/chest_xray (train/val/test structure)
- ai-training/datasets/symptom_dataset.csv
- ai-training/training_scripts for:
  - train_xray_model.py
  - dataset_loader.py
  - dataset_augmentation.py
  - gan_generator.py

Typical external dataset references for this domain:

- NIH ChestX-ray14
- Kaggle pneumonia chest X-ray datasets

## 6. Backend Specification (FastAPI)

Backend responsibilities:

- Authentication and authorization
- AI orchestration and inference APIs
- Explainability APIs
- Patient/case/monitoring persistence
- Report generation endpoint

Representative routes:

- /api/auth/login
- /api/auth/me
- /api/patients/register
- /api/patients/{patient_id}
- /api/cases/create
- /api/cases/hospital
- /api/monitoring/{patient_id}
- /api/predict-disease
- /api/explain/gradcam
- /api/explain/shap
- /api/enhance-xray
- /api/clinical-chatbot
- /api/generate-report

## 7. Database Design (PostgreSQL)

Core entities:

- hospitals
- users
- patients
- cases
- reports
- monitoring

Supported capabilities:

- Hospital-scoped access control
- Patient registration and lookup
- Case lifecycle tracking
- Monitoring time-series storage

## 8. Frontend Specification (Next.js)

Major pages:

- Dashboard
- Diagnosis
- Chatbot
- Monitoring
- Case history
- Analytics

Major UI capabilities:

- Stepwise AI pipeline display
- Grad-CAM visualization
- SHAP charting
- Interactive 3D lung model and infection marker
- Case and patient workflows
- Power BI embed container

## 9. Workflow (Operational Sequence)

1. Doctor logs in via hospital-scoped authentication.
2. Doctor registers or selects an existing patient.
3. Doctor runs chatbot flow and/or uploads chest X-ray.
4. Prediction pipeline performs multimodal inference.
5. System returns diagnosis, confidence, risk, uncertainty, and explainability.
6. Case data is stored and can be tracked.
7. Report is generated and analytics are exported.

## 10. Reporting and Analytics

### 10.1 Report generation

- Structured AI radiology report assembled in backend
- Includes diagnosis, risk, findings, recommendations, and explainability notes
- PDF generated and returned as base64 payload

### 10.2 Analytics export

- Prediction logs appended to CSV for BI usage
- Power BI embedding supported in frontend via environment variable

## 11. Security and Access Model

- JWT authentication
- Hospital-aware user scoping
- Route-level protection using current user dependency in APIs

## 12. Deployment Notes

Prerequisites:

- Python 3.10+
- Node.js 18+
- PostgreSQL

Backend startup:

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend startup:

```bash
cd frontend/nextjs-dashboard
npm install
npm run dev
```

Optional:

- Set NEXT_PUBLIC_POWERBI_EMBED_URL for embedded BI dashboard rendering.

## 13. Clinical Safety Statement

This project is a clinical decision support system intended to assist clinicians. It is not a replacement for professional medical judgment, diagnosis, or treatment planning.
