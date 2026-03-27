from typing import Optional
from pydantic import BaseModel, Field


class AircraftMissionBase(BaseModel):
    name: str
    notes: Optional[str] = None


class AircraftMissionRead(AircraftMissionBase):
    pass


class AircraftIssueRead(BaseModel):
    id: int
    aircraftId: str
    component: str
    severity: str
    description: Optional[str] = None
    status: str
    createdAt: str


class AircraftBase(BaseModel):
    id: str
    name: str
    model: str
    healthStatus: Optional[str] = None
    lastMaintenance: Optional[str] = None


class AircraftCreate(AircraftBase):
    assignedPilots: list[str] = Field(default_factory=list)
    missions: list[AircraftMissionBase] = Field(default_factory=list)


class AircraftUpdate(BaseModel):
    name: str
    model: str
    healthStatus: Optional[str] = None
    lastMaintenance: Optional[str] = None
    assignedPilots: list[str] = Field(default_factory=list)
    missions: list[AircraftMissionBase] = Field(default_factory=list)


class AircraftRead(AircraftBase):
    assignedPilot: str
    assignedPilots: list[str]
    missions: list[str]
    missionDetails: list[AircraftMissionRead]
    componentStatus: dict[str, str] = Field(default_factory=dict)
    openIssues: list[AircraftIssueRead] = Field(default_factory=list)

    class Config:
        from_attributes = True
