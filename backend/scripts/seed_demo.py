"""Explicit, idempotent seed for a fictional demonstration tenant.

Run from backend: ``python scripts/seed_demo.py``.  The demo password is read
from DEMO_PASSWORD and is never stored in source control.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.database import Base, SessionLocal, engine
from demo_tenant import ensure_demo_tenant


def main() -> None:
    password = os.getenv("DEMO_PASSWORD")
    if not password:
        raise SystemExit("Set DEMO_PASSWORD to create the fictional demo login.")
    if len(password) < 8:
        raise SystemExit("DEMO_PASSWORD must be at least 8 characters.")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        ensure_demo_tenant(db, password)
        print("Fictional demo tenant is ready.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
