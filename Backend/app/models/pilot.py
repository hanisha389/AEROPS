from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Pilot(Base):
    __tablename__ = "pilots"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    registration_number = Column(String(50), unique=True, nullable=False, index=True)
    rank = Column(String(80), nullable=False)
    call_sign = Column(String(80), nullable=False)
    assigned_aircraft = Column(String(50), nullable=True)
    status = Column(String(50), nullable=False, default="Active")
    on_holiday = Column(Boolean, nullable=False, default=False)
    face_url = Column(String(500), nullable=False)

    medical = relationship("PilotMedical", back_populates="pilot", uselist=False, cascade="all, delete-orphan")
    missions = relationship("PilotMission", back_populates="pilot", cascade="all, delete-orphan")
    trainings = relationship("PilotTrainingLog", back_populates="pilot", cascade="all, delete-orphan")


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
