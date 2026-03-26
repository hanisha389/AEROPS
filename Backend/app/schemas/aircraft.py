from typing import Optional
from pydantic import BaseModel, Field


class AircraftMissionBase(BaseModel):
    name: str
    notes: Optional[str] = None


class AircraftMissionRead(AircraftMissionBase):
    pass


class AircraftBase(BaseModel):
    id: str
    name: str
    model: str
    healthStatus: Optional[str] = None
    lastMaintenance: Optional[str] = None


class AircraftCreate(AircraftBase):
    assignedPilots: list[str] = Field(default_factory=list)
    missions: list[AircraftMissionBase] = Field(default_factory=list)


class AircraftRead(AircraftBase):
    assignedPilot: str
    assignedPilots: list[str]
    missions: list[str]
    missionDetails: list[AircraftMissionRead]

    class Config:
        from_attributes = True
