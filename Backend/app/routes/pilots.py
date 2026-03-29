from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.dependencies.db import get_db
from app.dependencies.roles import (
    ROLE_ADMIN_COMMANDER,
    ROLE_PILOT,
    RequestContext,
    get_request_context,
)
from app.models.pilot import (
    Pilot,
    PilotMedical,
    PilotMedicalDetails,
    PilotMedicalLog,
    PilotMission,
    PilotOperationalStatus,
    PilotPerformanceMetrics,
    PilotPersonalDetails,
    PilotQualifications,
)
from app.models.training import PilotTrainingLog
from app.schemas.pilot import PilotCreate, PilotRead, PilotUpdate

router = APIRouter(prefix="/pilots", tags=["pilots"])


def _normalize_status(value: str | None) -> str:
    if not value:
        return "ACTIVE"
    raw = value.strip().upper()
    alias = {
        "ACTIVE": "ACTIVE",
        "INACTIVE": "INACTIVE",
        "ON LEAVE": "ON LEAVE",
        "ON_LEAVE": "ON LEAVE",
        "MEDICAL HOLD": "MEDICAL HOLD",
        "MEDICAL_HOLD": "MEDICAL HOLD",
        "ACTIVE DUTY": "ACTIVE",
    }
    return alias.get(raw, raw)


def _to_schema(pilot: Pilot) -> PilotRead:
    medical = pilot.medical or PilotMedical(injuries="None", fit_for_duty=True, last_status="Fit for duty")
    personal = pilot.personal_details or PilotPersonalDetails(
        full_name=pilot.name,
        service_number=f"SVC-{pilot.id}",
        years_of_service=0,
    )
    operational = pilot.operational_status or PilotOperationalStatus(operational_state=pilot.status)
    qualifications = pilot.qualifications or PilotQualifications(training_level="Intermediate", simulator_score=0, total_flight_hours=0)
    metrics = pilot.performance_metrics or PilotPerformanceMetrics(
        avg_mission_success_rate=0,
        reaction_time_score=0,
        maneuver_accuracy=0,
        decision_efficiency_score=0,
    )
    medical_details = pilot.medical_details or PilotMedicalDetails(current_status="Fit for Flight", safe_to_assign=medical.fit_for_duty)

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
    medical_logs = [
        {
            "id": entry.id,
            "flightContext": entry.flight_context,
            "fatigueLevel": entry.fatigue_level,
            "safeToAssign": entry.safe_to_assign,
            "remarks": entry.remarks,
            "createdAt": entry.created_at,
        }
        for entry in sorted(pilot.medical_logs, key=lambda item: item.created_at, reverse=True)
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
        status=_normalize_status(pilot.status),
        onHoliday=pilot.on_holiday,
        skillLevel=qualifications.training_level,
        image=pilot.face_url,
        injury=medical.injuries,
        medicalReport=report,
        medical={
            "injuries": medical.injuries,
            "fitForDuty": medical.fit_for_duty,
            "lastStatus": medical.last_status,
        },
        personalDetails={
            "fullName": personal.full_name,
            "serviceNumber": personal.service_number,
            "dateOfBirth": personal.date_of_birth,
            "dateOfJoining": personal.date_of_joining,
            "yearsOfService": personal.years_of_service,
        },
        operationalStatus={
            "operationalState": operational.operational_state,
            "baseLocation": operational.base_location,
            "assignedSquadron": operational.squadron,
            "assignedAircraftType": operational.assigned_aircraft_type,
            "lastMissionDate": operational.last_mission_date,
            "currentMissionAssignment": operational.current_mission_assignment,
        },
        qualifications={
            "aircraftCertifications": [item for item in (qualifications.aircraft_certifications or "").split("|") if item],
            "totalFlightHours": qualifications.total_flight_hours,
            "flightHoursPerAircraft": {},
            "specializations": [item for item in (qualifications.specializations or "").split("|") if item],
            "trainingLevel": qualifications.training_level,
            "simulatorPerformanceScore": qualifications.simulator_score,
        },
        performanceMetrics={
            "avgMissionSuccessRate": metrics.avg_mission_success_rate,
            "reactionTimeScore": metrics.reaction_time_score,
            "maneuverAccuracy": metrics.maneuver_accuracy,
            "decisionEfficiencyScore": metrics.decision_efficiency_score,
            "last5TrainingResults": [item for item in (metrics.last_five_training_results or "").split("|") if item],
        },
        medicalDetails={
            "currentStatus": medical_details.current_status,
            "lastMedicalCheckDate": medical_details.last_medical_check_date,
            "nextDueCheck": medical_details.next_due_check,
            "pastInjuries": [item for item in (medical_details.past_injuries or "").split("|") if item],
            "fatigueLevel": medical_details.fatigue_level,
            "clearanceRemarks": medical_details.clearance_remarks,
            "safeToAssign": medical_details.safe_to_assign,
        },
        medicalLogs=medical_logs,
        missions=missions,
        trainings=trainings,
    )


@router.get("", response_model=list[PilotRead])
def list_pilots(db: Session = Depends(get_db), context: RequestContext = Depends(get_request_context)):
    if context.role not in {ROLE_ADMIN_COMMANDER, ROLE_PILOT}:
        raise HTTPException(status_code=403, detail="Role is not allowed to access pilot data")

    pilots = db.query(Pilot).all()
    return [_to_schema(pilot) for pilot in pilots]


