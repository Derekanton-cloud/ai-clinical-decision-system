"""Explicit, idempotent seed for a fictional demonstration tenant.

Run from backend: ``python scripts/seed_demo.py``.  The demo password is read
from DEMO_PASSWORD and is never stored in source control.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.auth_handler import hash_password
from database.database import Base, SessionLocal, engine
from database.models import Hospital, User


def main() -> None:
    password = os.getenv("DEMO_PASSWORD")
    if not password:
        raise SystemExit("Set DEMO_PASSWORD to create the fictional demo login.")
    if len(password) < 8:
        raise SystemExit("DEMO_PASSWORD must be at least 8 characters.")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        hospital = db.query(Hospital).filter_by(hospital_name="Harborview Demonstration Hospital").first()
        if hospital is None:
            hospital = Hospital(hospital_name="Harborview Demonstration Hospital", city="Demo City")
            db.add(hospital)
            db.flush()
        user = db.query(User).filter_by(first_name="Demo", last_name="Clinician", hospital_id=hospital.hospital_id, role="Doctor").first()
        if user is None:
            db.add(User(first_name="Demo", last_name="Clinician", password_hash=hash_password(password), role="Doctor", hospital_id=hospital.hospital_id))
        db.commit()
        print("Fictional demo tenant is ready.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
