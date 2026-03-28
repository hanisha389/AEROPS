import math
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.models.aircraft import Aircraft
from app.models.pilot import Pilot
from app.models.simulation import AirspaceZone, AirspaceZoneMeta, SimulationBaseLocation
from app.schemas.simulation import (
    AirspaceZoneCreate,
    AirspaceZoneRead,
    Coordinate,
    SimulationBasePayload,
    SimulationPilotContext,
    SimulationRunRequest,
    SimulationRunResponse,
)

router = APIRouter(prefix="/simulation", tags=["simulation"])

TARGET_SPEED_KMH = {
    "cargo_ship": 37.0,
    "warship": 56.0,
    "submarine": 30.0,
    "enemy_aircraft": 850.0,
}

MISSION_DIFFICULTY = {
    "water": 0.56,
    "air": 0.68,
    "ground": 0.62,
}


def _aircraft_speed_kmh(model: str) -> float:
    upper_model = model.upper()
    if "F-22" in upper_model:
        return 2410.0
    if "F-35" in upper_model:
        return 1930.0
    if "SU-30" in upper_model:
        return 2120.0
    if "RAFALE" in upper_model:
        return 1910.0
    if "F/A-18" in upper_model or "FA-18" in upper_model:
        return 1915.0
    return 1500.0


def _aircraft_range_km(model: str) -> float:
    upper_model = model.upper()
    if "F-22" in upper_model:
        return 2960.0
    if "F-35" in upper_model:
        return 2200.0
    if "SU-30" in upper_model:
        return 3000.0
    if "RAFALE" in upper_model:
        return 3700.0
    if "F/A-18" in upper_model or "FA-18" in upper_model:
        return 2340.0
    return 1800.0


def _to_rad(value: float) -> float:
    return (value * math.pi) / 180.0


def _haversine_km(a: Coordinate, b: Coordinate) -> float:
    earth_radius_km = 6371.0
    d_lat = _to_rad(b.lat - a.lat)
    d_lng = _to_rad(b.lng - a.lng)
    lat1 = _to_rad(a.lat)
    lat2 = _to_rad(b.lat)

    h = (math.sin(d_lat / 2.0) ** 2) + (math.cos(lat1) * math.cos(lat2) * (math.sin(d_lng / 2.0) ** 2))
    return 2.0 * earth_radius_km * math.asin(math.sqrt(h))


def _interpolate(a: Coordinate, b: Coordinate, ratio: float) -> Coordinate:
    return Coordinate(lat=a.lat + (b.lat - a.lat) * ratio, lng=a.lng + (b.lng - a.lng) * ratio)


def _sample_route(route: list[Coordinate], steps_per_segment: int = 25) -> list[tuple[Coordinate, float]]:
    sampled: list[tuple[Coordinate, float]] = [(route[0], 0.0)]
    cumulative = 0.0

    for index in range(len(route) - 1):
        start = route[index]
        end = route[index + 1]
        segment_distance = _haversine_km(start, end)

        for step in range(1, steps_per_segment + 1):
            ratio = step / steps_per_segment
            point = _interpolate(start, end, ratio)
            dist_on_segment = segment_distance * ratio
            sampled.append((point, cumulative + dist_on_segment))

        cumulative += segment_distance

    return sampled


def _polyline_distance_km(path: list[Coordinate]) -> float:
    if len(path) < 2:
        return 0.0
    total = 0.0
    for idx in range(len(path) - 1):
        total += _haversine_km(path[idx], path[idx + 1])
    return total


def _normalize(value: float, min_value: float = 0.0, max_value: float = 100.0) -> float:
    return max(min_value, min(max_value, value))


def _enemy_zone_fraction(path: list[Coordinate], enemy_zones: list[AirspaceZone]) -> float:
    if not path:
        return 0.0
    inside = 0
    for point in path:
        for zone in enemy_zones:
            if _haversine_km(point, Coordinate(lat=zone.center_lat, lng=zone.center_lng)) <= zone.radius_km:
                inside += 1
                break
    return inside / len(path)


def _zone_to_schema(zone: AirspaceZone) -> AirspaceZoneRead:
    zone_meta = getattr(zone, "zone_meta", None)
    zone_type = zone_meta.zone_type if zone_meta else "neutral"
    return AirspaceZoneRead(
        id=zone.id,
        countryName=zone.country_name,
        center=Coordinate(lat=zone.center_lat, lng=zone.center_lng),
        radiusKm=zone.radius_km,
        zoneType=zone_type,
    )


def _mission_route(payload: SimulationRunRequest) -> list[Coordinate]:
    if payload.missionType in ("water", "air"):
        if len(payload.routeCoordinates) < 2:
            raise HTTPException(status_code=400, detail="Route requires start and end points")
        return payload.routeCoordinates
    if payload.groundTargetLocation is None:
        raise HTTPException(status_code=400, detail="Ground mission requires a fixed target location")
    return [payload.groundTargetLocation]


