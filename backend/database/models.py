import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from database.database import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    hospital_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_name = Column(String, nullable=False)
    city = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    users = relationship("User", back_populates="hospital")
    patients = relationship("Patient", back_populates="hospital")
    cases = relationship("Case", back_populates="hospital")


class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.hospital_id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hospital = relationship("Hospital", back_populates="users")
    cases = relationship("Case", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    patient_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_code = Column(String, unique=True, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    date_of_birth = Column(DateTime)
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.hospital_id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    hospital = relationship("Hospital", back_populates="patients")
    cases = relationship("Case", back_populates="patient")
    monitoring_records = relationship("Monitoring", back_populates="patient")


class Case(Base):
    __tablename__ = "cases"

    case_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_code = Column(String, unique=True, nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id"))
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.user_id"))
    hospital_id = Column(UUID(as_uuid=True), ForeignKey("hospitals.hospital_id"))
    diagnosis = Column(String)
    confidence = Column(Float)
    risk_level = Column(String)
    status = Column(String, default="ONGOING")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="cases")
    doctor = relationship("User", back_populates="cases")
    hospital = relationship("Hospital", back_populates="cases")
    reports = relationship("Report", back_populates="case")


class Report(Base):
    __tablename__ = "reports"

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id = Column(UUID(as_uuid=True), ForeignKey("cases.case_id"))
    report_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    case = relationship("Case", back_populates="reports")


class Monitoring(Base):
    __tablename__ = "monitoring"

    monitor_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id"))
    heart_rate = Column(Float)
    oxygen_saturation = Column(Float)
    temperature = Column(Float)
    respiration_rate = Column(Float)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    patient = relationship("Patient", back_populates="monitoring_records")
