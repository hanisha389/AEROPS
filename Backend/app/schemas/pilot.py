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


class PilotTrainingRead(BaseModel):
    trainingType: str
    result: Optional[str] = None
    aircraftId: Optional[str] = None
    debrief: Optional[str] = None
    createdAt: str


class PilotBase(BaseModel):
    name: str
    registrationNumber: str
    rank: str
    callSign: str
    assignedAircraft: Optional[str] = None
    status: str = "Active"
    onHoliday: bool = False
    image: str = Field(..., min_length=3)


class PilotCreate(PilotBase):
    medical: PilotMedicalBase = Field(default_factory=PilotMedicalBase)
    missions: list[PilotMissionBase] = Field(default_factory=list)


class PilotRead(PilotBase):
    id: int
    injury: str
    medicalReport: str
    medical: PilotMedicalRead
    missions: list[PilotMissionRead]
    trainings: list[PilotTrainingRead] = Field(default_factory=list)

    class Config:
        from_attributes = True
