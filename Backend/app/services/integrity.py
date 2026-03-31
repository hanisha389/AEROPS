import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.db import Base

LOG_PATH = Path(__file__).resolve().parent.parent / "schemas" / "integrity_logs.json"
LOG_LIMIT = 50


def _table_hash(session: Session, table) -> str:
    pk_columns = list(table.primary_key.columns)
    stmt = select(table)
    if pk_columns:
        stmt = stmt.order_by(*pk_columns)
    rows = session.execute(stmt).mappings().all()

    digest = hashlib.sha256()
    for row in rows:
        for column in table.columns:
            digest.update(str(row.get(column.name, "")).encode("utf-8"))
            digest.update(b"|")
    return digest.hexdigest()


def compare_databases(primary: Session, shadow: Session) -> list[str]:
    mismatched: list[str] = []
    for table in Base.metadata.sorted_tables:
        if _table_hash(primary, table) != _table_hash(shadow, table):
            mismatched.append(table.name)
    return mismatched


def _copy_tables(source: Session, target: Session, tables: Iterable) -> None:
    target.execute(text("PRAGMA foreign_keys=OFF"))
    for table in reversed(list(tables)):
        target.execute(table.delete())
    for table in tables:
        rows = source.execute(select(table)).mappings().all()
        if rows:
            target.execute(table.insert(), rows)
    target.execute(text("PRAGMA foreign_keys=ON"))
    target.commit()


def sync_shadow_from_primary(primary: Session, shadow: Session) -> None:
    _copy_tables(primary, shadow, Base.metadata.sorted_tables)


def reset_primary_from_shadow(primary: Session, shadow: Session) -> None:
    _copy_tables(shadow, primary, Base.metadata.sorted_tables)


def record_integrity_event(tables: list[str]) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "tables": tables,
    }
    logs = read_integrity_logs()
    logs.append(entry)
    logs = logs[-LOG_LIMIT:]
    LOG_PATH.write_text(json.dumps(logs, indent=2), encoding="utf-8")


def read_integrity_logs() -> list[dict]:
    if not LOG_PATH.exists():
        return []
    try:
        return json.loads(LOG_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
