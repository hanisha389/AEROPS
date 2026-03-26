from sqlalchemy.orm import Session
from app.models.access_code import AccessCode
from app.models.pilot import Pilot, PilotMedical, PilotMission
from app.models.engineer import Engineer, EngineerMaintenanceLog
from app.models.aircraft import Aircraft, AircraftMission, AircraftPilotAssignment


def seed(db: Session) -> None:
    if db.query(AccessCode).count() == 0:
        db.add(AccessCode(code="123456"))

    if db.query(Pilot).count() == 0:
        pilot_1 = Pilot(
            name="Capt. Marcus 'Viper' Reid",
            registration_number="PLT-2841",
            rank="Captain",
            call_sign="Viper",
            assigned_aircraft="AC-001",
            status="Active",
            on_holiday=False,
            face_url="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=face",
        )
        pilot_2 = Pilot(
            name="Lt. Sarah 'Phoenix' Chen",
            registration_number="PLT-2842",
            rank="Lieutenant",
            call_sign="Phoenix",
            assigned_aircraft="AC-002",
            status="Active",
            on_holiday=False,
            face_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=face",
        )
        db.add_all([pilot_1, pilot_2])
        db.flush()

        db.add_all(
            [
                PilotMedical(pilot_id=pilot_1.id, injuries="None", fit_for_duty=True, last_status="Fit for duty"),
                PilotMedical(pilot_id=pilot_2.id, injuries="None", fit_for_duty=True, last_status="Fit for duty"),
                PilotMission(
                    pilot_id=pilot_1.id,
                    mission_name="Operation Nightfall",
                    aircraft_name="F-35A Lightning II",
                    duration="4h 30m",
                    status="Completed",
                    outcome="Success",
                    notes="Recon over sector 7.",
                ),
                PilotMission(
                    pilot_id=pilot_2.id,
                    mission_name="Operation Thunderbolt",
                    aircraft_name="F-22 Raptor",
                    duration="5h 00m",
                    status="Completed",
                    outcome="Success",
                    notes="Air superiority mission.",
                ),
            ]
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

    if db.query(Aircraft).count() == 0:
        aircraft = Aircraft(
            id="AC-001",
            name="F-35A Lightning II",
            model="F-35A",
            health_status="Good",
            last_maintenance="2026-03-10",
        )
        db.add(aircraft)
        db.flush()
        db.add_all(
            [
                AircraftPilotAssignment(aircraft_id=aircraft.id, pilot_name="Viper"),
                AircraftMission(aircraft_id=aircraft.id, mission_name="Operation Nightfall", notes="Recon mission"),
            ]
        )

    db.commit()
