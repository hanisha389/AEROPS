from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.roles import ROLE_ADMIN_COMMANDER, ROLE_ENGINEER, require_roles
from datetime import datetime
from app.models.engineer import Engineer, EngineerMaintenanceLog, EngineerMaintenanceReport
from app.models.aircraft import Aircraft, AircraftComponentStatus, AircraftIssue
from app.models.maintenance import AircraftMaintenanceLog
from app.schemas.engineer import EngineerCreate, EngineerMaintenanceLogCreate, EngineerMaintenanceStatusUpdate, EngineerRead

router = APIRouter(
    prefix="/engineers",
    tags=["engineers"],
    dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_ENGINEER))],
)


def _is_completed_status(value: str) -> bool:
    return (value or "").strip().upper() in {"COMPLETED", "COMPLETE"}


def _issue_component_from_log(log: EngineerMaintenanceLog) -> str | None:
    note = (log.notes or "").lower()
    for component in ["landingGear", "avionics", "engine", "wings", "fuel"]:
        if component.lower() in note:
            return component

    work_item = (log.work_item or "").lower()
    for component in ["landingGear", "avionics", "engine", "wings", "fuel"]:
        if component.lower() in work_item:
            return component

    return None


def _to_schema(engineer: Engineer) -> EngineerRead:
    logs = [
        {
            "id": item.id,
            "aircraft": item.aircraft_id,
            "type": item.work_item,
            "description": item.notes,
            "isCurrent": item.is_current,
            "date": item.log_date,
            "completionStatus": item.report.completion_status if item.report else "Pending",
        }
        for item in engineer.maintenance_logs
    ]
    aircraft_ids = sorted(list({item.aircraft_id for item in engineer.maintenance_logs if item.aircraft_id}))

    return EngineerRead(
        id=engineer.id,
        name=engineer.name,
        employeeId=engineer.service_id,
        role=engineer.role,
        specialization=engineer.specialization,
        status=engineer.status,
        onHoliday=engineer.on_holiday,
        image=engineer.face_url,
        aircraftWorkedOn=aircraft_ids,
        maintenanceLogs=logs,
    )


@router.get("", response_model=list[EngineerRead])
def list_engineers(db: Session = Depends(get_db)):
    engineers = db.query(Engineer).all()
    return [_to_schema(item) for item in engineers]


@router.get("/open-issues")
def list_open_issues(db: Session = Depends(get_db)):
    issues = db.query(AircraftIssue).filter(AircraftIssue.status.in_(["Open", "Assigned"])).all()
    return [
        {
            "id": issue.id,
            "aircraftId": issue.aircraft_id,
            "component": issue.component,
            "severity": issue.severity,
            "description": issue.description,
            "status": issue.status,
            "createdAt": issue.created_at,
        }
        for issue in issues
    ]


@router.get("/{engineer_id}", response_model=EngineerRead)
def get_engineer(engineer_id: int, db: Session = Depends(get_db)):
    engineer = db.query(Engineer).filter(Engineer.id == engineer_id).first()
    if not engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")
    return _to_schema(engineer)


@router.post("", response_model=EngineerRead, status_code=status.HTTP_201_CREATED)
def create_engineer(payload: EngineerCreate, db: Session = Depends(get_db)):
    existing = db.query(Engineer).filter(Engineer.service_id == payload.employeeId).first()
    if existing:
        raise HTTPException(status_code=409, detail="Engineer ID already exists")

    engineer = Engineer(
        name=payload.name,
        service_id=payload.employeeId,
        role=payload.role,
        specialization=payload.specialization,
        status=payload.status,
        on_holiday=payload.onHoliday,
        face_url=payload.image,
    )
    db.add(engineer)
    db.flush()

    for log in payload.maintenanceLogs:
        created_log = EngineerMaintenanceLog(
            engineer_id=engineer.id,
            aircraft_id=log.aircraft,
            work_item=log.type,
            notes=log.description,
            is_current=log.isCurrent,
            log_date=log.date,
        )
        db.add(created_log)
        db.flush()
        db.add(
            EngineerMaintenanceReport(
                maintenance_log_id=created_log.id,
                completion_status="Pending",
                updated_at=datetime.utcnow().isoformat(),
            )
        )

    db.commit()
    db.refresh(engineer)
    return _to_schema(engineer)


