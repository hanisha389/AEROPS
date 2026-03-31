import hashlib
import os

_HASH_SALT = os.getenv("DATA_HASH_SALT", "aerops-default-salt")


def hash_value(value: str | None) -> str | None:
    if value is None:
        return None
    if value == "":
        return ""
    source = f"{_HASH_SALT}|{value}"
    return hashlib.sha256(source.encode("utf-8")).hexdigest()
