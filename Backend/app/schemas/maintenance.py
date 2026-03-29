from typing import Literal
from pydantic import BaseModel


class MaintenanceEntryCreate(BaseModel):
    aircraftId: str
    issueType: Literal["Engine", "Avionics", "Structural"]
    severity: Literal["LOW", "MEDIUM", "HIGH"]
    notes: str = ""


class MaintenanceEntryComplete(BaseModel):
    issueResolved: Literal["YES", "NO"]
    notes: str


class MaintenanceEntryRead(BaseModel):
    id: int
    aircraftId: str
    issueType: str
    severity: str
    status: str
    issueResolved: str | None = None
    engineerNotes: str | None = None
    createdAt: str
    completedAt: str | None = None
