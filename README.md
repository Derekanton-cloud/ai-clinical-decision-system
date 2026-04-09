# AI Clinical Decision Support System

AI-powered multimodal platform for respiratory decision support across imaging, symptoms, risk scoring, and explainability.

## What This Project Demonstrates

- Multimodal inference from chest X-ray + clinical text
- Explainable AI (Grad-CAM and SHAP)
- Risk prediction and uncertainty estimation
- Clinical chatbot and patient/case workflows
- Monitoring, report generation, and analytics export

## AI Stack

- EfficientNet-B0 CNN
- Diffusion enhancer
- BioBERT symptom extraction
- XGBoost risk model
- Grad-CAM
- SHAP
- Monte Carlo dropout uncertainty
- Embedding-based case similarity
- Counterfactual analysis

## Quick Demo Flow

1. Doctor logs in.
2. Register/select patient.
3. Submit X-ray + symptoms.
4. View diagnosis, confidence, risk, and explanations.
5. Save case and generate report.

## Tech Stack

- Backend: FastAPI, PyTorch, Transformers, XGBoost, SHAP, PostgreSQL
- Frontend: Next.js, TypeScript, Tailwind, Recharts, React Three Fiber
- Reporting/Analytics: PDF generation + CSV export + Power BI embed

## Run Locally

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend/nextjs-dashboard
npm install
npm run dev
```

## Full Technical Documentation

See [TECHNICAL_SPEC.md](TECHNICAL_SPEC.md) for full architecture, model rationale, implementation status, API details, workflow, and limitations.

## Clinical Safety Notice

This system is a clinical decision support tool and must be used with qualified medical oversight. It is not a standalone diagnostic device.
