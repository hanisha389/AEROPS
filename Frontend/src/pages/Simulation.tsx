import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import {
  api,
  type AirspaceZone,
  type MapCoordinate,
  type EnemyAircraftUnitPayload,
} from "@/lib/api";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

type SidebarMode = "airspace" | "target" | "team" | "simulation";
type MapMode = "idle" | "set_base" | "airspace_vertex" | "route_start" | "route_waypoint" | "route_end" | "ground_target" | "aircraft_waypoint";
type MissionType = "water" | "air" | "ground";
type WaterTargetType = "cargo_ship" | "warship" | "submarine";
type ZoneType = "friendly" | "neutral" | "enemy";

interface PilotOption {
  id: number;
  name: string;
  callSign: string;
  assignedAircraft?: string | null;
}

interface AircraftCatalogItem {
  id: string;
  model?: string;
  name?: string;
}

interface WeaponSpec {
  weight: number;
}

interface AircraftProfile {
  name: string;
  maxSpeed: number;
  maxRange: number;
  baseWeight: number;
  maxTakeoffWeight: number;
  ordnanceLimit: number;
}

const WATER_TARGET_SPEEDS: Record<WaterTargetType, number> = {
  cargo_ship: 37,
  warship: 56,
  submarine: 30,
};

const WATER_TARGET_LABELS: Record<WaterTargetType, string> = {
  cargo_ship: "Cargo Ship",
  warship: "Warship",
  submarine: "Submarine",
};

const MISSION_LABELS: Record<MissionType, string> = {
  water: "Water Mission",
  air: "Air Mission",
  ground: "Ground Mission",
};

const ENEMY_AIRCRAFT_TYPES = ["F-16", "F-18", "F-22", "Su-30", "Rafale", "AWACS"];
const WEAPON_TYPES = ["AAM", "ASM", "Precision Bomb", "Torpedo", "ECM Pod"];
const WEAPON_SPECS: Record<string, WeaponSpec> = {
  AAM: { weight: 90 },
  ASM: { weight: 240 },
  "Precision Bomb": { weight: 520 },
  Torpedo: { weight: 380 },
  "ECM Pod": { weight: 180 },
};

const AIRCRAFT_PROFILES: Record<string, AircraftProfile> = {
  "F-22": {
    name: "F-22 Raptor",
    maxSpeed: 2410,
    maxRange: 2960,
    baseWeight: 19700,
    maxTakeoffWeight: 38000,
    ordnanceLimit: 1900,
  },
  "F-35": {
    name: "F-35 Lightning II",
    maxSpeed: 1930,
    maxRange: 2200,
    baseWeight: 13150,
    maxTakeoffWeight: 31750,
    ordnanceLimit: 1700,
  },
  "SU-30": {
    name: "Su-30MKI",
    maxSpeed: 2120,
    maxRange: 3000,
    baseWeight: 18400,
    maxTakeoffWeight: 38800,
    ordnanceLimit: 2200,
  },
  RAFALE: {
    name: "Rafale",
    maxSpeed: 1910,
    maxRange: 3700,
    baseWeight: 10100,
    maxTakeoffWeight: 24500,
    ordnanceLimit: 2000,
  },
  "F/A-18": {
    name: "F/A-18 Super Hornet",
    maxSpeed: 1915,
    maxRange: 2340,
    baseWeight: 14600,
    maxTakeoffWeight: 29900,
    ordnanceLimit: 1800,
  },
  DEFAULT: {
    name: "Generic Fighter",
    maxSpeed: 1500,
    maxRange: 1800,
    baseWeight: 14000,
    maxTakeoffWeight: 28000,
    ordnanceLimit: 1400,
  },
};

const ZONE_COLORS: Record<ZoneType, { stroke: string; fill: string; label: string }> = {
  friendly: { stroke: "#22c55e", fill: "#22c55e", label: "Friendly" },
  neutral: { stroke: "#eab308", fill: "#eab308", label: "Neutral" },
  enemy: { stroke: "#ef4444", fill: "#ef4444", label: "Enemy" },
};

const toPositions = (points: MapCoordinate[]) => points.map((point) => [point.lat, point.lng] as [number, number]);

