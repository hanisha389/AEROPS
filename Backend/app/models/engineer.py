from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from app.db import Base


class Engineer(Base):
    __tablename__ = "engineers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    service_id = Column(String(50), unique=True, nullable=False, index=True)
    role = Column(String(120), nullable=False)
    specialization = Column(String(120), nullable=False)
    status = Column(String(50), nullable=False, default="On Duty")
    on_holiday = Column(Boolean, nullable=False, default=False)
    face_url = Column(String(500), nullable=False)

    maintenance_logs = relationship("EngineerMaintenanceLog", back_populates="engineer", cascade="all, delete-orphan")


class EngineerMaintenanceLog(Base):
    __tablename__ = "engineer_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    engineer_id = Column(Integer, ForeignKey("engineers.id", ondelete="CASCADE"), nullable=False, index=True)
    aircraft_id = Column(String(50), nullable=True)
    work_item = Column(String(120), nullable=False)
    notes = Column(Text, nullable=True)
    is_current = Column(Boolean, nullable=False, default=False)
    log_date = Column(String(50), nullable=False)

    engineer = relationship("Engineer", back_populates="maintenance_logs")
