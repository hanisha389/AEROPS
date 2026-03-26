from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.engineer import Engineer, EngineerMaintenanceLog
from app.schemas.engineer import EngineerCreate, EngineerRead

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
