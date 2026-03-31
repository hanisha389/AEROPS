from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.roles import ROLE_ADMIN_COMMANDER, ROLE_ENGINEER, RequestContext, get_request_context, require_roles
from app.models.aircraft import Aircraft, AircraftComponentStatus, AircraftIssue
from app.models.maintenance import AircraftMaintenanceLog, MaintenanceEntry
from app.schemas.maintenance import MaintenanceEntryComplete, MaintenanceEntryCreate
from app.services.documents import create_document_from_template, ensure_default_templates
from app.security import hash_value

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_ENGINEER))])
def list_entries(db: Session = Depends(get_db)):
    entries = db.query(MaintenanceEntry).order_by(MaintenanceEntry.created_at.desc()).all()
    return [
        {
            "id": entry.id,
            "aircraftId": entry.aircraft_id,
            "issueType": entry.issue_type,
            "severity": entry.severity,
            "status": entry.status,
            "issueResolved": "YES" if entry.issue_resolved is True else "NO" if entry.issue_resolved is False else None,
            "engineerNotes": entry.engineer_notes,
            "createdAt": entry.created_at,
            "completedAt": entry.completed_at,
        }
        for entry in entries
    ]


@router.post("", dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_ENGINEER))])
def create_entry(
    payload: MaintenanceEntryCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    ensure_default_templates(db)

    aircraft = db.query(Aircraft).filter(Aircraft.id == payload.aircraftId).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    now = datetime.utcnow().isoformat()
    entry = MaintenanceEntry(
        aircraft_id=payload.aircraftId,
        issue_type=payload.issueType,
        severity=payload.severity,
        status="OPEN",
        engineer_notes=payload.notes,
        created_at=now,
    )
    db.add(entry)
    db.flush()

    component_name = {
        "Engine": "engine",
        "Avionics": "avionics",
        "Structural": "wings",
    }[payload.issueType]

    db.add(
        AircraftIssue(
            aircraft_id=payload.aircraftId,
            component=component_name,
            severity=payload.severity,
            description=payload.notes,
            status="Open",
            created_at=now,
        )
    )

    component_state = "Critical" if payload.severity == "HIGH" else "Warning"
    component_status = db.query(AircraftComponentStatus).filter(
        AircraftComponentStatus.aircraft_id == payload.aircraftId,
        AircraftComponentStatus.component == component_name,
    ).first()
    if component_status:
        component_status.status = component_state
        component_status.notes = payload.notes

    document = create_document_from_template(
        db,
        template_key="maintenance_entry_report",
        document_type="MAINTENANCE_ENTRY_REPORT",
        dynamic_fields={
            "aircraftId": payload.aircraftId,
            "issueType": payload.issueType,
            "severity": payload.severity,
            "notes": payload.notes,
        },
        created_by_role=context.role,
        aircraft_id=payload.aircraftId,
        maintenance_entry_id=entry.id,
    )

    db.add(
        AircraftMaintenanceLog(
            aircraft_id=payload.aircraftId,
            log_type="MAINTENANCE_ENTRY",
            summary=f"{payload.issueType} issue registered ({payload.severity})",
            summary_hash=hash_value(f"{payload.issueType} issue registered ({payload.severity})"),
            document_id=document.id,
            created_at=now,
        )
    )

    aircraft.health_status = "MAINTENANCE"
    db.commit()

    return {
        "id": entry.id,
        "aircraftId": entry.aircraft_id,
        "issueType": entry.issue_type,
        "severity": entry.severity,
        "status": entry.status,
        "issueResolved": None,
        "engineerNotes": entry.engineer_notes,
        "createdAt": entry.created_at,
        "completedAt": entry.completed_at,
    }


@router.put("/{entry_id}/complete", dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_ENGINEER))])
def complete_entry(
    entry_id: int,
    payload: MaintenanceEntryComplete,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    ensure_default_templates(db)

    entry = db.query(MaintenanceEntry).filter(MaintenanceEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Maintenance entry not found")

    aircraft = db.query(Aircraft).filter(Aircraft.id == entry.aircraft_id).first()
    if not aircraft:
        raise HTTPException(status_code=404, detail="Aircraft not found")

    now = datetime.utcnow().isoformat()
    resolved = payload.issueResolved == "YES"

    entry.issue_resolved = resolved
    entry.engineer_notes = payload.notes
    entry.status = "COMPLETED" if resolved else "OPEN"
    entry.completed_at = now

    if resolved:
        issues = db.query(AircraftIssue).filter(
            AircraftIssue.aircraft_id == entry.aircraft_id,
            AircraftIssue.status.in_(["Open", "Assigned"]),
        ).all()
        for issue in issues:
            issue.status = "Resolved"

        component_rows = db.query(AircraftComponentStatus).filter(
            AircraftComponentStatus.aircraft_id == entry.aircraft_id,
        ).all()
        for row in component_rows:
            row.status = "Good"
            row.notes = payload.notes
    else:
        issues = db.query(AircraftIssue).filter(
            AircraftIssue.aircraft_id == entry.aircraft_id,
            AircraftIssue.component.in_(["engine", "avionics", "wings"]),
            AircraftIssue.status.in_(["Open", "Assigned"]),
        ).all()
        for issue in issues:
            issue.status = "Open"

    has_open_issues = db.query(AircraftIssue).filter(
        AircraftIssue.aircraft_id == entry.aircraft_id,
        AircraftIssue.status.in_(["Open", "Assigned"]),
    ).first() is not None

    aircraft_status = "MAINTENANCE" if has_open_issues else "READY"
    aircraft.health_status = aircraft_status
    if resolved:
        aircraft.last_maintenance = now.split("T")[0]

    document = create_document_from_template(
        db,
        template_key="maintenance_completion_report",
        document_type="MAINTENANCE_COMPLETION_REPORT",
        dynamic_fields={
            "aircraftId": entry.aircraft_id,
            "issueResolved": payload.issueResolved,
            "notes": payload.notes,
            "aircraftStatus": aircraft_status,
        },
        created_by_role=context.role,
        aircraft_id=entry.aircraft_id,
        maintenance_entry_id=entry.id,
    )

    db.add(
        AircraftMaintenanceLog(
            aircraft_id=entry.aircraft_id,
            log_type="MAINTENANCE_COMPLETION",
            summary=f"Maintenance completion recorded: {payload.issueResolved}",
            summary_hash=hash_value(f"Maintenance completion recorded: {payload.issueResolved}"),
            document_id=document.id,
            created_at=now,
        )
    )

    db.commit()

    return {
        "id": entry.id,
        "aircraftId": entry.aircraft_id,
        "issueType": entry.issue_type,
        "severity": entry.severity,
        "status": entry.status,
        "issueResolved": payload.issueResolved,
        "engineerNotes": entry.engineer_notes,
        "createdAt": entry.created_at,
        "completedAt": entry.completed_at,
    }
