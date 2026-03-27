from typing import Optional
from pydantic import BaseModel, Field


class EngineerMaintenanceLogBase(BaseModel):
    aircraft: Optional[str] = None
    type: str
    description: Optional[str] = None
    isCurrent: bool = False
    date: str


class EngineerMaintenanceLogRead(EngineerMaintenanceLogBase):
    id: int
    completionStatus: str = "Pending"


class EngineerBase(BaseModel):
    name: str
    employeeId: str
    role: str
    specialization: str
    status: str = "On Duty"
    onHoliday: bool = False
    image: str = Field(..., min_length=3)


class EngineerCreate(EngineerBase):
    maintenanceLogs: list[EngineerMaintenanceLogBase] = Field(default_factory=list)


class EngineerMaintenanceLogCreate(EngineerMaintenanceLogBase):
    issueId: Optional[int] = None


class EngineerMaintenanceStatusUpdate(BaseModel):
    completionStatus: str


class EngineerRead(EngineerBase):
    id: int
    aircraftWorkedOn: list[str]
    maintenanceLogs: list[EngineerMaintenanceLogRead]

    class Config:
        from_attributes = True
