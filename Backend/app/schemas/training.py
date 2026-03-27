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
