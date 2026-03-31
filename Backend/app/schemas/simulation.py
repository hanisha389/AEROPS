from typing import Literal
from pydantic import BaseModel, Field


class Coordinate(BaseModel):
    lat: float
    lng: float


class AirspaceZoneCreate(BaseModel):
    countryName: str = Field(..., min_length=2)
    center: Coordinate | None = None
    radiusKm: float | None = Field(default=None, gt=0)
    polygon: list[Coordinate] = Field(default_factory=list)
    zoneType: Literal["friendly", "neutral", "enemy"] = "neutral"


class AirspaceZoneRead(BaseModel):
    id: int
    countryName: str
    geometryType: Literal["circle", "polygon"]
    center: Coordinate | None = None
    radiusKm: float | None = None
    polygon: list[Coordinate] = Field(default_factory=list)
    zoneType: Literal["friendly", "neutral", "enemy"]


class SimulationBasePayload(BaseModel):
    location: Coordinate


class EnemyAircraftUnit(BaseModel):
    aircraftType: str
    quantity: int = Field(..., ge=0)


class WeaponLoadoutItem(BaseModel):
    aircraftId: str
    weaponType: str
    quantity: int = Field(..., ge=0)


class SimulationRunRequest(BaseModel):
    missionType: Literal["water", "air", "ground"]
    waterTargetType: Literal["cargo_ship", "warship", "submarine"] | None = None
    routeCoordinates: list[Coordinate] = Field(default_factory=list)
    groundTargetLocation: Coordinate | None = None
    groundAirDefenseLevel: int = Field(default=1, ge=1, le=10)
    groundDefenseCount: int = Field(default=0, ge=0)
    enemyAircraftUnits: list[EnemyAircraftUnit] = Field(default_factory=list)
    aircraftRouteWaypoints: list[Coordinate] = Field(default_factory=list)
    selectedPilotIds: list[int] = Field(default_factory=list)
    weaponLoadout: list[WeaponLoadoutItem] = Field(default_factory=list)


class SimulationTimelineStep(BaseModel):
    timeSeconds: float
    aircraftPosition: Coordinate
    enemyPosition: Coordinate
    fuelRemaining: float
    distanceToTarget: float
    aircraftSpeedKmh: float
    targetSpeedKmh: float
    status: Literal["searching", "locked", "intercepted", "failed"]
    statusFlags: list[str] = Field(default_factory=list)


class SimulationEvent(BaseModel):
    timeSeconds: float
    description: str


class SimulationStrategyMetrics(BaseModel):
    distance: float
    time: float
    fuel: float
    cost: float
    risk: float
    fuel_margin: float


class SimulationStrategyRawMetrics(BaseModel):
    distance_km: float
    time_hours: float
    fuel_used: float
    mission_cost: float
    fuel_margin_km: float
    effective_speed_kmh: float
    effective_fuel_rate: float
    effective_range_km: float
    selected_aircraft_id: str
    aircraft_score: float
    weapon_score: float
    total_score: float
    survival_probability: float


class SimulationWhatIfResult(BaseModel):
    return_probability: float


class SimulationWhatIf(BaseModel):
    interception: SimulationWhatIfResult
    reinforcements: SimulationWhatIfResult
    bad_weather: SimulationWhatIfResult
    low_fuel: SimulationWhatIfResult


class SimulationStrategy(BaseModel):
    name: Literal["LOW_RISK", "FUEL_EFFICIENT", "COST_EFFICIENT"]
    path: list[Coordinate] = Field(default_factory=list)
    metrics: SimulationStrategyMetrics
    what_if: SimulationWhatIf
    raw_metrics: SimulationStrategyRawMetrics


class SimulationAircraftLoadout(BaseModel):
    aircraftId: str
    aircraftName: str
    baseWeightKg: float
    payloadWeightKg: float
    totalWeightKg: float
    maxTakeoffWeightKg: float
    ordnanceLimitKg: float
    weightUtilizationPercent: float
    effectiveSpeedKmh: float
    effectiveFuelRate: float
    effectiveRangeKm: float
    aircraftScore: float
    weaponScore: float
    totalScore: float
    survivalProbability: float


class SimulationTargetProfile(BaseModel):
    targetType: str
    speedKmh: float
    defenseLevel: float


class SimulationTrajectoryMetrics(BaseModel):
    totalDistanceKm: float
    pathDeviationKm: float
    interceptPoint: Coordinate
    interceptTimeSeconds: float | None


class SimulationFuelMetrics(BaseModel):
    fuelConsumptionRatePerHour: float
    remainingRangeKm: float
    returnFeasibility: float


class SimulationThreatMetrics(BaseModel):
    timeInEnemyAirspaceSeconds: float
    exposurePercentage: float
    enemyStrengthImpact: float


class SimulationPerformanceMetrics(BaseModel):
    pilotEfficiency: float
    weaponReadiness: float


class SimulationMetrics(BaseModel):
    trajectory: SimulationTrajectoryMetrics
    fuel: SimulationFuelMetrics
    threat: SimulationThreatMetrics
    performance: SimulationPerformanceMetrics


