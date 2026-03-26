from typing import Optional
from pydantic import BaseModel, Field


class EngineerMaintenanceLogBase(BaseModel):
    aircraft: Optional[str] = None
    type: str
    description: Optional[str] = None
    isCurrent: bool = False
    date: str


class EngineerMaintenanceLogRead(EngineerMaintenanceLogBase):
    pass


class EngineerBase(BaseModel):
    name: str
    employeeId: str
    role: str
    specialization: str
    status: str = "On Duty"
    onHoliday: bool = False
    image: str = Field(default="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=face")


class EngineerCreate(EngineerBase):
    maintenanceLogs: list[EngineerMaintenanceLogBase] = Field(default_factory=list)


class EngineerRead(EngineerBase):
    id: int
    aircraftWorkedOn: list[str]
    maintenanceLogs: list[EngineerMaintenanceLogRead]

    class Config:
        from_attributes = True
