import hashlib
import math
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies.db import get_db
from app.dependencies.roles import ROLE_ADMIN_COMMANDER, require_roles
from app.models.aircraft import Aircraft
from app.models.pilot import Pilot
from app.models.simulation import AirspaceZone, AirspaceZoneMeta, SimulationBaseLocation
from app.schemas.simulation import (
    AirspaceZoneCreate,
    AirspaceZoneRead,
    Coordinate,
    SimulationBasePayload,
    SimulationEvent,
    SimulationFinalResult,
    SimulationFuelMetrics,
    SimulationMetrics,
    SimulationPerformanceMetrics,
    SimulationPilotContext,
    SimulationRunRequest,
    SimulationRunResponse,
    SimulationThreatMetrics,
    SimulationTimelineStep,
    SimulationTrajectoryMetrics,
)

router = APIRouter(
    prefix="/simulation",
    tags=["simulation"],
    dependencies=[Depends(require_roles(ROLE_ADMIN_COMMANDER))],
)

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

TIMELINE_STEP_SECONDS = 2.0
SIMULATION_VARIANTS = 10
INTERCEPT_THRESHOLD_KM = 0.35
DETECTION_RANGE_KM = 28.0
REACTION_DELAY_RANGE = (3.0, 10.0)
DETECTION_DELAY_RANGE = (2.0, 12.0)


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


def _build_distance_map(points: list[Coordinate]) -> list[tuple[Coordinate, float]]:
    if not points:
        return []
    result: list[tuple[Coordinate, float]] = [(points[0], 0.0)]
    cumulative = 0.0
    for index in range(1, len(points)):
        prev = points[index - 1]
        current = points[index]
        segment = _haversine_km(prev, current)
        cumulative += segment
        result.append((current, cumulative))
    return result


def _position_along_path(distance_map: list[tuple[Coordinate, float]], distance: float) -> Coordinate:
    if not distance_map:
        raise HTTPException(status_code=400, detail="Simulation path is not defined")
    if distance <= 0.0 or len(distance_map) == 1:
        return distance_map[0][0]

    for index in range(1, len(distance_map)):
        start_coord, start_distance = distance_map[index - 1]
        end_coord, end_distance = distance_map[index]
        if distance <= end_distance or index == len(distance_map) - 1:
            segment_delta = end_distance - start_distance
            ratio = 0.0
            if segment_delta > 0:
                ratio = (distance - start_distance) / segment_delta
            return _interpolate(start_coord, end_coord, min(1.0, max(0.0, ratio)))
    return distance_map[-1][0]


def _seed_from_payload(payload: SimulationRunRequest) -> int:
    pilot_segment = ",".join(str(pilot_id) for pilot_id in sorted(payload.selectedPilotIds))
    enemy_segment = ",".join(f"{unit.aircraftType}:{unit.quantity}" for unit in payload.enemyAircraftUnits)
    weapon_segment = ",".join(f"{item.aircraftId}:{item.weaponType}:{item.quantity}" for item in payload.weaponLoadout)
    source = f"{payload.missionType}-{payload.groundAirDefenseLevel}-{payload.groundDefenseCount}-{pilot_segment}-{enemy_segment}-{weapon_segment}"
    digest = hashlib.sha256(source.encode("utf-8")).digest()
    return int.from_bytes(digest[:4], "little")


def _inside_enemy_zone(position: Coordinate, enemy_zones: list[AirspaceZone]) -> bool:
    for zone in enemy_zones:
        center = Coordinate(lat=zone.center_lat, lng=zone.center_lng)
        if _haversine_km(position, center) <= zone.radius_km:
            return True
    return False


