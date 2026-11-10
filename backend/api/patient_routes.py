import uuid
from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from pydantic import BaseModel
from database.database import get_db
from database.models import User, Patient
from auth.auth_handler import get_current_user

router = APIRouter(prefix="/patients", tags=["Patients"])


class PatientRegisterRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: str  # YYYY-MM-DD


class PatientResponse(BaseModel):
    patient_id: str
    patient_code: str
    first_name: str
    last_name: str
    date_of_birth: str
    age: int


def calculate_age(dob: datetime) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def generate_patient_code(db: Session) -> str:
    from sqlalchemy import func as sa_func
    max_code = db.query(sa_func.max(Patient.patient_code)).scalar()
    if max_code and max_code.startswith("PT-"):
        try:
            next_num = int(max_code.split("-")[1]) + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1
    return f"PT-{next_num:04d}"


@router.post("/register", response_model=PatientResponse)
def register_patient(
    request: PatientRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dob = datetime.strptime(request.date_of_birth, "%Y-%m-%d")

    existing = (
        db.query(Patient)
        .filter(
            Patient.first_name == request.first_name,
            Patient.last_name == request.last_name,
            Patient.date_of_birth == dob,
            Patient.hospital_id == current_user.hospital_id,
        )
        .first()
    )

    if existing:
        return PatientResponse(
            patient_id=str(existing.patient_id),
            patient_code=existing.patient_code,
            first_name=existing.first_name,
            last_name=existing.last_name,
            date_of_birth=existing.date_of_birth.strftime("%Y-%m-%d"),
            age=calculate_age(existing.date_of_birth),
        )

    new_patient = Patient(
        patient_id=uuid.uuid4(),
        patient_code=generate_patient_code(db),
        first_name=request.first_name,
        last_name=request.last_name,
        date_of_birth=dob,
        hospital_id=current_user.hospital_id,
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_patient)

    return PatientResponse(
        patient_id=str(new_patient.patient_id),
        patient_code=new_patient.patient_code,
        first_name=new_patient.first_name,
        last_name=new_patient.last_name,
        date_of_birth=new_patient.date_of_birth.strftime("%Y-%m-%d"),
        age=calculate_age(new_patient.date_of_birth),
    )


@router.get("/{patient_id}")
def get_patient(
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

    return {
        "patient_id": str(patient.patient_id),
        "patient_code": patient.patient_code,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "date_of_birth": patient.date_of_birth.strftime("%Y-%m-%d"),
        "age": calculate_age(patient.date_of_birth),
        "hospital_id": str(patient.hospital_id),
    }


@router.get("/search/")
def search_patients(
    q: str = "",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Patient).filter(Patient.hospital_id == current_user.hospital_id)

    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                Patient.first_name.ilike(search_term),
                Patient.last_name.ilike(search_term),
                Patient.patient_code.ilike(search_term),
            )
        )

    patients = query.limit(20).all()
    return [
        {
            "patient_id": str(p.patient_id),
            "patient_code": p.patient_code,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "date_of_birth": p.date_of_birth.strftime("%Y-%m-%d"),
            "age": calculate_age(p.date_of_birth),
        }
        for p in patients
    ]