const formatCoord = (point: MapCoordinate) => `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

const greatCirclePoint = (start: MapCoordinate, end: MapCoordinate, ratio: number): MapCoordinate => {
  if (ratio <= 0) {
    return start;
  }
  if (ratio >= 1) {
    return end;
  }

  const lat1 = toRadians(start.lat);
  const lon1 = toRadians(start.lng);
  const lat2 = toRadians(end.lat);
  const lon2 = toRadians(end.lng);

  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);

  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);

  const dot = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2));
  const omega = Math.acos(dot);
  if (Math.abs(omega) < 1e-10) {
    return {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
    };
  }

  const sinOmega = Math.sin(omega);
  const w1 = Math.sin((1 - ratio) * omega) / sinOmega;
  const w2 = Math.sin(ratio * omega) / sinOmega;

  let x = w1 * x1 + w2 * x2;
  let y = w1 * y1 + w2 * y2;
  let z = w1 * z1 + w2 * z2;
  const norm = Math.sqrt(x * x + y * y + z * z);
  x /= norm;
  y /= norm;
  z /= norm;

  return {
    lat: toDegrees(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lng: toDegrees(Math.atan2(y, x)),
  };
};

const geodesicInterpolatePath = (points: MapCoordinate[], segmentsPerLeg = 24): MapCoordinate[] => {
  if (points.length < 2) {
    return points;
  }
  const curved: MapCoordinate[] = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    for (let step = 1; step <= segmentsPerLeg; step += 1) {
      curved.push(greatCirclePoint(start, end, step / segmentsPerLeg));
    }
  }
  return curved;
};

const resolveAircraftProfile = (modelName?: string | null): AircraftProfile => {
  const model = (modelName || "").toUpperCase();
  if (model.includes("F-22")) {
    return AIRCRAFT_PROFILES["F-22"];
  }
  if (model.includes("F-35")) {
    return AIRCRAFT_PROFILES["F-35"];
  }
  if (model.includes("SU-30")) {
    return AIRCRAFT_PROFILES["SU-30"];
  }
  if (model.includes("RAFALE")) {
    return AIRCRAFT_PROFILES.RAFALE;
  }
  if (model.includes("F/A-18") || model.includes("FA-18")) {
    return AIRCRAFT_PROFILES["F/A-18"];
  }
  return AIRCRAFT_PROFILES.DEFAULT;
};

const computePayloadWeightKg = (weaponMap: Record<string, number>) =>
  Object.entries(weaponMap).reduce((sum, [weaponType, quantity]) => {
    const weaponWeight = WEAPON_SPECS[weaponType]?.weight ?? 0;
    return sum + weaponWeight * quantity;
  }, 0);

const ClickHandler = ({ onClick }: { onClick: (point: MapCoordinate) => void }) => {
  useMapEvents({
    click(event) {
      onClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return null;
};

const Simulation = () => {
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("airspace");
  const [mapMode, setMapMode] = useState<MapMode>("idle");
  const [zones, setZones] = useState<AirspaceZone[]>([]);
  const [baseLocation, setBaseLocation] = useState<MapCoordinate | null>(null);
  const [airspaceCountry, setAirspaceCountry] = useState("");
  const [airspaceZoneType, setAirspaceZoneType] = useState<ZoneType>("neutral");
  const [airspaceDraftPolygon, setAirspaceDraftPolygon] = useState<MapCoordinate[]>([]);

  const [missionType, setMissionType] = useState<MissionType>("water");
  const [waterTargetType, setWaterTargetType] = useState<WaterTargetType>("cargo_ship");
  const [routeStart, setRouteStart] = useState<MapCoordinate | null>(null);
  const [routeWaypoints, setRouteWaypoints] = useState<MapCoordinate[]>([]);
  const [routeEnd, setRouteEnd] = useState<MapCoordinate | null>(null);
  const [groundTargetLocation, setGroundTargetLocation] = useState<MapCoordinate | null>(null);
  const [groundAirDefenseLevel, setGroundAirDefenseLevel] = useState(5);
  const [groundDefenseCount, setGroundDefenseCount] = useState(2);

  const [enemyAircraftByType, setEnemyAircraftByType] = useState<Record<string, number>>({});
  const [aircraftRouteWaypoints, setAircraftRouteWaypoints] = useState<MapCoordinate[]>([]);

  const [pilotOptions, setPilotOptions] = useState<PilotOption[]>([]);
  const [aircraftCatalog, setAircraftCatalog] = useState<Record<string, AircraftCatalogItem>>({});
  const [selectedPilotIds, setSelectedPilotIds] = useState<number[]>([]);
  const [weaponByAircraft, setWeaponByAircraft] = useState<Record<string, Record<string, number>>>({});

  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  const routeCoordinates = useMemo(() => {
    if (!routeStart || !routeEnd) {
      return [];
    }
    return [routeStart, ...routeWaypoints, routeEnd];
  }, [routeStart, routeWaypoints, routeEnd]);

  const selectedPilots = useMemo(
    () => pilotOptions.filter((pilot) => selectedPilotIds.includes(pilot.id)),
    [pilotOptions, selectedPilotIds],
  );

  const selectedAircraftIds = useMemo(
    () => Array.from(new Set(selectedPilots.map((pilot) => pilot.assignedAircraft).filter(Boolean))) as string[],
    [selectedPilots],
  );

  const weaponCountByAircraft = useMemo(() => {
    const totalByAircraft: Record<string, number> = {};
    for (const aircraftId of selectedAircraftIds) {
      const entries = Object.values(weaponByAircraft[aircraftId] || {});
      totalByAircraft[aircraftId] = entries.reduce((sum, qty) => sum + qty, 0);
    }
    return totalByAircraft;
  }, [selectedAircraftIds, weaponByAircraft]);

  const weaponLoadout = useMemo(() => {
    const payload: { aircraftId: string; weaponType: string; quantity: number }[] = [];
    for (const aircraftId of selectedAircraftIds) {
      const map = weaponByAircraft[aircraftId] || {};
      for (const weaponType of Object.keys(map)) {
        const quantity = map[weaponType];
        if (quantity > 0) {
          payload.push({ aircraftId, weaponType, quantity });
        }
      }
    }
    return payload;
  }, [selectedAircraftIds, weaponByAircraft]);

  const enemyAircraftUnits = useMemo<EnemyAircraftUnitPayload[]>(() => {
    return Object.entries(enemyAircraftByType)
      .filter(([, quantity]) => quantity > 0)
      .map(([aircraftType, quantity]) => ({ aircraftType, quantity }));
  }, [enemyAircraftByType]);

  const routeForDisplay = useMemo(() => {
    if (missionType === "ground") {
      return groundTargetLocation ? [groundTargetLocation] : [];
    }
    return geodesicInterpolatePath(routeCoordinates);
  }, [missionType, groundTargetLocation, routeCoordinates]);

  const draftAirspacePath = useMemo(() => {
    if (!airspaceDraftPolygon.length) {
      return [];
    }
    if (airspaceDraftPolygon.length === 1) {
      return airspaceDraftPolygon;
    }
    return [...airspaceDraftPolygon, airspaceDraftPolygon[0]];
  }, [airspaceDraftPolygon]);

  useEffect(() => {
    api.getAirspaceZones().then(setZones);
    api.getSimulationBase().then(setBaseLocation).catch(() => undefined);
    api.getPilots().then((pilots) => {
      setPilotOptions(
        pilots.map((pilot: PilotOption) => ({
          id: pilot.id,
          name: pilot.name,
          callSign: pilot.callSign,
          assignedAircraft: pilot.assignedAircraft,
        })),
      );
    });
    api.getAircrafts().then((aircraftList) => {
      const next: Record<string, AircraftCatalogItem> = {};
      (aircraftList || []).forEach((item: AircraftCatalogItem) => {
        next[item.id] = item;
      });
      setAircraftCatalog(next);
    });
  }, []);

  useEffect(() => {
    setWeaponByAircraft((prev) => {
      const next: Record<string, Record<string, number>> = {};
      for (const aircraftId of selectedAircraftIds) {
        next[aircraftId] = prev[aircraftId] || {};
      }
      return next;
    });
  }, [selectedAircraftIds]);

  const handleMapClick = (point: MapCoordinate) => {
    if (mapMode === "set_base") {
      api.setSimulationBase(point).then(setBaseLocation);
      setMapMode("idle");
      return;
    }
    if (mapMode === "airspace_vertex") {
      setAirspaceDraftPolygon((prev) => [...prev, point]);
      return;
    }
    if (mapMode === "route_start") {
      setRouteStart(point);
      setRouteWaypoints([]);
      setRouteEnd(null);
      return;
    }
    if (mapMode === "route_waypoint") {
      setRouteWaypoints((prev) => [...prev, point]);
      return;
    }
    if (mapMode === "route_end") {
      setRouteEnd(point);
      return;
    }
    if (mapMode === "ground_target") {
      setGroundTargetLocation(point);
      return;
    }
    if (mapMode === "aircraft_waypoint") {
      setAircraftRouteWaypoints((prev) => [...prev, point]);
    }
  };

  const saveAirspace = async () => {
    if (airspaceDraftPolygon.length < 3) {
      window.alert("Draw at least 3 polygon points for airspace.");
      return;
    }
    if (!airspaceCountry.trim()) {
      window.alert("Enter country name for this airspace zone.");
      return;
    }

    const created = await api.createAirspaceZone({
      countryName: airspaceCountry.trim(),
      polygon: airspaceDraftPolygon,
      zoneType: airspaceZoneType,
    });
    setZones((prev) => [...prev, created]);
    setAirspaceCountry("");
    setAirspaceDraftPolygon([]);
    setMapMode("idle");
  };

  const undoDraftAirspacePoint = () => {
    setAirspaceDraftPolygon((prev) => prev.slice(0, -1));
  };

  const togglePilot = (pilotId: number) => {
    setSelectedPilotIds((prev) =>
      prev.includes(pilotId) ? prev.filter((id) => id !== pilotId) : [...prev, pilotId],
    );
  };

  const setEnemyAircraftCount = (aircraftType: string, quantity: number) => {
    setEnemyAircraftByType((prev) => ({
      ...prev,
      [aircraftType]: Math.max(0, Math.min(20, quantity)),
    }));
  };

  const setWeaponQuantity = (aircraftId: string, weaponType: string, quantity: number) => {
    const clampedQuantity = Math.max(0, Math.min(5, quantity));
    setWeaponByAircraft((prev) => {
      const aircraftMap = { ...(prev[aircraftId] || {}) };
      aircraftMap[weaponType] = clampedQuantity;

      const total = Object.values(aircraftMap).reduce((sum, qty) => sum + qty, 0);
      if (total > 5) {
        window.alert(`Aircraft ${aircraftId} can carry maximum 5 weapon units.`);
        return prev;
      }

      const aircraftModel = aircraftCatalog[aircraftId]?.model || aircraftCatalog[aircraftId]?.name;
      const profile = resolveAircraftProfile(aircraftModel);
      const payloadWeightKg = computePayloadWeightKg(aircraftMap);
      if (payloadWeightKg > profile.ordnanceLimit) {
        window.alert(
          `${aircraftId} payload exceeds limit (${payloadWeightKg.toFixed(0)}kg / ${profile.ordnanceLimit.toFixed(0)}kg).`,
        );
        return prev;
      }

      return {
        ...prev,
        [aircraftId]: aircraftMap,
      };
    });
  };

  const runSimulation = async () => {
    if (!baseLocation) {
      window.alert("Set base location before running simulation.");
      return;
    }
    if (missionType !== "ground" && (!routeStart || !routeEnd)) {
      window.alert("Set both route start and route end points.");
      return;
    }
    if (missionType === "ground" && !groundTargetLocation) {
      window.alert("Set ground target location for ground mission.");
      return;
    }
    if (selectedPilotIds.length === 0) {
      window.alert("Select at least one pilot.");
      return;
    }

    if (missionType === "air" && enemyAircraftUnits.length === 0) {
      window.alert("Air mission requires at least one enemy aircraft unit.");
      return;
    }

    setRunning(true);
    try {
      const output = await api.runSimulation({
        missionType,
        waterTargetType: missionType === "water" ? waterTargetType : undefined,
        routeCoordinates: missionType === "ground" ? [] : routeCoordinates,
        groundTargetLocation: missionType === "ground" ? groundTargetLocation || undefined : undefined,
        groundAirDefenseLevel,
        groundDefenseCount,
        enemyAircraftUnits,
        aircraftRouteWaypoints,
        selectedPilotIds,
        weaponLoadout,
      });
      navigate("/simulation/run", { state: { simulation: output } });
    } finally {
      setRunning(false);
    }
  };

  const activeAirspaceColor = ZONE_COLORS[airspaceZoneType];

  const previewAircraftPath = useMemo(() => {
    if (!baseLocation) {
      return [];
    }
    return geodesicInterpolatePath([baseLocation, ...aircraftRouteWaypoints]);
  }, [baseLocation, aircraftRouteWaypoints]);

  const loadoutAnalysis = useMemo(() => {
    return selectedAircraftIds.map((aircraftId) => {
      const aircraftModel = aircraftCatalog[aircraftId]?.model || aircraftCatalog[aircraftId]?.name;
      const profile = resolveAircraftProfile(aircraftModel);
      const weaponsMap = weaponByAircraft[aircraftId] || {};
      const payloadWeightKg = computePayloadWeightKg(weaponsMap);
      const payloadRatio = Math.min(1, payloadWeightKg / Math.max(profile.ordnanceLimit, 1));
      const effectiveSpeed = profile.maxSpeed * (1 - payloadRatio * 0.35);
      const effectiveRange = profile.maxRange * (1 - payloadRatio * 0.28);
      const totalWeightKg = profile.baseWeight + payloadWeightKg;
      return {
        aircraftId,
        profile,
        payloadWeightKg,
        totalWeightKg,
        payloadRatio,
        effectiveSpeed,
        effectiveRange,
      };
    });
  }, [selectedAircraftIds, aircraftCatalog, weaponByAircraft]);

  const renderModeButton = (mode: SidebarMode, label: string) => (
    <button
      type="button"
      className={`border px-3 py-2 font-orbitron text-[10px] tracking-[0.12em] ${sidebarMode === mode ? "border-primary text-primary" : "border-border/50 text-muted-foreground"}`}
      onClick={() => setSidebarMode(mode)}
    >
      {label}
    </button>
  );

  return (
    <BackgroundLayout>
      <PageHeader title="SIMULATION" />
      <div className="grid min-h-[78vh] grid-cols-1 gap-4 p-4 xl:grid-cols-[2fr_1fr]">
        <div className="border border-border/40 bg-card/20 p-2">
          <MapContainer center={[15, 70]} zoom={4} minZoom={2} className="h-[72vh] w-full">
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onClick={handleMapClick} />

            {zones.map((zone) => (
              zone.geometryType === "polygon" && zone.polygon.length >= 3 ? (
                <Polygon
                  key={zone.id}
                  positions={toPositions(zone.polygon)}
                  pathOptions={{
                    color: ZONE_COLORS[zone.zoneType].stroke,
                    fillColor: ZONE_COLORS[zone.zoneType].fill,
                    fillOpacity: 0.14,
                    weight: 2,
                  }}
                >
                  <Tooltip>{`${zone.countryName} (Polygon, ${ZONE_COLORS[zone.zoneType].label})`}</Tooltip>
                </Polygon>
              ) : (
                zone.center && zone.radiusKm ? (
                  <Circle
                    key={zone.id}
                    center={[zone.center.lat, zone.center.lng]}
                    radius={zone.radiusKm * 1000}
                    pathOptions={{
                      color: ZONE_COLORS[zone.zoneType].stroke,
                      fillColor: ZONE_COLORS[zone.zoneType].fill,
                      fillOpacity: 0.14,
                      weight: 2,
                    }}
                  >
                    <Tooltip>{`${zone.countryName} (${zone.radiusKm} km, ${ZONE_COLORS[zone.zoneType].label})`}</Tooltip>
                  </Circle>
                ) : null
              )
            ))}

            {airspaceDraftPolygon.length >= 3 && (
              <Polygon
                positions={toPositions(airspaceDraftPolygon)}
                pathOptions={{ color: activeAirspaceColor.stroke, fillColor: activeAirspaceColor.fill, fillOpacity: 0.12, weight: 2, dashArray: "4 6" }}
              >
                <Tooltip>Draft Airspace Polygon</Tooltip>
              </Polygon>
            )}

            {draftAirspacePath.length > 1 && (
              <Polyline positions={toPositions(draftAirspacePath)} pathOptions={{ color: activeAirspaceColor.stroke, weight: 2, dashArray: "4 6" }} />
            )}

            {airspaceDraftPolygon.map((vertex, index) => (
              <CircleMarker key={`draft-vertex-${index}`} center={[vertex.lat, vertex.lng]} radius={5} pathOptions={{ color: activeAirspaceColor.stroke, fillColor: activeAirspaceColor.fill, fillOpacity: 1 }}>
                <Tooltip>{`Vertex ${index + 1}`}</Tooltip>
              </CircleMarker>
            ))}

            {baseLocation && (
              <CircleMarker
                center={[baseLocation.lat, baseLocation.lng]}
                radius={9}
                pathOptions={{ color: "#60a5fa", fillColor: "#60a5fa", fillOpacity: 1 }}
              >
                <Tooltip>BASE</Tooltip>
              </CircleMarker>
            )}

            {routeForDisplay.length > 1 && (
              <Polyline positions={toPositions(routeForDisplay)} pathOptions={{ color: "#f87171", weight: 3, dashArray: "6 8" }} />
            )}

            {(missionType === "water" || missionType === "air") && routeStart && (
              <CircleMarker center={[routeStart.lat, routeStart.lng]} radius={7} pathOptions={{ color: "#fb7185", fillColor: "#fb7185", fillOpacity: 1 }}>
                <Tooltip>Route Start</Tooltip>
              </CircleMarker>
            )}

            {(missionType === "water" || missionType === "air") && routeEnd && (
              <CircleMarker center={[routeEnd.lat, routeEnd.lng]} radius={7} pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 1 }}>
                <Tooltip>Route End</Tooltip>
              </CircleMarker>
            )}

            {groundTargetLocation && (
              <CircleMarker center={[groundTargetLocation.lat, groundTargetLocation.lng]} radius={8} pathOptions={{ color: "#d97706", fillColor: "#d97706", fillOpacity: 1 }}>
                <Tooltip>Ground Target</Tooltip>
              </CircleMarker>
            )}

            {previewAircraftPath.length > 1 && (
              <Polyline positions={toPositions(previewAircraftPath)} pathOptions={{ color: "#22d3ee", weight: 2, dashArray: "3 7" }} />
            )}

          </MapContainer>
        </div>

        <div className="space-y-4 border border-border/40 bg-card/30 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`border px-3 py-2 font-orbitron text-[10px] tracking-[0.12em] ${mapMode === "set_base" ? "border-primary text-primary" : "border-border/50 text-muted-foreground"}`}
              onClick={() => setMapMode("set_base")}
            >
              SET BASE
            </button>
            {renderModeButton("airspace", "AIRSPACE MODE")}
            {renderModeButton("target", "TARGET MODE")}
            {renderModeButton("team", "TEAM MODE")}
            {renderModeButton("simulation", "SIMULATION MODE")}
          </div>

          <div className="border border-border/40 bg-background/20 p-3">
            <p className="font-rajdhani text-xs text-muted-foreground">Map Mode</p>
            <p className="font-orbitron text-xs tracking-[0.15em] text-primary">{mapMode.toUpperCase()}</p>
            <p className="mt-1 font-rajdhani text-xs text-muted-foreground">Base: {baseLocation ? formatCoord(baseLocation) : "Not Set"}</p>
          </div>

          {sidebarMode === "airspace" && (
            <div className="space-y-2 border border-border/40 bg-background/20 p-3">
              <p className="font-orbitron text-xs tracking-[0.12em] text-primary">AIRSPACE MODE</p>
              <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={() => setMapMode("airspace_vertex")}>DRAW POLYGON (CLICK MAP)</button>
              <input
                value={airspaceCountry}
                onChange={(event) => setAirspaceCountry(event.target.value)}
                placeholder="Country Name"
                className="w-full border border-border/50 bg-background/60 px-2 py-2 font-rajdhani text-sm"
              />
              <label className="block font-rajdhani text-xs text-muted-foreground">
                Airspace Color Type
                <select
                  value={airspaceZoneType}
                  onChange={(event) => setAirspaceZoneType(event.target.value as ZoneType)}
                  className="mt-1 w-full border border-border/50 bg-background/60 px-2 py-2 text-sm"
                >
                  <option value="friendly">Green - Friendly</option>
                  <option value="neutral">Yellow - Neutral</option>
                  <option value="enemy">Red - Enemy</option>
                </select>
              </label>
              <p className="font-rajdhani text-xs text-muted-foreground">Polygon Points: {airspaceDraftPolygon.length}</p>
              <div className="flex gap-2">
                <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={undoDraftAirspacePoint}>UNDO LAST</button>
                <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={() => setAirspaceDraftPolygon([])}>CLEAR POLYGON</button>
              </div>
              <button type="button" className="w-full border border-primary px-3 py-2 font-orbitron text-xs text-primary" onClick={saveAirspace}>
                SAVE ZONE
              </button>
            </div>
          )}

          {sidebarMode === "target" && (
            <div className="space-y-3">
              <div className="border border-border/40 bg-background/20 p-3">
                <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">TARGET MODE</p>
                <select
                  className="w-full border border-border/50 bg-background/60 px-2 py-2 font-rajdhani text-sm"
                  value={missionType}
                  onChange={(event) => setMissionType(event.target.value as MissionType)}
                >
                  <option value="water">Water Mission</option>
                  <option value="air">Air Mission</option>
                  <option value="ground">Ground Mission</option>
                </select>
                <p className="mt-2 font-rajdhani text-xs text-muted-foreground">{MISSION_LABELS[missionType]}</p>
              </div>

              {missionType === "water" && (
                <div className="border border-border/40 bg-background/20 p-3">
                  <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">WATER TARGET</p>
                  <select
                    className="w-full border border-border/50 bg-background/60 px-2 py-2 font-rajdhani text-sm"
                    value={waterTargetType}
                    onChange={(event) => setWaterTargetType(event.target.value as WaterTargetType)}
                  >
                    <option value="cargo_ship">Cargo Ship</option>
                    <option value="warship">Warship</option>
                    <option value="submarine">Submarine</option>
                  </select>
                  <p className="mt-2 font-rajdhani text-xs text-muted-foreground">Fixed Speed: {WATER_TARGET_SPEEDS[waterTargetType]} km/h</p>
                </div>
              )}

              {(missionType === "water" || missionType === "air") && (
                <div className="border border-border/40 bg-background/20 p-3">
                  <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">ENEMY ROUTE</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="border border-border/50 px-2 py-1 font-rajdhani text-xs" onClick={() => setMapMode("route_start")}>SET START</button>
                    <button type="button" className="border border-border/50 px-2 py-1 font-rajdhani text-xs" onClick={() => setMapMode("route_waypoint")}>ADD ROUTE POINT</button>
                    <button type="button" className="border border-border/50 px-2 py-1 font-rajdhani text-xs" onClick={() => setMapMode("route_end")}>SET END</button>
                  </div>
                  <p className="mt-2 font-rajdhani text-xs text-muted-foreground">Start: {routeStart ? formatCoord(routeStart) : "Not Set"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Route Points: {routeWaypoints.length}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">End: {routeEnd ? formatCoord(routeEnd) : "Not Set"}</p>
                </div>
              )}

              {missionType === "ground" && (
                <div className="border border-border/40 bg-background/20 p-3">
                  <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">GROUND TARGET</p>
                  <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={() => setMapMode("ground_target")}>SET GROUND TARGET POINT</button>
                  <p className="mt-2 font-rajdhani text-xs text-muted-foreground">Target: {groundTargetLocation ? formatCoord(groundTargetLocation) : "Not Set"}</p>
                  <label className="mt-2 block font-rajdhani text-xs text-muted-foreground">
                    Air Defense Level: {groundAirDefenseLevel}
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={groundAirDefenseLevel}
                      onChange={(event) => setGroundAirDefenseLevel(Number(event.target.value))}
                      className="mt-1 w-full"
                    />
                  </label>
                  <label className="mt-2 block font-rajdhani text-xs text-muted-foreground">
                    Defense Count
                    <input
                      type="number"
                      min={0}
                      value={groundDefenseCount}
                      onChange={(event) => setGroundDefenseCount(Number(event.target.value))}
                      className="mt-1 w-full border border-border/50 bg-background/60 px-2 py-2 text-sm"
                    />
                  </label>
                </div>
              )}

              <div className="border border-border/40 bg-background/20 p-3">
                <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">ENEMY CONFIGURATION</p>
                <div className="space-y-1">
                  {ENEMY_AIRCRAFT_TYPES.map((type) => (
                    <label key={type} className="flex items-center justify-between border border-border/40 px-2 py-1">
                      <span className="font-rajdhani text-sm">{type}</span>
                      <input
                        type="number"
                        min={0}
                        value={enemyAircraftByType[type] || 0}
                        onChange={(event) => setEnemyAircraftCount(type, Number(event.target.value || 0))}
                        className="w-16 border border-border/50 bg-background/60 px-2 py-1 text-right font-rajdhani text-sm"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sidebarMode === "team" && (
            <div className="space-y-3">
              <div className="border border-border/40 bg-background/20 p-3">
                <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">SELECT PILOTS</p>
                <div className="max-h-44 space-y-1 overflow-auto pr-1">
                  {pilotOptions.map((pilot) => (
                    <label key={pilot.id} className="flex items-center justify-between border border-border/40 px-2 py-1">
                      <span className="font-rajdhani text-sm">{pilot.callSign} ({pilot.name})</span>
                      <input type="checkbox" checked={selectedPilotIds.includes(pilot.id)} onChange={() => togglePilot(pilot.id)} />
                    </label>
                  ))}
                </div>
              </div>

              <div className="border border-border/40 bg-background/20 p-3">
                <p className="mb-2 font-orbitron text-xs tracking-[0.12em] text-primary">AUTO-SELECTED AIRCRAFT</p>
                {selectedAircraftIds.length === 0 && <p className="font-rajdhani text-sm text-muted-foreground">No aircraft selected yet.</p>}
                {selectedAircraftIds.map((aircraftId) => (
                  <p key={aircraftId} className="font-rajdhani text-sm text-primary">{aircraftId}</p>
                ))}
              </div>

              {selectedAircraftIds.map((aircraftId) => (
                <div key={aircraftId} className="space-y-1 border border-border/40 bg-background/20 p-3">
                  <p className="font-orbitron text-[11px] tracking-[0.1em] text-primary">WEAPONS: {aircraftId}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Capacity: {weaponCountByAircraft[aircraftId] || 0}/5 units</p>
                  {WEAPON_TYPES.map((weaponType) => (
                    <label key={`${aircraftId}-${weaponType}`} className="flex items-center justify-between border border-border/40 px-2 py-1">
                      <span className="font-rajdhani text-sm">{weaponType}</span>
                      <input
                        type="number"
                        min={0}
                        max={5}
                        value={weaponByAircraft[aircraftId]?.[weaponType] || 0}
                        onChange={(event) => setWeaponQuantity(aircraftId, weaponType, Number(event.target.value || 0))}
                        className="w-16 border border-border/50 bg-background/60 px-2 py-1 text-right font-rajdhani text-sm"
                      />
                    </label>
                  ))}
                </div>
              ))}

              {loadoutAnalysis.length > 0 && (
                <div className="space-y-2 border border-border/40 bg-background/20 p-3">
                  <p className="font-orbitron text-xs tracking-[0.12em] text-primary">WEIGHT AND FUEL IMPACT</p>
                  {loadoutAnalysis.map((item) => (
                    <div key={`loadout-${item.aircraftId}`} className="border border-border/40 px-2 py-2">
                      <p className="font-rajdhani text-sm text-primary">{item.aircraftId} - {item.profile.name}</p>
                      <p className="font-rajdhani text-xs text-muted-foreground">Payload: {item.payloadWeightKg.toFixed(0)}kg / {item.profile.ordnanceLimit.toFixed(0)}kg</p>
                      <p className="font-rajdhani text-xs text-muted-foreground">Final Weight: {item.totalWeightKg.toFixed(0)}kg</p>
                      <p className="font-rajdhani text-xs text-muted-foreground">Est. Speed After Loadout: {item.effectiveSpeed.toFixed(0)} km/h</p>
                      <p className="font-rajdhani text-xs text-muted-foreground">Est. Range After Loadout: {item.effectiveRange.toFixed(0)} km</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {sidebarMode === "simulation" && (
            <div className="space-y-2 border border-border/40 bg-background/20 p-3">
              <p className="font-orbitron text-xs tracking-[0.12em] text-primary">SIMULATION MODE</p>
              <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={() => setMapMode("aircraft_waypoint")}>ADD AIRCRAFT PATH POINT</button>
              <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={() => setAircraftRouteWaypoints([])}>CLEAR AIRCRAFT PATH POINTS</button>
              <p className="font-rajdhani text-xs text-muted-foreground">Aircraft route: Base to Intercept to Base. Airspace constraints placeholder is enabled for future logic extension.</p>
              <button type="button" disabled={running} onClick={runSimulation} className="w-full border border-primary px-3 py-3 font-orbitron text-xs tracking-[0.14em] text-primary">
                {running ? "RUNNING SIMULATION..." : "RUN SIMULATION"}
              </button>
            </div>
          )}

        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Simulation;
