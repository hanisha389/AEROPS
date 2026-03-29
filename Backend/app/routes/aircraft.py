from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.roles import (
    ROLE_ADMIN_COMMANDER,
    ROLE_ENGINEER,
    ROLE_PILOT,
    RequestContext,
    get_request_context,
)
from app.models.aircraft import Aircraft, AircraftMission, AircraftPilotAssignment, AircraftComponentStatus, AircraftIssue
from app.models.maintenance import AircraftMaintenanceLog
from app.models.pilot import Pilot
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
def list_aircraft(db: Session = Depends(get_db), context: RequestContext = Depends(get_request_context)):
    if context.role not in {ROLE_ADMIN_COMMANDER, ROLE_ENGINEER, ROLE_PILOT}:
        raise HTTPException(status_code=403, detail="Role is not allowed to access aircraft data")

    if context.role == ROLE_PILOT:
        if context.pilot_id is None:
            return []
        pilot = db.query(Pilot).filter(Pilot.id == context.pilot_id).first()
        if not pilot or not pilot.assigned_aircraft:
            return []
        aircraft = db.query(Aircraft).filter(Aircraft.id == pilot.assigned_aircraft).all()
        return [_to_schema(item) for item in aircraft]

    aircraft = db.query(Aircraft).all()
    return [_to_schema(item) for item in aircraft]


@router.get("/{aircraft_id}", response_model=AircraftRead)
def get_aircraft(aircraft_id: str, db: Session = Depends(get_db), context: RequestContext = Depends(get_request_context)):
    if context.role not in {ROLE_ADMIN_COMMANDER, ROLE_ENGINEER, ROLE_PILOT}:
        raise HTTPException(status_code=403, detail="Role is not allowed to access aircraft data")

    if context.role == ROLE_PILOT:
        if context.pilot_id is None:
            raise HTTPException(status_code=403, detail="Pilot role requires x-pilot-id header")
        pilot = db.query(Pilot).filter(Pilot.id == context.pilot_id).first()
        if not pilot or pilot.assigned_aircraft != aircraft_id:
            raise HTTPException(status_code=403, detail="Pilot can only access assigned aircraft")

    aircraft = db.query(Aircraft).filter(Aircraft.id == aircraft_id).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")
    return _to_schema(aircraft)


@router.get("/{aircraft_id}/maintenance-history")
def get_aircraft_maintenance_history(
    aircraft_id: str,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    if context.role not in {ROLE_ADMIN_COMMANDER, ROLE_ENGINEER, ROLE_PILOT}:
        raise HTTPException(status_code=403, detail="Role is not allowed to access aircraft data")

    if context.role == ROLE_PILOT:
        if context.pilot_id is None:
            raise HTTPException(status_code=403, detail="Pilot role requires x-pilot-id header")
        pilot = db.query(Pilot).filter(Pilot.id == context.pilot_id).first()
        if not pilot or pilot.assigned_aircraft != aircraft_id:
            raise HTTPException(status_code=403, detail="Pilot can only access assigned aircraft")

    aircraft = db.query(Aircraft).filter(Aircraft.id == aircraft_id).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    allowed_log_types = [
        "PRE_FLIGHT_INSPECTION",
        "POST_FLIGHT_INSPECTION",
        "ENGINEER_TASK_COMPLETION",
        "MAINTENANCE_COMPLETION",
    ]
    rows = (
        db.query(AircraftMaintenanceLog)
        .filter(
            AircraftMaintenanceLog.aircraft_id == aircraft_id,
            AircraftMaintenanceLog.log_type.in_(allowed_log_types),
        )
        .order_by(AircraftMaintenanceLog.created_at.desc())
        .all()
    )
    return [
        {
            "id": row.id,
            "aircraftId": row.aircraft_id,
            "logType": row.log_type,
            "summary": row.summary or "",
            "createdAt": row.created_at,
            "documentId": row.document_id,
        }
        for row in rows
    ]


@router.post("", response_model=AircraftRead, status_code=status.HTTP_201_CREATED)
def create_aircraft(
    payload: AircraftCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    if context.role != ROLE_ADMIN_COMMANDER:
        raise HTTPException(status_code=403, detail="Only admin/commander can create aircraft")

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
def update_aircraft(
    aircraft_id: str,
    payload: AircraftUpdate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    if context.role not in {ROLE_ADMIN_COMMANDER, ROLE_ENGINEER}:
        raise HTTPException(status_code=403, detail="Role is not allowed to update aircraft data")

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
