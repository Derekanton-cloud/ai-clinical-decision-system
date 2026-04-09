# AI Clinical Decision Support System

A comprehensive AI-powered clinical decision support system featuring disease prediction, explainable AI, doctor chatbot, 3D visualization, and analytics.

## Architecture

```
ai-clinical-decision-system/
├── frontend/nextjs-dashboard/   — Next.js + TypeScript + TailwindCSS dashboard
├── backend/                     — Python FastAPI AI server
├── ai-training/                 — ML training datasets, notebooks, scripts
├── database/                    — Database schemas and migrations
└── docs/                        — Documentation
```

## Features

- **AI Diagnosis** — Upload X-rays and symptoms for disease prediction
- **Explainable AI** — Grad-CAM heatmaps and SHAP feature importance
- **Doctor Chatbot** — Medical assistant conversation interface
- **3D Lung Visualization** — Interactive 3D lung model with disease highlighting
- **Radiology Reports** — Auto-generated structured medical reports (PDF)
- **Analytics Dashboard** — Power BI embedded analytics

## Getting Started

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
