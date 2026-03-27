from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.aircraft import Aircraft, AircraftMission, AircraftPilotAssignment, AircraftComponentStatus, AircraftIssue
from app.schemas.aircraft import AircraftCreate, AircraftRead, AircraftUpdate

router = APIRouter(prefix="/aircraft", tags=["aircraft"])


def _to_schema(aircraft: Aircraft) -> AircraftRead:
    assigned_pilots = [item.pilot_name for item in aircraft.assignments]
    mission_details = [{"name": item.mission_name, "notes": item.notes} for item in aircraft.missions]
    component_status = {
        "engine": "Good",
        "wings": "Good",
        "avionics": "Good",
        "fuel": "Good",
        "landingGear": "Good",
    }
    component_status.update({item.component: item.status for item in aircraft.component_statuses})
    open_issues = [
        {
            "id": issue.id,
            "aircraftId": issue.aircraft_id,
            "component": issue.component,
            "severity": issue.severity,
            "description": issue.description,
            "status": issue.status,
            "createdAt": issue.created_at,
        }
        for issue in aircraft.issues
        if issue.status in ("Open", "Assigned")
    ]

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
        componentStatus=component_status,
        openIssues=open_issues,
    )


@router.get("", response_model=list[AircraftRead])
def list_aircraft(db: Session = Depends(get_db)):
    aircraft = db.query(Aircraft).all()
    return [_to_schema(item) for item in aircraft]


@router.get("/{aircraft_id}", response_model=AircraftRead)
def get_aircraft(aircraft_id: str, db: Session = Depends(get_db)):
    aircraft = db.query(Aircraft).filter(Aircraft.id == aircraft_id).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return _to_schema(aircraft)


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

    for component in ["engine", "wings", "avionics", "fuel", "landingGear"]:
        db.add(AircraftComponentStatus(aircraft_id=aircraft.id, component=component, status="Good", notes=""))

    db.commit()
    db.refresh(aircraft)
    return _to_schema(aircraft)


@router.put("/{aircraft_id}", response_model=AircraftRead)
def update_aircraft(aircraft_id: str, payload: AircraftUpdate, db: Session = Depends(get_db)):
    aircraft = db.query(Aircraft).filter(Aircraft.id == aircraft_id).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    aircraft.name = payload.name
    aircraft.model = payload.model
    aircraft.health_status = payload.healthStatus
    aircraft.last_maintenance = payload.lastMaintenance

    db.query(AircraftPilotAssignment).filter(AircraftPilotAssignment.aircraft_id == aircraft_id).delete()
    db.query(AircraftMission).filter(AircraftMission.aircraft_id == aircraft_id).delete()

    for pilot_name in payload.assignedPilots:
        db.add(AircraftPilotAssignment(aircraft_id=aircraft_id, pilot_name=pilot_name))

    for mission in payload.missions:
        db.add(AircraftMission(aircraft_id=aircraft_id, mission_name=mission.name, notes=mission.notes))

    if payload.healthStatus:
        try:
            component, state = payload.healthStatus.split(":", 1)
            row = db.query(AircraftComponentStatus).filter(
                AircraftComponentStatus.aircraft_id == aircraft_id,
                AircraftComponentStatus.component == component,
            ).first()
            if row:
                row.status = state
        except ValueError:
            pass

    db.commit()
    db.refresh(aircraft)
    return _to_schema(aircraft)
