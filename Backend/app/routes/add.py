from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.routes.pilots import create_pilot
from app.routes.engineers import create_engineer
from app.routes.aircraft import create_aircraft
from app.schemas.add import AddEntityPayload

router = APIRouter(prefix="/add", tags=["add"])


@router.post("")
def add_entity(payload: AddEntityPayload, db: Session = Depends(get_db)):
    if payload.entityType == "pilot":
        return create_pilot(payload.payload, db)
    if payload.entityType == "engineer":
        return create_engineer(payload.payload, db)
    if payload.entityType == "aircraft":
        return create_aircraft(payload.payload, db)

    raise HTTPException(status_code=400, detail="Unsupported entity type")
