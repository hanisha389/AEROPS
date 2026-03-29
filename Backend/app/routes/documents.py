from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.roles import (
    ROLE_ADMIN_COMMANDER,
    ROLE_ENGINEER,
    ROLE_PILOT,
    RequestContext,
    get_request_context,
    require_roles,
)
from app.models.document import DocumentTemplate, GeneratedDocument
from app.services.documents import ensure_default_templates, generated_document_to_dict, template_to_dict

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get(
    "/templates",
    dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_PILOT, ROLE_ENGINEER))],
)
def list_templates(db: Session = Depends(get_db)):
    ensure_default_templates(db)
    templates = db.query(DocumentTemplate).order_by(DocumentTemplate.key.asc()).all()
    return [template_to_dict(item) for item in templates]


@router.get(
    "",
    dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER, ROLE_PILOT, ROLE_ENGINEER))],
)
def list_documents(
    type: str | None = None,
    pilotId: int | None = None,
    aircraftId: str | None = None,
    db: Session = Depends(get_db),
    context: RequestContext = Depends(get_request_context),
):
    query = db.query(GeneratedDocument)

    if type:
        query = query.filter(GeneratedDocument.document_type == type)
    if pilotId is not None:
        query = query.filter(GeneratedDocument.pilot_id == pilotId)
    if aircraftId:
        query = query.filter(GeneratedDocument.aircraft_id == aircraftId)

    if context.role == ROLE_PILOT:
        if context.pilot_id is None:
            return []
        query = query.filter(GeneratedDocument.pilot_id == context.pilot_id)
    elif context.role == ROLE_ENGINEER:
        query = query.filter(
            GeneratedDocument.document_type.in_(
                [
                    "PRE_FLIGHT_INSPECTION_REPORT",
                    "POST_FLIGHT_INSPECTION_REPORT",
                    "MAINTENANCE_ENTRY_REPORT",
                    "MAINTENANCE_COMPLETION_REPORT",
                ]
            )
        )

    documents = query.order_by(GeneratedDocument.created_at.desc()).all()
    return [generated_document_to_dict(item) for item in documents]
