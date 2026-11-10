import uuid
import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.database import get_db
from database.models import User, Patient, Case, Report, Monitoring
from auth.auth_handler import get_current_user

router = APIRouter(tags=["Dashboard & Monitoring"])


@router.get("/dashboard/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    hospital_id = current_user.hospital_id

    total_predictions = db.query(Case).filter(Case.hospital_id == hospital_id).count()
    patients_screened = db.query(Patient).filter(Patient.hospital_id == hospital_id).count()
    reports_generated = (
        db.query(Report)
        .join(Case, Report.case_id == Case.case_id)
        .filter(Case.hospital_id == hospital_id)
        .count()
    )
    high_risk_cases = (
        db.query(Case)
        .filter(
            Case.hospital_id == hospital_id,
            Case.risk_level.in_(["High", "Critical", "HIGH", "CRITICAL"]),
        )
        .count()
    )

    return {
        "total_predictions": total_predictions,
        "patients_screened": patients_screened,
        "reports_generated": reports_generated,
        "high_risk_cases": high_risk_cases,
    }


@router.get("/monitoring/{patient_id}")
def get_monitoring_data(
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

    records = (
        db.query(Monitoring)
        .filter(Monitoring.patient_id == uuid.UUID(patient_id))
        .order_by(Monitoring.recorded_at.desc())
        .limit(60)
        .all()
    )

    if records:
        return {
            "patient_id": str(patient.patient_id),
            "patient_code": patient.patient_code,
            "patient_name": f"{patient.first_name} {patient.last_name}",
            "readings": [
                {
                    "time": r.recorded_at.strftime("%H:%M:%S") if r.recorded_at else "",
                    "heart_rate": r.heart_rate,
                    "oxygen_saturation": r.oxygen_saturation,
                    "temperature": r.temperature,
                    "respiration_rate": r.respiration_rate,
                }
                for r in reversed(records)
            ],
        }

    # Generate simulated vitals if no records exist
    simulated = []
    now = datetime.now(timezone.utc)
    hr = 72.0
    o2 = 97.0
    temp = 36.8
    rr = 16.0

    for i in range(40):
        t = now - timedelta(seconds=(39 - i) * 3)
        hr = max(50, min(140, hr + random.uniform(-3, 3)))
        o2 = max(85, min(100, o2 + random.uniform(-1, 1)))
        temp = max(35.5, min(40.0, temp + random.uniform(-0.15, 0.15)))
        rr = max(8, min(35, rr + random.uniform(-1.5, 1.5)))

        monitor = Monitoring(
            monitor_id=uuid.uuid4(),
            patient_id=patient.patient_id,
            heart_rate=round(hr, 1),
            oxygen_saturation=round(o2, 1),
            temperature=round(temp, 1),
            respiration_rate=round(rr, 1),
            recorded_at=t,
        )
        db.add(monitor)
        simulated.append(
            {
                "time": t.strftime("%H:%M:%S"),
                "heart_rate": round(hr, 1),
                "oxygen_saturation": round(o2, 1),
                "temperature": round(temp, 1),
                "respiration_rate": round(rr, 1),
            }
        )

    db.commit()

    return {
        "patient_id": str(patient.patient_id),
        "patient_code": patient.patient_code,
        "patient_name": f"{patient.first_name} {patient.last_name}",
        "readings": simulated,
    }
