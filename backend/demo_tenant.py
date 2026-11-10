"""Idempotent, fictional data used exclusively by the public company demo."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from auth.auth_handler import hash_password
from database.models import Case, Hospital, Monitoring, Patient, Report, User

DEMO_HOSPITAL = "Harborview Demonstration Hospital"
DEMO_CITY = "Demo City"
DEMO_FIRST_NAME = "Demo"
DEMO_LAST_NAME = "Clinician"
DEMO_ROLE = "Radiologist"

_PATIENTS = (
    ("DEMO-PT-001", "Avery", "Morgan", datetime(1972, 4, 18)),
    ("DEMO-PT-002", "Jordan", "Lee", datetime(1985, 9, 3)),
    ("DEMO-PT-003", "Casey", "Rivera", datetime(1958, 1, 27)),
)
_CASES = (
    ("DEMO-CASE-001", "DEMO-PT-001", "Illustrative pneumonia review", 0.84, "High", "REVIEWED"),
    ("DEMO-CASE-002", "DEMO-PT-002", "Illustrative respiratory assessment", 0.73, "Moderate", "ONGOING"),
    ("DEMO-CASE-003", "DEMO-PT-003", "Illustrative follow-up assessment", 0.68, "High", "COMPLETED"),
)


def ensure_demo_tenant(db: Session, password: str) -> tuple[Hospital, User]:
    """Create the demo tenant once; never mutate unrelated tenant records."""
    hospital = db.query(Hospital).filter(Hospital.hospital_name == DEMO_HOSPITAL).first()
    if hospital is None:
        hospital = Hospital(hospital_name=DEMO_HOSPITAL, city=DEMO_CITY)
        db.add(hospital)
        db.flush()

    user = db.query(User).filter(
        User.first_name == DEMO_FIRST_NAME,
        User.last_name == DEMO_LAST_NAME,
        User.role == DEMO_ROLE,
        User.hospital_id == hospital.hospital_id,
    ).first()
    if user is None:
        user = User(
            first_name=DEMO_FIRST_NAME,
            last_name=DEMO_LAST_NAME,
            role=DEMO_ROLE,
            hospital_id=hospital.hospital_id,
            password_hash=hash_password(password),
        )
        db.add(user)
        db.flush()

    patients: dict[str, Patient] = {}
    for code, first_name, last_name, dob in _PATIENTS:
        patient = db.query(Patient).filter(
            Patient.hospital_id == hospital.hospital_id, Patient.patient_code == code
        ).first()
        if patient is None:
            patient = Patient(patient_code=code, first_name=first_name, last_name=last_name, date_of_birth=dob, hospital_id=hospital.hospital_id)
            db.add(patient)
            db.flush()
        patients[code] = patient

    for code, patient_code, diagnosis, confidence, risk_level, status in _CASES:
        case = db.query(Case).filter(Case.hospital_id == hospital.hospital_id, Case.case_code == code).first()
        if case is None:
            case = Case(
                case_code=code, patient_id=patients[patient_code].patient_id,
                doctor_id=user.user_id, hospital_id=hospital.hospital_id,
                diagnosis=diagnosis, confidence=confidence, risk_level=risk_level, status=status,
                notes="Fictional demonstration record. Not clinical guidance or a validated diagnosis.",
            )
            db.add(case)
            db.flush()
        report = db.query(Report).filter(Report.case_id == case.case_id).first()
        if report is None:
            db.add(Report(case_id=case.case_id, report_path=f"demo://{code.lower()}"))

    monitored_patient = patients["DEMO-PT-001"]
    if db.query(Monitoring).filter(Monitoring.patient_id == monitored_patient.patient_id).count() == 0:
        now = datetime.now(timezone.utc)
        for index in range(12):
            db.add(Monitoring(
                patient_id=monitored_patient.patient_id,
                heart_rate=76 + (index % 4), oxygen_saturation=97.0 - (index % 2) * 0.2,
                temperature=36.7 + (index % 3) * 0.1, respiration_rate=16 + (index % 3),
                recorded_at=now - timedelta(minutes=(11 - index) * 5),
            ))
    db.commit()
    return hospital, user