@router.get("/{pilot_id}", response_model=PilotRead)
def get_pilot(pilot_id: int, db: Session = Depends(get_db), context: RequestContext = Depends(get_request_context)):
    if context.role not in {ROLE_ADMIN_COMMANDER, ROLE_PILOT}:
        raise HTTPException(status_code=403, detail="Role is not allowed to access pilot data")

    pilot = db.query(Pilot).filter(Pilot.id == pilot_id).first()
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")
    return _to_schema(pilot)


@router.post("", response_model=PilotRead, status_code=status.HTTP_201_CREATED)
def create_pilot(
    payload: PilotCreate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    if context.role != ROLE_ADMIN_COMMANDER:
        raise HTTPException(status_code=403, detail="Only admin/commander can create pilots")

    existing = db.query(Pilot).filter(Pilot.registration_number == payload.registrationNumber).first()
    if existing:
        raise HTTPException(status_code=409, detail="Pilot registration number already exists")
    existing_service = db.query(PilotPersonalDetails).filter(PilotPersonalDetails.service_number == payload.personalDetails.serviceNumber).first()
    if existing_service:
        raise HTTPException(status_code=409, detail="Pilot service number already exists")

    pilot = Pilot(
        name=payload.name,
        registration_number=payload.registrationNumber,
        rank=payload.rank,
        call_sign=payload.callSign,
        assigned_aircraft=payload.assignedAircraft,
        status=_normalize_status(payload.status),
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

    db.add(
        PilotPersonalDetails(
            pilot_id=pilot.id,
            full_name=payload.personalDetails.fullName,
            service_number=payload.personalDetails.serviceNumber,
            date_of_birth=payload.personalDetails.dateOfBirth,
            date_of_joining=payload.personalDetails.dateOfJoining,
            years_of_service=payload.personalDetails.yearsOfService,
        )
    )

    db.add(
        PilotOperationalStatus(
            pilot_id=pilot.id,
            operational_state=payload.operationalStatus.operationalState,
            base_location=payload.operationalStatus.baseLocation,
            squadron=payload.operationalStatus.assignedSquadron,
            assigned_aircraft_type=payload.operationalStatus.assignedAircraftType,
            last_mission_date=payload.operationalStatus.lastMissionDate,
            current_mission_assignment=payload.operationalStatus.currentMissionAssignment,
        )
    )

    db.add(
        PilotQualifications(
            pilot_id=pilot.id,
            aircraft_certifications="|".join(payload.qualifications.aircraftCertifications),
            total_flight_hours=payload.qualifications.totalFlightHours,
            flight_hours_per_aircraft="",
            specializations="|".join(payload.qualifications.specializations),
            training_level=payload.skillLevel or payload.qualifications.trainingLevel,
            simulator_score=payload.qualifications.simulatorPerformanceScore,
        )
    )

    db.add(
        PilotPerformanceMetrics(
            pilot_id=pilot.id,
            avg_mission_success_rate=payload.performanceMetrics.avgMissionSuccessRate,
            reaction_time_score=payload.performanceMetrics.reactionTimeScore,
            maneuver_accuracy=payload.performanceMetrics.maneuverAccuracy,
            decision_efficiency_score=payload.performanceMetrics.decisionEfficiencyScore,
            last_five_training_results="|".join(payload.performanceMetrics.last5TrainingResults),
        )
    )

    db.add(
        PilotMedicalDetails(
            pilot_id=pilot.id,
            current_status=payload.medicalDetails.currentStatus,
            last_medical_check_date=payload.medicalDetails.lastMedicalCheckDate,
            next_due_check=payload.medicalDetails.nextDueCheck,
            past_injuries="|".join(payload.medicalDetails.pastInjuries),
            fatigue_level=payload.medicalDetails.fatigueLevel,
            clearance_remarks=payload.medicalDetails.clearanceRemarks,
            safe_to_assign=payload.medicalDetails.safeToAssign,
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


@router.put("/{pilot_id}", response_model=PilotRead)
def update_pilot(
    pilot_id: int,
    payload: PilotUpdate,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    if context.role != ROLE_ADMIN_COMMANDER:
        raise HTTPException(status_code=403, detail="Only admin/commander can update pilots")

    pilot = db.query(Pilot).filter(Pilot.id == pilot_id).first()
    if not pilot:
        raise HTTPException(status_code=404, detail="Pilot not found")

    qualifications = pilot.qualifications
    if not qualifications:
        qualifications = PilotQualifications(pilot_id=pilot.id, training_level=payload.skillLevel, simulator_score=0, total_flight_hours=0)
        db.add(qualifications)

    medical = pilot.medical
    fit_for_duty = True if not medical else medical.fit_for_duty

    requested_status = _normalize_status(payload.status)
    if payload.leaveApplied:
        requested_status = "ON LEAVE"
    if not fit_for_duty:
        requested_status = "MEDICAL HOLD"

    allowed_status = {"ACTIVE", "INACTIVE", "ON LEAVE", "MEDICAL HOLD"}
    if requested_status not in allowed_status:
        raise HTTPException(status_code=400, detail="Invalid pilot status")

    pilot.name = payload.name
    pilot.assigned_aircraft = payload.assignedAircraft
    pilot.status = requested_status
    pilot.on_holiday = requested_status == "ON LEAVE"
    qualifications.training_level = payload.skillLevel

    operational = pilot.operational_status
    if operational:
        operational.operational_state = requested_status
        operational.assigned_aircraft_type = payload.assignedAircraft

    db.commit()
    db.refresh(pilot)
    return _to_schema(pilot)
