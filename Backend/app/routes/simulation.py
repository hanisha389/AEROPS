import hashlib
import math
import heapq
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.dependencies.db import get_db
from app.dependencies.roles import ROLE_ADMIN_COMMANDER, require_roles
from app.models.aircraft import Aircraft
from app.models.pilot import Pilot
from app.models.simulation import AirspaceZone, AirspaceZoneMeta, AirspaceZoneVertex, SimulationBaseLocation, SimulationState
from app.schemas.simulation import (
    AirspaceZoneCreate,
    AirspaceZoneRead,
    Coordinate,
    SimulationAircraftLoadout,
    SimulationBasePayload,
    SimulationEvent,
    SimulationFinalResult,
    SimulationFuelMetrics,
    SimulationMetrics,
    SimulationPerformanceMetrics,
    SimulationPilotContext,
    SimulationGridDataResponse,
    SimulationGridLoadoutItem,
    SimulationGridPreset,
    SimulationGridPresetCreate,
    SimulationGridPilotSelection,
    SimulationGridRunRequest,
    SimulationGridRunResponse,
    SimulationGridState,
    SimulationGridStateResponse,
    SimulationGridStateUpdate,
    SimulationGridZone,
    SimulationRunRequest,
    SimulationRunResponse,
    SimulationStrategy,
    SimulationStrategyMetrics,
    SimulationStrategyRawMetrics,
    SimulationTargetProfile,
    SimulationThreatMetrics,
    SimulationTimelineStep,
    SimulationTrajectoryMetrics,
    SimulationWhatIf,
    SimulationWhatIfResult,
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


GRID_SIZE = 25
GRID_MAX_RED_CELLS = 3
GRID_MAX_LOADOUT = 5

GRID_DEFAULT_BOUNDS = {
    "min_lat": 4.0,
    "max_lat": 42.0,
    "min_lng": 60.0,
    "max_lng": 105.0,
}

GRID_DATA_PATH = Path(__file__).resolve().parents[1] / "simulation_data.json"
if GRID_DATA_PATH.exists():
    with GRID_DATA_PATH.open("r", encoding="utf-8") as handle:
        GRID_RAW_DATA = json.load(handle)
else:
    GRID_RAW_DATA = {"aircraft": [], "air_defense": []}

GRID_AIRCRAFT_LIST = GRID_RAW_DATA.get("aircraft", [])
GRID_DEFENSE_LIST = GRID_RAW_DATA.get("air_defense", [])

GRID_WEAPON_INDEX: dict[str, dict] = {}
GRID_WEAPON_LIST: list[dict] = []
for aircraft in GRID_AIRCRAFT_LIST:
    for weapon in aircraft.get("loadout", {}).get("systems", []):
        name = weapon.get("name")
        if name and name not in GRID_WEAPON_INDEX:
            GRID_WEAPON_INDEX[name] = weapon
            GRID_WEAPON_LIST.append(weapon)

GRID_AIRCRAFT_INDEX: dict[str, dict] = {
    aircraft.get("name"): aircraft
    for aircraft in GRID_AIRCRAFT_LIST
    if aircraft.get("name")
}
GRID_DEFENSE_INDEX: dict[str, dict] = {
    defense.get("name"): defense
    for defense in GRID_DEFENSE_LIST
    if defense.get("name")
}

GRID_TEAMS = sorted(
    {
        *(aircraft.get("group") for aircraft in GRID_AIRCRAFT_LIST if aircraft.get("group")),
        *(defense.get("group") for defense in GRID_DEFENSE_LIST if defense.get("group")),
    }
)

GRID_AIRCRAFT_STATS = [
    "speed",
    "range",
    "detection",
    "engagement_range",
    "maneuverability",
    "stealth",
]


def grid_aircraft_base_score(aircraft: dict) -> float:
    values = [
        aircraft.get(key)
        for key in GRID_AIRCRAFT_STATS
        if isinstance(aircraft.get(key), (int, float))
    ]
    if not values:
        return 0.6
    return sum(values) / len(values)


if GRID_AIRCRAFT_LIST:
    GRID_DEFAULT_AIRCRAFT_BASE = (
        sum(grid_aircraft_base_score(aircraft) for aircraft in GRID_AIRCRAFT_LIST)
        / len(GRID_AIRCRAFT_LIST)
    )
else:
    GRID_DEFAULT_AIRCRAFT_BASE = 0.6


def grid_weapon_weight(weapon: dict) -> float:
    weapon_range = weapon.get("range", 0.6)
    effectiveness = weapon.get("effectiveness", 0.6)
    return 0.8 + weapon_range * 0.6 + effectiveness * 0.4


def grid_weapon_cost(weapon: dict) -> float:
    weapon_range = weapon.get("range", 0.6)
    effectiveness = weapon.get("effectiveness", 0.6)
    return 200.0 + weapon_range * 450.0 + effectiveness * 550.0


for weapon in GRID_WEAPON_LIST:
    weapon["weight"] = round(grid_weapon_weight(weapon), 2)
    weapon["cost"] = round(grid_weapon_cost(weapon), 1)
    if weapon.get("name"):
        GRID_WEAPON_INDEX[weapon["name"]] = weapon


def grid_clamp(value: float, low: float, high: float) -> float:
    return max(low, min(value, high))


def grid_haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.asin(math.sqrt(a))
    return radius * c


def grid_aircraft_power(aircraft_key: str, loadout_items: list[SimulationGridLoadoutItem]) -> float:
    aircraft = GRID_AIRCRAFT_INDEX.get(aircraft_key)
    base = grid_aircraft_base_score(aircraft) if aircraft else GRID_DEFAULT_AIRCRAFT_BASE
    capacity = 0.8
    if aircraft:
        capacity = aircraft.get("loadout", {}).get("capacity", capacity)
    weapon_effectiveness = sum(
        GRID_WEAPON_INDEX[item.name]["effectiveness"] * item.quantity
        for item in loadout_items
        if item.name in GRID_WEAPON_INDEX
    )
    total_weight = sum(
        GRID_WEAPON_INDEX[item.name]["weight"] * item.quantity
        for item in loadout_items
        if item.name in GRID_WEAPON_INDEX
    )
    weight_penalty = grid_clamp(capacity + 0.2 - total_weight / 10.0, 0.3, 1.0)
    return (base + weapon_effectiveness) * weight_penalty


def grid_defense_score(defense: dict) -> float:
    return (
        0.45 * defense["detection_range"]
        + 0.35 * defense["engagement_range"]
        + 0.2 * defense["threat_level"]
    )


def grid_defense_power(defense_type: str, defense_count: int) -> float:
    if defense_count <= 0 or not GRID_DEFENSE_LIST:
        return 0.0
    defense = GRID_DEFENSE_INDEX.get(defense_type)
    if not defense:
        defense = GRID_DEFENSE_LIST[0]
    return grid_defense_score(defense) * defense_count


def grid_defense_units_from_state(state: dict) -> list[dict]:
    units = state.get("defense_units") or []
    if units:
        return units
    defense_type = state.get("defense_type") or ""
    defense_count = state.get("defense_count", 0)
    if defense_type and defense_count > 0:
        return [{"name": defense_type, "count": defense_count}]
    return []


def grid_total_defense_count(units: list[dict]) -> int:
    return sum(unit.get("count", 0) for unit in units if unit.get("count", 0) > 0)


def grid_defense_power_units(units: list[dict]) -> float:
    if not units or not GRID_DEFENSE_LIST:
        return 0.0
    total = 0.0
    for unit in units:
        count = unit.get("count", 0)
        if count <= 0:
            continue
        defense = GRID_DEFENSE_INDEX.get(unit.get("name"))
        if not defense:
            continue
        total += grid_defense_score(defense) * count
    return total


def grid_defense_radius_km(defense_power_value: float, defense_count: int) -> float:
    if defense_count <= 0:
        return 0.0
    return max(80.0, defense_power_value * 120.0)


def grid_risk_at_distance(distance_km: float, defense_power_value: float, radius_km: float) -> float:
    if radius_km <= 0:
        return 0.05
    if distance_km <= radius_km:
        return grid_clamp(0.65 + defense_power_value * 0.06, 0.65, 0.95)
    return 0.08


def grid_zone_base_risk(zone: str) -> float:
    if zone == "red":
        return 0.85
    if zone == "yellow":
        return 0.55
    return 0.25


def grid_nearest_cell(lat_grid, lng_grid, point: Coordinate):
    best = (0, 0)
    best_dist = float("inf")
    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            d_lat = lat_grid[r][c] - point.lat
            d_lng = lng_grid[r][c] - point.lng
            dist = d_lat * d_lat + d_lng * d_lng
            if dist < best_dist:
                best_dist = dist
                best = (r, c)
    return best


def grid_build_grid(
    start: Coordinate | None,
    target: Coordinate | None,
    defense_power_value: float,
    defense_radius_km: float,
    zones: list[SimulationGridZone],
):
    min_lat = GRID_DEFAULT_BOUNDS["min_lat"]
    max_lat = GRID_DEFAULT_BOUNDS["max_lat"]
    min_lng = GRID_DEFAULT_BOUNDS["min_lng"]
    max_lng = GRID_DEFAULT_BOUNDS["max_lng"]

    if min_lat == max_lat:
        min_lat -= 0.2
        max_lat += 0.2
    if min_lng == max_lng:
        min_lng -= 0.2
        max_lng += 0.2

    lat_step = (max_lat - min_lat) / GRID_SIZE
    lng_step = (max_lng - min_lng) / GRID_SIZE

    if target:
        target_point = target
    elif start:
        target_point = start
    else:
        target_point = Coordinate(lat=(min_lat + max_lat) / 2, lng=(min_lng + max_lng) / 2)

    corners = [
        (min_lat, min_lng),
        (min_lat, max_lng),
        (max_lat, min_lng),
        (max_lat, max_lng),
    ]
    max_dist = max(
        grid_haversine_km(target_point.lat, target_point.lng, lat, lng)
        for lat, lng in corners
    )
    if max_dist == 0:
        max_dist = 1.0

    grid = []
    risk_grid = [[0.0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    defense_grid = [[0.0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    zone_grid = [["green" for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    lat_grid = [[0.0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    lng_grid = [[0.0 for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
    bounds_grid = [[{} for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]

    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            south = min_lat + r * lat_step
            north = south + lat_step
            west = min_lng + c * lng_step
            east = west + lng_step
            lat = south + lat_step / 2
            lng = west + lng_step / 2

            lat_grid[r][c] = lat
            lng_grid[r][c] = lng
            bounds_grid[r][c] = {
                "north": north,
                "south": south,
                "east": east,
                "west": west,
            }

    zone_overrides = {}
    if zones:
        for zone in zones:
            row, col = grid_nearest_cell(lat_grid, lng_grid, Coordinate(lat=zone.lat, lng=zone.lng))
            zone_overrides[(row, col)] = zone.type

    for r in range(GRID_SIZE):
        for c in range(GRID_SIZE):
            lat = lat_grid[r][c]
            lng = lng_grid[r][c]
            dist = grid_haversine_km(target_point.lat, target_point.lng, lat, lng)
            ratio = grid_clamp(dist / max_dist, 0.0, 1.0)
            inside_radius = defense_radius_km > 0 and dist <= defense_radius_km
            defense_cell = defense_power_value * (1.0 if inside_radius else 0.2)

            if zone_overrides:
                zone = zone_overrides.get((r, c))
                if zone:
                    base_risk = grid_zone_base_risk(zone)
                else:
                    base_risk = 1.0 - ratio
                    zone = "red" if ratio <= 0.33 else "yellow" if ratio <= 0.66 else "green"
            else:
                base_risk = 1.0 - ratio
                zone = "red" if ratio <= 0.33 else "yellow" if ratio <= 0.66 else "green"

            risk = grid_risk_at_distance(dist, defense_power_value, defense_radius_km)

            risk_grid[r][c] = risk
            defense_grid[r][c] = defense_cell
            zone_grid[r][c] = zone

            grid.append(
                {
                    "row": r,
                    "col": c,
                    "lat": lat,
                    "lng": lng,
                    "zone": zone,
                    "risk": risk,
                    "defense": defense_cell,
                    "bounds": bounds_grid[r][c],
                }
            )

    return grid, risk_grid, defense_grid, zone_grid, lat_grid, lng_grid


def grid_zone_penalty(zone: str, mode: str) -> float:
    if mode == "safe":
        if zone == "red":
            return 520.0
        if zone == "yellow":
            return 55.0
        return 1.2
    if mode == "balanced":
        if zone == "red":
            return 140.0
        if zone == "yellow":
            return 16.0
        return 1.05
    if zone == "red":
        return 8.0
    if zone == "yellow":
        return 2.0
    return 1.0


def grid_step_cost(
    mode: str,
    distance_km: float,
    zone: str,
    risk_value: float,
    defense_value: float,
    inside_radius: bool,
    distance_to_target: float,
    radius_km: float,
):
    if mode == "safe":
        risk_weight = 7.0
    elif mode == "balanced":
        risk_weight = 5.0
    else:
        risk_weight = 2.5

    risk = min(max(risk_value, 0.0), 1.0)
    base_cost = distance_km * (1.0 + risk_weight * risk)

    if zone == "red":
        base_cost += 25.0
        if distance_to_target > max(radius_km * 0.6, 80.0):
            base_cost += 50.0

    if inside_radius:
        base_cost += 10.0

    return base_cost


def grid_dijkstra(
    risk_grid,
    defense_grid,
    zone_grid,
    lat_grid,
    lng_grid,
    start_rc,
    target_rc,
    mode,
    target_point: Coordinate,
    defense_radius_km: float,
):
    dist = [
        [[math.inf for _ in range(GRID_MAX_RED_CELLS + 1)] for _ in range(GRID_SIZE)]
        for _ in range(GRID_SIZE)
    ]
    prev = [
        [[None for _ in range(GRID_MAX_RED_CELLS + 1)] for _ in range(GRID_SIZE)]
        for _ in range(GRID_SIZE)
    ]

    sr, sc = start_rc
    tr, tc = target_rc

    start_red = 1 if zone_grid[sr][sc] == "red" else 0
    if start_red > GRID_MAX_RED_CELLS:
        return [], 0.0
    dist[sr][sc][start_red] = 0.0
    heap = [(0.0, sr, sc, start_red)]
    best_end = (sr, sc, start_red)
    best_end_distance = grid_haversine_km(
        lat_grid[sr][sc],
        lng_grid[sr][sc],
        target_point.lat,
        target_point.lng,
    )
    best_end_cost = 0.0

    while heap:
        cost, r, c, red_count = heapq.heappop(heap)
        if cost != dist[r][c][red_count]:
            continue
        if (r, c) == (tr, tc):
            break
        for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
            nr = r + dr
            nc = c + dc
            if 0 <= nr < GRID_SIZE and 0 <= nc < GRID_SIZE:
                step_distance = grid_haversine_km(
                    lat_grid[r][c],
                    lng_grid[r][c],
                    lat_grid[nr][nc],
                    lng_grid[nr][nc],
                )
                new_red_count = red_count + (1 if zone_grid[nr][nc] == "red" else 0)
                if new_red_count > GRID_MAX_RED_CELLS:
                    continue
                distance_to_target = grid_haversine_km(
                    lat_grid[nr][nc],
                    lng_grid[nr][nc],
                    target_point.lat,
                    target_point.lng,
                )
                inside_radius = defense_radius_km > 0 and distance_to_target <= defense_radius_km
                step = grid_step_cost(
                    mode,
                    step_distance,
                    zone_grid[nr][nc],
                    risk_grid[nr][nc],
                    defense_grid[nr][nc],
                    inside_radius,
                    distance_to_target,
                    defense_radius_km,
                )
                new_cost = cost + step
                if new_cost < dist[nr][nc][new_red_count]:
                    dist[nr][nc][new_red_count] = new_cost
                    prev[nr][nc][new_red_count] = (r, c, red_count)
                    heapq.heappush(heap, (new_cost, nr, nc, new_red_count))
                if distance_to_target < best_end_distance or (
                    distance_to_target == best_end_distance and new_cost < best_end_cost
                ):
                    best_end_distance = distance_to_target
                    best_end_cost = new_cost
                    best_end = (nr, nc, new_red_count)

    path_cells = []
    if any(dist[tr][tc][idx] < math.inf for idx in range(GRID_MAX_RED_CELLS + 1)):
        target_red = min(
            range(GRID_MAX_RED_CELLS + 1),
            key=lambda idx: dist[tr][tc][idx],
        )
        cur = (tr, tc, target_red)
    else:
        cur = best_end

    while cur is not None:
        path_cells.append((cur[0], cur[1]))
        if (cur[0], cur[1]) == (sr, sc):
            break
        cur = prev[cur[0]][cur[1]][cur[2]]
    path_cells.reverse()

    path_coords = [
        {"lat": lat_grid[r][c], "lng": lng_grid[r][c]} for r, c in path_cells
    ]
    if not path_cells:
        return path_coords, 0.0
    avg_risk = sum(risk_grid[r][c] for r, c in path_cells) / len(path_cells)

    return path_coords, avg_risk


def grid_zone_ratios_for_path(path: list[dict], lat_grid, lng_grid, zone_grid):
    green_steps = 0
    yellow_steps = 0
    red_steps = 0
    total_steps = 0
    for point in path:
        row, col = grid_nearest_cell(lat_grid, lng_grid, Coordinate(**point))
        zone = zone_grid[row][col]
        if zone == "green":
            green_steps += 1
        elif zone == "yellow":
            yellow_steps += 1
        else:
            red_steps += 1
        total_steps += 1

    total_steps = max(1, total_steps)
    green_ratio = green_steps / total_steps
    yellow_ratio = yellow_steps / total_steps
    red_ratio = red_steps / total_steps

    return {
        "green_steps": green_steps,
        "yellow_steps": yellow_steps,
        "red_steps": red_steps,
        "green_ratio": green_ratio,
        "yellow_ratio": yellow_ratio,
        "red_ratio": red_ratio,
    }


def grid_route_outcome(attack_power: float, defense_power_value: float, pilot_count: int, ratios: dict):
    casualty_ratio = (
        ratios["yellow_ratio"] * 0.2
        + ratios["red_ratio"] * 0.9
        + defense_power_value * 0.5
    )
    casualty_ratio = grid_clamp(casualty_ratio, 0.05, 0.95)

    success_ratio = attack_power / (
        attack_power + defense_power_value * (1.0 + ratios["red_ratio"] * 2.0)
    )
    success_ratio = grid_clamp(success_ratio, 0.05, 0.95)

    losses = int(pilot_count * casualty_ratio)
    return {
        "casualty_percentage": round(casualty_ratio * 100.0, 1),
        "success": round(success_ratio * 100.0, 1),
        "losses": losses,
    }


def grid_what_if_scenarios(attack_power: float, defense_power_value: float, pilot_count: int, ratios: dict):
    more_defense = grid_route_outcome(attack_power, defense_power_value * 1.3, pilot_count, ratios)
    less_defense = grid_route_outcome(attack_power, defense_power_value * 0.7, pilot_count, ratios)

    enemy_chance = grid_clamp(ratios["red_ratio"] * 0.8, 0.0, 0.95)
    enemy_defense = defense_power_value * (1.0 + enemy_chance)
    enemy_reinforcement = grid_route_outcome(attack_power, enemy_defense, pilot_count, ratios)
    enemy_reinforcement["chance"] = round(enemy_chance, 2)

    our_chance = grid_clamp(ratios["yellow_ratio"] * 0.7, 0.0, 0.95)
    our_attack = attack_power * (1.0 + our_chance)
    our_reinforcement = grid_route_outcome(our_attack, defense_power_value, pilot_count, ratios)
    our_reinforcement["chance"] = round(our_chance, 2)

    return {
        "more_defense": more_defense,
        "less_defense": less_defense,
        "enemy_reinforcement": enemy_reinforcement,
        "our_reinforcement": our_reinforcement,
    }


def grid_direct_path(start: Coordinate, target: Coordinate, steps: int = 18) -> list[dict]:
    path = []
    for idx in range(steps + 1):
        t = idx / steps
        curve = math.sin(t * math.pi) * 0.18
        lat = start.lat + (target.lat - start.lat) * t
        lng = start.lng + (target.lng - start.lng) * t + curve
        path.append({"lat": lat, "lng": lng})
    return path


def grid_path_distance_km(path: list[dict]) -> float:
    if len(path) < 2:
        return 0.0
    total = 0.0
    for idx in range(1, len(path)):
        total += grid_haversine_km(
            path[idx - 1]["lat"],
            path[idx - 1]["lng"],
            path[idx]["lat"],
            path[idx]["lng"],
        )
    return total


def grid_trim_path_by_red_limit(
    path: list[dict],
    lat_grid,
    lng_grid,
    zone_grid,
    max_red_cells: int,
):
    if not path:
        return []
    red_count = 0
    trimmed = []
    for point in path:
        row, col = grid_nearest_cell(lat_grid, lng_grid, Coordinate(**point))
        zone = zone_grid[row][col]
        if zone == "red":
            red_count += 1
            if red_count > max_red_cells:
                break
        trimmed.append(point)
    if not trimmed:
        trimmed.append(path[0])
    return trimmed


def grid_aircraft_speed_kmh(aircraft_key: str) -> float:
    aircraft = GRID_AIRCRAFT_INDEX.get(aircraft_key)
    speed_value = 0.7
    if aircraft:
        speed_value = aircraft.get("speed", speed_value)
    return 650.0 + speed_value * 450.0


def grid_build_state_response(state: dict):
    defense_units = grid_defense_units_from_state(state)
    defense_count = grid_total_defense_count(defense_units)
    defense_value = grid_defense_power_units(defense_units)
    defense_radius = grid_defense_radius_km(defense_value, defense_count)
    start = Coordinate(**state["start"]) if state.get("start") else None
    target = Coordinate(**state["target"]) if state.get("target") else None
    zones = [SimulationGridZone(**zone) for zone in state.get("zones", [])]
    grid, _, _, _, _, _ = grid_build_grid(start, target, defense_value, defense_radius, zones)
    return {
        "state": state,
        "grid": grid,
        "defense_radius_km": round(defense_radius, 1),
    }


def grid_default_state() -> dict:
    return {
        "team": None,
        "pilots": [],
        "defense_type": None,
        "defense_count": 0,
        "defense_units": [],
        "start": None,
        "target": None,
        "zones": [],
        "presets": [],
    }


def grid_state_snapshot(state: dict) -> dict:
    return {
        "team": state.get("team"),
        "pilots": state.get("pilots", []),
        "defense_type": state.get("defense_type"),
        "defense_count": state.get("defense_count", 0),
        "defense_units": grid_defense_units_from_state(state),
        "start": state.get("start"),
        "target": state.get("target"),
        "zones": state.get("zones", []),
    }


def grid_get_state(db: Session) -> tuple[SimulationState, dict]:
    row = db.query(SimulationState).order_by(SimulationState.id.asc()).first()
    if not row:
        payload = grid_default_state()
        row = SimulationState(payload=payload)
        db.add(row)
        flag_modified(row, "payload")
        db.commit()
        db.refresh(row)
        return row, payload

    payload = row.payload or {}
    defaults = grid_default_state()
    updated = False
    for key, value in defaults.items():
        if key not in payload:
            payload[key] = value
            updated = True
    if updated:
        row.payload = dict(payload)
        flag_modified(row, "payload")
        db.commit()
    return row, payload


def grid_persist_state(db: Session, row: SimulationState, state: dict) -> None:
    row.payload = dict(state)
    flag_modified(row, "payload")
    db.add(row)
    db.commit()


@router.get("/grid/data", response_model=SimulationGridDataResponse)
def grid_data():
    return {
        "teams": [{"name": team} for team in GRID_TEAMS],
        "aircraft": GRID_AIRCRAFT_LIST,
        "weapons": GRID_WEAPON_LIST,
        "defenses": GRID_DEFENSE_LIST,
    }


@router.get("/grid/state", response_model=SimulationGridStateResponse)
def grid_state(db: Session = Depends(get_db)):
    _, state = grid_get_state(db)
    return grid_build_state_response(state)


@router.post("/grid/state", response_model=SimulationGridStateResponse)
def grid_update_state(payload: SimulationGridStateUpdate, db: Session = Depends(get_db)):
    row, state = grid_get_state(db)
    if payload.team is not None:
        state["team"] = payload.team
    if payload.pilots is not None:
        state["pilots"] = [pilot.dict() for pilot in payload.pilots]
    if payload.defense_type is not None:
        state["defense_type"] = payload.defense_type
    if payload.defense_count is not None:
        state["defense_count"] = payload.defense_count
    if payload.defense_units is not None:
        state["defense_units"] = [unit.dict() for unit in payload.defense_units]
        total_count = grid_total_defense_count(state["defense_units"])
        primary = state["defense_units"][0]["name"] if state["defense_units"] else None
        state["defense_type"] = primary
        state["defense_count"] = total_count
    if payload.start is not None:
        state["start"] = payload.start.dict()
    if payload.target is not None:
        state["target"] = payload.target.dict()
    if payload.zones is not None:
        state["zones"] = [zone.dict() for zone in payload.zones]

    grid_persist_state(db, row, state)
    return grid_build_state_response(state)


@router.put("/grid/layout", response_model=SimulationGridStateResponse)
def grid_save_layout(payload: SimulationGridStateUpdate, db: Session = Depends(get_db)):
    if payload.zones is None:
        raise HTTPException(status_code=400, detail="Zones payload is required")
    row, state = grid_get_state(db)
    state["zones"] = [zone.dict() for zone in payload.zones]
    grid_persist_state(db, row, state)
    return grid_build_state_response(state)


@router.post("/grid/simulate", response_model=SimulationGridRunResponse)
def grid_simulate(payload: SimulationGridRunRequest, db: Session = Depends(get_db)):
    pilots = [pilot for pilot in payload.pilots if pilot.aircraft]
    if not pilots and GRID_AIRCRAFT_LIST:
        pilots = [SimulationGridPilotSelection(pilot_id=0, aircraft=GRID_AIRCRAFT_LIST[0]["name"], loadout=[])]

    attack_power = 0.0
    total_weight = 0.0
    total_loadout_cost = 0.0
    speed_values = []
    for pilot in pilots:
        loadout = [
            item
            for item in pilot.loadout
            if item.name in GRID_WEAPON_INDEX and item.quantity > 0
        ]
        attack_power += grid_aircraft_power(pilot.aircraft, loadout)
        for item in loadout:
            weapon = GRID_WEAPON_INDEX[item.name]
            total_weight += weapon["weight"] * item.quantity
            total_loadout_cost += weapon["cost"] * item.quantity
        speed_values.append(grid_aircraft_speed_kmh(pilot.aircraft))

    defense_units = [unit.dict() for unit in payload.defense_units] if payload.defense_units else []
    if not defense_units and payload.defense_type and payload.defense_count > 0:
        defense_units = [{"name": payload.defense_type, "count": payload.defense_count}]
    total_defense_count = grid_total_defense_count(defense_units)

    if total_defense_count > 0:
        for pilot in pilots:
            if pilot.aircraft == "Su-30MKI":
                attack_power *= 0.92
            if pilot.aircraft == "Rafale":
                attack_power *= 1.06

    defense_power_value = grid_defense_power_units(defense_units)
    defense_radius = grid_defense_radius_km(defense_power_value, total_defense_count)

    grid, risk_grid, defense_grid, zone_grid, lat_grid, lng_grid = grid_build_grid(
        payload.start, payload.target, defense_power_value, defense_radius, payload.zones
    )

    start_rc = grid_nearest_cell(lat_grid, lng_grid, payload.start)
    target_rc = grid_nearest_cell(lat_grid, lng_grid, payload.target)

    pilot_count = max(1, len(pilots))
    weight_per_aircraft = total_weight / pilot_count
    fuel_factor = 1.0 + weight_per_aircraft / 12.0
    fuel_cost_per_km = 5200.0
    avg_speed = sum(speed_values) / len(speed_values) if speed_values else 900.0

    routes = []

    direct = grid_direct_path(payload.start, payload.target)
    direct = grid_trim_path_by_red_limit(
        direct,
        lat_grid,
        lng_grid,
        zone_grid,
        GRID_MAX_RED_CELLS,
    )
    direct_ratios = grid_zone_ratios_for_path(direct, lat_grid, lng_grid, zone_grid)
    direct_outcome = grid_route_outcome(attack_power, defense_power_value, pilot_count, direct_ratios)
    direct_success = direct_outcome["success"]
    direct_casualty_pct = direct_outcome["casualty_percentage"]
    direct_aircraft_losses = int(pilot_count * (direct_casualty_pct / 100.0))
    direct_distance = grid_path_distance_km(direct)
    direct_time = direct_distance / avg_speed if avg_speed > 0 else 0.0
    direct_cost = direct_distance * fuel_cost_per_km * pilot_count * fuel_factor + total_loadout_cost
    routes.append(
        {
            "mode": "direct",
            "path": direct,
            "risk": round(direct_ratios["red_ratio"], 3),
            "green_ratio": round(direct_ratios["green_ratio"], 3),
            "yellow_ratio": round(direct_ratios["yellow_ratio"], 3),
            "red_ratio": round(direct_ratios["red_ratio"], 3),
            "casualty_percentage": direct_casualty_pct,
            "success": direct_success,
            "losses": direct_outcome["losses"],
            "aircraft_losses": direct_aircraft_losses,
            "what_if": grid_what_if_scenarios(attack_power, defense_power_value, pilot_count, direct_ratios),
            "distance_km": round(direct_distance, 2),
            "time_hours": round(direct_time, 2),
            "estimated_cost": round(direct_cost, 0),
        }
    )

    for mode in ["safe", "balanced"]:
        path, _ = grid_dijkstra(
            risk_grid,
            defense_grid,
            zone_grid,
            lat_grid,
            lng_grid,
            start_rc,
            target_rc,
            mode,
            payload.target,
            defense_radius,
        )
        ratios = grid_zone_ratios_for_path(path, lat_grid, lng_grid, zone_grid)
        outcome = grid_route_outcome(attack_power, defense_power_value, pilot_count, ratios)
        casualty_pct = outcome["casualty_percentage"]
        success = outcome["success"]
        if mode == "safe" and casualty_pct >= direct_casualty_pct:
            casualty_pct = max(0.0, direct_casualty_pct - 3.0)
            outcome["losses"] = int(pilot_count * (casualty_pct / 100.0))
        aircraft_losses = int(pilot_count * (casualty_pct / 100.0))
        distance_km = grid_path_distance_km(path)
        time_hours = distance_km / avg_speed if avg_speed > 0 else 0.0
        estimated_cost = distance_km * fuel_cost_per_km * pilot_count * fuel_factor + total_loadout_cost
        routes.append(
            {
                "mode": mode,
                "path": path,
                "risk": round(ratios["red_ratio"], 3),
                "green_ratio": round(ratios["green_ratio"], 3),
                "yellow_ratio": round(ratios["yellow_ratio"], 3),
                "red_ratio": round(ratios["red_ratio"], 3),
                "casualty_percentage": casualty_pct,
                "success": success,
                "losses": outcome["losses"],
                "aircraft_losses": aircraft_losses,
                "what_if": grid_what_if_scenarios(attack_power, defense_power_value, pilot_count, ratios),
                "distance_km": round(distance_km, 2),
                "time_hours": round(time_hours, 2),
                "estimated_cost": round(estimated_cost, 0),
            }
        )

    row, state = grid_get_state(db)
    state.update(
        {
            "team": payload.team,
            "pilots": [pilot.dict() for pilot in pilots],
            "defense_type": defense_units[0]["name"] if defense_units else payload.defense_type,
            "defense_count": total_defense_count,
            "defense_units": defense_units,
            "start": payload.start.dict(),
            "target": payload.target.dict(),
            "zones": [zone.dict() for zone in payload.zones],
        }
    )
    grid_persist_state(db, row, state)

    return {
        "grid": grid,
        "routes": routes,
        "defense_radius_km": round(defense_radius, 1),
    }


@router.get("/grid/presets", response_model=list[SimulationGridPreset])
def grid_list_presets(db: Session = Depends(get_db)):
    _, state = grid_get_state(db)
    return state.get("presets", [])


@router.post("/grid/presets", response_model=list[SimulationGridPreset])
def grid_save_preset(payload: SimulationGridPresetCreate, db: Session = Depends(get_db)):
    row, state = grid_get_state(db)
    presets = state.get("presets", [])
    snapshot = payload.snapshot.dict() if payload.snapshot else grid_state_snapshot(state)
    filtered = [preset for preset in presets if preset.get("name") != payload.name]
    filtered.append({"name": payload.name, "snapshot": snapshot})
    state["presets"] = filtered
    grid_persist_state(db, row, state)
    return state.get("presets", [])


@router.delete("/grid/presets/{preset_name}", response_model=list[SimulationGridPreset])
def grid_delete_preset(preset_name: str, db: Session = Depends(get_db)):
    row, state = grid_get_state(db)
    presets = state.get("presets", [])
    state["presets"] = [preset for preset in presets if preset.get("name") != preset_name]
    grid_persist_state(db, row, state)
    return state.get("presets", [])

DETECTION_RANGE_KM = 28.0
INTERCEPT_THRESHOLD_KM = 0.35

AIRCRAFT_DATASET = {
    "F-22": {
        "id": "f22a",
        "name": "F-22 Raptor",
        "max_speed": 2410.0,
        "base_weight": 19700.0,
        "max_takeoff_weight": 38000.0,
        "fuel_capacity": 8200.0,
        "fuel_consumption_rate": 2.8,
        "max_range": 2960.0,
        "hardpoints": 8,
        "ordnance_limit": 1900.0,
        "hourly_operating_cost": 85000.0,
    },
    "F-35": {
        "id": "f35a",
        "name": "F-35 Lightning II",
        "max_speed": 1930.0,
        "base_weight": 13150.0,
        "max_takeoff_weight": 31750.0,
        "fuel_capacity": 8300.0,
        "fuel_consumption_rate": 3.0,
        "max_range": 2200.0,
        "hardpoints": 6,
        "ordnance_limit": 1700.0,
        "hourly_operating_cost": 72000.0,
    },
    "SU-30": {
        "id": "su30mki",
        "name": "Su-30MKI",
        "max_speed": 2120.0,
        "base_weight": 18400.0,
        "max_takeoff_weight": 38800.0,
        "fuel_capacity": 9600.0,
        "fuel_consumption_rate": 3.2,
        "max_range": 3000.0,
        "hardpoints": 12,
        "ordnance_limit": 2200.0,
        "hourly_operating_cost": 64000.0,
    },
    "RAFALE": {
        "id": "rafale",
        "name": "Rafale",
        "max_speed": 1910.0,
        "base_weight": 10100.0,
        "max_takeoff_weight": 24500.0,
        "fuel_capacity": 4700.0,
        "fuel_consumption_rate": 2.6,
        "max_range": 3700.0,
        "hardpoints": 14,
        "ordnance_limit": 2000.0,
        "hourly_operating_cost": 59000.0,
    },
    "F/A-18": {
        "id": "fa18",
        "name": "F/A-18 Super Hornet",
        "max_speed": 1915.0,
        "base_weight": 14600.0,
        "max_takeoff_weight": 29900.0,
        "fuel_capacity": 6600.0,
        "fuel_consumption_rate": 2.9,
        "max_range": 2340.0,
        "hardpoints": 11,
        "ordnance_limit": 1800.0,
        "hourly_operating_cost": 54000.0,
    },
    "DEFAULT": {
        "id": "generic_fighter",
        "name": "Generic Fighter",
        "max_speed": 1500.0,
        "base_weight": 14000.0,
        "max_takeoff_weight": 28000.0,
        "fuel_capacity": 6000.0,
        "fuel_consumption_rate": 2.7,
        "max_range": 1800.0,
        "hardpoints": 6,
        "ordnance_limit": 1400.0,
        "hourly_operating_cost": 45000.0,
    },
}

WEAPON_DATASET = {
    "AAM": {"id": "aam", "name": "Air-to-Air Missile", "weight": 90.0, "type": "air_to_air", "drag_factor": 0.04, "unit_cost": 180000.0, "score": 14.0},
    "ASM": {"id": "asm", "name": "Air-to-Surface Missile", "weight": 240.0, "type": "air_to_surface", "drag_factor": 0.08, "unit_cost": 320000.0, "score": 20.0},
    "Precision Bomb": {"id": "precision_bomb", "name": "Precision Bomb", "weight": 520.0, "type": "bomb", "drag_factor": 0.1, "unit_cost": 240000.0, "score": 24.0},
    "Torpedo": {"id": "torpedo", "name": "Light Torpedo", "weight": 380.0, "type": "anti_ship", "drag_factor": 0.09, "unit_cost": 410000.0, "score": 22.0},
    "ECM Pod": {"id": "ecm_pod", "name": "ECM Pod", "weight": 180.0, "type": "countermeasure", "drag_factor": 0.03, "unit_cost": 150000.0, "score": 12.0},
}

TARGET_DATASET = {
    "cargo_ship": {"type": "cargo_ship", "speed": 37.0, "defense_level": 0.35},
    "warship": {"type": "warship", "speed": 56.0, "defense_level": 0.82},
    "submarine": {"type": "submarine", "speed": 30.0, "defense_level": 0.74},
    "enemy_aircraft": {"type": "enemy_aircraft", "speed": 850.0, "defense_level": 0.68},
    "ground": {"type": "ground", "speed": 0.0, "defense_level": 0.6},
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


def _point_in_polygon(point: Coordinate, polygon: list[Coordinate]) -> bool:
    if len(polygon) < 3:
        return False

    inside = False
    x = point.lng
    y = point.lat
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi = polygon[i].lng
        yi = polygon[i].lat
        xj = polygon[j].lng
        yj = polygon[j].lat
        delta_y = yj - yi
        if abs(delta_y) < 1e-12:
            j = i
            continue
        intersects = ((yi > y) != (yj > y)) and (x < ((xj - xi) * (y - yi) / delta_y) + xi)
        if intersects:
            inside = not inside
        j = i
    return inside


def _zone_polygon(zone: AirspaceZone) -> list[Coordinate]:
    vertices = getattr(zone, "zone_vertices", None) or []
    return [Coordinate(lat=item.lat, lng=item.lng) for item in sorted(vertices, key=lambda row: row.vertex_order)]


def _zone_contains_point(zone: AirspaceZone, point: Coordinate) -> bool:
    polygon = _zone_polygon(zone)
    if polygon:
        return _point_in_polygon(point, polygon)
    center = Coordinate(lat=zone.center_lat, lng=zone.center_lng)
    return _haversine_km(point, center) <= zone.radius_km


def _enemy_zone_fraction(path: list[Coordinate], enemy_zones: list[AirspaceZone]) -> float:
    if not path:
        return 0.0
    inside = 0
    for point in path:
        for zone in enemy_zones:
            if _zone_contains_point(zone, point):
                inside += 1
                break
    return inside / len(path)


def _zone_to_schema(zone: AirspaceZone) -> AirspaceZoneRead:
    zone_meta = getattr(zone, "zone_meta", None)
    zone_type = zone_meta.zone_type if zone_meta else "neutral"
    polygon = _zone_polygon(zone)
    if polygon:
        return AirspaceZoneRead(
            id=zone.id,
            countryName=zone.country_name,
            geometryType="polygon",
            center=Coordinate(lat=zone.center_lat, lng=zone.center_lng),
            radiusKm=zone.radius_km,
            polygon=polygon,
            zoneType=zone_type,
        )
    return AirspaceZoneRead(
        id=zone.id,
        countryName=zone.country_name,
        geometryType="circle",
        center=Coordinate(lat=zone.center_lat, lng=zone.center_lng),
        radiusKm=zone.radius_km,
        polygon=[],
        zoneType=zone_type,
    )


def _mission_route(payload: SimulationRunRequest) -> list[Coordinate]:
    if payload.missionType in ("water", "air"):
        if len(payload.routeCoordinates) < 2:
            raise HTTPException(status_code=400, detail="Route requires start and end points")
        return _interpolate_polyline(payload.routeCoordinates, points_per_segment=24)
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
        if _zone_contains_point(zone, position):
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


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _normalize_minmax(value: float, values: list[float]) -> float:
    if not values:
        return 0.0
    min_value = min(values)
    max_value = max(values)
    if math.isclose(max_value, min_value):
        return 0.5
    return _clamp01((value - min_value) / (max_value - min_value))


def _resolve_aircraft_profile(aircraft: Aircraft) -> dict:
    model_name = (aircraft.model or "").upper()
    for key, profile in AIRCRAFT_DATASET.items():
        if key != "DEFAULT" and key in model_name:
            return profile
    return AIRCRAFT_DATASET["DEFAULT"]


def _target_profile(payload: SimulationRunRequest) -> dict:
    if payload.missionType == "water":
        if payload.waterTargetType is None:
            raise HTTPException(status_code=400, detail="Water mission requires target type")
        return TARGET_DATASET[payload.waterTargetType]
    if payload.missionType == "air":
        return TARGET_DATASET["enemy_aircraft"]
    return TARGET_DATASET["ground"]


def _strategy_midpoint(
    start: Coordinate,
    end: Coordinate,
    offset_km: float,
    enemy_zones: list[AirspaceZone],
    avoid_enemy: bool,
) -> Coordinate:
    avg_lat_rad = _to_rad((start.lat + end.lat) / 2.0)
    km_per_deg_lat = 110.574
    km_per_deg_lng = 111.320 * max(math.cos(avg_lat_rad), 0.1)

    start_x = start.lng * km_per_deg_lng
    start_y = start.lat * km_per_deg_lat
    end_x = end.lng * km_per_deg_lng
    end_y = end.lat * km_per_deg_lat

    mid_x = (start_x + end_x) / 2.0
    mid_y = (start_y + end_y) / 2.0

    dx = end_x - start_x
    dy = end_y - start_y
    norm = math.hypot(dx, dy)
    if norm == 0.0:
        return Coordinate(lat=start.lat, lng=start.lng)

    perp_x = -dy / norm
    perp_y = dx / norm

    offsets = [offset_km, -offset_km]
    if not avoid_enemy or not enemy_zones:
        selected_offset = offsets[0]
    else:
        best_offset = offsets[0]
        best_safety = -1.0
        for candidate_offset in offsets:
            candidate_x = mid_x + perp_x * candidate_offset
            candidate_y = mid_y + perp_y * candidate_offset
            candidate = Coordinate(lat=candidate_y / km_per_deg_lat, lng=candidate_x / km_per_deg_lng)
            min_clearance = float("inf")
            for zone in enemy_zones:
                zone_center = Coordinate(lat=zone.center_lat, lng=zone.center_lng)
                clearance = _haversine_km(candidate, zone_center) - zone.radius_km
                min_clearance = min(min_clearance, clearance)
            if min_clearance > best_safety:
                best_safety = min_clearance
                best_offset = candidate_offset
        selected_offset = best_offset

    shifted_x = mid_x + perp_x * selected_offset
    shifted_y = mid_y + perp_y * selected_offset
    return Coordinate(lat=shifted_y / km_per_deg_lat, lng=shifted_x / km_per_deg_lng)


def _to_deg(value: float) -> float:
    return (value * 180.0) / math.pi


def _great_circle_interpolate(start: Coordinate, end: Coordinate, ratio: float) -> Coordinate:
    if ratio <= 0.0:
        return Coordinate(lat=start.lat, lng=start.lng)
    if ratio >= 1.0:
        return Coordinate(lat=end.lat, lng=end.lng)

    lat1 = _to_rad(start.lat)
    lng1 = _to_rad(start.lng)
    lat2 = _to_rad(end.lat)
    lng2 = _to_rad(end.lng)

    x1 = math.cos(lat1) * math.cos(lng1)
    y1 = math.cos(lat1) * math.sin(lng1)
    z1 = math.sin(lat1)

    x2 = math.cos(lat2) * math.cos(lng2)
    y2 = math.cos(lat2) * math.sin(lng2)
    z2 = math.sin(lat2)

    dot = max(-1.0, min(1.0, x1 * x2 + y1 * y2 + z1 * z2))
    omega = math.acos(dot)
    if math.isclose(omega, 0.0):
        return _interpolate(start, end, ratio)

    sin_omega = math.sin(omega)
    weight_start = math.sin((1.0 - ratio) * omega) / sin_omega
    weight_end = math.sin(ratio * omega) / sin_omega

    x = (weight_start * x1) + (weight_end * x2)
    y = (weight_start * y1) + (weight_end * y2)
    z = (weight_start * z1) + (weight_end * z2)

    norm = math.sqrt((x * x) + (y * y) + (z * z))
    x /= norm
    y /= norm
    z /= norm

    lat = math.atan2(z, math.sqrt((x * x) + (y * y)))
    lng = math.atan2(y, x)
    return Coordinate(lat=_to_deg(lat), lng=_to_deg(lng))


def _interpolate_polyline(points: list[Coordinate], points_per_segment: int) -> list[Coordinate]:
    if len(points) < 2:
        return points
    sampled: list[Coordinate] = [points[0]]
    for idx in range(len(points) - 1):
        segment_start = points[idx]
        segment_end = points[idx + 1]
        for step in range(1, points_per_segment + 1):
            sampled.append(_great_circle_interpolate(segment_start, segment_end, step / points_per_segment))
    return sampled


def _build_strategy_path(
    start: Coordinate,
    end: Coordinate,
    offset_km: float,
    enemy_zones: list[AirspaceZone],
    avoid_enemy: bool,
) -> list[Coordinate]:
    midpoint = _strategy_midpoint(start, end, offset_km=offset_km, enemy_zones=enemy_zones, avoid_enemy=avoid_enemy)
    return _interpolate_polyline([start, midpoint, end], points_per_segment=8)


def _strategy_path_to_intercept(
    strategy_name: str,
    base: Coordinate,
    intercept_point: Coordinate,
    offset_km: float,
    enemy_zones: list[AirspaceZone],
    avoid_enemy: bool,
) -> list[Coordinate]:
    if strategy_name == "FUEL_EFFICIENT":
        return _interpolate_polyline([base, intercept_point], points_per_segment=24)
    return _build_strategy_path(
        start=base,
        end=intercept_point,
        offset_km=offset_km,
        enemy_zones=enemy_zones,
        avoid_enemy=avoid_enemy,
    )


def _solve_moving_target_intercept(
    strategy_name: str,
    base: Coordinate,
    enemy_route: list[Coordinate],
    target_speed: float,
    aircraft_speed: float,
    effective_fuel_rate: float,
    offset_km: float,
    enemy_zones: list[AirspaceZone],
    avoid_enemy: bool,
    payload_cost: float,
    hourly_operating_cost: float,
) -> dict:
    if len(enemy_route) < 2 or target_speed <= 0.0:
        intercept_point = enemy_route[-1]
        path = _strategy_path_to_intercept(
            strategy_name=strategy_name,
            base=base,
            intercept_point=intercept_point,
            offset_km=offset_km,
            enemy_zones=enemy_zones,
            avoid_enemy=avoid_enemy,
        )
        distance_km = _polyline_distance_km(path)
        aircraft_arrival_hours = distance_km / max(aircraft_speed, 1.0)
        mission_cost = payload_cost + (aircraft_arrival_hours * hourly_operating_cost) + (distance_km * effective_fuel_rate * 120.0)
        return {
            "path": path,
            "intercept_point": intercept_point,
            "distance_km": distance_km,
            "aircraft_arrival_hours": aircraft_arrival_hours,
            "target_arrival_hours": aircraft_arrival_hours,
            "intercept_time_hours": aircraft_arrival_hours,
            "intercept_target_distance_km": 0.0,
            "fuel_used": distance_km * effective_fuel_rate,
            "mission_cost": mission_cost,
        }

    target_distance_map = _build_distance_map(enemy_route)
    stride = max(1, len(target_distance_map) // 180)
    sampled_targets = [target_distance_map[index] for index in range(0, len(target_distance_map), stride)]
    if sampled_targets[-1] != target_distance_map[-1]:
        sampled_targets.append(target_distance_map[-1])

    best_feasible: dict | None = None
    best_fallback: dict | None = None

    for target_point, target_distance_km in sampled_targets:
        target_arrival_hours = target_distance_km / max(target_speed, 1e-6)
        path = _strategy_path_to_intercept(
            strategy_name=strategy_name,
            base=base,
            intercept_point=target_point,
            offset_km=offset_km,
            enemy_zones=enemy_zones,
            avoid_enemy=avoid_enemy,
        )
        distance_km = _polyline_distance_km(path)
        aircraft_arrival_hours = distance_km / max(aircraft_speed, 1.0)
        wait_hours = max(0.0, target_arrival_hours - aircraft_arrival_hours)
        loiter_fuel = wait_hours * effective_fuel_rate * 0.18
        fuel_used = (distance_km * effective_fuel_rate) + loiter_fuel
        intercept_time_hours = max(aircraft_arrival_hours, target_arrival_hours)
        mission_cost = payload_cost + (intercept_time_hours * hourly_operating_cost) + (fuel_used * 120.0)
        zone_exposure = _enemy_zone_fraction(path, enemy_zones)

        if strategy_name == "LOW_RISK":
            objective = (zone_exposure * 1000.0) + (intercept_time_hours * 8.0) + (distance_km * 0.02)
        elif strategy_name == "FUEL_EFFICIENT":
            objective = distance_km + (wait_hours * 0.01)
        else:
            objective = mission_cost + (zone_exposure * 500.0)

        candidate = {
            "path": path,
            "intercept_point": target_point,
            "distance_km": distance_km,
            "aircraft_arrival_hours": aircraft_arrival_hours,
            "target_arrival_hours": target_arrival_hours,
            "intercept_time_hours": intercept_time_hours,
            "intercept_target_distance_km": target_distance_km,
            "fuel_used": fuel_used,
            "mission_cost": mission_cost,
            "objective": objective,
            "time_gap_hours": aircraft_arrival_hours - target_arrival_hours,
        }

        # Feasible means aircraft can reach the point before (or almost exactly when) the target does.
        if aircraft_arrival_hours <= target_arrival_hours + (1.0 / 720.0):
            if best_feasible is None or candidate["objective"] < best_feasible["objective"]:
                best_feasible = candidate

        fallback_loss = abs(candidate["time_gap_hours"]) * 1000.0 + candidate["objective"]
        if best_fallback is None:
            best_fallback = {**candidate, "fallback_loss": fallback_loss}
        elif fallback_loss < best_fallback["fallback_loss"]:
            best_fallback = {**candidate, "fallback_loss": fallback_loss}

    chosen = best_feasible if best_feasible is not None else best_fallback
    if chosen is None:
        raise HTTPException(status_code=500, detail="Failed to compute intercept solution")
    return chosen


def _return_probability(fuel_margin_km: float, effective_range_km: float, risk: float, time_hours: float) -> float:
    safe_range = max(effective_range_km, 1.0)
    fuel_margin_factor = _clamp01((fuel_margin_km + safe_range) / (2.0 * safe_range))
    efficiency = _clamp01(1.0 / (1.0 + max(time_hours, 0.0)))
    return _clamp01((fuel_margin_factor * 0.5) + ((1.0 - _clamp01(risk)) * 0.3) + (efficiency * 0.2))


def _build_deterministic_timeline(
    path: list[Coordinate],
    enemy_route: list[Coordinate],
    aircraft_speed: float,
    target_speed: float,
    effective_range: float,
    enemy_zones: list[AirspaceZone],
    intercept_time_hours: float | None = None,
    intercept_target_distance_km: float | None = None,
) -> dict:
    aircraft_map = _build_distance_map(path)
    path_distance = aircraft_map[-1][1] if aircraft_map else 0.0

    if not enemy_route:
        enemy_points = [path[-1], path[-1]]
    else:
        enemy_points = enemy_route if len(enemy_route) >= 2 else [enemy_route[-1], enemy_route[-1]]
    enemy_map = _build_distance_map(enemy_points)
    enemy_distance = enemy_map[-1][1] if enemy_map else 0.0

    travel_hours = path_distance / max(aircraft_speed, 1.0)
    if intercept_time_hours is not None:
        total_time_hours = max(intercept_time_hours, travel_hours)
    else:
        total_time_hours = travel_hours

    total_time_seconds = max(120.0, total_time_hours * 3600.0)
    steps = max(16, min(120, int(total_time_seconds / 6.0)))
    step_seconds = total_time_seconds / steps

    timeline: list[SimulationTimelineStep] = []
    event_log: list[SimulationEvent] = [
        SimulationEvent(timeSeconds=0.0, description="T+0.0s: Aircraft departed base"),
    ]

    intercept_time: float | None = None
    time_in_enemy_airspace = 0.0
    entered_enemy_zone_logged = False
    target_detected_logged = False

    for step in range(steps + 1):
        time_seconds = total_time_seconds if step == steps else step * step_seconds
        aircraft_distance = min(path_distance, (aircraft_speed * time_seconds) / 3600.0)
        aircraft_position = _position_along_path(aircraft_map, aircraft_distance)

        if target_speed > 0 and enemy_distance > 0:
            enemy_progress = min(enemy_distance, (target_speed * time_seconds) / 3600.0)
            if intercept_target_distance_km is not None and intercept_time_hours is not None and step == steps:
                enemy_progress = min(enemy_distance, intercept_target_distance_km)
            enemy_position = _position_along_path(enemy_map, enemy_progress)
        else:
            enemy_position = enemy_points[-1]

        distance_to_target = _haversine_km(aircraft_position, enemy_position)
        inside_enemy_zone = _inside_enemy_zone(aircraft_position, enemy_zones)
        if inside_enemy_zone:
            time_in_enemy_airspace += step_seconds
        if inside_enemy_zone and not entered_enemy_zone_logged:
            entered_enemy_zone_logged = True
            event_log.append(
                SimulationEvent(timeSeconds=round(time_seconds, 2), description=f"T+{time_seconds:.1f}s: Aircraft entered enemy airspace")
            )

        if distance_to_target <= DETECTION_RANGE_KM and not target_detected_logged:
            target_detected_logged = True
            event_log.append(
                SimulationEvent(timeSeconds=round(time_seconds, 2), description=f"T+{time_seconds:.1f}s: Target detected")
            )

        if intercept_time_hours is not None and step == steps:
            intercept_time = total_time_seconds
            if not target_detected_logged:
                target_detected_logged = True
                event_log.append(
                    SimulationEvent(timeSeconds=round(time_seconds, 2), description=f"T+{time_seconds:.1f}s: Target detected")
                )
            event_log.append(
                SimulationEvent(timeSeconds=round(time_seconds, 2), description=f"T+{time_seconds:.1f}s: Intercept achieved")
            )
        elif intercept_time is None and (distance_to_target <= INTERCEPT_THRESHOLD_KM or step == steps):
            intercept_time = time_seconds
            event_log.append(
                SimulationEvent(timeSeconds=round(time_seconds, 2), description=f"T+{time_seconds:.1f}s: Intercept achieved")
            )

        fuel_remaining = max(0.0, 100.0 - (aircraft_distance / max(effective_range, 1.0)) * 100.0)
        status = "intercepted" if intercept_time is not None else "locked" if distance_to_target <= DETECTION_RANGE_KM else "searching"
        flags: list[str] = []
        if status in {"locked", "intercepted"}:
            flags.append("locked")
        if inside_enemy_zone:
            flags.append("in_enemy_zone")
        if status == "intercepted":
            flags.append("intercepted")

        timeline.append(
            SimulationTimelineStep(
                timeSeconds=round(time_seconds, 2),
                aircraftPosition=aircraft_position,
                enemyPosition=enemy_position,
                fuelRemaining=round(fuel_remaining, 2),
                distanceToTarget=round(distance_to_target, 3),
                aircraftSpeedKmh=round(aircraft_speed, 2),
                targetSpeedKmh=round(target_speed, 2),
                status=status,
                statusFlags=flags,
            )
        )

        if intercept_time is not None:
            break

    if intercept_time is None:
        event_log.append(
            SimulationEvent(timeSeconds=round(total_time_seconds, 2), description=f"T+{total_time_seconds:.1f}s: Mission timed out")
        )

    final_status = "intercepted" if intercept_time is not None else "failed"
    final_time = intercept_time if intercept_time is not None else total_time_seconds
    final_fuel = timeline[-1].fuelRemaining if timeline else 100.0

    return {
        "timeline": timeline,
        "event_log": event_log,
        "intercept_time": round(intercept_time, 2) if intercept_time is not None else None,
        "time_elapsed": round(final_time, 2),
        "fuel_remaining": round(final_fuel, 2),
        "time_in_enemy_airspace": round(time_in_enemy_airspace, 2),
        "status": final_status,
    }


@router.get("/airspace-zones", response_model=list[AirspaceZoneRead])
def list_airspace_zones(db: Session = Depends(get_db)):
    zones = db.query(AirspaceZone).order_by(AirspaceZone.id.asc()).all()
    metas = db.query(AirspaceZoneMeta).all()
    vertices = db.query(AirspaceZoneVertex).order_by(AirspaceZoneVertex.zone_id.asc(), AirspaceZoneVertex.vertex_order.asc()).all()
    meta_by_zone_id = {item.zone_id: item for item in metas}
    vertices_by_zone_id: dict[int, list[AirspaceZoneVertex]] = {}
    for vertex in vertices:
        vertices_by_zone_id.setdefault(vertex.zone_id, []).append(vertex)
    for zone in zones:
        setattr(zone, "zone_meta", meta_by_zone_id.get(zone.id))
        setattr(zone, "zone_vertices", vertices_by_zone_id.get(zone.id, []))
    return [_zone_to_schema(zone) for zone in zones]


@router.post("/airspace-zones", response_model=AirspaceZoneRead, status_code=status.HTTP_201_CREATED)
def create_airspace_zone(payload: AirspaceZoneCreate, db: Session = Depends(get_db)):
    polygon = payload.polygon or []
    has_polygon = len(polygon) >= 3

    if not has_polygon and (payload.center is None or payload.radiusKm is None):
        raise HTTPException(status_code=400, detail="Provide either polygon points or center and radius")

    if has_polygon:
        centroid_lat = sum(point.lat for point in polygon) / len(polygon)
        centroid_lng = sum(point.lng for point in polygon) / len(polygon)
        centroid = Coordinate(lat=centroid_lat, lng=centroid_lng)
        radius_km = max(_haversine_km(centroid, point) for point in polygon)
        zone_center = centroid
    else:
        zone_center = payload.center
        radius_km = payload.radiusKm

    zone = AirspaceZone(
        country_name=payload.countryName.strip(),
        center_lat=zone_center.lat,
        center_lng=zone_center.lng,
        radius_km=radius_km,
    )
    db.add(zone)
    db.flush()

    if has_polygon:
        for index, point in enumerate(polygon):
            db.add(
                AirspaceZoneVertex(
                    zone_id=zone.id,
                    vertex_order=index,
                    lat=point.lat,
                    lng=point.lng,
                )
            )

    db.add(AirspaceZoneMeta(zone_id=zone.id, zone_type=payload.zoneType))
    db.commit()
    db.refresh(zone)
    setattr(zone, "zone_meta", AirspaceZoneMeta(zone_id=zone.id, zone_type=payload.zoneType))
    if has_polygon:
        zone_vertices = db.query(AirspaceZoneVertex).filter(AirspaceZoneVertex.zone_id == zone.id).order_by(AirspaceZoneVertex.vertex_order.asc()).all()
    else:
        zone_vertices = []
    setattr(zone, "zone_vertices", zone_vertices)
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
    target_profile = _target_profile(payload)
    target_speed = target_profile["speed"]

    metas = db.query(AirspaceZoneMeta).all()
    zone_rows = db.query(AirspaceZone).all()
    zone_vertices = db.query(AirspaceZoneVertex).order_by(AirspaceZoneVertex.zone_id.asc(), AirspaceZoneVertex.vertex_order.asc()).all()
    meta_by_zone = {row.zone_id: row.zone_type for row in metas}
    vertices_by_zone: dict[int, list[AirspaceZoneVertex]] = {}
    for vertex in zone_vertices:
        vertices_by_zone.setdefault(vertex.zone_id, []).append(vertex)

    enemy_zones: list[AirspaceZone] = []
    for zone in zone_rows:
        setattr(zone, "zone_vertices", vertices_by_zone.get(zone.id, []))
        if meta_by_zone.get(zone.id, "neutral") == "enemy":
            enemy_zones.append(zone)

    enemy_unit_pressure = _clamp01(sum(unit.quantity for unit in payload.enemyAircraftUnits) / 20.0)
    ground_pressure = _clamp01((payload.groundDefenseCount + payload.groundAirDefenseLevel) / 20.0)
    enemy_strength = _clamp01((target_profile["defense_level"] * 0.5) + (enemy_unit_pressure * 0.3) + (ground_pressure * 0.2))

    pilot_skill_values = []
    for pilot in pilots:
        metrics = pilot.performance_metrics
        if metrics:
            pilot_skill_values.append((metrics.reaction_time_score + metrics.decision_efficiency_score + metrics.maneuver_accuracy) / 3.0)
        else:
            pilot_skill_values.append(60.0)
    pilot_skill = sum(pilot_skill_values) / len(pilot_skill_values)

    aircraft_performance: dict[str, dict] = {}
    for aircraft_id in aircraft_ids:
        aircraft = aircraft_by_id[aircraft_id]
        profile = _resolve_aircraft_profile(aircraft)

        payload_weight = 0.0
        drag_sum = 0.0
        payload_cost = 0.0
        weapon_score_raw = 0.0
        for item in payload.weaponLoadout:
            if item.aircraftId != aircraft_id:
                continue
            weapon_profile = WEAPON_DATASET.get(item.weaponType)
            if not weapon_profile:
                continue
            payload_weight += weapon_profile["weight"] * item.quantity
            drag_sum += weapon_profile["drag_factor"] * item.quantity
            payload_cost += weapon_profile["unit_cost"] * item.quantity
            weapon_score_raw += weapon_profile["score"] * item.quantity

        ordnance_limit = profile["ordnance_limit"]
        if payload_weight > ordnance_limit:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Aircraft {aircraft_id} payload exceeds ordnance limit "
                    f"({payload_weight:.0f}kg > {ordnance_limit:.0f}kg)."
                ),
            )

        payload_capacity = max(profile["max_takeoff_weight"] - profile["base_weight"], 1.0)
        payload_capacity_ratio = _clamp01(payload_weight / payload_capacity)
        ordnance_ratio = _clamp01(payload_weight / max(ordnance_limit, 1.0))
        weight_ratio = _clamp01((payload_capacity_ratio * 0.6) + (ordnance_ratio * 0.4))
        drag_factor = _clamp01(drag_sum / max(profile["hardpoints"], 1.0))
        effective_speed = profile["max_speed"] * (1.0 - weight_ratio)
        base_fuel_rate = profile["fuel_consumption_rate"] * (1.0 + drag_factor)
        effective_fuel_rate = base_fuel_rate * (1.0 + weight_ratio)
        effective_range = profile["max_range"] * (1.0 - weight_ratio)

        aircraft_score = _normalize((profile["max_speed"] / 25.0) + (profile["max_range"] / 45.0) - (weight_ratio * 35.0), 0.0, 100.0)
        weapon_score = _normalize(weapon_score_raw, 0.0, 100.0)
        total_score = _normalize((aircraft_score * 0.62) + (weapon_score * 0.38) - (enemy_strength * 8.0), 0.0, 100.0)
        survival_probability = _clamp01((total_score / 100.0) * 0.74 + (1.0 - enemy_strength) * 0.26)

        aircraft_performance[aircraft_id] = {
            "aircraft_id": aircraft_id,
            "profile": profile,
            "payload_weight": payload_weight,
            "payload_cost": payload_cost,
            "total_weight": profile["base_weight"] + payload_weight,
            "weight_ratio": weight_ratio,
            "ordnance_limit": ordnance_limit,
            "effective_speed": max(effective_speed, 250.0),
            "effective_fuel_rate": max(effective_fuel_rate, 0.1),
            "effective_range": max(effective_range, 350.0),
            "aircraft_score": aircraft_score,
            "weapon_score": weapon_score,
            "total_score": total_score,
            "survival_probability": survival_probability,
            "hourly_operating_cost": profile["hourly_operating_cost"],
        }

    strategy_configs = [
        {"name": "LOW_RISK", "offset_km": 64.0, "speed_factor": 0.74, "fuel_factor": 1.04, "risk_bias": -0.28, "avoid_enemy": True},
        {"name": "FUEL_EFFICIENT", "offset_km": 0.0, "speed_factor": 0.8, "fuel_factor": 0.84, "risk_bias": -0.04, "avoid_enemy": False},
        {"name": "COST_EFFICIENT", "offset_km": 12.0, "speed_factor": 0.88, "fuel_factor": 0.9, "risk_bias": 0.05, "avoid_enemy": False},
    ]

    raw_strategy_rows: list[dict] = []
    for strategy in strategy_configs:
        name = strategy["name"]
        if name == "LOW_RISK":
            selected = max(aircraft_performance.values(), key=lambda row: row["survival_probability"])
        elif name == "FUEL_EFFICIENT":
            selected = min(aircraft_performance.values(), key=lambda row: row["effective_fuel_rate"])
        else:
            selected = min(
                aircraft_performance.values(),
                key=lambda row: row["payload_cost"] + (row["hourly_operating_cost"] * 0.85),
            )

        effective_speed = max(220.0, selected["effective_speed"] * strategy["speed_factor"])
        effective_fuel_rate = max(0.1, selected["effective_fuel_rate"] * strategy["fuel_factor"])
        effective_range = selected["effective_range"]

        intercept_solution = _solve_moving_target_intercept(
            strategy_name=name,
            base=base,
            enemy_route=mission_route,
            target_speed=target_speed,
            aircraft_speed=effective_speed,
            effective_fuel_rate=effective_fuel_rate,
            offset_km=strategy["offset_km"],
            enemy_zones=enemy_zones,
            avoid_enemy=strategy["avoid_enemy"],
            payload_cost=selected["payload_cost"],
            hourly_operating_cost=selected["hourly_operating_cost"],
        )

        path = intercept_solution["path"]
        intercept_point = intercept_solution["intercept_point"]
        distance_km = intercept_solution["distance_km"]
        time_hours = intercept_solution["intercept_time_hours"]
        fuel_used = intercept_solution["fuel_used"]
        mission_cost = intercept_solution["mission_cost"]
        fuel_margin_km = effective_range - (fuel_used / max(effective_fuel_rate, 1e-6))

        zone_exposure = _enemy_zone_fraction(path, enemy_zones)
        risk = _clamp01((zone_exposure * 0.6) + (enemy_strength * 0.4) + strategy["risk_bias"])
        survival_probability = _clamp01(
            (selected["survival_probability"] * 0.5) + ((1.0 - risk) * 0.3) + (_clamp01(fuel_margin_km / max(effective_range, 1.0)) * 0.2)
        )

        interception_fuel = fuel_used * 1.15
        interception_time = time_hours * 1.10
        interception_risk = _clamp01(risk * 1.2)
        interception_margin = fuel_margin_km - (interception_fuel - fuel_used) / max(effective_fuel_rate, 1e-6)

        reinforcement_risk = _clamp01(risk + 0.12 + (enemy_unit_pressure * 0.2))
        reinforcement_time = time_hours * 1.08

        bad_weather_speed = max(180.0, effective_speed * 0.8)
        bad_weather_time = distance_km / bad_weather_speed
        bad_weather_fuel = fuel_used * 1.10
        bad_weather_margin = fuel_margin_km - (bad_weather_fuel - fuel_used) / max(effective_fuel_rate, 1e-6)

        low_fuel_margin = fuel_margin_km * 0.75

        raw_strategy_rows.append(
            {
                "name": name,
                "path": path,
                "distance_km": distance_km,
                "time_hours": time_hours,
                "fuel_used": fuel_used,
                "mission_cost": mission_cost,
                "risk": risk,
                "fuel_margin_km": fuel_margin_km,
                "effective_speed": effective_speed,
                "effective_fuel_rate": effective_fuel_rate,
                "effective_range": effective_range,
                "selected_aircraft_id": selected["aircraft_id"],
                "intercept_point": intercept_point,
                "intercept_target_distance_km": intercept_solution["intercept_target_distance_km"],
                "aircraft_score": selected["aircraft_score"],
                "weapon_score": selected["weapon_score"],
                "total_score": selected["total_score"],
                "survival_probability": survival_probability,
                "what_if": {
                    "interception": _return_probability(interception_margin, effective_range, interception_risk, interception_time),
                    "reinforcements": _return_probability(fuel_margin_km, effective_range, reinforcement_risk, reinforcement_time),
                    "bad_weather": _return_probability(bad_weather_margin, effective_range, risk, bad_weather_time),
                    "low_fuel": _return_probability(low_fuel_margin, effective_range, risk, time_hours),
                },
                "base_return_probability": _return_probability(fuel_margin_km, effective_range, risk, time_hours),
            }
        )

    distance_values = [row["distance_km"] for row in raw_strategy_rows]
    time_values = [row["time_hours"] for row in raw_strategy_rows]
    fuel_values = [row["fuel_used"] for row in raw_strategy_rows]
    cost_values = [row["mission_cost"] for row in raw_strategy_rows]
    risk_values = [row["risk"] for row in raw_strategy_rows]
    fuel_margin_values = [row["fuel_margin_km"] for row in raw_strategy_rows]

    strategy_results: list[SimulationStrategy] = []
    for row in raw_strategy_rows:
        strategy_results.append(
            SimulationStrategy(
                name=row["name"],
                path=row["path"],
                metrics=SimulationStrategyMetrics(
                    distance=round(_normalize_minmax(row["distance_km"], distance_values), 4),
                    time=round(_normalize_minmax(row["time_hours"], time_values), 4),
                    fuel=round(_normalize_minmax(row["fuel_used"], fuel_values), 4),
                    cost=round(_normalize_minmax(row["mission_cost"], cost_values), 4),
                    risk=round(_normalize_minmax(row["risk"], risk_values), 4),
                    fuel_margin=round(_normalize_minmax(row["fuel_margin_km"], fuel_margin_values), 4),
                ),
                what_if=SimulationWhatIf(
                    interception=SimulationWhatIfResult(return_probability=round(row["what_if"]["interception"], 4)),
                    reinforcements=SimulationWhatIfResult(return_probability=round(row["what_if"]["reinforcements"], 4)),
                    bad_weather=SimulationWhatIfResult(return_probability=round(row["what_if"]["bad_weather"], 4)),
                    low_fuel=SimulationWhatIfResult(return_probability=round(row["what_if"]["low_fuel"], 4)),
                ),
                raw_metrics=SimulationStrategyRawMetrics(
                    distance_km=round(row["distance_km"], 3),
                    time_hours=round(row["time_hours"], 3),
                    fuel_used=round(row["fuel_used"], 3),
                    mission_cost=round(row["mission_cost"], 2),
                    fuel_margin_km=round(row["fuel_margin_km"], 3),
                    effective_speed_kmh=round(row["effective_speed"], 2),
                    effective_fuel_rate=round(row["effective_fuel_rate"], 3),
                    effective_range_km=round(row["effective_range"], 2),
                    selected_aircraft_id=row["selected_aircraft_id"],
                    aircraft_score=round(row["aircraft_score"], 2),
                    weapon_score=round(row["weapon_score"], 2),
                    total_score=round(row["total_score"], 2),
                    survival_probability=round(row["survival_probability"], 4),
                ),
            )
        )

    primary_row = next((row for row in raw_strategy_rows if row["name"] == "LOW_RISK"), raw_strategy_rows[0])
    primary_strategy = next((item for item in strategy_results if item.name == "LOW_RISK"), strategy_results[0])
    intercept_point = primary_row["intercept_point"]

    full_flight_path = [*primary_strategy.path, base]
    full_flight_distance = _polyline_distance_km(full_flight_path)
    straight_distance = _haversine_km(base, intercept_point)

    timeline_payload = _build_deterministic_timeline(
        path=primary_strategy.path,
        enemy_route=mission_route,
        aircraft_speed=primary_row["effective_speed"],
        target_speed=target_speed,
        effective_range=primary_row["effective_range"],
        enemy_zones=enemy_zones,
        intercept_time_hours=primary_row["time_hours"],
        intercept_target_distance_km=primary_row["intercept_target_distance_km"],
    )

    timeline = timeline_payload["timeline"]
    event_log = timeline_payload["event_log"]
    time_in_enemy_airspace = timeline_payload["time_in_enemy_airspace"]
    time_elapsed_seconds = timeline_payload["time_elapsed"]
    fuel_remaining = timeline_payload["fuel_remaining"]
    intercept_seconds = timeline_payload["intercept_time"]
    mission_result_status = "Success" if timeline_payload["status"] == "intercepted" else "Failed"

    fuel_consumed = max(0.0, 100.0 - fuel_remaining)
    elapsed_hours = max(time_elapsed_seconds / 3600.0, 1e-3)
    fuel_consumption_rate = fuel_consumed / elapsed_hours
    remaining_range = primary_row["effective_range"] * (fuel_remaining / 100.0)
    exposure_percentage = min(100.0, (time_in_enemy_airspace / max(time_elapsed_seconds, 1.0)) * 100.0) if time_elapsed_seconds > 0 else 0.0

    weapon_units = sum(item.quantity for item in payload.weaponLoadout)
    weapon_types = len({item.weaponType for item in payload.weaponLoadout})
    weapon_effect = min(100.0, weapon_units * 8.0 + weapon_types * 6.0)

    selected_pilot_context = [
        SimulationPilotContext(id=pilot.id, name=pilot.name, callSign=pilot.call_sign, aircraftId=pilot.assigned_aircraft)
        for pilot in sorted(pilots, key=lambda item: item.id)
    ]

    fuel_feasibility_ratio = _clamp01(
        (primary_row["fuel_margin_km"] + primary_row["effective_range"]) / (2.0 * max(primary_row["effective_range"], 1.0))
    )
    fuel_feasibility = fuel_feasibility_ratio * 100.0
    risk_level = primary_row["risk"] * 100.0
    threat_level = enemy_strength * 100.0
    mission_efficiency = (1.0 - primary_strategy.metrics.time) * 100.0
    success_probability = (sum(row["survival_probability"] for row in raw_strategy_rows) / len(raw_strategy_rows)) * 100.0

    aircraft_loadout = [
        SimulationAircraftLoadout(
            aircraftId=row["aircraft_id"],
            aircraftName=row["profile"]["name"],
            baseWeightKg=round(row["profile"]["base_weight"], 2),
            payloadWeightKg=round(row["payload_weight"], 2),
            totalWeightKg=round(row["total_weight"], 2),
            maxTakeoffWeightKg=round(row["profile"]["max_takeoff_weight"], 2),
            ordnanceLimitKg=round(row["ordnance_limit"], 2),
            weightUtilizationPercent=round(row["weight_ratio"] * 100.0, 2),
            effectiveSpeedKmh=round(row["effective_speed"], 2),
            effectiveFuelRate=round(row["effective_fuel_rate"], 3),
            effectiveRangeKm=round(row["effective_range"], 2),
            aircraftScore=round(row["aircraft_score"], 2),
            weaponScore=round(row["weapon_score"], 2),
            totalScore=round(row["total_score"], 2),
            survivalProbability=round(row["survival_probability"], 4),
        )
        for row in sorted(aircraft_performance.values(), key=lambda item: item["aircraft_id"])
    ]

    target_profile_payload = SimulationTargetProfile(
        targetType=target_profile["type"],
        speedKmh=round(target_profile["speed"], 2),
        defenseLevel=round(target_profile["defense_level"], 4),
    )

    metrics = SimulationMetrics(
        trajectory=SimulationTrajectoryMetrics(
            totalDistanceKm=round(full_flight_distance, 2),
            pathDeviationKm=round(max(0.0, primary_row["distance_km"] - straight_distance), 2),
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
            enemyStrengthImpact=round(threat_level, 2),
        ),
        performance=SimulationPerformanceMetrics(
            pilotEfficiency=round(pilot_skill, 2),
            weaponReadiness=round(weapon_effect, 2),
        ),
    )

    final_result = SimulationFinalResult(
        status=mission_result_status,
        interceptTimeSeconds=intercept_seconds,
        successRatePercent=round(success_probability, 2),
        timeElapsedSeconds=round(time_elapsed_seconds, 2),
        fuelRemaining=round(fuel_remaining, 2),
    )

    explanation = (
        "Generated PLAN 1 (LOW_RISK), PLAN 2 (FUEL_EFFICIENT), and PLAN 3 (COST_EFFICIENT) with a moving-target intercept solver: "
        "for each plan, candidate points across the target route are evaluated and the intercept is chosen by strategy objective "
        "(minimum risk, minimum base-to-intercept distance, or minimum mission cost)."
    )

    return SimulationRunResponse(
        baseLocation=base,
        interceptLocation=intercept_point,
        timeToInterceptMinutes=round(primary_row["time_hours"] * 60.0, 2),
        bestAircraftId=primary_row["selected_aircraft_id"],
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
        strategies=strategy_results,
        targetProfile=target_profile_payload,
        aircraftLoadout=aircraft_loadout,
    )
