from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Aircraft(Base):
    __tablename__ = "aircraft"

    id = Column(String(50), primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    model = Column(String(80), nullable=False)
    health_status = Column(String(80), nullable=True)
    last_maintenance = Column(String(50), nullable=True)

    assignments = relationship("AircraftPilotAssignment", back_populates="aircraft", cascade="all, delete-orphan")
    missions = relationship("AircraftMission", back_populates="aircraft", cascade="all, delete-orphan")


class AircraftPilotAssignment(Base):
    __tablename__ = "aircraft_pilot_assignments"

    id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(String(50), ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False, index=True)
    pilot_name = Column(String(120), nullable=False)

    aircraft = relationship("Aircraft", back_populates="assignments")


class AircraftMission(Base):
    __tablename__ = "aircraft_missions"

    id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(String(50), ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False, index=True)
    mission_name = Column(String(120), nullable=False)
    notes = Column(Text, nullable=True)

    aircraft = relationship("Aircraft", back_populates="missions")
