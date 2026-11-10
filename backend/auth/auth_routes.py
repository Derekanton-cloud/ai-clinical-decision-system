from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.database import get_db
from database.models import User, Hospital
from auth.auth_handler import verify_password, hash_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    first_name: str
    last_name: str
    password: str
    role: str
    hospital: str


class LoginResponse(BaseModel):
    token: str
    user_id: str
    first_name: str
    last_name: str
    role: str
    hospital_id: str
    hospital_name: str


@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    hospital = (
        db.query(Hospital)
        .filter(Hospital.hospital_name == request.hospital)
        .first()
    )
    if not hospital:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hospital not found",
        )

    user = (
        db.query(User)
        .filter(
            User.first_name == request.first_name,
            User.last_name == request.last_name,
            User.role == request.role,
            User.hospital_id == hospital.hospital_id,
        )
        .first()
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    # One-time compatibility path for databases created by older releases.
    # Successful legacy logins are converted before a token is issued.
    legacy_match = not user.password_hash.startswith(("$2a$", "$2b$", "$2y$")) and request.password == user.password_hash
    if not legacy_match and not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Auto-upgrade plain-text passwords to bcrypt
    if legacy_match:
        user.password_hash = hash_password(request.password)
        db.commit()

    token = create_access_token(
        {
            "user_id": str(user.user_id),
            "hospital_id": str(user.hospital_id),
            "role": user.role,
        }
    )

    return LoginResponse(
        token=token,
        user_id=str(user.user_id),
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        hospital_id=str(user.hospital_id),
        hospital_name=hospital.hospital_name,
    )


@router.get("/me")
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    hospital = db.query(Hospital).filter(Hospital.hospital_id == current_user.hospital_id).first()
    return {
        "user_id": str(current_user.user_id),
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "role": current_user.role,
        "hospital_id": str(current_user.hospital_id),
        "hospital_name": hospital.hospital_name if hospital else "",
    }


@router.get("/hospitals")
def list_hospitals(db: Session = Depends(get_db)):
    hospitals = db.query(Hospital).all()
    return [
        {"hospital_id": str(h.hospital_id), "hospital_name": h.hospital_name, "city": h.city}
        for h in hospitals
    ]
