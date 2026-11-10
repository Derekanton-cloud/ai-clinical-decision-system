"""Executable integration smoke test for the core (non-AI) workflow."""
import os
import sys
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from main import app
from database.database import SessionLocal
from database.models import Hospital, User
from auth.auth_handler import hash_password


def main() -> None:
    suffix = uuid.uuid4().hex[:8]
    with TestClient(app) as client:
        os.environ["DEMO_LOGIN_ENABLED"] = "false"
        assert client.post("/api/auth/demo-login").status_code == 404
        os.environ["DEMO_LOGIN_ENABLED"] = "true"
        os.environ["DEMO_PASSWORD"] = "DemoPassword123!"
        demo_login = client.post("/api/auth/demo-login")
        assert demo_login.status_code == 200, demo_login.text
        demo = demo_login.json()
        assert demo["first_name"] == "Demo" and demo["last_name"] == "Clinician"
        assert demo["role"] == "Radiologist"
        demo_headers = {"Authorization": f"Bearer {demo['token']}"}
        assert client.get("/api/auth/me", headers=demo_headers).status_code == 200
        assert client.get("/api/dashboard/stats", headers=demo_headers).json()["patients_screened"] >= 3
        assert len(client.get("/api/patients/search/?q=DEMO", headers=demo_headers).json()) >= 3
        assert len(client.get("/api/cases/hospital", headers=demo_headers).json()) >= 3
        # Repeat login verifies provisioning is idempotent rather than creating
        # a new fictional account or duplicate records.
        assert client.post("/api/auth/demo-login").json()["user_id"] == demo["user_id"]
        db = SessionLocal()
        hospital_name = f"Fictional Test Hospital {suffix}"
        hospital = Hospital(hospital_name=hospital_name, city="Test")
        db.add(hospital)
        db.flush()
        db.add(User(first_name="Test", last_name="Doctor", password_hash=hash_password("Password123!"), role="Doctor", hospital_id=hospital.hospital_id))
        db.commit()
        db.close()
        login = client.post("/api/auth/login", json={"first_name": "Test", "last_name": "Doctor", "password": "Password123!", "role": "Doctor", "hospital": hospital_name})
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['token']}"}
        patient = client.post("/api/patients/register", json={"first_name": "Fictional", "last_name": "Patient", "date_of_birth": "1990-01-01"}, headers=headers)
        assert patient.status_code == 200, patient.text
        case = client.post("/api/cases/create", json={"patient_id": patient.json()["patient_id"], "diagnosis": "Demo only", "confidence": 0.5, "risk_level": "Low"}, headers=headers)
        assert case.status_code == 200, case.text
        assert client.get("/api/dashboard/stats", headers=headers).status_code == 200
        unavailable = client.post("/api/predict-disease", data={"symptoms": "cough"}, files={"xray": ("test.png", b"not-an-image", "image/png")}, headers=headers)
        assert unavailable.status_code == 503, unavailable.text
        assert client.get("/health").json()["status"] == "healthy"
    print("core integration smoke test passed")


if __name__ == "__main__":
    main()
