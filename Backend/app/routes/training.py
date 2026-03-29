from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.roles import (
    ROLE_ADMIN_COMMANDER,
    ROLE_PILOT,
    RequestContext,
    get_request_context,
    require_roles,
)
from app.models.aircraft import Aircraft
from app.models.maintenance import AircraftMaintenanceLog
from app.models.pilot import Pilot, PilotMedical, PilotMedicalDetails, PilotMedicalLog, PilotMission
from app.models.training import PilotTrainingLog
from app.schemas.training import TrainingRunResponse, TrainingWorkflowRequest, TrainingWorkflowResponse
from app.services.documents import create_document_from_template, ensure_default_templates

router = APIRouter(prefix="/training", tags=["training"])

@router.post(
    "/run",
    response_model=TrainingRunResponse,
    dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_PILOT))],
)
def legacy_run_training():
    raise HTTPException(status_code=410, detail="Use /training/workflow/complete for structured training workflow")


@router.post(
    "/workflow/complete",
    response_model=TrainingWorkflowResponse,
    dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_PILOT))],
)
def complete_training_workflow(
    payload: TrainingWorkflowRequest,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    ensure_default_templates(db)

    if payload.trainingType == "Dogfight" and len(payload.aircraftIds) != 2:
        raise HTTPException(status_code=400, detail="Dogfight training requires exactly 2 aircraft")
    if payload.trainingType in {"Maneuver", "Precision Bombing"} and len(payload.aircraftIds) != 1:
        raise HTTPException(status_code=400, detail="Maneuver and Precision Bombing training require exactly 1 aircraft")

    aircraft_list = db.query(Aircraft).filter(Aircraft.id.in_(payload.aircraftIds)).all()
    if len(aircraft_list) != len(payload.aircraftIds):
        raise HTTPException(status_code=404, detail="One or more selected aircraft were not found")
    aircraft_by_id = {item.id: item for item in aircraft_list}

    pre_checks_by_aircraft = {item.aircraftId: item.checklist for item in payload.preTrainingChecks}
    post_checks_by_aircraft = {item.aircraftId: item.checklist for item in payload.postTrainingChecks}
    if sorted(pre_checks_by_aircraft.keys()) != sorted(payload.aircraftIds):
        raise HTTPException(status_code=400, detail="Pre-training check must be provided for each selected aircraft")
    if sorted(post_checks_by_aircraft.keys()) != sorted(payload.aircraftIds):
        raise HTTPException(status_code=400, detail="Post-training check must be provided for each selected aircraft")

    pilots = db.query(Pilot).filter(Pilot.id.in_(payload.pilotIds)).all()
    if len(pilots) != len(payload.pilotIds):
        raise HTTPException(status_code=404, detail="One or more selected pilots were not found")

    if context.role == ROLE_PILOT:
        if context.pilot_id is None:
            raise HTTPException(status_code=400, detail="Pilot role requires x-pilot-id header")
        if sorted(payload.pilotIds) != [context.pilot_id]:
            raise HTTPException(status_code=403, detail="Pilot role can submit workflow only for itself")

    status_by_pilot_id = {pilot.id: (pilot.status or "").strip().upper() for pilot in pilots}
    non_active = [pid for pid, state in status_by_pilot_id.items() if state != "ACTIVE"]
    if non_active:
        raise HTTPException(status_code=400, detail="Only ACTIVE pilots can be used in training")

    medical_by_pilot_id = {item.pilotId: item for item in payload.pilotMedicalReports}
    if sorted(medical_by_pilot_id.keys()) != sorted(payload.pilotIds):
        raise HTTPException(status_code=400, detail="Medical report must be provided for each selected pilot")

    now = datetime.utcnow().isoformat()
    created_document_ids: list[int] = []

    updated_aircraft_ids: list[str] = []
    for aircraft_id in payload.aircraftIds:
        pre_check = pre_checks_by_aircraft[aircraft_id]
        post_check = post_checks_by_aircraft[aircraft_id]

        pre_document = create_document_from_template(
            db,
            template_key="pre_flight_inspection_report",
            document_type="PRE_FLIGHT_INSPECTION_REPORT",
            dynamic_fields={
                "aircraftId": aircraft_id,
                "trainingType": payload.trainingType,
                "fuelLevel": pre_check.fuelLevel,
                "engineStatus": pre_check.engineStatus,
                "avionicsCheck": pre_check.avionicsCheck,
                "weaponSystems": pre_check.weaponSystems,
                "overallStatus": pre_check.overallStatus,
            },
            created_by_role=context.role,
            aircraft_id=aircraft_id,
        )
        created_document_ids.append(pre_document.id)
        db.add(
            AircraftMaintenanceLog(
                aircraft_id=aircraft_id,
                log_type="PRE_FLIGHT_INSPECTION",
                summary=f"Pre-training inspection for {payload.trainingType}",
                document_id=pre_document.id,
                created_at=now,
            )
        )

        post_document = create_document_from_template(
            db,
            template_key="post_flight_inspection_report",
            document_type="POST_FLIGHT_INSPECTION_REPORT",
            dynamic_fields={
                "aircraftId": aircraft_id,
                "trainingType": payload.trainingType,
                "fuelLevel": post_check.fuelLevel,
                "engineStatus": post_check.engineStatus,
                "avionicsCheck": post_check.avionicsCheck,
                "weaponSystems": post_check.weaponSystems,
                "overallStatus": post_check.overallStatus,
                "damageObserved": post_check.damageObserved,
                "maintenanceRequired": post_check.maintenanceRequired,
            },
            created_by_role=context.role,
            aircraft_id=aircraft_id,
        )
        created_document_ids.append(post_document.id)
        db.add(
            AircraftMaintenanceLog(
                aircraft_id=aircraft_id,
                log_type="POST_FLIGHT_INSPECTION",
                summary=f"Post-training inspection for {payload.trainingType}",
                document_id=post_document.id,
                created_at=now,
            )
        )

        aircraft = aircraft_by_id[aircraft_id]
        aircraft_ready = (
            pre_check.overallStatus == "READY"
            and post_check.overallStatus == "READY"
            and post_check.damageObserved == "NO"
            and post_check.maintenanceRequired == "NO"
        )
        aircraft.health_status = "READY" if aircraft_ready else "MAINTENANCE"
        aircraft.last_maintenance = now.split("T")[0]
        updated_aircraft_ids.append(aircraft_id)

    updated_pilot_ids: list[int] = []
    for pilot in pilots:
        medical_input = medical_by_pilot_id[pilot.id]
        fit_for_duty = medical_input.fitForDuty == "YES"
        injuries = medical_input.injuries
        injury_text = "None" if not injuries else ", ".join([f"{item.part} ({item.severity})" for item in injuries])

        pilot_medical = pilot.medical
        if not pilot_medical:
            pilot_medical = PilotMedical(pilot_id=pilot.id, injuries="None", fit_for_duty=True, last_status="Fit for duty")
            db.add(pilot_medical)
            db.flush()
        pilot_medical.injuries = injury_text
        pilot_medical.fit_for_duty = fit_for_duty
        pilot_medical.last_status = "Fit for duty" if fit_for_duty else "Not fit for duty"

        medical_details = pilot.medical_details
        if not medical_details:
            medical_details = PilotMedicalDetails(pilot_id=pilot.id, current_status="Fit for Flight", safe_to_assign=True)
            db.add(medical_details)
            db.flush()

        medical_details.current_status = "Fit for Flight" if fit_for_duty else "Medical Hold"
        medical_details.fatigue_level = medical_input.fatigueLevel
        medical_details.past_injuries = "|".join([f"{item.part}:{item.severity}" for item in injuries])
        medical_details.last_medical_check_date = now.split("T")[0]
        medical_details.safe_to_assign = fit_for_duty
        medical_details.clearance_remarks = medical_input.remarks or ("Cleared for training" if fit_for_duty else "Hold from duty until medical clearance")

        pilot.status = "ACTIVE" if fit_for_duty else "MEDICAL HOLD"

        db.add(
            PilotMedicalLog(
                pilot_id=pilot.id,
                flight_context=f"Training - {payload.trainingType}",
                fatigue_level=medical_input.fatigueLevel,
                stress_level=None,
                sleep_quality_score=0,
                cognitive_readiness=0,
                safe_to_assign=fit_for_duty,
                remarks=medical_details.clearance_remarks,
                created_at=now,
            )
        )

        db.add(
            PilotMission(
                pilot_id=pilot.id,
                mission_name=f"Training - {payload.trainingType}",
                aircraft_name=", ".join(payload.aircraftIds),
                duration=payload.duration,
                status="Completed",
                outcome="Completed",
                notes=payload.notes,
            )
        )

        db.add(
            PilotTrainingLog(
                pilot_id=pilot.id,
                training_type=payload.trainingType,
                result="Completed",
                aircraft_id=payload.aircraftIds[0],
                debrief=payload.notes,
                created_at=now,
            )
        )

        medical_document = create_document_from_template(
            db,
            template_key="pilot_medical_report",
            document_type="PILOT_MEDICAL_REPORT",
            dynamic_fields={
                "pilotId": pilot.id,
                "pilotName": pilot.name,
                "pilotImage": pilot.face_url,
                "status": pilot.status,
                "fatigueLevel": medical_input.fatigueLevel,
                "injuries": injury_text,
                "fitForDuty": medical_input.fitForDuty,
                "remarks": medical_details.clearance_remarks,
            },
            created_by_role=context.role,
            pilot_id=pilot.id,
            aircraft_id=payload.aircraftIds[0],
        )
        created_document_ids.append(medical_document.id)
        updated_pilot_ids.append(pilot.id)

    db.commit()

    return TrainingWorkflowResponse(
        trainingType=payload.trainingType,
        completed=True,
        createdDocumentIds=created_document_ids,
        updatedPilotIds=updated_pilot_ids,
        updatedAircraftIds=updated_aircraft_ids,
    )
