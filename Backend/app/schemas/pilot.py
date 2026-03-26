from typing import Optional
from pydantic import BaseModel, Field


class PilotMedicalBase(BaseModel):
    injuries: str = "None"
    fitForDuty: bool = True
    lastStatus: str = "Fit for duty"


class PilotMedicalRead(PilotMedicalBase):
    pass


class PilotMissionBase(BaseModel):
    name: str
    aircraftName: Optional[str] = None
    duration: Optional[str] = None
    status: Optional[str] = None
    outcome: Optional[str] = None
    notes: Optional[str] = None


class PilotMissionRead(PilotMissionBase):
    pass


class PilotBase(BaseModel):
    name: str
    registrationNumber: str
    rank: str
    callSign: str
    assignedAircraft: Optional[str] = None
    status: str = "Active"
    onHoliday: bool = False
    image: str = Field(default="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face")


class PilotCreate(PilotBase):
    medical: PilotMedicalBase = Field(default_factory=PilotMedicalBase)
    missions: list[PilotMissionBase] = Field(default_factory=list)


class PilotRead(PilotBase):
    id: int
    injury: str
    medicalReport: str
    medical: PilotMedicalRead
    missions: list[PilotMissionRead]

    class Config:
        from_attributes = True
