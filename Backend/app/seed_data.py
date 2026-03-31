from datetime import datetime, timedelta
import os
import random
from sqlalchemy.orm import Session
from app.models.access_code import AccessCode
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
from app.models.document import DocumentTemplate, GeneratedDocument
from app.models.engineer import Engineer, EngineerMaintenanceLog
from app.models.maintenance import AircraftMaintenanceLog, MaintenanceEntry
from app.models.aircraft import (
    Aircraft,
    AircraftComponentStatus,
    AircraftIssue,
    AircraftMission,
    AircraftPilotAssignment,
)
from app.security import hash_value


def seed(db: Session) -> None:
    rng = random.Random()
    clear_documents = os.getenv("SEED_CLEAR_DOCUMENTS", "false").strip().lower() in {"1", "true", "yes"}

    def iso_timestamp(days_ago: int = 0, hours_ago: int = 0) -> str:
        moment = datetime.utcnow() - timedelta(days=days_ago, hours=hours_ago)
        return moment.replace(microsecond=0).isoformat() + "Z"

    if db.query(AccessCode).count() == 0:
        db.add(AccessCode(code="123456"))

    db.query(PilotTrainingLog).delete()
    db.query(PilotMedicalLog).delete()
    db.query(PilotMedicalDetails).delete()
    db.query(PilotPerformanceMetrics).delete()
    db.query(PilotQualifications).delete()
    db.query(PilotOperationalStatus).delete()
    db.query(PilotMission).delete()
    db.query(PilotPersonalDetails).delete()
    db.query(PilotMedical).delete()
    db.query(Pilot).delete()

    db.query(AircraftIssue).delete()
    db.query(AircraftComponentStatus).delete()
    db.query(AircraftMission).delete()
    db.query(AircraftPilotAssignment).delete()
    db.query(AircraftMaintenanceLog).delete()
    if clear_documents:
        db.query(GeneratedDocument).delete()
        db.query(DocumentTemplate).delete()
    db.query(MaintenanceEntry).delete()
    db.query(Aircraft).delete()

    pilot_seed = [
        {
            "name": "Manish 'Godse' Kumar",
            "registration_number": "PLT-9001",
            "rank": "Flight Lieutenant",
            "call_sign": "Godse",
            "assigned_aircraft": "TJ-001",
            "status": "Active",
            "on_holiday": False,
            "face_url": "/images/godse.png",
            "service_number": "SVC-9001",
            "years_of_service": 7,
            "mission_name": "Night Patrol Sweep",
            "aircraft_name": "HAL Tejas",
            "mission_duration": "3h 25m",
            "mission_notes": "Border patrol and sensor calibration.",
        },
        {
            "name": "Kartikey 'Manthra'",
            "registration_number": "PLT-9002",
            "rank": "Flying Officer",
            "call_sign": "Manthra",
            "assigned_aircraft": "TJ-002",
            "status": "Active",
            "on_holiday": False,
            "face_url": "/images/Manthra.png",
            "service_number": "SVC-9002",
            "years_of_service": 3,
            "mission_name": "Dawn Intercept Practice",
            "aircraft_name": "HAL Tejas",
            "mission_duration": "2h 55m",
            "mission_notes": "High-speed intercept training over sector alpha.",
        },
        {
            "name": "Hanisha 'Mhysa' Goshikonda",
            "registration_number": "PLT-9003",
            "rank": "Flying Officer",
            "call_sign": "Mhysa",
            "assigned_aircraft": "TJ-003",
            "status": "Active",
            "on_holiday": False,
            "face_url": "/images/Mhysa.png",
            "service_number": "SVC-9003",
            "years_of_service": 4,
            "mission_name": "Mid-Range Escort",
            "aircraft_name": "HAL Tejas",
            "mission_duration": "3h 10m",
            "mission_notes": "Escort drill with electronic countermeasure support.",
        },
        {
            "name": "Ashwini 'Phoenix' Reddy",
            "registration_number": "PLT-9004",
            "rank": "Wing Commander",
            "call_sign": "Phoenix",
            "assigned_aircraft": "TJ-004",
            "status": "Active",
            "on_holiday": False,
            "face_url": "/images/phoenix.png",
            "service_number": "SVC-9004",
            "years_of_service": 12,
            "mission_name": "High Altitude Recon",
            "aircraft_name": "HAL Tejas",
            "mission_duration": "4h 05m",
            "mission_notes": "High-altitude surveillance and comms relay.",
        },
        {
            "name": "Rishik 'Risspect' Garg",
            "registration_number": "PLT-9005",
            "rank": "Squadron Leader",
            "call_sign": "Risspect",
            "assigned_aircraft": "TJ-005",
            "status": "Medical Hold",
            "on_holiday": False,
            "face_url": "/images/Risspect.png",
            "service_number": "SVC-9005",
            "years_of_service": 9,
            "mission_name": "Strike Escort",
            "aircraft_name": "HAL Tejas",
            "mission_duration": "3h 40m",
            "mission_notes": "Escort formation with simulated threat responses.",
        },
        {
            "name": "Srikanth 'Voldemort' Reddy",
            "registration_number": "PLT-9006",
            "rank": "Flight Lieutenant",
            "call_sign": "Voldemort",
            "assigned_aircraft": "TJ-006",
            "status": "Active",
            "on_holiday": False,
            "face_url": "/images/Voldemort.png",
            "service_number": "SVC-9006",
            "years_of_service": 6,
            "mission_name": "Night Air Defense Patrol",
            "aircraft_name": "HAL Tejas",
            "mission_duration": "3h 20m",
            "mission_notes": "Night patrol with radar discipline drills.",
        },
    ]
    pilots_to_create: list[tuple[Pilot, dict]] = []
    for entry in pilot_seed:
        pilot = Pilot(
            name=entry["name"],
            registration_number=entry["registration_number"],
            registration_number_hash=hash_value(entry["registration_number"]),
            rank=entry["rank"],
            call_sign=entry["call_sign"],
            assigned_aircraft=entry["assigned_aircraft"],
            status=entry["status"],
            on_holiday=entry["on_holiday"],
            face_url=entry["face_url"],
        )
        db.add(pilot)
        pilots_to_create.append((pilot, entry))

    if pilots_to_create:
        db.flush()
        for pilot, entry in pilots_to_create:
            is_medical_hold = entry["call_sign"].lower() == "risspect"
            injuries = "Knee strain" if is_medical_hold else "None"
            db.add(
                PilotMedical(
                    pilot_id=pilot.id,
                    injuries=injuries,
                    fit_for_duty=not is_medical_hold,
                    last_status="Medical leave" if is_medical_hold else "Fit for duty",
                )
            )
            db.add(
                PilotPersonalDetails(
                    pilot_id=pilot.id,
                    full_name=pilot.name,
                    service_number=entry["service_number"],
                    years_of_service=entry["years_of_service"],
                )
            )
            db.add(
                PilotOperationalStatus(
                    pilot_id=pilot.id,
                    operational_state="Medical Hold" if is_medical_hold else "Active",
                    base_location="AEROPS Main Base",
                    squadron="IAF Alpha",
                    assigned_aircraft_type="HAL Tejas",
                    last_mission_date=iso_timestamp(days_ago=4)[:10],
                    current_mission_assignment=entry["mission_name"],
                )
            )
            db.add(
                PilotQualifications(
                    pilot_id=pilot.id,
                    aircraft_certifications="HAL Tejas",
                    total_flight_hours=1200 + entry["years_of_service"] * 120,
                    flight_hours_per_aircraft="HAL Tejas:800",
                    specializations="Air Superiority|Escort",
                    training_level="Advanced" if entry["years_of_service"] > 6 else "Intermediate",
                    simulator_score=86 if not is_medical_hold else 78,
                )
            )
            training_results = []
            for idx in range(3):
                training_type = rng.choice(
                    [
                        "Maneuver - Low Altitude",
                        "Maneuver - Night Ops",
                        "Dogfight - 1v1",
                        "Dogfight - 2v2",
                        "Precision Bombing",
                        "Basic Maneuvers - Takeoff",
                        "Basic Maneuvers - Landing",
                    ]
                )
                result = "PASS" if rng.random() > 0.15 else "FAIL"
                training_results.append(result)
                db.add(
                    PilotTrainingLog(
                        pilot_id=pilot.id,
                        training_type=training_type,
                        result=result,
                        aircraft_id=entry["assigned_aircraft"],
                        debrief=(
                            "Stable performance with minor adjustments required."
                            if result == "PASS"
                            else "Deviations noted; remedial drills scheduled."
                        ),
                        debrief_hash=hash_value(
                            "Stable performance with minor adjustments required."
                            if result == "PASS"
                            else "Deviations noted; remedial drills scheduled."
                        ),
                        created_at=iso_timestamp(days_ago=idx + (6 if is_medical_hold else 1), hours_ago=idx * 2),
                    )
                )

            db.add(
                PilotPerformanceMetrics(
                    pilot_id=pilot.id,
                    avg_mission_success_rate=94 if not is_medical_hold else 82,
                    reaction_time_score=91 if not is_medical_hold else 76,
                    maneuver_accuracy=92 if not is_medical_hold else 79,
                    decision_efficiency_score=90 if not is_medical_hold else 77,
                    last_five_training_results="|".join((training_results + ["PASS"] * 2)[:5]),
                )
            )
            db.add(
                PilotMedicalDetails(
                    pilot_id=pilot.id,
                    current_status="Medical Leave" if is_medical_hold else "Fit for Flight",
                    last_medical_check_date=iso_timestamp(days_ago=5)[:10],
                    next_due_check=iso_timestamp(days_ago=-175)[:10],
                    fatigue_level="HIGH" if is_medical_hold else rng.choice(["LOW", "MEDIUM"]),
                    clearance_remarks="On medical leave for knee strain review."
                    if is_medical_hold
                    else "Cleared for combat readiness exercises.",
                    safe_to_assign=not is_medical_hold,
                    past_injuries="Knee strain:MINOR" if is_medical_hold else "",
                )
            )
            db.add(
                PilotMission(
                    pilot_id=pilot.id,
                    mission_name=entry["mission_name"],
                    aircraft_name=entry["aircraft_name"],
                    duration=entry["mission_duration"],
                    status="Completed",
                    outcome="Success",
                    notes=entry["mission_notes"],
                )
            )
            for idx in range(3):
                fatigue = "HIGH" if is_medical_hold else rng.choice(["LOW", "MEDIUM"])
                safe_to_assign = False if is_medical_hold else True
                db.add(
                    PilotMedicalLog(
                        pilot_id=pilot.id,
                        flight_context=f"Post-training check #{idx + 1} for {entry['mission_name']}",
                        flight_context_hash=hash_value(f"Post-training check #{idx + 1} for {entry['mission_name']}"),
                        fatigue_level=fatigue,
                        sleep_quality_score=6.1 if is_medical_hold else round(rng.uniform(7.2, 9.0), 1),
                        cognitive_readiness=6.4 if is_medical_hold else round(rng.uniform(7.5, 9.3), 1),
                        safe_to_assign=safe_to_assign,
                        remarks=(
                            "Medical leave enforced. Follow-up scheduled for recovery assessment."
                            if is_medical_hold
                            else "Vitals stable. Cleared for next sortie."
                        ),
                        remarks_hash=hash_value(
                            "Medical leave enforced. Follow-up scheduled for recovery assessment."
                            if is_medical_hold
                            else "Vitals stable. Cleared for next sortie."
                        ),
                        created_at=iso_timestamp(days_ago=idx + (5 if is_medical_hold else 1), hours_ago=idx),
                    )
                )

    if db.query(Engineer).count() == 0:
        engineer = Engineer(
            name="SSgt. Michael Torres",
            service_id="ENG-4001",
            role="Avionics Specialist",
            specialization="Avionics & Electronics",
            status="On Duty",
            on_holiday=False,
            face_url="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=face",
        )
        db.add(engineer)
        db.flush()
        db.add(
            EngineerMaintenanceLog(
                engineer_id=engineer.id,
                aircraft_id="TJ-001",
                work_item="Scheduled",
                notes="Replaced radar module. All systems nominal.",
                is_current=True,
                log_date="2026-03-10",
            )
        )

    aircraft_seed = [
        {"id": "TJ-001", "name": "HAL Tejas", "model": "Tejas", "last_maintenance": "2026-03-18", "mission": "Night Patrol Sweep", "notes": "Border patrol readiness"},
        {"id": "TJ-002", "name": "HAL Tejas", "model": "Tejas", "last_maintenance": "2026-03-18", "mission": "Dawn Intercept Practice", "notes": "Intercept training sortie"},
        {"id": "TJ-003", "name": "HAL Tejas", "model": "Tejas", "last_maintenance": "2026-03-19", "mission": "Mid-Range Escort", "notes": "Escort and ECM drills"},
        {"id": "TJ-004", "name": "HAL Tejas", "model": "Tejas", "last_maintenance": "2026-03-20", "mission": "High Altitude Recon", "notes": "High-altitude recon flight"},
        {"id": "TJ-005", "name": "HAL Tejas", "model": "Tejas", "last_maintenance": "2026-03-20", "mission": "Strike Escort", "notes": "Escort formation training"},
        {"id": "TJ-006", "name": "HAL Tejas", "model": "Tejas", "last_maintenance": "2026-03-21", "mission": "Night Air Defense Patrol", "notes": "Night patrol readiness"},
    ]
    created_aircraft_ids: list[str] = []
    for entry in aircraft_seed:
        db.add(
            Aircraft(
                id=entry["id"],
                name=entry["name"],
                model=entry["model"],
                health_status="Good",
                last_maintenance=entry["last_maintenance"],
            )
        )
        created_aircraft_ids.append(entry["id"])

    if created_aircraft_ids:
        db.flush()
        for entry in aircraft_seed:
            db.add(AircraftMission(aircraft_id=entry["id"], mission_name=entry["mission"], notes=entry["notes"]))
            for component in ["engine", "wings", "avionics", "fuel", "landingGear"]:
                db.add(AircraftComponentStatus(aircraft_id=entry["id"], component=component, status="Good", notes=""))

        aircraft_issue_seed = [
            {
                "aircraft_id": "TJ-003",
                "component": "wings",
                "severity": "HIGH",
                "description": "Wing spar stress detected after training sortie.",
                "status": "Open",
            },
            {
                "aircraft_id": "TJ-004",
                "component": "engine",
                "severity": "HIGH",
                "description": "Engine vibration above nominal thresholds.",
                "status": "Open",
            },
            {
                "aircraft_id": "TJ-005",
                "component": "wings",
                "severity": "MEDIUM",
                "description": "Wing flap actuator lag recorded.",
                "status": "Assigned",
            },
            {
                "aircraft_id": "TJ-005",
                "component": "engine",
                "severity": "MEDIUM",
                "description": "Engine oil pressure variance detected.",
                "status": "Open",
            },
        ]
        for issue in aircraft_issue_seed:
            db.add(
                AircraftIssue(
                    aircraft_id=issue["aircraft_id"],
                    component=issue["component"],
                    severity=issue["severity"],
                    description=issue["description"],
                    status=issue["status"],
                    created_at=iso_timestamp(days_ago=2),
                )
            )
            db.add(
                AircraftMaintenanceLog(
                    aircraft_id=issue["aircraft_id"],
                    log_type="TRAINING_CRITICAL_ALERT",
                    summary=issue["description"],
                    summary_hash=hash_value(issue["description"]),
                    document_id=None,
                    created_at=iso_timestamp(days_ago=2),
                )
            )

        maintenance_entries = [
            {
                "aircraft_id": "TJ-001",
                "issue_type": "Avionics",
                "severity": "LOW",
                "status": "COMPLETED",
                "notes": "Minor radar calibration adjustment.",
                "created_at": iso_timestamp(days_ago=6),
                "completed_at": iso_timestamp(days_ago=5),
            },
            {
                "aircraft_id": "TJ-003",
                "issue_type": "Structural",
                "severity": "HIGH",
                "status": "OPEN",
                "notes": "Wing spar inspection required.",
                "created_at": iso_timestamp(days_ago=2),
                "completed_at": None,
            },
            {
                "aircraft_id": "TJ-004",
                "issue_type": "Engine",
                "severity": "HIGH",
                "status": "OPEN",
                "notes": "Engine vibration analysis pending.",
                "created_at": iso_timestamp(days_ago=2),
                "completed_at": None,
            },
        ]
        for entry in maintenance_entries:
            db.add(
                MaintenanceEntry(
                    aircraft_id=entry["aircraft_id"],
                    issue_type=entry["issue_type"],
                    severity=entry["severity"],
                    status=entry["status"],
                    engineer_notes=entry["notes"],
                    created_at=entry["created_at"],
                    completed_at=entry["completed_at"],
                    issue_resolved=True if entry["status"] == "COMPLETED" else False,
                )
            )
            db.add(
                AircraftMaintenanceLog(
                    aircraft_id=entry["aircraft_id"],
                    log_type="MAINTENANCE_ENTRY",
                    summary=entry["notes"],
                    summary_hash=hash_value(entry["notes"]),
                    document_id=None,
                    created_at=entry["created_at"],
                )
            )

    assignment_seed = [
        ("TJ-001", "Godse"),
        ("TJ-002", "Manthra"),
        ("TJ-003", "Mhysa"),
        ("TJ-004", "Phoenix"),
        ("TJ-005", "Risspect"),
        ("TJ-006", "Voldemort"),
    ]
    for aircraft_id, pilot_name in assignment_seed:
        db.add(AircraftPilotAssignment(aircraft_id=aircraft_id, pilot_name=pilot_name))

    db.commit()
