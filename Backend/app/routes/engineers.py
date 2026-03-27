from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.engineer import Engineer, EngineerMaintenanceLog
from app.models.aircraft import AircraftIssue
from app.schemas.engineer import EngineerCreate, EngineerMaintenanceLogCreate, EngineerRead

router = APIRouter(prefix="/engineers", tags=["engineers"])


def _to_schema(engineer: Engineer) -> EngineerRead:
    logs = [
        {
            "aircraft": item.aircraft_id,
            "type": item.work_item,
            "description": item.notes,
            "isCurrent": item.is_current,
            "date": item.log_date,
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
        db.add(
            EngineerMaintenanceLog(
                engineer_id=engineer.id,
                aircraft_id=log.aircraft,
                work_item=log.type,
                notes=log.description,
                is_current=log.isCurrent,
                log_date=log.date,
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

    db.add(
        EngineerMaintenanceLog(
            engineer_id=engineer_id,
            aircraft_id=payload.aircraft,
            work_item=payload.type,
            notes=payload.description,
            is_current=payload.isCurrent,
            log_date=payload.date,
        )
    )

    if payload.issueId is not None:
        issue = db.query(AircraftIssue).filter(AircraftIssue.id == payload.issueId).first()
        if issue:
            issue.status = "Assigned"

    db.commit()
    db.refresh(engineer)
    return _to_schema(engineer)
