import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMapEvents } from "react-leaflet";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  api,
  type AirspaceZone,
  type MapCoordinate,
  type EnemyAircraftUnitPayload,
  type SimulationResult,
} from "@/lib/api";
import "leaflet/dist/leaflet.css";

type SidebarMode = "airspace" | "target" | "team" | "simulation";
type MapMode = "idle" | "set_base" | "airspace" | "route_start" | "route_waypoint" | "route_end" | "ground_target" | "aircraft_waypoint";
type MissionType = "water" | "air" | "ground";
type WaterTargetType = "cargo_ship" | "warship" | "submarine";
type ZoneType = "friendly" | "neutral" | "enemy";

interface PilotOption {
  id: number;
  name: string;
  callSign: string;
  assignedAircraft?: string | null;
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
const ZONE_COLORS: Record<ZoneType, { stroke: string; fill: string; label: string }> = {
  friendly: { stroke: "#22c55e", fill: "#22c55e", label: "Friendly" },
  neutral: { stroke: "#eab308", fill: "#eab308", label: "Neutral" },
  enemy: { stroke: "#ef4444", fill: "#ef4444", label: "Enemy" },
};

const toPositions = (points: MapCoordinate[]) => points.map((point) => [point.lat, point.lng] as [number, number]);

const formatCoord = (point: MapCoordinate) => `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;

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
  const [airspaceRadiusKm, setAirspaceRadiusKm] = useState(120);
  const [airspaceDraftCenter, setAirspaceDraftCenter] = useState<MapCoordinate | null>(null);

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
  const [selectedPilotIds, setSelectedPilotIds] = useState<number[]>([]);
  const [weaponByAircraft, setWeaponByAircraft] = useState<Record<string, Record<string, number>>>({});

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

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
    return routeCoordinates;
  }, [missionType, groundTargetLocation, routeCoordinates]);

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
      setResult(null);
      return;
    }
    if (mapMode === "airspace") {
      setAirspaceDraftCenter(point);
      return;
    }
    if (mapMode === "route_start") {
      setRouteStart(point);
      setRouteWaypoints([]);
      setRouteEnd(null);
      setResult(null);
      return;
    }
    if (mapMode === "route_waypoint") {
      setRouteWaypoints((prev) => [...prev, point]);
      setResult(null);
      return;
    }
    if (mapMode === "route_end") {
      setRouteEnd(point);
      setResult(null);
      return;
    }
    if (mapMode === "ground_target") {
      setGroundTargetLocation(point);
      setResult(null);
      return;
    }
    if (mapMode === "aircraft_waypoint") {
      setAircraftRouteWaypoints((prev) => [...prev, point]);
      setResult(null);
    }
  };

  const saveAirspace = async () => {
    if (!airspaceDraftCenter) {
      window.alert("Click on the map to place airspace center first.");
      return;
    }
    if (!airspaceCountry.trim()) {
      window.alert("Enter country name for this airspace zone.");
      return;
    }

    const created = await api.createAirspaceZone({
      countryName: airspaceCountry.trim(),
      center: airspaceDraftCenter,
      radiusKm: airspaceRadiusKm,
      zoneType: airspaceZoneType,
    });
    setZones((prev) => [...prev, created]);
    setAirspaceCountry("");
    setAirspaceDraftCenter(null);
  };

  const togglePilot = (pilotId: number) => {
    setSelectedPilotIds((prev) =>
      prev.includes(pilotId) ? prev.filter((id) => id !== pilotId) : [...prev, pilotId],
    );
    setResult(null);
  };

  const setEnemyAircraftCount = (aircraftType: string, quantity: number) => {
    setEnemyAircraftByType((prev) => ({
      ...prev,
      [aircraftType]: Math.max(0, Math.min(20, quantity)),
    }));
    setResult(null);
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
      setResult(output);
      setIsResultOpen(true);
    } finally {
      setRunning(false);
    }
  };

  const activeAirspaceColor = ZONE_COLORS[airspaceZoneType];

  const previewAircraftPath = useMemo(() => {
    if (!baseLocation) {
      return [];
    }
    return [baseLocation, ...aircraftRouteWaypoints];
  }, [baseLocation, aircraftRouteWaypoints]);

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
            ))}

            {airspaceDraftCenter && (
              <Circle
                center={[airspaceDraftCenter.lat, airspaceDraftCenter.lng]}
                radius={airspaceRadiusKm * 1000}
                pathOptions={{ color: activeAirspaceColor.stroke, fillColor: activeAirspaceColor.fill, fillOpacity: 0.12, weight: 2, dashArray: "4 6" }}
              >
                <Tooltip>Draft Airspace</Tooltip>
              </Circle>
            )}

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

            {result?.bestAircraftPath && result.bestAircraftPath.length > 1 && (
              <Polyline positions={toPositions(result.bestAircraftPath)} pathOptions={{ color: "#38bdf8", weight: 4 }} />
            )}

            {result?.interceptLocation && (
              <CircleMarker
                center={[result.interceptLocation.lat, result.interceptLocation.lng]}
                radius={9}
                pathOptions={{ color: "#facc15", fillColor: "#facc15", fillOpacity: 1 }}
              >
                <Tooltip>Intercept Point</Tooltip>
              </CircleMarker>
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
              <button type="button" className="w-full border border-border/50 px-2 py-2 font-rajdhani text-xs" onClick={() => setMapMode("airspace")}>ADD/EDIT AIRSPACE</button>
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
              <label className="block font-rajdhani text-xs text-muted-foreground">
                Radius (km)
                <input
                  type="number"
                  value={airspaceRadiusKm}
                  min={10}
                  max={1000}
                  onChange={(event) => setAirspaceRadiusKm(Number(event.target.value))}
                  className="mt-1 w-full border border-border/50 bg-background/60 px-2 py-2 text-sm"
                />
              </label>
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
                  <p className="font-rajdhani text-xs text-muted-foreground">Capacity: {weaponCountByAircraft[aircraftId] || 0}/5</p>
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

          {result && <p className="font-rajdhani text-xs text-muted-foreground">Last run: {result.timeToInterceptMinutes} min to intercept, popup has full mission report.</p>}
        </div>
      </div>

      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-5xl border-border/40 bg-card/95">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-sm tracking-[0.15em] text-primary">SIMULATION MISSION OUTPUT</DialogTitle>
            <DialogDescription className="font-rajdhani text-xs text-muted-foreground">Visual intercept strategy and deterministic mission evaluation.</DialogDescription>
          </DialogHeader>

          {result && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="border border-border/40 bg-background/20 p-2">
                <MapContainer center={[result.interceptLocation.lat, result.interceptLocation.lng]} zoom={5} minZoom={2} className="h-[22rem] w-full">
                  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  {result.enemyRoute.length > 1 && (
                    <Polyline positions={toPositions(result.enemyRoute)} pathOptions={{ color: "#f87171", weight: 3, dashArray: "6 8" }} />
                  )}

                  {result.bestAircraftPath.length > 1 && (
                    <Polyline positions={toPositions(result.bestAircraftPath)} pathOptions={{ color: "#38bdf8", weight: 4 }} />
                  )}

                  <CircleMarker center={[result.interceptLocation.lat, result.interceptLocation.lng]} radius={9} pathOptions={{ color: "#facc15", fillColor: "#facc15", fillOpacity: 1 }}>
                    <Tooltip>Intercept Point</Tooltip>
                  </CircleMarker>
                </MapContainer>
              </div>

              <div className="space-y-2 border border-border/40 bg-background/20 p-3">
                <p className="font-orbitron text-xs tracking-[0.12em] text-primary">TEXT OUTPUT</p>
                <p className="font-rajdhani text-sm text-muted-foreground">Best Time to Attack: {result.timeToInterceptMinutes} min</p>
                <p className="font-rajdhani text-sm text-muted-foreground">Intercept Location: {formatCoord(result.interceptLocation)}</p>
                <p className="font-rajdhani text-xs text-muted-foreground">Reasoning: shortest route to a timing-feasible intercept computed from base origin and target movement profile.</p>
                <p className="font-rajdhani text-xs text-muted-foreground">Engine Note: {result.explanation}</p>

                <div className="mt-2 border border-border/30 p-2">
                  <p className="font-orbitron text-[10px] tracking-[0.12em] text-primary">MISSION METRICS</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Success Probability: {result.successProbability.toFixed(2)}%</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Risk Level: {result.riskLevel.toFixed(2)}%</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Fuel Feasibility: {result.fuelFeasibility.toFixed(2)}%</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Threat Level: {result.threatLevel.toFixed(2)}%</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Mission Efficiency Score: {result.missionEfficiencyScore.toFixed(2)}%</p>
                </div>

                <div className="border border-border/30 p-2">
                  <p className="font-orbitron text-[10px] tracking-[0.12em] text-primary">MISSION CONTEXT</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Pilots: {result.selectedPilots.map((pilot) => `${pilot.callSign} (${pilot.aircraftId || "Unassigned"})`).join(", ")}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Aircraft: {result.aircraftUsed.join(", ")}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Weapon Loadout: {result.weaponLoadout.length === 0 ? "None" : result.weaponLoadout.map((item) => `${item.aircraftId}:${item.weaponType} x${item.quantity}`).join(" | ")}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </BackgroundLayout>
  );
};

export default Simulation;
