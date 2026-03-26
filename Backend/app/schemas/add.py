from typing import Literal, Union
from pydantic import BaseModel
from app.schemas.pilot import PilotCreate
from app.schemas.engineer import EngineerCreate
from app.schemas.aircraft import AircraftCreate


class AddEntityPayload(BaseModel):
    entityType: Literal["pilot", "engineer", "aircraft"]
    payload: Union[PilotCreate, EngineerCreate, AircraftCreate]
