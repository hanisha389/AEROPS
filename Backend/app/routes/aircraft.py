from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.aircraft import Aircraft, AircraftMission, AircraftPilotAssignment
from app.schemas.aircraft import AircraftCreate, AircraftRead

router = APIRouter(prefix="/aircraft", tags=["aircraft"])


def _to_schema(aircraft: Aircraft) -> AircraftRead:
    assigned_pilots = [item.pilot_name for item in aircraft.assignments]
    mission_details = [{"name": item.mission_name, "notes": item.notes} for item in aircraft.missions]

    return AircraftRead(
        id=aircraft.id,
        name=aircraft.name,
        model=aircraft.model,
        healthStatus=aircraft.health_status,
        lastMaintenance=aircraft.last_maintenance,
        assignedPilot=assigned_pilots[0] if assigned_pilots else "Unassigned",
        assignedPilots=assigned_pilots,
        missions=[item["name"] for item in mission_details],
        missionDetails=mission_details,
    )


@router.get("", response_model=list[AircraftRead])
def list_aircraft(db: Session = Depends(get_db)):
    aircraft = db.query(Aircraft).all()
    return [_to_schema(item) for item in aircraft]


@router.post("", response_model=AircraftRead, status_code=status.HTTP_201_CREATED)
def create_aircraft(payload: AircraftCreate, db: Session = Depends(get_db)):
    existing = db.query(Aircraft).filter(Aircraft.id == payload.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Aircraft ID already exists")

    aircraft = Aircraft(
        id=payload.id,
        name=payload.name,
        model=payload.model,
        health_status=payload.healthStatus,
        last_maintenance=payload.lastMaintenance,
    )
    db.add(aircraft)
    db.flush()

    for pilot_name in payload.assignedPilots:
        db.add(AircraftPilotAssignment(aircraft_id=aircraft.id, pilot_name=pilot_name))

    for mission in payload.missions:
        db.add(AircraftMission(aircraft_id=aircraft.id, mission_name=mission.name, notes=mission.notes))

    db.commit()
    db.refresh(aircraft)
    return _to_schema(aircraft)