def _target_speed(payload: SimulationRunRequest) -> float:
    if payload.missionType == "water":
        if payload.waterTargetType is None:
            raise HTTPException(status_code=400, detail="Water mission requires target type")
        return TARGET_SPEED_KMH[payload.waterTargetType]
    if payload.missionType == "air":
        return TARGET_SPEED_KMH["enemy_aircraft"]
    return 0.0


@router.get("/airspace-zones", response_model=list[AirspaceZoneRead])
def list_airspace_zones(db: Session = Depends(get_db)):
    zones = db.query(AirspaceZone).order_by(AirspaceZone.id.asc()).all()
    metas = db.query(AirspaceZoneMeta).all()
    meta_by_zone_id = {item.zone_id: item for item in metas}
    for zone in zones:
        setattr(zone, "zone_meta", meta_by_zone_id.get(zone.id))
    return [_zone_to_schema(zone) for zone in zones]


@router.post("/airspace-zones", response_model=AirspaceZoneRead, status_code=status.HTTP_201_CREATED)
def create_airspace_zone(payload: AirspaceZoneCreate, db: Session = Depends(get_db)):
    zone = AirspaceZone(
        country_name=payload.countryName.strip(),
        center_lat=payload.center.lat,
        center_lng=payload.center.lng,
        radius_km=payload.radiusKm,
    )
    db.add(zone)
    db.flush()
    db.add(AirspaceZoneMeta(zone_id=zone.id, zone_type=payload.zoneType))
    db.commit()
    db.refresh(zone)
    setattr(zone, "zone_meta", AirspaceZoneMeta(zone_id=zone.id, zone_type=payload.zoneType))
    return _zone_to_schema(zone)


@router.get("/base", response_model=Coordinate)
def get_base_location(db: Session = Depends(get_db)):
    base = db.query(SimulationBaseLocation).order_by(SimulationBaseLocation.id.asc()).first()
    if not base:
        raise HTTPException(status_code=404, detail="Base location not set")
    return Coordinate(lat=base.lat, lng=base.lng)


@router.put("/base", response_model=Coordinate)
def set_base_location(payload: SimulationBasePayload, db: Session = Depends(get_db)):
    base = db.query(SimulationBaseLocation).order_by(SimulationBaseLocation.id.asc()).first()
    if not base:
        base = SimulationBaseLocation(lat=payload.location.lat, lng=payload.location.lng)
        db.add(base)
    else:
        base.lat = payload.location.lat
        base.lng = payload.location.lng
    db.commit()
    return Coordinate(lat=base.lat, lng=base.lng)


