from sqlalchemy import Column, ForeignKey, Integer, String, Text
from app.db import Base


class DocumentTemplate(Base):
    __tablename__ = "document_templates"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(80), unique=True, nullable=False, index=True)
    title = Column(String(160), nullable=False)
    fixed_sections = Column(Text, nullable=False, default="")
    required_fields = Column(Text, nullable=False, default="")


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(Integer, primary_key=True, index=True)
    template_key = Column(String(80), nullable=False, index=True)
    document_type = Column(String(80), nullable=False, index=True)
    title = Column(String(160), nullable=False)
    payload_json = Column(Text, nullable=False)
    pilot_id = Column(Integer, ForeignKey("pilots.id", ondelete="SET NULL"), nullable=True, index=True)
    aircraft_id = Column(String(50), ForeignKey("aircraft.id", ondelete="SET NULL"), nullable=True, index=True)
    maintenance_entry_id = Column(Integer, ForeignKey("maintenance_entries.id", ondelete="SET NULL"), nullable=True, index=True)
    created_by_role = Column(String(40), nullable=False)
    created_at = Column(String(50), nullable=False)
