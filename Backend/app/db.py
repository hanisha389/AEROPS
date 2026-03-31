import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./aerops.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def init_db() -> None:
    from app.models import access_code, aircraft, document, engineer, maintenance, pilot, simulation, training  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_hash_columns(engine)


def ensure_hash_columns(target_engine) -> None:
    hash_columns = {
        "pilots": ["registration_number_hash"],
        "pilot_training_logs": ["debrief_hash"],
        "pilot_medical_logs": ["flight_context_hash", "remarks_hash"],
        "aircraft_maintenance_logs": ["summary_hash"],
    }

    with target_engine.connect() as connection:
        for table_name, columns in hash_columns.items():
            result = connection.execute(text(f"PRAGMA table_info({table_name})"))
            existing = {row[1] for row in result}
            for column in columns:
                if column in existing:
                    continue
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column} TEXT"))
