import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.models.aircraft import Aircraft, AircraftComponentStatus, AircraftIssue
from app.models.pilot import Pilot, PilotMedical, PilotMedicalDetails, PilotMedicalLog, PilotMission
from app.models.training import PilotTrainingLog
from app.schemas.training import TrainingDebriefEvent, TrainingRunRequest, TrainingRunResponse

router = APIRouter(prefix="/training", tags=["training"])

COMPONENTS = ["engine", "wings", "avionics", "fuel", "landingGear"]
STATUSES = ["Good", "Warning", "Critical"]


def _ensure_component_rows(db: Session, aircraft_id: str) -> dict[str, AircraftComponentStatus]:
    rows = db.query(AircraftComponentStatus).filter(AircraftComponentStatus.aircraft_id == aircraft_id).all()
    mapped = {row.component: row for row in rows}
    for component in COMPONENTS:
        if component not in mapped:
            created = AircraftComponentStatus(aircraft_id=aircraft_id, component=component, status="Good", notes="")
            db.add(created)
            db.flush()
            mapped[component] = created
    return mapped


@router.post("/run", response_model=TrainingRunResponse)
def run_training(payload: TrainingRunRequest, db: Session = Depends(get_db)):
    if not payload.pilotIds:
        raise HTTPException(status_code=400, detail="At least one pilot is required")

    if payload.trainingType == "one_v_one_dogfight" and len(payload.pilotIds) != 2:
        raise HTTPException(status_code=400, detail="1v1 dogfight requires exactly two pilots")

    pilots = db.query(Pilot).filter(Pilot.id.in_(payload.pilotIds)).all()
    if len(pilots) != len(payload.pilotIds):
        raise HTTPException(status_code=404, detail="One or more pilots not found")

    aircraft_list = []
    if payload.aircraftIds:
        aircraft_list = db.query(Aircraft).filter(Aircraft.id.in_(payload.aircraftIds)).all()

    aircraft_by_pilot_id: dict[int, str | None] = {}
    for index, pilot_id in enumerate(payload.pilotIds):
        aircraft_by_pilot_id[pilot_id] = payload.aircraftIds[index] if index < len(payload.aircraftIds) else None

    now = datetime.utcnow().isoformat()
    events: list[TrainingDebriefEvent] = []
    winner_pilot_id = None

    if payload.trainingType == "one_v_one_dogfight":
        winner = random.choice(pilots)
        winner_pilot_id = winner.id
        loser = [pilot for pilot in pilots if pilot.id != winner.id][0]
        events.append(TrainingDebriefEvent(kind="result", message=f"{winner.call_sign} won the 1v1 dogfight against {loser.call_sign}."))
    else:
        events.append(TrainingDebriefEvent(kind="result", message="Training completed successfully."))

    for pilot in pilots:
        medical = pilot.medical
        if not medical:
            medical = PilotMedical(pilot_id=pilot.id, injuries="None", fit_for_duty=True, last_status="Fit for duty")
            db.add(medical)
            db.flush()

        medical_details = pilot.medical_details
        if not medical_details:
            medical_details = PilotMedicalDetails(pilot_id=pilot.id, current_status="Fit for Flight", safe_to_assign=True)
            db.add(medical_details)
            db.flush()

        injury_roll = random.random()
        if injury_roll < 0.35:
            injury = random.choice(["Severe headache", "Neck strain", "Shoulder strain", "None"])
            medical.injuries = injury
            medical.fit_for_duty = injury == "None"
            medical.last_status = "Under observation" if injury != "None" else "Fit for duty"
            if injury != "None":
                events.append(TrainingDebriefEvent(kind="pilot", message=f"{pilot.call_sign} reported {injury}."))

        fatigue_level = random.choice(["Low", "Medium", "High"])
        stress_level = random.choice(["Low", "Medium", "High"])
        sleep_score = random.randint(55, 98)
        cognitive_score = random.randint(50, 98)
        safe_to_assign = fatigue_level != "High" and stress_level != "High" and cognitive_score >= 65

        medical_details.current_status = "Fit for Flight" if safe_to_assign else "Temporarily Grounded"
        medical_details.fatigue_level = fatigue_level
        medical_details.stress_level = stress_level
        medical_details.sleep_quality_score = sleep_score
        medical_details.cognitive_readiness = cognitive_score
        medical_details.safe_to_assign = safe_to_assign
        medical_details.last_medical_check_date = now.split("T")[0]
        medical_details.clearance_remarks = (
            "Fit for high-G maneuvers" if safe_to_assign else "Rest and reassessment required before mission assignment"
        )

        db.add(
            PilotMedicalLog(
                pilot_id=pilot.id,
                flight_context=f"Training - {payload.trainingType}",
                fatigue_level=fatigue_level,
                stress_level=stress_level,
                sleep_quality_score=sleep_score,
                cognitive_readiness=cognitive_score,
                safe_to_assign=safe_to_assign,
                remarks=medical_details.clearance_remarks,
                created_at=now,
            )
        )

        db.add(
            PilotMission(
                pilot_id=pilot.id,
                mission_name=f"Training - {payload.trainingType}",
                aircraft_name=aircraft_by_pilot_id.get(pilot.id) or pilot.assigned_aircraft,
                duration="1h 00m",
                status="Completed",
                outcome="Success" if pilot.id == winner_pilot_id or winner_pilot_id is None else "Loss",
                notes="Auto-generated training mission entry",
            )
        )

        db.add(
            PilotTrainingLog(
                pilot_id=pilot.id,
                training_type=payload.trainingType,
                result="Winner" if pilot.id == winner_pilot_id else "Completed",
                aircraft_id=aircraft_by_pilot_id.get(pilot.id) or pilot.assigned_aircraft,
                debrief="Training simulation completed",
                created_at=now,
            )
        )

    for aircraft in aircraft_list:
        component_rows = _ensure_component_rows(db, aircraft.id)
        component = random.choice(COMPONENTS)
        severity = random.choice(STATUSES)
        component_rows[component].status = severity
        component_rows[component].notes = f"Updated during {payload.trainingType}"

        if severity in ("Warning", "Critical"):
            issue = AircraftIssue(
                aircraft_id=aircraft.id,
                component=component,
                severity=severity,
                description=f"{component} requires inspection after {payload.trainingType}",
                status="Open",
                created_at=now,
            )
            db.add(issue)
            events.append(TrainingDebriefEvent(kind="aircraft", message=f"{aircraft.id} {component} status changed to {severity}."))

    db.commit()

    return TrainingRunResponse(trainingType=payload.trainingType, winnerPilotId=winner_pilot_id, events=events)
