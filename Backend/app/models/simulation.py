from sqlalchemy import Column, Float, Integer, String
from app.db import Base


class AirspaceZone(Base):
    __tablename__ = "airspace_zones"

    id = Column(Integer, primary_key=True, index=True)
    country_name = Column(String(120), nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    radius_km = Column(Float, nullable=False)


class AirspaceZoneMeta(Base):
    __tablename__ = "airspace_zone_meta"

    zone_id = Column(Integer, primary_key=True, index=True)
    zone_type = Column(String(20), nullable=False, default="neutral")


class SimulationBaseLocation(Base):
    __tablename__ = "simulation_base_locations"

    id = Column(Integer, primary_key=True, index=True)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)


class AirspaceZoneVertex(Base):
    __tablename__ = "airspace_zone_vertices"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, nullable=False, index=True)
    vertex_order = Column(Integer, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