@router.post("/run", response_model=SimulationRunResponse)
def run_simulation(payload: SimulationRunRequest, db: Session = Depends(get_db)):
    if not payload.selectedPilotIds:
        raise HTTPException(status_code=400, detail="Select at least one pilot")

    pilots = db.query(Pilot).filter(Pilot.id.in_(payload.selectedPilotIds)).all()
    if len(pilots) != len(payload.selectedPilotIds):
        raise HTTPException(status_code=404, detail="One or more selected pilots were not found")

    aircraft_ids = sorted({pilot.assigned_aircraft for pilot in pilots if pilot.assigned_aircraft})
    if not aircraft_ids:
        raise HTTPException(status_code=400, detail="Selected pilots do not have assigned aircraft")

    aircraft_list = db.query(Aircraft).filter(Aircraft.id.in_(aircraft_ids)).all()
    aircraft_by_id = {aircraft.id: aircraft for aircraft in aircraft_list}
    if len(aircraft_by_id) != len(aircraft_ids):
        raise HTTPException(status_code=404, detail="One or more assigned aircraft were not found")

    weapon_count_by_aircraft: dict[str, int] = {aircraft_id: 0 for aircraft_id in aircraft_ids}
    for item in payload.weaponLoadout:
        if item.aircraftId not in weapon_count_by_aircraft:
            raise HTTPException(status_code=400, detail=f"Weapon loadout references unknown aircraft: {item.aircraftId}")
        weapon_count_by_aircraft[item.aircraftId] += item.quantity

    over_capacity = [aircraft_id for aircraft_id, qty in weapon_count_by_aircraft.items() if qty > 5]
    if over_capacity:
        joined = ", ".join(over_capacity)
        raise HTTPException(status_code=400, detail=f"Aircraft loadout exceeds max capacity of 5 units: {joined}")

    base_row = db.query(SimulationBaseLocation).order_by(SimulationBaseLocation.id.asc()).first()
    if not base_row:
        raise HTTPException(status_code=400, detail="Set base location before running simulation")

    base = Coordinate(lat=base_row.lat, lng=base_row.lng)
    mission_route = _mission_route(payload)
    target_speed = _target_speed(payload)
    sampled_route = _sample_route(mission_route) if payload.missionType in ("water", "air") else [(mission_route[0], 0.0)]

    metas = db.query(AirspaceZoneMeta).all()
    meta_by_zone = {row.zone_id: row.zone_type for row in metas}
    enemy_zones = [
        zone for zone in db.query(AirspaceZone).all() if meta_by_zone.get(zone.id, "neutral") == "enemy"
    ]

    best_candidate: tuple[float, float, float, str, Coordinate] | None = None

    for point, ship_distance in sampled_route:
        ship_time_h = ship_distance / target_speed if target_speed > 0 else 0.0

        for aircraft_id in aircraft_ids:
            aircraft = aircraft_by_id[aircraft_id]
            aircraft_speed = _aircraft_speed_kmh(aircraft.model)
            outbound_path = [base, *payload.aircraftRouteWaypoints, point]
            air_distance = _polyline_distance_km(outbound_path)
            air_time_h = air_distance / aircraft_speed

            if payload.missionType == "ground" or air_time_h <= ship_time_h + 0.001:
                candidate = (ship_time_h, air_time_h, air_distance, aircraft_id, point)
                if best_candidate is None or candidate < best_candidate:
                    best_candidate = candidate

    if best_candidate is None:
        raise HTTPException(status_code=400, detail="No feasible intercept point found for the current route and selected team")

    ship_time_h, air_time_h, air_distance, best_aircraft_id, intercept_point = best_candidate
    time_minutes = round((ship_time_h if payload.missionType != "ground" else air_time_h) * 60.0, 2)

    best_aircraft = aircraft_by_id[best_aircraft_id]
    outbound = [base, *payload.aircraftRouteWaypoints, intercept_point]
    full_flight_path = [*outbound, base]
    full_flight_distance = _polyline_distance_km(full_flight_path)
    aircraft_range = _aircraft_range_km(best_aircraft.model)
    fuel_feasibility = _normalize((aircraft_range / max(full_flight_distance, 1.0)) * 100.0)

    enemy_strength = 0.0
    enemy_strength += sum(unit.quantity for unit in payload.enemyAircraftUnits) * 6.0
    enemy_strength += payload.groundDefenseCount * 4.0
    enemy_strength += payload.groundAirDefenseLevel * 3.0
    zone_penalty = _enemy_zone_fraction(full_flight_path, enemy_zones) * 100.0

    pilot_skill_values = []
    for pilot in pilots:
        metrics = pilot.performance_metrics
        if metrics:
            pilot_skill_values.append((metrics.reaction_time_score + metrics.decision_efficiency_score + metrics.maneuver_accuracy) / 3.0)
        else:
            pilot_skill_values.append(60.0)
    pilot_skill = sum(pilot_skill_values) / len(pilot_skill_values)

    weapon_units = sum(item.quantity for item in payload.weaponLoadout)
    weapon_types = len({item.weaponType for item in payload.weaponLoadout})
    weapon_effect = min(100.0, weapon_units * 9.0 + weapon_types * 7.0)

    distance_factor = _normalize(100.0 - (full_flight_distance / 20.0))
    time_feasibility = _normalize(100.0 - abs((air_time_h - ship_time_h) * 60.0) * 4.0)
    mission_efficiency = _normalize(0.5 * distance_factor + 0.5 * time_feasibility)

    threat_level = _normalize(0.55 * enemy_strength + 0.45 * zone_penalty)
    risk_level = _normalize(0.5 * threat_level + 0.25 * (100.0 - fuel_feasibility) + 0.25 * (100.0 - time_feasibility))

    target_difficulty = MISSION_DIFFICULTY[payload.missionType] * 100.0
    success_probability = _normalize(
        0.24 * pilot_skill
        + 0.2 * weapon_effect
        + 0.2 * fuel_feasibility
        + 0.2 * mission_efficiency
        - 0.12 * threat_level
        - 0.08 * target_difficulty
    )

    selected_pilot_context = [
        SimulationPilotContext(id=pilot.id, name=pilot.name, callSign=pilot.call_sign, aircraftId=pilot.assigned_aircraft)
        for pilot in sorted(pilots, key=lambda item: item.id)
    ]

    explanation = (
        "Selected the intercept point that satisfies timing feasibility while minimizing base-to-intercept travel distance; "
        "aircraft route starts from base and returns to base after intercept."
    )

    return SimulationRunResponse(
        baseLocation=base,
        interceptLocation=intercept_point,
        timeToInterceptMinutes=time_minutes,
        bestAircraftId=best_aircraft_id,
        bestAircraftPath=full_flight_path,
        enemyRoute=mission_route,
        explanation=explanation,
        successProbability=round(success_probability, 2),
        riskLevel=round(risk_level, 2),
        fuelFeasibility=round(fuel_feasibility, 2),
        threatLevel=round(threat_level, 2),
        missionEfficiencyScore=round(mission_efficiency, 2),
        selectedPilots=selected_pilot_context,
        aircraftUsed=aircraft_ids,
        weaponLoadout=payload.weaponLoadout,
    )
