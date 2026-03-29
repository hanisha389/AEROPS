from pydantic import BaseModel, Field


class DocumentTemplateRead(BaseModel):
    id: int
    key: str
    title: str
    fixedSections: list[str] = Field(default_factory=list)
    requiredFields: list[str] = Field(default_factory=list)


class GeneratedDocumentRead(BaseModel):
    id: int
    templateKey: str
    documentType: str
    title: str
    pilotId: int | None = None
    aircraftId: str | None = None
    maintenanceEntryId: int | None = None
    createdByRole: str
    createdAt: str
    payload: dict
