from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class PilotTrainingLog(Base):
    __tablename__ = "pilot_training_logs"

    id = Column(Integer, primary_key=True, index=True)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="CASCADE"), nullable=False, index=True)
    training_type = Column(String(80), nullable=False)
    result = Column(String(80), nullable=True)
    aircraft_id = Column(String(50), nullable=True)
    debrief = Column(Text, nullable=True)
    created_at = Column(String(50), nullable=False)

    pilot = relationship("Pilot", back_populates="trainings")
