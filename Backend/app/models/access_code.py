from sqlalchemy import Column, Integer, String
from app.db import Base


class AccessCode(Base):
    __tablename__ = "access_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(6), nullable=False)
