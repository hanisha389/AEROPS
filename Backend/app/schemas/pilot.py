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


class PilotPersonalDetailsBase(BaseModel):
    fullName: str
    serviceNumber: str
    dateOfBirth: Optional[str] = None
    dateOfJoining: Optional[str] = None
    yearsOfService: float = 0


class PilotOperationalStatusBase(BaseModel):
    operationalState: str = "Active"
    baseLocation: Optional[str] = None
    assignedSquadron: Optional[str] = None
    assignedAircraftType: Optional[str] = None
    lastMissionDate: Optional[str] = None
    currentMissionAssignment: Optional[str] = None


class PilotQualificationsBase(BaseModel):
    aircraftCertifications: list[str] = Field(default_factory=list)
    totalFlightHours: float = 0
    flightHoursPerAircraft: dict[str, float] = Field(default_factory=dict)
    specializations: list[str] = Field(default_factory=list)
    trainingLevel: str = "Intermediate"
    simulatorPerformanceScore: float = 0


class PilotPerformanceMetricsBase(BaseModel):
    avgMissionSuccessRate: float = 0
    reactionTimeScore: float = 0
    maneuverAccuracy: float = 0
    decisionEfficiencyScore: float = 0
    last5TrainingResults: list[str] = Field(default_factory=list)


class PilotMedicalDetailsBase(BaseModel):
    currentStatus: str = "Fit for Flight"
    lastMedicalCheckDate: Optional[str] = None
    nextDueCheck: Optional[str] = None
    pastInjuries: list[str] = Field(default_factory=list)
    fatigueLevel: Optional[str] = None
    clearanceRemarks: Optional[str] = None
    safeToAssign: bool = True


class PilotMedicalLogRead(BaseModel):
    id: int
    flightContext: str
    fatigueLevel: Optional[str] = None
    safeToAssign: bool
    remarks: Optional[str] = None
    createdAt: str


class PilotBase(BaseModel):
    name: str
    registrationNumber: str
    rank: str
    callSign: str
    assignedAircraft: Optional[str] = None
    status: str = "ACTIVE"
    onHoliday: bool = False
    image: str = Field(..., min_length=3)


class PilotCreate(PilotBase):
    skillLevel: str = "Intermediate"
    personalDetails: PilotPersonalDetailsBase
    medical: PilotMedicalBase = Field(default_factory=PilotMedicalBase)
    medicalDetails: PilotMedicalDetailsBase = Field(default_factory=PilotMedicalDetailsBase)
    operationalStatus: PilotOperationalStatusBase = Field(default_factory=PilotOperationalStatusBase)
    qualifications: PilotQualificationsBase = Field(default_factory=PilotQualificationsBase)
    performanceMetrics: PilotPerformanceMetricsBase = Field(default_factory=PilotPerformanceMetricsBase)
    missions: list[PilotMissionBase] = Field(default_factory=list)


class PilotRead(PilotBase):
    id: int
    skillLevel: str = "Intermediate"
    injury: str
    medicalReport: str
    medical: PilotMedicalRead
    personalDetails: PilotPersonalDetailsBase
    operationalStatus: PilotOperationalStatusBase
    qualifications: PilotQualificationsBase
    performanceMetrics: PilotPerformanceMetricsBase
    medicalDetails: PilotMedicalDetailsBase
    medicalLogs: list[PilotMedicalLogRead] = Field(default_factory=list)
    missions: list[PilotMissionRead]
    trainings: list[PilotTrainingRead] = Field(default_factory=list)

    class Config:
        from_attributes = True


class PilotUpdate(BaseModel):
    name: str
    assignedAircraft: Optional[str] = None
    skillLevel: str
    status: str
    leaveApplied: bool = False
