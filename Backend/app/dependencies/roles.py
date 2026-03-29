from dataclasses import dataclass
from fastapi import Depends, Header, HTTPException

ROLE_ADMIN_COMMANDER = "ADMIN_COMMANDER"
ROLE_PILOT = "PILOT"
ROLE_ENGINEER = "ENGINEER"

ALL_ROLES = {
    ROLE_ADMIN_COMMANDER,
    ROLE_PILOT,
    ROLE_ENGINEER,
}


@dataclass
class RequestContext:
    role: str
    pilot_id: int | None


def get_request_context(
    role: str = Header(default=ROLE_ADMIN_COMMANDER, alias="x-role"),
    pilot_id_header: int | None = Header(default=None, alias="x-pilot-id"),
) -> RequestContext:
    normalized_role = role.strip().upper()
    if normalized_role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role header")
    return RequestContext(role=normalized_role, pilot_id=pilot_id_header)


def require_roles(*allowed_roles: str):
    normalized = {role.upper() for role in allowed_roles}
    def enforce(context: RequestContext = Depends(get_request_context)) -> RequestContext:
        if context.role not in normalized:
            raise HTTPException(status_code=403, detail="Role is not allowed to access this resource")
        return context

    return enforce
