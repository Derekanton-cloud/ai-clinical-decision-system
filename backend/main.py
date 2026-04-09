from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router
from auth.auth_routes import router as auth_router
from api.patient_routes import router as patient_router
from api.case_routes import router as case_router
from api.dashboard_routes import router as dashboard_router

app = FastAPI(
    title="AI Clinical Decision Support System",
    description="AI-powered clinical decision support with disease prediction, explainability, and chatbot.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(patient_router, prefix="/api")
app.include_router(case_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"message": "AI Clinical Decision Support System API"}
