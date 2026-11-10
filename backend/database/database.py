"""Environment-based database configuration."""
import os
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker, declarative_base

APP_ENV = os.getenv("APP_ENV", "development").lower()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    if APP_ENV in {"production", "prod"}:
        raise RuntimeError("DATABASE_URL must be set in production")
    DATABASE_URL = "sqlite:///./clinical_ai.db"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

url = make_url(DATABASE_URL)
engine_options = {"pool_pre_ping": True, "future": True}
if url.drivername.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
else:
    engine_options.update({"pool_size": int(os.getenv("DB_POOL_SIZE", "3")), "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "2")), "pool_recycle": 1800})
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
