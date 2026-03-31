from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Pilot(Base):
    __tablename__ = "pilots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    registration_number = Column(String(50), unique=True, nullable=False, index=True)
    registration_number_hash = Column(String(64), nullable=True)
    rank = Column(String(80), nullable=False)
    call_sign = Column(String(80), nullable=False)
    assigned_aircraft = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default="Active")
    on_holiday = Column(Boolean, nullable=False, default=False)
    face_url = Column(String(500), nullable=False)

    medical = relationship("PilotMedical", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    missions = relationship("PilotMission", back_populates="pilot", cascade="all, delete-orphan")
    trainings = relationship("PilotTrainingLog", back_populates="pilot", cascade="all, delete-orphan")
    personal_details = relationship("PilotPersonalDetails", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    operational_status = relationship("PilotOperationalStatus", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    qualifications = relationship("PilotQualifications", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    performance_metrics = relationship("PilotPerformanceMetrics", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    medical_details = relationship("PilotMedicalDetails", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    medical_logs = relationship("PilotMedicalLog", back_populates="pilot", cascade="all, delete-orphan")


class PilotMedical(Base):
    __tablename__ = "pilot_medicals"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, unique=True)
    injuries = Column(String(255), nullable=False, default="None")
    fit_for_duty = Column(Boolean, nullable=False, default=True)
    last_status = Column(String(255), nullable=False, default="Fit for duty")

    pilot = relationship("Pilot", back_populates="medical")


class PilotMission(Base):
    __tablename__ = "pilot_missions"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, index=True)
    mission_name = Column(String(120), nullable=False)
    aircraft_name = Column(String(120), nullable=True)
    duration = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True)
    outcome = Column(String(50), nullable=True)
    notes = Column(Text, nullable=True)

    pilot = relationship("Pilot", back_populates="missions")


class PilotPersonalDetails(Base):
    __tablename__ = "pilot_personal_details"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, unique=True)
    full_name = Column(String(120), nullable=False)
    service_number = Column(String(60), nullable=False, unique=True, index=True)
    date_of_birth = Column(String(20), nullable=True)
    date_of_joining = Column(String(20), nullable=True)
    years_of_service = Column(Float, nullable=False, default=0)

    pilot = relationship("Pilot", back_populates="personal_details")


class PilotOperationalStatus(Base):
    __tablename__ = "pilot_operational_status"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, unique=True)
    operational_state = Column(String(40), nullable=False, default="Active")
    base_location = Column(String(120), nullable=True)
    squadron = Column(String(120), nullable=True)
    assigned_aircraft_type = Column(String(120), nullable=True)
    last_mission_date = Column(String(20), nullable=True)
    current_mission_assignment = Column(String(255), nullable=True)

    pilot = relationship("Pilot", back_populates="operational_status")


class PilotQualifications(Base):
    __tablename__ = "pilot_qualifications"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, unique=True)
    aircraft_certifications = Column(Text, nullable=True)
    total_flight_hours = Column(Float, nullable=False, default=0)
    flight_hours_per_aircraft = Column(Text, nullable=True)
    specializations = Column(Text, nullable=True)
    training_level = Column(String(40), nullable=False, default="Intermediate")
    simulator_score = Column(Float, nullable=False, default=0)

    pilot = relationship("Pilot", back_populates="qualifications")


class PilotPerformanceMetrics(Base):
    __tablename__ = "pilot_performance_metrics"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, unique=True)
    avg_mission_success_rate = Column(Float, nullable=False, default=0)
    reaction_time_score = Column(Float, nullable=False, default=0)
    maneuver_accuracy = Column(Float, nullable=False, default=0)
    decision_efficiency_score = Column(Float, nullable=False, default=0)
    last_five_training_results = Column(Text, nullable=True)

    pilot = relationship("Pilot", back_populates="performance_metrics")


class PilotMedicalDetails(Base):
    __tablename__ = "pilot_medical_details"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, unique=True)
    current_status = Column(String(40), nullable=False, default="Fit for Flight")
    last_medical_check_date = Column(String(20), nullable=True)
    next_due_check = Column(String(20), nullable=True)
    heart_rate = Column(String(20), nullable=True)
    blood_pressure = Column(String(30), nullable=True)
    oxygen_saturation = Column(String(20), nullable=True)
    vision_status = Column(String(40), nullable=True)
    g_tolerance_level = Column(String(40), nullable=True)
    past_injuries = Column(Text, nullable=True)
    surgeries = Column(Text, nullable=True)
    chronic_conditions = Column(Text, nullable=True)
    medication = Column(Text, nullable=True)
    fatigue_level = Column(String(20), nullable=True)
    stress_level = Column(String(20), nullable=True)
    sleep_quality_score = Column(Float, nullable=False, default=0)
    cognitive_readiness = Column(Float, nullable=False, default=0)
    last_cleared_for_flight = Column(String(20), nullable=True)
    cleared_by = Column(String(120), nullable=True)
    clearance_remarks = Column(Text, nullable=True)
    safe_to_assign = Column(Boolean, nullable=False, default=True)

    pilot = relationship("Pilot", back_populates="medical_details")


class PilotMedicalLog(Base):
    __tablename__ = "pilot_medical_logs"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, index=True)
    flight_context = Column(String(255), nullable=False)
    flight_context_hash = Column(String(64), nullable=True)
    fatigue_level = Column(String(20), nullable=True)
    stress_level = Column(String(20), nullable=True)
    sleep_quality_score = Column(Float, nullable=False, default=0)
    cognitive_readiness = Column(Float, nullable=False, default=0)
    safe_to_assign = Column(Boolean, nullable=False, default=True)
    remarks = Column(Text, nullable=True)
    remarks_hash = Column(String(64), nullable=True)
    created_at = Column(String(50), nullable=False)

    pilot = relationship("Pilot", back_populates="medical_logs")
