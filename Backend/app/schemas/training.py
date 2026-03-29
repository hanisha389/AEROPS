from typing import Literal
from pydantic import BaseModel, Field


class TrainingRunRequest(BaseModel):
    trainingType: Literal["basic_maneuvers", "one_v_one_dogfight", "precision_bomb_drop"]
    pilotIds: list[int] = Field(default_factory=list)
    aircraftIds: list[str] = Field(default_factory=list)


class TrainingDebriefEvent(BaseModel):
    kind: str
    message: str


class TrainingRunResponse(BaseModel):
    trainingType: str
    winnerPilotId: int | None = None
    events: list[TrainingDebriefEvent]


class AircraftChecklist(BaseModel):
    fuelLevel: Literal["OK", "LOW", "CRITICAL"]
    engineStatus: Literal["OK", "ISSUE"]
    avionicsCheck: Literal["OK", "ISSUE"]
    weaponSystems: Literal["OK", "NOT REQUIRED"]
    overallStatus: Literal["READY", "NOT READY"]


class PostAircraftChecklist(AircraftChecklist):
    damageObserved: Literal["YES", "NO"]
    maintenanceRequired: Literal["YES", "NO"]


class AircraftPreCheck(BaseModel):
    aircraftId: str
    checklist: AircraftChecklist


class AircraftPostCheck(BaseModel):
    aircraftId: str
    checklist: PostAircraftChecklist


class PilotMedicalInput(BaseModel):
    class InjuryMark(BaseModel):
        part: str
        severity: Literal["MINOR", "MAJOR"]

    pilotId: int
    fatigueLevel: Literal["LOW", "MEDIUM", "HIGH"]
    injuries: list[InjuryMark] = Field(default_factory=list)
    fitForDuty: Literal["YES", "NO"]
    remarks: str = ""


class TrainingWorkflowRequest(BaseModel):
    pilotIds: list[int] = Field(min_length=1)
    aircraftIds: list[str] = Field(min_length=1)
    trainingType: Literal["Maneuver", "Dogfight", "Precision Bombing"]
    duration: str = Field(min_length=1)
    notes: str = ""
    preTrainingChecks: list[AircraftPreCheck] = Field(min_length=1)
    postTrainingChecks: list[AircraftPostCheck] = Field(min_length=1)
    pilotMedicalReports: list[PilotMedicalInput] = Field(min_length=1)


class TrainingWorkflowResponse(BaseModel):
    trainingType: str
    completed: bool
    createdDocumentIds: list[int] = Field(default_factory=list)
    updatedPilotIds: list[int] = Field(default_factory=list)
    updatedAircraftIds: list[str] = Field(default_factory=list)
