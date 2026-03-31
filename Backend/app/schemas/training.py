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
    engineStatus: Literal["OK", "ISSUE"]
    wingsStatus: Literal["OK", "DAMAGE"]
    landingGearStatus: Literal["OK", "ISSUE"]
    avionicsStatus: Literal["OK", "ISSUE"]
    fuelSystemStatus: Literal["OK", "LOW", "CRITICAL", "ISSUE"]
    overallStatus: Literal["READY", "NOT READY"]


class PostAircraftChecklist(AircraftChecklist):
    damageObserved: Literal["YES", "NO"]
    maintenanceRequired: Literal["YES", "NO"]
    fluidLeakDetected: Literal["YES", "NO"] = "NO"
    birdStrikeSigns: Literal["YES", "NO"] = "NO"


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


class TrainingTelemetrySummary(BaseModel):
    speedMin: float | None = None
    speedAvg: float | None = None
    speedMax: float | None = None
    altitudeAvg: float | None = None
    altitudeMax: float | None = None
    headingRange: str | None = None


class TrainingDebriefInput(BaseModel):
    source: str = ""
    score: int | None = None
    grade: str = ""
    peakG: float | None = None
    peakStress: float | None = None
    peakHeartRate: float | None = None
    peakFatigue: float | None = None
    telemetrySummary: TrainingTelemetrySummary | None = None
    plannedPath: list[str] = Field(default_factory=list)
    actionSummary: list[str] = Field(default_factory=list)
    assessment: str = ""
    recommendations: list[str] = Field(default_factory=list)


class TrainingWorkflowRequest(BaseModel):
    pilotIds: list[int] = Field(min_length=1)
    aircraftIds: list[str] = Field(min_length=1)
    trainingType: Literal["Maneuver", "Dogfight", "Precision Bombing"]
    duration: str = Field(min_length=1)
    notes: str = ""
    debrief: TrainingDebriefInput | None = None
    preTrainingChecks: list[AircraftPreCheck] = Field(min_length=1)
    postTrainingChecks: list[AircraftPostCheck] = Field(min_length=1)
    pilotMedicalReports: list[PilotMedicalInput] = Field(min_length=1)


class TrainingWorkflowResponse(BaseModel):
    trainingType: str
    completed: bool
    createdDocumentIds: list[int] = Field(default_factory=list)
    updatedPilotIds: list[int] = Field(default_factory=list)
    updatedAircraftIds: list[str] = Field(default_factory=list)
