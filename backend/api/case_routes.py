import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from typing import Optional
from database.database import get_db
from database.models import User, Patient, Case
from auth.auth_handler import get_current_user

router = APIRouter(prefix="/cases", tags=["Cases"])


class CaseCreateRequest(BaseModel):
    patient_id: str
    diagnosis: str
    confidence: float
    risk_level: str
    notes: Optional[str] = None


class CaseStatusUpdateRequest(BaseModel):
    status: str
    notes: str


def generate_case_code(db: Session) -> str:
    from datetime import datetime
    from sqlalchemy import func as sa_func
    year = datetime.now().year
    prefix = f"CASE-{year}-"
    max_code = (
        db.query(sa_func.max(Case.case_code))
        .filter(Case.case_code.like(f"{prefix}%"))
        .scalar()
    )
    if max_code:
        try:
            next_num = int(max_code.split("-")[2]) + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    return f"{prefix}{next_num:03d}"


@router.post("/create")
def create_case(
    request: CaseCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.patient_id == uuid.UUID(request.patient_id),
            Patient.hospital_id == current_user.hospital_id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    new_case = Case(
        case_id=uuid.uuid4(),
        case_code=generate_case_code(db),
        patient_id=patient.patient_id,
        doctor_id=current_user.user_id,
        hospital_id=current_user.hospital_id,
        diagnosis=request.diagnosis,
        confidence=request.confidence,
        risk_level=request.risk_level,
        status="ONGOING",
        notes=request.notes or "",
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)

    return {
        "case_id": str(new_case.case_id),
        "case_code": new_case.case_code,
        "status": new_case.status,
    }


@router.get("/hospital")
def get_hospital_cases(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cases = (
        db.query(Case)
        .filter(Case.hospital_id == current_user.hospital_id)
        .order_by(Case.created_at.desc())
        .all()
    )

    results = []
    for c in cases:
        patient = db.query(Patient).filter(Patient.patient_id == c.patient_id).first()
        doctor = db.query(User).filter(User.user_id == c.doctor_id).first()
        results.append(
            {
                "case_id": str(c.case_id),
                "case_code": c.case_code,
                "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
                "patient_id": str(c.patient_id),
                "patient_code": patient.patient_code if patient else "",
                "date": c.created_at.strftime("%Y-%m-%d") if c.created_at else "",
                "diagnosis": c.diagnosis,
                "confidence": c.confidence,
                "risk_level": c.risk_level,
                "status": c.status,
                "notes": c.notes,
                "doctor_name": f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "Unknown",
            }
        )
    return results


@router.get("/patient/{patient_id}")
def get_patient_cases(
    patient_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = (
        db.query(Patient)
        .filter(
            Patient.patient_id == uuid.UUID(patient_id),
            Patient.hospital_id == current_user.hospital_id,
        )
        .first()
    )
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    cases = (
        db.query(Case)
        .filter(Case.patient_id == uuid.UUID(patient_id))
        .order_by(Case.created_at.desc())
        .all()
    )

    case_list = []
    for c in cases:
        doctor = db.query(User).filter(User.user_id == c.doctor_id).first()
        case_list.append(
            {
                "case_id": str(c.case_id),
                "case_code": c.case_code,
                "date": c.created_at.strftime("%Y-%m-%d") if c.created_at else "",
                "diagnosis": c.diagnosis,
                "confidence": c.confidence,
                "risk_level": c.risk_level,
                "status": c.status,
                "notes": c.notes,
                "doctor_name": f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "Unknown",
            }
        )

    return {
        "patient": {
            "patient_id": str(patient.patient_id),
            "patient_code": patient.patient_code,
            "first_name": patient.first_name,
            "last_name": patient.last_name,
            "date_of_birth": patient.date_of_birth.strftime("%Y-%m-%d") if patient.date_of_birth else "",
        },
        "cases": case_list,
    }


@router.patch("/{case_id}/status")
def update_case_status(
    case_id: str,
    request: CaseStatusUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if request.status not in ("ONGOING", "COMPLETED", "REVIEWED"):
        raise HTTPException(status_code=400, detail="Invalid status")

    case = (
        db.query(Case)
        .filter(
            Case.case_id == uuid.UUID(case_id),
            Case.hospital_id == current_user.hospital_id,
        )
        .first()
    )
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")

    case.status = request.status
    case.notes = request.notes
    db.commit()
    db.refresh(case)

    return {"case_id": str(case.case_id), "status": case.status}


@router.get("/search")
def search_cases(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    search_term = f"%{q}%"

    # Find matching patients first
    matching_patient_ids = [
        p.patient_id
        for p in db.query(Patient)
        .filter(
            Patient.hospital_id == current_user.hospital_id,
            or_(
                Patient.first_name.ilike(search_term),
                Patient.last_name.ilike(search_term),
                Patient.patient_code.ilike(search_term),
            ),
        )
        .all()
    ]

    # Find matching doctors
    matching_doctor_ids = [
        u.user_id
        for u in db.query(User)
        .filter(
            User.hospital_id == current_user.hospital_id,
            or_(
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term),
            ),
        )
        .all()
    ]

    cases = (
        db.query(Case)
        .filter(
            Case.hospital_id == current_user.hospital_id,
            or_(
                Case.case_code.ilike(search_term),
                Case.diagnosis.ilike(search_term),
                Case.patient_id.in_(matching_patient_ids),
                Case.doctor_id.in_(matching_doctor_ids),
            ),
        )
        .order_by(Case.created_at.desc())
        .limit(50)
        .all()
    )

    results = []
    for c in cases:
        patient = db.query(Patient).filter(Patient.patient_id == c.patient_id).first()
        doctor = db.query(User).filter(User.user_id == c.doctor_id).first()
        results.append(
            {
                "case_id": str(c.case_id),
                "case_code": c.case_code,
                "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown",
                "patient_id": str(c.patient_id),
                "patient_code": patient.patient_code if patient else "",
                "date": c.created_at.strftime("%Y-%m-%d") if c.created_at else "",
                "diagnosis": c.diagnosis,
                "confidence": c.confidence,
                "risk_level": c.risk_level,
                "status": c.status,
                "notes": c.notes,
                "doctor_name": f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "Unknown",
            }
        )
    return results
