from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.roles import ROLE_ADMIN_COMMANDER, require_roles
from app.models.access_code import AccessCode
from app.schemas.access_code import (
    AccessCodeRead,
    AccessCodeUpdate,
    AccessCodeVerify,
    AccessCodeVerifyResult,
)

router = APIRouter(prefix="/pin", tags=["pin"], dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER))])


def _get_or_create_access_code(db: Session) -> AccessCode:
    record = db.query(AccessCode).first()
    if record:
        return record
    record = AccessCode(code="123456")
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=AccessCodeRead)
def read_access_code(db: Session = Depends(get_db)):
    record = _get_or_create_access_code(db)
    return AccessCodeRead(code=record.code)


@router.put("", response_model=AccessCodeRead)
def update_access_code(payload: AccessCodeUpdate, db: Session = Depends(get_db)):
    record = _get_or_create_access_code(db)
    record.code = payload.code
    db.commit()
    db.refresh(record)
    return AccessCodeRead(code=record.code)


@router.post("/verify", response_model=AccessCodeVerifyResult)
def verify_access_code(payload: AccessCodeVerify, db: Session = Depends(get_db)):
    if not payload.code.isdigit() or len(payload.code) != 6:
        raise HTTPException(status_code=400, detail="Access code must be 6 digits")
    record = _get_or_create_access_code(db)
    return AccessCodeVerifyResult(valid=record.code == payload.code)
