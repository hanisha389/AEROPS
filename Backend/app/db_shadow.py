import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base, ensure_hash_columns


def _default_shadow_url() -> str:
    base_dir = Path(__file__).resolve().parent / "schemas"
    base_dir.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{(base_dir / 'shadow.db').as_posix()}"


SHADOW_DATABASE_URL = os.getenv("SHADOW_DATABASE_URL", _default_shadow_url())

connect_args = {"check_same_thread": False} if SHADOW_DATABASE_URL.startswith("sqlite") else {}
shadow_engine = create_engine(SHADOW_DATABASE_URL, connect_args=connect_args)
ShadowSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=shadow_engine)


def init_shadow_db() -> None:
    from app.models import access_code, aircraft, document, engineer, maintenance, pilot, simulation, training  # noqa: F401

    Base.metadata.create_all(bind=shadow_engine)
    ensure_hash_columns(shadow_engine)
