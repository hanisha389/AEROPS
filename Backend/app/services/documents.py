import json
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.document import DocumentTemplate, GeneratedDocument


DEFAULT_TEMPLATES = [
    {
        "key": "pre_flight_inspection_report",
        "title": "Pre-Flight Inspection Report",
        "sections": ["Inspection Context", "Aircraft Checklist", "Readiness Summary"],
        "required_fields": [
            "aircraftId",
            "fuelLevel",
            "engineStatus",
            "avionicsCheck",
            "weaponSystems",
            "overallStatus",
        ],
    },
    {
        "key": "post_flight_inspection_report",
        "title": "Post-Flight Inspection Report",
        "sections": ["Inspection Context", "Aircraft Checklist", "Damage and Maintenance"],
        "required_fields": [
            "aircraftId",
            "fuelLevel",
            "engineStatus",
            "avionicsCheck",
            "weaponSystems",
            "overallStatus",
            "damageObserved",
            "maintenanceRequired",
        ],
    },
    {
        "key": "pilot_medical_report",
        "title": "Pilot Medical Report",
        "sections": ["Pilot Identity", "Medical Assessment", "Duty Decision"],
        "required_fields": [
            "pilotId",
            "pilotName",
            "pilotImage",
            "status",
            "fatigueLevel",
            "injuries",
            "fitForDuty",
            "remarks",
        ],
    },
    {
        "key": "maintenance_entry_report",
        "title": "Maintenance Entry Report",
        "sections": ["Entry Context", "Issue Details"],
        "required_fields": ["aircraftId", "issueType", "severity", "notes"],
    },
    {
        "key": "maintenance_completion_report",
        "title": "Maintenance Completion Report",
        "sections": ["Completion Context", "Resolution Details", "Aircraft Readiness"],
        "required_fields": ["aircraftId", "issueResolved", "notes", "aircraftStatus"],
    },
]


def _join(values: list[str]) -> str:
    return "|".join(values)


def _split(value: str | None) -> list[str]:
    if not value:
        return []
    return [item for item in value.split("|") if item]


def ensure_default_templates(db: Session) -> None:
    existing_keys = {item[0] for item in db.query(DocumentTemplate.key).all()}
    for template in DEFAULT_TEMPLATES:
        if template["key"] in existing_keys:
            continue
        db.add(
            DocumentTemplate(
                key=template["key"],
                title=template["title"],
                fixed_sections=_join(template["sections"]),
                required_fields=_join(template["required_fields"]),
            )
        )
    db.flush()


def template_to_dict(template: DocumentTemplate) -> dict:
    return {
        "id": template.id,
        "key": template.key,
        "title": template.title,
        "fixedSections": _split(template.fixed_sections),
        "requiredFields": _split(template.required_fields),
    }


def create_document_from_template(
    db: Session,
    *,
    template_key: str,
    document_type: str,
    dynamic_fields: dict,
    created_by_role: str,
    pilot_id: int | None = None,
    aircraft_id: str | None = None,
    maintenance_entry_id: int | None = None,
) -> GeneratedDocument:
    template = db.query(DocumentTemplate).filter(DocumentTemplate.key == template_key).first()
    if not template:
        raise ValueError(f"Template not found: {template_key}")

    required_fields = _split(template.required_fields)
    missing = [field for field in required_fields if field not in dynamic_fields]
    if missing:
        raise ValueError(f"Missing required template fields: {', '.join(missing)}")

    payload = {
        "title": template.title,
        "fixedSections": _split(template.fixed_sections),
        "fields": dynamic_fields,
    }

    document = GeneratedDocument(
        template_key=template.key,
        document_type=document_type,
        title=template.title,
        payload_json=json.dumps(payload),
        pilot_id=pilot_id,
        aircraft_id=aircraft_id,
        maintenance_entry_id=maintenance_entry_id,
        created_by_role=created_by_role,
        created_at=datetime.utcnow().isoformat(),
    )
    db.add(document)
    db.flush()
    return document


def generated_document_to_dict(document: GeneratedDocument) -> dict:
    return {
        "id": document.id,
        "templateKey": document.template_key,
        "documentType": document.document_type,
        "title": document.title,
        "pilotId": document.pilot_id,
        "aircraftId": document.aircraft_id,
        "maintenanceEntryId": document.maintenance_entry_id,
        "createdByRole": document.created_by_role,
        "createdAt": document.created_at,
        "payload": json.loads(document.payload_json),
    }
