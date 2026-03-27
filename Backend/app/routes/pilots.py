from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.models.pilot import Pilot, PilotMedical, PilotMission
from app.models.training import PilotTrainingLog
from app.schemas.pilot import PilotCreate, PilotRead

router = APIRouter(prefix="/pilots", tags=["pilots"])


def _to_schema(pilot: Pilot) -> PilotRead:
    medical = pilot.medical or PilotMedical(injuries="None", fit_for_duty=True, last_status="Fit for duty")
    missions = [
        {
            "name": mission.mission_name,
            "aircraftName": mission.aircraft_name,
            "duration": mission.duration,
            "status": mission.status,
            "outcome": mission.outcome,
            "notes": mission.notes,
        }
        for mission in pilot.missions
    ]
    trainings = [
        {
            "trainingType": entry.training_type,
            "result": entry.result,
            "aircraftId": entry.aircraft_id,
            "debrief": entry.debrief,
            "createdAt": entry.created_at,
        }
        for entry in sorted(pilot.trainings, key=lambda item: item.created_at, reverse=True)
    ]
    medical_status = "Fit for duty" if medical.fit_for_duty else "Not fit for duty"
    report = f"{medical_status}. Last status: {medical.last_status}"

    return PilotRead(
        id=pilot.id,
        name=pilot.name,
        registrationNumber=pilot.registration_number,
        rank=pilot.rank,
        callSign=pilot.call_sign,
        assignedAircraft=pilot.assigned_aircraft,
        status=pilot.status,
        onHoliday=pilot.on_holiday,
        image=pilot.face_url,
        injury=medical.injuries,
        medicalReport=report,
        medical={
            "injuries": medical.injuries,
            "fitForDuty": medical.fit_for_duty,
            "lastStatus": medical.last_status,
        },
        missions=missions,
        trainings=trainings,
    )


@router.get("", response_model=list[PilotRead])
def list_pilots(db: Session = Depends(get_db)):
    pilots = db.query(Pilot).all()
    return [_to_schema(pilot) for pilot in pilots]


@router.get("/{pilot_id}", response_model=PilotRead)
def get_pilot(pilot_id: int, db: Session = Depends(get_db)):
        pilot = db.query(Pilot).filter(Pilot.id == pilot_id).first()
        if not pilot:
                raise HTTPException(status_code=404, detail="Pilot not found")
        return _to_schema(pilot)


@router.post("", response_model=PilotRead, status_code=status.HTTP_201_CREATED)
def create_pilot(payload: PilotCreate, db: Session = Depends(get_db)):
    existing = db.query(Pilot).filter(Pilot.registration_number == payload.registrationNumber).first()
    if existing:
        raise HTTPException(status_code=409, detail="Pilot registration number already exists")

    pilot = Pilot(
        name=payload.name,
        registration_number=payload.registrationNumber,
        rank=payload.rank,
        call_sign=payload.callSign,
        assigned_aircraft=payload.assignedAircraft,
        status=payload.status,
        on_holiday=payload.onHoliday,
        face_url=payload.image,
    )
    db.add(pilot)
    db.flush()

    db.add(
        PilotMedical(
            pilot_id=pilot.id,
            injuries=payload.medical.injuries,
            fit_for_duty=payload.medical.fitForDuty,
            last_status=payload.medical.lastStatus,
        )
    )

    for mission in payload.missions:
        db.add(
            PilotMission(
                pilot_id=pilot.id,
                mission_name=mission.name,
                aircraft_name=mission.aircraftName,
                duration=mission.duration,
                status=mission.status,
                outcome=mission.outcome,
                notes=mission.notes,
            )
        )

    db.commit()
    db.refresh(pilot)
    return _to_schema(pilot)
