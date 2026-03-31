from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.roles import ROLE_ADMIN_COMMANDER, require_roles
from app.db_shadow import ShadowSessionLocal
from app.services.integrity import compare_databases, read_integrity_logs, reset_primary_from_shadow

router = APIRouter(prefix="/integrity", tags=["integrity"])


@router.get("/check")
def check_integrity(db: Session = Depends(get_db)):
    shadow_db = ShadowSessionLocal()
    try:
        mismatched = compare_databases(db, shadow_db)
    finally:
        shadow_db.close()
    return {"ok": not mismatched, "mismatchedTables": mismatched}


@router.post("/reset", dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER))])
def reset_integrity(db: Session = Depends(get_db)):
    shadow_db = ShadowSessionLocal()
    try:
        reset_primary_from_shadow(db, shadow_db)
    finally:
        shadow_db.close()
    return {"reset": True}


@router.get("/logs", dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER))])
def get_integrity_logs():
    return {"logs": read_integrity_logs()}