class SimulationFinalResult(BaseModel):
    status: Literal["Active", "Success", "Failed"]
    interceptTimeSeconds: float | None
    successRatePercent: float
    timeElapsedSeconds: float
    fuelRemaining: float


class SimulationPilotContext(BaseModel):
    id: int
    name: str
    callSign: str
    aircraftId: str | None = None


class SimulationRunResponse(BaseModel):
    baseLocation: Coordinate
    interceptLocation: Coordinate
    timeToInterceptMinutes: float
    bestAircraftId: str
    bestAircraftPath: list[Coordinate]
    enemyRoute: list[Coordinate]
    explanation: str
    successProbability: float
    riskLevel: float
    fuelFeasibility: float
    threatLevel: float
    missionEfficiencyScore: float
    selectedPilots: list[SimulationPilotContext]
    aircraftUsed: list[str]
    weaponLoadout: list[WeaponLoadoutItem]
    timeline: list[SimulationTimelineStep]
    finalResult: SimulationFinalResult
    metrics: SimulationMetrics
    eventLog: list[SimulationEvent]
    strategies: list[SimulationStrategy] = Field(default_factory=list)
    targetProfile: SimulationTargetProfile
    aircraftLoadout: list[SimulationAircraftLoadout] = Field(default_factory=list)


class SimulationGridBounds(BaseModel):
    north: float
    south: float
    east: float
    west: float


class SimulationGridCell(BaseModel):
    row: int
    col: int
    lat: float
    lng: float
    zone: Literal["green", "yellow", "red"]
    risk: float
    defense: float
    bounds: SimulationGridBounds


class SimulationGridZone(BaseModel):
    lat: float
    lng: float
    type: Literal["green", "yellow", "red"]


class SimulationGridLoadoutItem(BaseModel):
    name: str
    quantity: int = Field(default=1, ge=1, le=10)


class SimulationGridPilotSelection(BaseModel):
    pilot_id: int
    aircraft: str
    loadout: list[SimulationGridLoadoutItem] = Field(default_factory=list)


class SimulationGridDefenseSelection(BaseModel):
    name: str
    count: int = Field(default=0, ge=0, le=25)


class SimulationGridPresetSnapshot(BaseModel):
    team: str | None = None
    pilots: list[SimulationGridPilotSelection] = Field(default_factory=list)
    defense_type: str | None = None
    defense_count: int = Field(default=0, ge=0, le=25)
    defense_units: list[SimulationGridDefenseSelection] = Field(default_factory=list)
    start: Coordinate | None = None
    target: Coordinate | None = None
    zones: list[SimulationGridZone] = Field(default_factory=list)


class SimulationGridPreset(BaseModel):
    name: str
    snapshot: SimulationGridPresetSnapshot


class SimulationGridPresetCreate(BaseModel):
    name: str
    snapshot: SimulationGridPresetSnapshot | None = None


class SimulationGridState(BaseModel):
    team: str | None = None
    pilots: list[SimulationGridPilotSelection] = Field(default_factory=list)
    defense_type: str | None = None
    defense_count: int = Field(default=0, ge=0, le=25)
    defense_units: list[SimulationGridDefenseSelection] = Field(default_factory=list)
    start: Coordinate | None = None
    target: Coordinate | None = None
    zones: list[SimulationGridZone] = Field(default_factory=list)
    presets: list[SimulationGridPreset] = Field(default_factory=list)


class SimulationGridStateUpdate(BaseModel):
    team: str | None = None
    pilots: list[SimulationGridPilotSelection] | None = None
    defense_type: str | None = None
    defense_count: int | None = None
    defense_units: list[SimulationGridDefenseSelection] | None = None
    start: Coordinate | None = None
    target: Coordinate | None = None
    zones: list[SimulationGridZone] | None = None


class SimulationGridRoute(BaseModel):
    mode: Literal["direct", "safe", "balanced"]
    path: list[Coordinate]
    risk: float
    green_ratio: float
    yellow_ratio: float
    red_ratio: float
    casualty_percentage: float
    success: float
    losses: int
    aircraft_losses: int
    distance_km: float
    time_hours: float
    estimated_cost: float
    what_if: dict


class SimulationGridDataResponse(BaseModel):
    teams: list[dict]
    aircraft: list[dict]
    weapons: list[dict]
    defenses: list[dict]


class SimulationGridStateResponse(BaseModel):
    state: SimulationGridState
    grid: list[SimulationGridCell]
    defense_radius_km: float


class SimulationGridRunRequest(BaseModel):
    team: str
    start: Coordinate
    target: Coordinate
    pilots: list[SimulationGridPilotSelection] = Field(default_factory=list)
    defense_type: str
    defense_count: int = Field(ge=0, le=25)
    defense_units: list[SimulationGridDefenseSelection] = Field(default_factory=list)
    zones: list[SimulationGridZone] = Field(default_factory=list)


class SimulationGridRunResponse(BaseModel):
    grid: list[SimulationGridCell]
    routes: list[SimulationGridRoute]
    defense_radius_km: float
