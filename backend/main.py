import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from api.routes import router
from auth.auth_routes import router as auth_router
from api.patient_routes import router as patient_router
from api.case_routes import router as case_router
from api.dashboard_routes import router as dashboard_router
from database.database import Base, engine
import database.models

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield
    engine.dispose()

app = FastAPI(
    title="AI Clinical Decision Support System",
    description="Clinical decision support demonstration; not a diagnostic device.",
    version="2.1.0",
    lifespan=lifespan,
)

cors_origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,https://ai-clinical-decision-system.onrender.com").split(",") if item.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(patient_router, prefix="/api")
app.include_router(case_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {"service": "AI Clinical Decision Support System API", "docs": "/docs"}


@app.get("/health")
def health_check():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "degraded", "database": "unavailable"}
