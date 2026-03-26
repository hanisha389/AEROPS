from pydantic import BaseModel, Field, field_validator


class AccessCodeRead(BaseModel):
    code: str


class AccessCodeUpdate(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)

    @field_validator("code")
    @classmethod
    def validate_digits_only(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("Access code must be exactly 6 digits")
        return value


class AccessCodeVerify(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class AccessCodeVerifyResult(BaseModel):
    valid: bool