def _simulate_timeline(
    aircraft_map: list[tuple[Coordinate, float]],
    path_distance: float,
    enemy_map: list[tuple[Coordinate, float]],
    enemy_distance: float,
    aircraft_speed: float,
    target_speed: float,
    reaction_delay: float,
    detection_delay: float,
    step_seconds: float,
    max_time_seconds: float,
    aircraft_range: float,
    enemy_zones: list[AirspaceZone],
    record_timeline: bool,
    record_events: bool,
) -> dict:
    timeline: list[SimulationTimelineStep] = []
    events: list[SimulationEvent] = []
    time_seconds = 0.0
    fuel_remaining = 100.0
    last_aircraft_distance = 0.0
    locked = False
    intercepted = False
    intercept_time: float | None = None
    time_in_enemy_airspace = 0.0
    departed_logged = False
    enemy_zone_logged = False
    detection_logged = False
    fuel_failure_logged = False
    timeout_logged = False

    while time_seconds <= max_time_seconds:
        enemy_progress = min(enemy_distance, (target_speed * time_seconds) / 3600.0)
        enemy_pos = _position_along_path(enemy_map, enemy_progress)
        aircraft_progress_time = max(0.0, time_seconds - reaction_delay)
        aircraft_progress_distance = min(path_distance, (aircraft_speed * aircraft_progress_time) / 3600.0)
        aircraft_pos = _position_along_path(aircraft_map, aircraft_progress_distance)
        distance_to_enemy = _haversine_km(aircraft_pos, enemy_pos)

        inside_enemy = _inside_enemy_zone(aircraft_pos, enemy_zones)
        if inside_enemy:
            time_in_enemy_airspace += step_seconds
        if inside_enemy and not enemy_zone_logged and record_events:
            enemy_zone_logged = True
            events.append(SimulationEvent(timeSeconds=time_seconds, description=f"T+{time_seconds:.1f}s: Aircraft entered enemy airspace"))
        if not departed_logged and aircraft_progress_distance > 0 and record_events:
            departed_logged = True
            events.append(SimulationEvent(timeSeconds=time_seconds, description=f"T+{time_seconds:.1f}s: Aircraft departed base"))

        if not locked and distance_to_enemy <= DETECTION_RANGE_KM and time_seconds >= detection_delay:
            locked = True
            if record_events and not detection_logged:
                detection_logged = True
                events.append(SimulationEvent(timeSeconds=time_seconds, description=f"T+{time_seconds:.1f}s: Target detected"))

        if locked and not intercepted and distance_to_enemy <= INTERCEPT_THRESHOLD_KM:
            intercepted = True
            intercept_time = time_seconds
            if record_events:
                events.append(SimulationEvent(timeSeconds=time_seconds, description=f"T+{time_seconds:.1f}s: Intercept achieved"))

        distance_delta = max(0.0, aircraft_progress_distance - last_aircraft_distance)
        fuel_consumption = distance_delta * (100.0 / max(aircraft_range, 1.0))
        fuel_remaining = max(0.0, fuel_remaining - fuel_consumption)
        last_aircraft_distance = aircraft_progress_distance

        if fuel_remaining <= 0.0 and not fuel_failure_logged and record_events:
            fuel_failure_logged = True
            events.append(SimulationEvent(timeSeconds=time_seconds, description=f"T+{time_seconds:.1f}s: Simulation aborted (fuel depleted)"))

        step_status = (
            "intercepted"
            if intercepted
            else "failed"
            if fuel_remaining <= 0.0
            else "locked"
            if locked
            else "searching"
        )

        if time_seconds >= max_time_seconds and not intercepted and record_events and not timeout_logged:
            timeout_logged = True
            events.append(SimulationEvent(timeSeconds=time_seconds, description=f"T+{time_seconds:.1f}s: Mission timed out"))
            step_status = "failed"

        if record_timeline:
            flags: list[str] = []
            if locked:
                flags.append("locked")
            if inside_enemy:
                flags.append("in_enemy_zone")
            if intercepted:
                flags.append("intercepted")
            if step_status == "failed":
                flags.append("failed")

            timeline.append(
                SimulationTimelineStep(
                    timeSeconds=round(time_seconds, 2),
                    aircraftPosition=Coordinate(lat=aircraft_pos.lat, lng=aircraft_pos.lng),
                    enemyPosition=Coordinate(lat=enemy_pos.lat, lng=enemy_pos.lng),
                    fuelRemaining=round(fuel_remaining, 2),
                    distanceToTarget=round(distance_to_enemy, 3),
                    aircraftSpeedKmh=round(aircraft_speed, 2),
                    targetSpeedKmh=round(target_speed, 2),
                    status=step_status,
                    statusFlags=flags,
                )
            )

        if intercepted or fuel_remaining <= 0.0 or time_seconds >= max_time_seconds:
            break

        time_seconds += step_seconds

    final_status = "intercepted" if intercepted else "failed"
    return {
        "status": final_status,
        "intercept_time": intercept_time,
        "fuel_remaining": fuel_remaining,
        "time_elapsed": time_seconds,
        "timeline": timeline,
        "event_log": events,
        "time_in_enemy_airspace": time_in_enemy_airspace,
    }


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
    outbound_distance = _polyline_distance_km(outbound)
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

    aircraft_map = _build_distance_map(outbound)
    enemy_map = _build_distance_map(mission_route)
    enemy_total_distance = enemy_map[-1][1] if enemy_map else 0.0
    straight_distance = _haversine_km(base, intercept_point)
    expected_air_seconds = (outbound_distance / max(_aircraft_speed_kmh(best_aircraft.model), 1.0)) * 3600.0
    expected_target_seconds = (ship_time_h if ship_time_h > 0 else air_time_h) * 3600.0
    max_time_seconds = max(expected_air_seconds, expected_target_seconds) * 1.4 + 120.0
    max_time_seconds = max(max_time_seconds, 600.0)

    seed = _seed_from_payload(payload)
    success_hits = 0
    base_simulation: dict | None = None
    base_aircraft_speed = _aircraft_speed_kmh(best_aircraft.model)

    for run_index in range(SIMULATION_VARIANTS):
        rng = random.Random(seed + run_index)
        reaction_delay = rng.uniform(*REACTION_DELAY_RANGE)
        detection_delay = rng.uniform(*DETECTION_DELAY_RANGE)
        aircraft_speed_variation = base_aircraft_speed * rng.uniform(0.97, 1.03)
        target_speed_variation = max(0.0, target_speed * rng.uniform(0.94, 1.04) + rng.uniform(-2.0, 2.0))
        simulation_result = _simulate_timeline(
            aircraft_map=aircraft_map,
            path_distance=outbound_distance,
            enemy_map=enemy_map,
            enemy_distance=enemy_total_distance,
            aircraft_speed=aircraft_speed_variation,
            target_speed=target_speed_variation,
            reaction_delay=reaction_delay,
            detection_delay=detection_delay,
            step_seconds=TIMELINE_STEP_SECONDS,
            max_time_seconds=max_time_seconds,
            aircraft_range=aircraft_range,
            enemy_zones=enemy_zones,
            record_timeline=run_index == 0,
            record_events=run_index == 0,
        )
        if run_index == 0:
            base_simulation = simulation_result
        if simulation_result["status"] == "intercepted":
            success_hits += 1

    if base_simulation is None:
        raise HTTPException(status_code=500, detail="Unable to generate simulation timeline")

    success_rate_percent = (success_hits / SIMULATION_VARIANTS) * 100.0
    timeline = base_simulation["timeline"]
    event_log = base_simulation["event_log"]
    time_in_enemy_airspace = base_simulation["time_in_enemy_airspace"]
    time_elapsed_seconds = base_simulation["time_elapsed"]
    fuel_remaining = base_simulation["fuel_remaining"]
    intercept_seconds = base_simulation["intercept_time"]
    mission_result_status = "Success" if base_simulation["status"] == "intercepted" else "Failed"

    fuel_consumed = max(0.0, 100.0 - fuel_remaining)
    time_hours = max(time_elapsed_seconds / 3600.0, 1e-3)
    fuel_consumption_rate = fuel_consumed / time_hours
    remaining_range = aircraft_range * (fuel_remaining / 100.0)
    exposure_percentage = min(100.0, (time_in_enemy_airspace / max(time_elapsed_seconds, 1.0)) * 100.0) if time_elapsed_seconds > 0 else 0.0

    metrics = SimulationMetrics(
        trajectory=SimulationTrajectoryMetrics(
            totalDistanceKm=round(full_flight_distance, 2),
            pathDeviationKm=round(max(0.0, outbound_distance - straight_distance), 2),
            interceptPoint=intercept_point,
            interceptTimeSeconds=intercept_seconds,
        ),
        fuel=SimulationFuelMetrics(
            fuelConsumptionRatePerHour=round(fuel_consumption_rate, 2),
            remainingRangeKm=round(remaining_range, 2),
            returnFeasibility=round(fuel_feasibility, 2),
        ),
        threat=SimulationThreatMetrics(
            timeInEnemyAirspaceSeconds=round(time_in_enemy_airspace, 2),
            exposurePercentage=round(exposure_percentage, 2),
            enemyStrengthImpact=round(enemy_strength, 2),
        ),
        performance=SimulationPerformanceMetrics(
            pilotEfficiency=round(pilot_skill, 2),
            weaponReadiness=round(weapon_effect, 2),
        ),
    )

    final_result = SimulationFinalResult(
        status=mission_result_status,
        interceptTimeSeconds=intercept_seconds,
        successRatePercent=round(success_rate_percent, 2),
        timeElapsedSeconds=round(time_elapsed_seconds, 2),
        fuelRemaining=round(fuel_remaining, 2),
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
        timeline=timeline,
        finalResult=final_result,
        metrics=metrics,
        eventLog=event_log,
    )
