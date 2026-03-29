from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from app.db import Base


class MaintenanceEntry(Base):
    __tablename__ = "maintenance_entries"

    id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(String(50), ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False, index=True)
    issue_type = Column(String(40), nullable=False)
    severity = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="OPEN")
    issue_resolved = Column(Boolean, nullable=True)
    engineer_notes = Column(Text, nullable=True)
    created_at = Column(String(50), nullable=False)
    completed_at = Column(String(50), nullable=True)


class AircraftMaintenanceLog(Base):
    __tablename__ = "aircraft_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    aircraft_id = Column(String(50), ForeignKey("aircraft.id", ondelete="CASCADE"), nullable=False, index=True)
    log_type = Column(String(80), nullable=False)
    summary = Column(Text, nullable=True)
    document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(String(50), nullable=False)
