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
from app.models.aircraft import Aircraft, AircraftComponentStatus, AircraftIssue
from app.models.maintenance import AircraftMaintenanceLog, MaintenanceEntry
from app.models.pilot import Pilot, PilotMedical, PilotMedicalDetails, PilotMedicalLog, PilotMission
from app.models.training import PilotTrainingLog
from app.schemas.training import TrainingRunResponse, TrainingWorkflowRequest, TrainingWorkflowResponse
from app.services.documents import create_document_from_template, ensure_default_templates
from app.security import hash_value

router = APIRouter(prefix="/training", tags=["training"])

COMPONENT_STATE_RANK = {"Good": 0, "Warning": 1, "Critical": 2}


def _merge_component_state(current_state: str, next_state: str) -> str:
    return next_state if COMPONENT_STATE_RANK[next_state] > COMPONENT_STATE_RANK[current_state] else current_state


def _maintenance_issue_type(component: str) -> str:
    if component == "engine":
        return "Engine"
    if component == "avionics":
        return "Avionics"
    return "Structural"


def _derive_component_findings(pre_check, post_check) -> dict[str, tuple[str, str, str]]:
    findings: dict[str, tuple[str, str, str]] = {
        "engine": ("Good", "LOW", "No issues detected"),
        "wings": ("Good", "LOW", "No issues detected"),
        "avionics": ("Good", "LOW", "No issues detected"),
        "fuel": ("Good", "LOW", "No issues detected"),
        "landingGear": ("Good", "LOW", "No issues detected"),
    }

    def set_component(component: str, state: str, severity: str, reason: str):
        current_state, current_severity, current_reason = findings[component]
        merged_state = _merge_component_state(current_state, state)
        if merged_state == current_state:
            return
        merged_severity = severity if state == merged_state else current_severity
        merged_reason = reason if state == merged_state else current_reason
        findings[component] = (merged_state, merged_severity, merged_reason)

    if pre_check.fuelSystemStatus in {"CRITICAL", "ISSUE"} or post_check.fuelSystemStatus in {"CRITICAL", "ISSUE"}:
        set_component("fuel", "Critical", "HIGH", "Fuel system issue detected during training checks")
    elif pre_check.fuelSystemStatus == "LOW" or post_check.fuelSystemStatus == "LOW":
        set_component("fuel", "Warning", "MEDIUM", "Fuel system reported LOW during training checks")

    if post_check.engineStatus == "ISSUE":
        set_component("engine", "Critical", "HIGH", "Engine issue detected in post-training inspection")
    elif pre_check.engineStatus == "ISSUE":
        set_component("engine", "Warning", "MEDIUM", "Engine issue flagged in pre-training inspection")

    if post_check.avionicsStatus == "ISSUE":
        set_component("avionics", "Critical", "HIGH", "Avionics issue detected in post-training inspection")
    elif pre_check.avionicsStatus == "ISSUE":
        set_component("avionics", "Warning", "MEDIUM", "Avionics issue flagged in pre-training inspection")

    if post_check.wingsStatus == "DAMAGE" or post_check.damageObserved == "YES":
        set_component("wings", "Critical", "HIGH", "Wing damage detected in post-training inspection")
    elif pre_check.wingsStatus == "DAMAGE":
        set_component("wings", "Warning", "MEDIUM", "Wing issue flagged in pre-training inspection")

    if post_check.landingGearStatus == "ISSUE":
        set_component("landingGear", "Critical", "HIGH", "Landing gear issue detected in post-training inspection")
    elif pre_check.landingGearStatus == "ISSUE":
        set_component("landingGear", "Warning", "MEDIUM", "Landing gear issue flagged in pre-training inspection")

    if post_check.maintenanceRequired == "YES":
        set_component("landingGear", "Critical", "HIGH", "Post-training maintenance required")
    elif post_check.overallStatus == "NOT READY" or pre_check.overallStatus == "NOT READY":
        set_component("landingGear", "Warning", "MEDIUM", "Aircraft marked NOT READY during checks")

    return findings

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

    debrief_input = payload.debrief
    if debrief_input:
        telemetry = debrief_input.telemetrySummary
        telemetry_summary = "N/A"
        if telemetry:
            telemetry_summary = (
                f"Speed {telemetry.speedMin or 0}-{telemetry.speedMax or 0} kts "
                f"(avg {telemetry.speedAvg or 0}); "
                f"Altitude avg {telemetry.altitudeAvg or 0} m, peak {telemetry.altitudeMax or 0} m; "
                f"Heading {telemetry.headingRange or 'N/A'}"
            )

        debrief_document = create_document_from_template(
            db,
            template_key="training_debrief_report",
            document_type="TRAINING_DEBRIEF_REPORT",
            dynamic_fields={
                "trainingType": payload.trainingType,
                "duration": payload.duration,
                "debriefSource": debrief_input.source or "N/A",
                "performanceScore": debrief_input.score if debrief_input.score is not None else "N/A",
                "performanceGrade": debrief_input.grade or "N/A",
                "assessment": debrief_input.assessment or "N/A",
                "recommendations": " | ".join(debrief_input.recommendations) or "None",
                "pilotCallSigns": ", ".join([pilot.call_sign for pilot in pilots]) or "N/A",
                "peakG": debrief_input.peakG if debrief_input.peakG is not None else "N/A",
                "peakStress": debrief_input.peakStress if debrief_input.peakStress is not None else "N/A",
                "peakHeartRate": debrief_input.peakHeartRate if debrief_input.peakHeartRate is not None else "N/A",
                "peakFatigue": debrief_input.peakFatigue if debrief_input.peakFatigue is not None else "N/A",
                "telemetrySummary": telemetry_summary,
                "plannedRoute": " | ".join(debrief_input.plannedPath) or "N/A",
                "actionSummary": " | ".join(debrief_input.actionSummary) or "N/A",
            },
            created_by_role=context.role,
        )
        created_document_ids.append(debrief_document.id)

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
                "engineStatus": pre_check.engineStatus,
                "wingsStatus": pre_check.wingsStatus,
                "landingGearStatus": pre_check.landingGearStatus,
                "avionicsStatus": pre_check.avionicsStatus,
                "fuelSystemStatus": pre_check.fuelSystemStatus,
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
                summary=hash_value(f"Pre-training inspection for {payload.trainingType}"),
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
                "engineStatus": post_check.engineStatus,
                "wingsStatus": post_check.wingsStatus,
                "landingGearStatus": post_check.landingGearStatus,
                "avionicsStatus": post_check.avionicsStatus,
                "fuelSystemStatus": post_check.fuelSystemStatus,
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
                summary=hash_value(f"Post-training inspection for {payload.trainingType}"),
                document_id=post_document.id,
                created_at=now,
            )
        )

        component_findings = _derive_component_findings(pre_check, post_check)
        has_critical_component = False
        has_warning_component = False

        for component, (state, severity, reason) in component_findings.items():
            component_row = db.query(AircraftComponentStatus).filter(
                AircraftComponentStatus.aircraft_id == aircraft_id,
                AircraftComponentStatus.component == component,
            ).first()
            if not component_row:
                component_row = AircraftComponentStatus(
                    aircraft_id=aircraft_id,
                    component=component,
                    status=state,
                    notes=reason,
                )
                db.add(component_row)
            else:
                component_row.status = state
                component_row.notes = reason

            if state == "Warning":
                has_warning_component = True

            if state not in {"Warning", "Critical"}:
                continue

            if state == "Critical":
                has_critical_component = True

            issue_severity = "HIGH" if state == "Critical" else "MEDIUM"
            issue = db.query(AircraftIssue).filter(
                AircraftIssue.aircraft_id == aircraft_id,
                AircraftIssue.component == component,
                AircraftIssue.status.in_(["Open", "Assigned"]),
            ).order_by(AircraftIssue.id.asc()).first()

            if issue:
                issue.severity = issue_severity
                issue.description = reason
                if issue.status != "Assigned":
                    issue.status = "Open"
            else:
                db.add(
                    AircraftIssue(
                        aircraft_id=aircraft_id,
                        component=component,
                        severity=issue_severity,
                        description=reason,
                        status="Open",
                        created_at=now,
                    )
                )

            issue_type = _maintenance_issue_type(component)
            existing_entry = db.query(MaintenanceEntry).filter(
                MaintenanceEntry.aircraft_id == aircraft_id,
                MaintenanceEntry.issue_type == issue_type,
                MaintenanceEntry.status == "OPEN",
                MaintenanceEntry.engineer_notes.contains(component),
            ).first()
            if state == "Critical" and not existing_entry:
                db.add(
                    MaintenanceEntry(
                        aircraft_id=aircraft_id,
                        issue_type=issue_type,
                        severity="HIGH",
                        status="OPEN",
                        engineer_notes=f"Auto-created from training post-check: {component} - {reason}",
                        created_at=now,
                    )
                )
                db.add(
                    AircraftMaintenanceLog(
                        aircraft_id=aircraft_id,
                        log_type="MAINTENANCE_ENTRY",
                        summary=hash_value(
                            f"Auto-reported critical {component} issue from training ({payload.trainingType})"
                        ),
                        document_id=None,
                        created_at=now,
                    )
                )

            if state in {"Warning", "Critical"}:
                db.add(
                    AircraftMaintenanceLog(
                        aircraft_id=aircraft_id,
                        log_type="TRAINING_CRITICAL_ALERT",
                        summary=hash_value(f"{state} {component} status reported to engineering workflow"),
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
            and not has_critical_component
            and not has_warning_component
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
        # Derive a concise injury status so the document template can capture severity at a glance
        if not injuries:
            injury_status = "NONE"
        else:
            injury_status = "MAJOR" if any(item.severity == "MAJOR" for item in injuries) else "MINOR"

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
                flight_context=hash_value(f"Training - {payload.trainingType}"),
                fatigue_level=medical_input.fatigueLevel,
                stress_level=None,
                sleep_quality_score=0,
                cognitive_readiness=0,
                safe_to_assign=fit_for_duty,
                remarks=hash_value(medical_details.clearance_remarks),
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
                debrief=hash_value(payload.notes),
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
                "injuryStatus": injury_status,
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