@router.post("/{engineer_id}/logs", response_model=EngineerRead)
def add_engineer_log(engineer_id: int, payload: EngineerMaintenanceLogCreate, db: Session = Depends(get_db)):
    engineer = db.query(Engineer).filter(Engineer.id == engineer_id).first()
    if not engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")

    if payload.isCurrent:
        db.query(EngineerMaintenanceLog).filter(
            EngineerMaintenanceLog.engineer_id == engineer_id,
            EngineerMaintenanceLog.is_current.is_(True),
        ).update({"is_current": False})

    created_log = EngineerMaintenanceLog(
        engineer_id=engineer_id,
        aircraft_id=payload.aircraft,
        work_item=payload.type,
        notes=payload.description,
        is_current=payload.isCurrent,
        log_date=payload.date,
    )
    db.add(created_log)
    db.flush()

    db.add(
        EngineerMaintenanceReport(
            maintenance_log_id=created_log.id,
            completion_status="Pending",
            updated_at=datetime.utcnow().isoformat(),
        )
    )

    if payload.issueId is not None:
        issue = db.query(AircraftIssue).filter(AircraftIssue.id == payload.issueId).first()
        if issue:
            issue.status = "Assigned"

    db.commit()
    db.refresh(engineer)
    return _to_schema(engineer)


@router.put("/{engineer_id}/logs/{log_id}/status", response_model=EngineerRead)
def update_engineer_log_status(
    engineer_id: int,
    log_id: int,
    payload: EngineerMaintenanceStatusUpdate,
    db: Session = Depends(get_db),
):
    engineer = db.query(Engineer).filter(Engineer.id == engineer_id).first()
    if not engineer:
        raise HTTPException(status_code=404, detail="Engineer not found")

    log = db.query(EngineerMaintenanceLog).filter(
        EngineerMaintenanceLog.id == log_id,
        EngineerMaintenanceLog.engineer_id == engineer_id,
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Maintenance log not found")

    report = db.query(EngineerMaintenanceReport).filter(
        EngineerMaintenanceReport.maintenance_log_id == log_id
    ).first()
    if not report:
        report = EngineerMaintenanceReport(
            maintenance_log_id=log_id,
            completion_status=payload.completionStatus,
            updated_at=datetime.utcnow().isoformat(),
        )
        db.add(report)
    else:
        report.completion_status = payload.completionStatus
        report.updated_at = datetime.utcnow().isoformat()

    if _is_completed_status(payload.completionStatus) and log.aircraft_id:
        issue_component = _issue_component_from_log(log)
        issue_query = db.query(AircraftIssue).filter(
            AircraftIssue.aircraft_id == log.aircraft_id,
            AircraftIssue.status.in_(["Open", "Assigned"]),
        )
        if issue_component:
            issue_query = issue_query.filter(AircraftIssue.component == issue_component)

        issue = issue_query.order_by(AircraftIssue.id.asc()).first()
        if issue:
            issue.status = "Resolved"

        if issue_component:
            component_row = db.query(AircraftComponentStatus).filter(
                AircraftComponentStatus.aircraft_id == log.aircraft_id,
                AircraftComponentStatus.component == issue_component,
            ).first()
            if component_row:
                component_row.status = "Good"
                component_row.notes = log.notes

        has_open_issues = (
            db.query(AircraftIssue)
            .filter(
                AircraftIssue.aircraft_id == log.aircraft_id,
                AircraftIssue.status.in_(["Open", "Assigned"]),
            )
            .first()
            is not None
        )

        aircraft = db.query(Aircraft).filter(Aircraft.id == log.aircraft_id).first()
        if aircraft:
            aircraft.health_status = "MAINTENANCE" if has_open_issues else "READY"
            if not has_open_issues:
                aircraft.last_maintenance = datetime.utcnow().isoformat().split("T")[0]

        db.add(
            AircraftMaintenanceLog(
                aircraft_id=log.aircraft_id,
                log_type="ENGINEER_TASK_COMPLETION",
                summary=f"Engineer task completed for {log.aircraft_id}: {log.work_item}",
                document_id=None,
                created_at=datetime.utcnow().isoformat(),
            )
        )

    db.commit()
    db.refresh(engineer)
    return _to_schema(engineer)
