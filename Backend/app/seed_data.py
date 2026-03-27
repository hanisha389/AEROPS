from sqlalchemy.orm import Session
from app.models.access_code import AccessCode
from app.models.pilot import Pilot, PilotMedical, PilotMission, PilotPersonalDetails
from app.models.engineer import Engineer, EngineerMaintenanceLog
from app.models.aircraft import Aircraft, AircraftMission, AircraftPilotAssignment, AircraftComponentStatus


def seed(db: Session) -> None:
    if db.query(AccessCode).count() == 0:
        db.add(AccessCode(code="123456"))

    pilot_seed = [
        {
            "name": "Capt. Marcus 'Viper' Reid",
            "registration_number": "PLT-2841",
            "rank": "Captain",
            "call_sign": "Viper",
            "assigned_aircraft": "AC-001",
            "status": "Active",
            "on_holiday": False,
            "face_url": "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face",
            "service_number": "SVC-2841",
            "years_of_service": 6,
            "mission_name": "Operation Nightfall",
            "aircraft_name": "F-35A Lightning II",
            "mission_duration": "4h 30m",
            "mission_notes": "Recon over sector 7.",
        },
        {
            "name": "Lt. Sarah 'Phoenix' Chen",
            "registration_number": "PLT-2842",
            "rank": "Lieutenant",
            "call_sign": "Phoenix",
            "assigned_aircraft": "AC-002",
            "status": "Active",
            "on_holiday": False,
            "face_url": "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=face",
            "service_number": "SVC-2842",
            "years_of_service": 4,
            "mission_name": "Operation Thunderbolt",
            "aircraft_name": "F-22 Raptor",
            "mission_duration": "5h 00m",
            "mission_notes": "Air superiority mission.",
        },
        {
            "name": "Sqn Ldr. Arjun 'Falcon-1' Singh",
            "registration_number": "PLT-2843",
            "rank": "Squadron Leader",
            "call_sign": "Falcon-1",
            "assigned_aircraft": "AC-003",
            "status": "Active",
            "on_holiday": False,
            "face_url": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=face",
            "service_number": "SVC-2843",
            "years_of_service": 8,
            "mission_name": "Operation Falcon Shield",
            "aircraft_name": "Su-30MKI",
            "mission_duration": "5h 45m",
            "mission_notes": "Escort and strike mission.",
        },
        {
            "name": "Maj. Elena 'Comet' Volkov",
            "registration_number": "PLT-2844",
            "rank": "Major",
            "call_sign": "Comet",
            "assigned_aircraft": "AC-004",
            "status": "Active",
            "on_holiday": False,
            "face_url": "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=300&h=300&fit=crop&crop=face",
            "service_number": "SVC-2844",
            "years_of_service": 9,
            "mission_name": "Operation Steel Horizon",
            "aircraft_name": "Rafale C",
            "mission_duration": "4h 50m",
            "mission_notes": "High-altitude escort and interception.",
        },
        {
            "name": "Lt. Noah 'Ghost' Bennett",
            "registration_number": "PLT-2845",
            "rank": "Lieutenant",
            "call_sign": "Ghost",
            "assigned_aircraft": "AC-004",
            "status": "Active",
            "on_holiday": False,
            "face_url": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
            "service_number": "SVC-2845",
            "years_of_service": 3,
            "mission_name": "Operation Iron Veil",
            "aircraft_name": "Rafale C",
            "mission_duration": "3h 35m",
            "mission_notes": "Night strike support and jamming cover.",
        },
    ]
    existing_registrations = {row[0] for row in db.query(Pilot.registration_number).all()}
    pilots_to_create: list[tuple[Pilot, dict]] = []
    for entry in pilot_seed:
        if entry["registration_number"] in existing_registrations:
            continue
        pilot = Pilot(
            name=entry["name"],
            registration_number=entry["registration_number"],
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
            db.add(PilotMedical(pilot_id=pilot.id, injuries="None", fit_for_duty=True, last_status="Fit for duty"))
            db.add(
                PilotPersonalDetails(
                    pilot_id=pilot.id,
                    full_name=pilot.name,
                    service_number=entry["service_number"],
                    years_of_service=entry["years_of_service"],
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
                aircraft_id="AC-001",
                work_item="Scheduled",
                notes="Replaced radar module. All systems nominal.",
                is_current=True,
                log_date="2026-03-10",
            )
        )

    aircraft_seed = [
        {"id": "AC-001", "name": "F-35A Lightning II", "model": "F-35A", "last_maintenance": "2026-03-10", "mission": "Operation Nightfall", "notes": "Recon mission"},
        {"id": "AC-002", "name": "F-22 Raptor", "model": "F-22A", "last_maintenance": "2026-03-11", "mission": "Operation Thunderbolt", "notes": "Air superiority mission"},
        {"id": "AC-003", "name": "Su-30MKI", "model": "Su-30MKI", "last_maintenance": "2026-03-12", "mission": "Operation Falcon Shield", "notes": "Escort strike mission"},
        {"id": "AC-004", "name": "Rafale C", "model": "Rafale", "last_maintenance": "2026-03-14", "mission": "Operation Steel Horizon", "notes": "Interception and escort"},
        {"id": "AC-005", "name": "F/A-18E Super Hornet", "model": "F/A-18E", "last_maintenance": "2026-03-16", "mission": "Operation Hammer Tide", "notes": "Carrier strike readiness"},
    ]
    existing_aircraft_ids = {row[0] for row in db.query(Aircraft.id).all()}
    created_aircraft_ids: list[str] = []
    for entry in aircraft_seed:
        if entry["id"] in existing_aircraft_ids:
            continue
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
            if entry["id"] not in created_aircraft_ids:
                continue
            db.add(AircraftMission(aircraft_id=entry["id"], mission_name=entry["mission"], notes=entry["notes"]))
            for component in ["engine", "wings", "avionics", "fuel", "landingGear"]:
                db.add(AircraftComponentStatus(aircraft_id=entry["id"], component=component, status="Good", notes=""))

    assignment_seed = [
        ("AC-001", "Viper"),
        ("AC-002", "Phoenix"),
        ("AC-003", "Falcon-1"),
        ("AC-004", "Comet"),
        ("AC-004", "Ghost"),
        ("AC-005", "Falcon-1"),
    ]
    existing_assignments = {(row.aircraft_id, row.pilot_name) for row in db.query(AircraftPilotAssignment).all()}
    for aircraft_id, pilot_name in assignment_seed:
        if (aircraft_id, pilot_name) in existing_assignments:
            continue
        db.add(AircraftPilotAssignment(aircraft_id=aircraft_id, pilot_name=pilot_name))

    db.commit()
