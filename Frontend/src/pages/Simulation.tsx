import { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, Rectangle, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useNavigate } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/ui/custom/Panel";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  api,
  type MapCoordinate,
  type SimulationGridAircraft,
  type SimulationGridCell,
  type SimulationGridDefense,
  type SimulationGridDefenseSelection,
  type SimulationGridRoute,
  type SimulationGridState,
  type SimulationGridPreset,
  type SimulationGridPresetSnapshot,
  type SimulationGridWeapon,
  type SimulationGridZoneType,
} from "@/lib/api";
import "leaflet/dist/leaflet.css";

interface PilotOption {
  id: number;
  name: string;
  callSign: string;
  assignedAircraft?: string | null;
}

interface PilotSetup {
  pilotId: number;
  aircraft: string;
  loadoutCounts: Record<string, number>;
}

const GRID_MAX_LOADOUT = 5;
const MAP_BOUNDS: L.LatLngBoundsExpression = [
  [4, 60],
  [42, 105],
];
const MAP_CENTER: [number, number] = [22.5, 78.9];

const zoneFill = (zone: SimulationGridZoneType) => {
  if (zone === "red") return "rgba(255,0,0,0.55)";
  if (zone === "yellow") return "rgba(255,255,0,0.55)";
  return "rgba(0,255,0,0)";
};

const zoneStroke = (zone: SimulationGridZoneType) => {
  if (zone === "red") return "rgba(255,0,0,0.7)";
  if (zone === "yellow") return "rgba(255,210,0,0.8)";
  return "rgba(0,0,0,0.2)";
};

const cycleZone = (zone: SimulationGridZoneType): SimulationGridZoneType => {
  if (zone === "green") return "yellow";
  if (zone === "yellow") return "red";
  return "green";
};

const startIcon = L.divIcon({
  className: "sim-marker sim-marker--start",
  html: "<span class='sim-marker__dot'></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const targetIcon = L.divIcon({
  className: "sim-marker sim-marker--target",
  html: "<span class='sim-marker__dot'></span>",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const Simulation = () => {
  const navigate = useNavigate();
  const [aircraftOptions, setAircraftOptions] = useState<SimulationGridAircraft[]>([]);
  const [weaponOptions, setWeaponOptions] = useState<SimulationGridWeapon[]>([]);
  const [defenseOptions, setDefenseOptions] = useState<SimulationGridDefense[]>([]);
  const [pilotOptions, setPilotOptions] = useState<PilotOption[]>([]);
  const [pilotLoadoutPools, setPilotLoadoutPools] = useState<Record<number, SimulationGridWeapon[]>>({});

  const [team, setTeam] = useState<string>("");
  const [start, setStart] = useState<MapCoordinate | null>(null);
  const [target, setTarget] = useState<MapCoordinate | null>(null);
  const [defenseType, setDefenseType] = useState("");
  const [defenseUnits, setDefenseUnits] = useState<SimulationGridDefenseSelection[]>([]);
  const [grid, setGrid] = useState<SimulationGridCell[]>([]);
  const [showGrid, setShowGrid] = useState(true);
  const [defenseRadiusKm, setDefenseRadiusKm] = useState(0);
  const [clickMode, setClickMode] = useState<"start" | "target" | null>(null);
  const [selectedPilotIds, setSelectedPilotIds] = useState<number[]>([]);
  const [pilotSetups, setPilotSetups] = useState<Record<number, PilotSetup>>({});
  const [lastRoutes, setLastRoutes] = useState<SimulationGridRoute[]>([]);
  const [previewMode, setPreviewMode] = useState<SimulationGridRoute["mode"]>("safe");
  const [presets, setPresets] = useState<SimulationGridPreset[]>([]);
  const [lastRunResult, setLastRunResult] = useState<
    | {
        grid: SimulationGridCell[];
        routes: SimulationGridRoute[];
        start: MapCoordinate;
        target: MapCoordinate;
        defenseRadiusKm: number;
      }
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const weaponIndex = useMemo(() => new Map(weaponOptions.map((weapon) => [weapon.name, weapon])), [weaponOptions]);
  const presetSlots = useMemo(() => ["1", "2", "3"], []);

  const enemyDefenseOptions = useMemo(() => {
    if (!team) return defenseOptions;
    const filtered = defenseOptions.filter((option) => option.group !== team);
    return filtered.length ? filtered : defenseOptions;
  }, [defenseOptions, team]);

  const enemyReinforcements = useMemo(() => {
    if (!aircraftOptions.length) return [] as Array<{ name: string; count: number; group: string }>;
    const enemy = team ? aircraftOptions.filter((aircraft) => aircraft.group !== team) : aircraftOptions;
    return enemy.map((aircraft, index) => ({
      name: aircraft.name,
      count: (index % 3) + 2,
      group: aircraft.group,
    }));
  }, [aircraftOptions, team]);

  const selectedPilotSetups = useMemo(() => {
    return selectedPilotIds
      .map((pilotId) => pilotSetups[pilotId])
      .filter((setup): setup is PilotSetup => Boolean(setup));
  }, [selectedPilotIds, pilotSetups]);

  const totalDefenseCount = useMemo(
    () => defenseUnits.reduce((sum, unit) => sum + (unit.count || 0), 0),
    [defenseUnits],
  );

  const previewRoute = useMemo(() => {
    if (!lastRoutes.length) return null;
    return lastRoutes.find((route) => route.mode === previewMode) ?? lastRoutes[0];
  }, [lastRoutes, previewMode]);

  const pilotPayload = useMemo(() => {
    return selectedPilotSetups.map((setup) => ({
      pilot_id: setup.pilotId,
      aircraft: setup.aircraft,
      loadout: Object.entries(setup.loadoutCounts)
        .filter(([, quantity]) => quantity > 0)
        .map(([name, quantity]) => ({ name, quantity })),
    }));
  }, [selectedPilotSetups]);

  const totalLoadoutMetrics = useMemo(() => {
    let totalWeight = 0;
    let totalCost = 0;
    let totalCount = 0;
    selectedPilotSetups.forEach((setup) => {
      Object.entries(setup.loadoutCounts).forEach(([weaponName, quantity]) => {
        const weapon = weaponIndex.get(weaponName);
        const weight = weapon?.weight ?? 1.2;
        const cost = weapon?.cost ?? 250;
        totalWeight += weight * quantity;
        totalCost += cost * quantity;
        totalCount += quantity;
      });
    });
    return { totalWeight, totalCost, totalCount };
  }, [selectedPilotSetups, weaponIndex]);

  const zonePayload = (cells: SimulationGridCell[]) =>
    cells.map((cell) => ({ lat: cell.lat, lng: cell.lng, type: cell.zone }));

  const buildPresetSnapshot = (): SimulationGridPresetSnapshot => ({
    pilots: [],
    defense_count: 0,
    zones: zonePayload(grid),
  });

  const resolveDefaultAircraft = (pilot: PilotOption): string => {
    return pilot.assignedAircraft ?? "";
  };

  const buildRandomLoadout = (weapons: SimulationGridWeapon[]) => {
    if (!weapons.length) {
      return { pool: [], counts: {} as Record<string, number> };
    }
    const shuffled = [...weapons].sort(() => Math.random() - 0.5);
    const poolSize = Math.min(4, shuffled.length);
    const pool = shuffled.slice(0, poolSize);
    const counts: Record<string, number> = {};
    let remaining = GRID_MAX_LOADOUT;
    pool.forEach((weapon, index) => {
      if (remaining <= 0) return;
      const minQty = index === 0 ? 1 : 0;
      const maxQty = Math.min(2, remaining);
      const qty = minQty === maxQty ? maxQty : Math.floor(Math.random() * (maxQty - minQty + 1)) + minQty;
      if (qty > 0) {
        counts[weapon.name] = qty;
        remaining -= qty;
      }
    });
    if (!Object.keys(counts).length && pool[0]) {
      counts[pool[0].name] = 1;
    }
    return { pool, counts };
  };

  const updateBackendState = async (payload: SimulationGridState, updateGrid = true) => {
    if (!isInitialized) return;
    try {
      const response = await api.updateSimulationGridState(payload);
      if (updateGrid && response.grid?.length) {
        setGrid(response.grid);
      }
      if (response.defense_radius_km !== undefined) {
        setDefenseRadiusKm(response.defense_radius_km ?? 0);
      }
      if (response.state?.start) {
        setStart(response.state.start ?? null);
      }
      if (response.state?.target) {
        setTarget(response.state.target ?? null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dataResponse, stateResponse, pilots, presetResponse] = await Promise.all([
          api.getSimulationGridData(),
          api.getSimulationGridState(),
          api.getPilots(),
          api.listSimulationGridPresets(),
        ]);

        setAircraftOptions(dataResponse.aircraft ?? []);
        setWeaponOptions(dataResponse.weapons ?? []);
        setDefenseOptions(dataResponse.defenses ?? []);
        setPilotOptions(
          (pilots || []).map((pilot: PilotOption) => ({
            id: pilot.id,
            name: pilot.name,
            callSign: pilot.callSign,
            assignedAircraft: pilot.assignedAircraft,
          })),
        );

        const weaponPool = dataResponse.weapons ?? [];
        const weaponIndexMap = new Map(weaponPool.map((weapon) => [weapon.name, weapon]));

        const initialTeam = stateResponse.state?.team ?? dataResponse.teams?.[0]?.name ?? "";
        const initialDefense = stateResponse.state?.defense_type ?? dataResponse.defenses?.[0]?.name ?? "";

        setTeam(initialTeam);
        const stateDefenseUnits = stateResponse.state?.defense_units ?? [];
        const initialUnits = stateDefenseUnits.length
          ? stateDefenseUnits
          : initialDefense
            ? [{ name: initialDefense, count: stateResponse.state?.defense_count ?? 2 }]
            : [];
        setDefenseUnits(initialUnits);
        setDefenseType(initialUnits[0]?.name ?? initialDefense);
        setStart(stateResponse.state?.start ?? null);
        setTarget(stateResponse.state?.target ?? null);
        setGrid(stateResponse.grid ?? []);
        setDefenseRadiusKm(stateResponse.defense_radius_km ?? 0);
        setPresets(presetResponse.length ? presetResponse : stateResponse.state?.presets ?? []);

        const storedPilots = stateResponse.state?.pilots ?? [];
        if (storedPilots.length) {
          const nextSetups: Record<number, PilotSetup> = {};
          const nextPools: Record<number, SimulationGridWeapon[]> = {};
          storedPilots.forEach((stored) => {
            const nextCounts: Record<string, number> = {};
            stored.loadout?.forEach((item) => {
              nextCounts[item.name] = item.quantity;
            });
            const storedPool = stored.loadout
              ?.map((item) => weaponIndexMap.get(item.name))
              .filter((weapon): weapon is SimulationGridWeapon => Boolean(weapon));
            if (storedPool?.length) {
              nextPools[stored.pilot_id] = storedPool;
            }
            nextSetups[stored.pilot_id] = {
              pilotId: stored.pilot_id,
              aircraft: stored.aircraft,
              loadoutCounts: nextCounts,
            };
          });
          setPilotSetups(nextSetups);
          setSelectedPilotIds(storedPilots.map((pilot) => pilot.pilot_id));
          if (Object.keys(nextPools).length) {
            setPilotLoadoutPools(nextPools);
          }
        }

        setIsInitialized(true);

        if (!stateResponse.state?.start) {
          try {
            const baseLocation = await api.getSimulationBase();
            if (baseLocation) {
              setStart(baseLocation);
              await api.updateSimulationGridState({ start: baseLocation } as SimulationGridState);
            }
          } catch (baseErr) {
            if (!(baseErr instanceof Error && baseErr.message.includes("404"))) {
              console.error(baseErr);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load simulation data");
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (enemyDefenseOptions.length && !enemyDefenseOptions.some((option) => option.name === defenseType)) {
      setDefenseType(enemyDefenseOptions[0]?.name ?? "");
    }
  }, [enemyDefenseOptions, defenseType, isInitialized]);

  useEffect(() => {
    if (!isInitialized) return;
    const timer = setTimeout(() => {
      updateBackendState(
        {
          team,
          pilots: pilotPayload,
          defense_type: defenseUnits[0]?.name ?? defenseType,
          defense_count: totalDefenseCount,
          defense_units: defenseUnits,
        },
        false,
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [team, pilotPayload, defenseType, totalDefenseCount, defenseUnits, isInitialized]);

  const addDefenseUnit = () => {
    if (!defenseType) return;
    setDefenseUnits((prev) => {
      const match = prev.find((unit) => unit.name === defenseType);
      if (match) {
        return prev.map((unit) =>
          unit.name === defenseType ? { ...unit, count: Math.min(25, unit.count + 1) } : unit,
        );
      }
      return [...prev, { name: defenseType, count: 1 }];
    });
  };

  const updateDefenseUnit = (name: string, delta: number) => {
    setDefenseUnits((prev) =>
      prev
        .map((unit) =>
          unit.name === name ? { ...unit, count: Math.max(0, Math.min(25, unit.count + delta)) } : unit,
        )
        .filter((unit) => unit.count > 0),
    );
  };

  const togglePilot = (pilot: PilotOption) => {
    setSelectedPilotIds((prev) => {
      if (prev.includes(pilot.id)) {
        const next = prev.filter((id) => id !== pilot.id);
        return next;
      }
      if (!pilotSetups[pilot.id]) {
        const defaultAircraft = resolveDefaultAircraft(pilot);
        const { pool, counts } = buildRandomLoadout(weaponOptions);
        if (pool.length) {
          setPilotLoadoutPools((current) => ({
            ...current,
            [pilot.id]: pool,
          }));
        }
        setPilotSetups((current) => ({
          ...current,
          [pilot.id]: {
            pilotId: pilot.id,
            aircraft: defaultAircraft,
            loadoutCounts: counts,
          },
        }));
      }
      return [...prev, pilot.id];
    });
  };

  const adjustWeapon = (pilotId: number, weaponName: string, delta: number) => {
    setPilotSetups((prev) => {
      const setup = prev[pilotId];
      if (!setup) return prev;
      const current = setup.loadoutCounts[weaponName] ?? 0;
      const totalCount = Object.values(setup.loadoutCounts).reduce((sum, qty) => sum + qty, 0);
      if (delta > 0 && totalCount >= GRID_MAX_LOADOUT) {
        return prev;
      }
      const updated = Math.max(0, current + delta);
      const nextCounts = { ...setup.loadoutCounts };
      if (updated === 0) {
        delete nextCounts[weaponName];
      } else {
        nextCounts[weaponName] = updated;
      }
      return {
        ...prev,
        [pilotId]: { ...setup, loadoutCounts: nextCounts },
      };
    });
  };

  const toggleZone = (row: number, col: number) => {
    setGrid((prev) => {
      const next = prev.map((cell) => {
        if (cell.row === row && cell.col === col) {
          return { ...cell, zone: cycleZone(cell.zone) };
        }
        return cell;
      });
      updateBackendState({ zones: zonePayload(next) }, false);
      return next;
    });
  };

  const saveGridLayout = async () => {
    try {
      setError(null);
      const response = await api.saveSimulationGridLayout({ zones: zonePayload(grid) });
      setGrid(response.grid ?? grid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save grid layout");
    }
  };

  const clearGridLayout = async () => {
    try {
      setError(null);
      const clearedGrid = grid.map((cell) => ({ ...cell, zone: "green" as SimulationGridZoneType }));
      const clearedZones = clearedGrid.map((cell) => ({ lat: cell.lat, lng: cell.lng, type: "green" as SimulationGridZoneType }));
      setGrid(clearedGrid);
      const response = await api.updateSimulationGridState({ zones: clearedZones });
      setGrid(response.grid ?? clearedGrid);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear grid layout");
    }
  };

  const savePreset = async (name: string) => {
    try {
      setError(null);
      const updated = await api.saveSimulationGridPreset({
        name,
        snapshot: buildPresetSnapshot(),
      });
      setPresets(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save preset");
    }
  };

  const deletePreset = async (name: string) => {
    try {
      setError(null);
      const updated = await api.deleteSimulationGridPreset(name);
      setPresets(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete preset");
    }
  };

  const applyPreset = async (preset: SimulationGridPreset) => {
    const snapshot = preset.snapshot;
    try {
      setError(null);
      const response = await api.updateSimulationGridState({ zones: snapshot.zones } as SimulationGridState);
      setGrid(response.grid ?? []);
      setDefenseRadiusKm(response.defense_radius_km ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load preset");
    }
  };

  const runSimulation = async () => {
    if (!start || !target) {
      setError("Select base and enemy base before running.");
      return;
    }
    if (!defenseUnits.length || totalDefenseCount <= 0) {
      setError("Select enemy air defense before running.");
      return;
    }
    if (!pilotPayload.length) {
      setError("Select at least one pilot.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.runSimulationGrid({
        team,
        start,
        target,
        pilots: pilotPayload,
        defense_type: defenseUnits[0]?.name ?? defenseType,
        defense_count: totalDefenseCount,
        defense_units: defenseUnits,
        zones: zonePayload(grid),
      });
      const result = {
        grid: response.grid ?? grid,
        routes: response.routes ?? [],
        start,
        target,
        defenseRadiusKm: response.defense_radius_km ?? 0,
      };
      setGrid(result.grid ?? grid);
      setDefenseRadiusKm(result.defenseRadiusKm ?? 0);
      setLastRoutes(result.routes ?? []);
      setPreviewMode("safe");
      setLastRunResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setIsLoading(false);
    }
  };

  const openResults = () => {
    if (!lastRunResult) return;
    navigate("/simulation/results", {
      state: {
        result: lastRunResult,
      },
    });
  };

  const MapClickHandler = () => {
    useMapEvents({
      click: (event) => {
        if (!clickMode) return;
        const nextPoint = { lat: event.latlng.lat, lng: event.latlng.lng };
        if (clickMode === "start") {
          setStart(nextPoint);
          updateBackendState({ start: nextPoint }, false);
          api.setSimulationBase(nextPoint).catch((err) => {
            setError(err instanceof Error ? err.message : "Failed to save base location");
          });
        }
        if (clickMode === "target") {
          setTarget(nextPoint);
          updateBackendState({ target: nextPoint }, false);
        }
        setClickMode(null);
      },
    });
    return null;
  };

  return (
    <BackgroundLayout>
      <PageHeader title="SIMULATION GRID" />
      <div className="px-6 pb-8 pt-4">
        <div className="flex h-[calc(100vh-160px)] gap-4 overflow-hidden">
          <Panel className="w-3/5 p-3">
            <div className="h-full overflow-hidden rounded-lg">
              <MapContainer
                center={MAP_CENTER}
                zoom={5}
                minZoom={4}
                maxZoom={7}
                scrollWheelZoom
                maxBounds={MAP_BOUNDS}
                maxBoundsViscosity={1.0}
                className="h-full w-full"
              >
                <MapClickHandler />
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {grid.map((cell) => (
                  <Rectangle
                    key={`${cell.row}-${cell.col}`}
                    bounds={[
                      [cell.bounds.south, cell.bounds.west],
                      [cell.bounds.north, cell.bounds.east],
                    ]}
                    pathOptions={{
                      color: showGrid ? zoneStroke(cell.zone) : "rgba(0,0,0,0.05)",
                      fillColor: showGrid ? zoneFill(cell.zone) : "rgba(0,0,0,0.05)",
                      fillOpacity: showGrid ? 0.8 : 0.04,
                      weight: 0.6,
                    }}
                    interactive
                    eventHandlers={{
                      click: () => toggleZone(cell.row, cell.col),
                    }}
                  />
                ))}

                {target && defenseRadiusKm > 0 && (
                  <Circle
                    center={[target.lat, target.lng]}
                    radius={defenseRadiusKm * 1000}
                    pathOptions={{
                      color: "rgba(239,68,68,0.5)",
                      fillColor: "rgba(239,68,68,0.14)",
                      fillOpacity: 0.3,
                      weight: 1,
                    }}
                  />
                )}

                {previewRoute && previewRoute.path?.length > 1 && (
                  <Polyline
                    positions={previewRoute.path.map((point) => [point.lat, point.lng])}
                    pathOptions={{
                      color: "rgba(14, 165, 233, 0.95)",
                      weight: 3,
                      opacity: 0.9,
                    }}
                  />
                )}

                {start && <Marker position={[start.lat, start.lng]} icon={startIcon} />}
                {target && <Marker position={[target.lat, target.lng]} icon={targetIcon} />}
              </MapContainer>
            </div>
          </Panel>

          <ScrollArea className="h-full w-2/5">
            <div className="space-y-4 pr-2">
              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">BASE COMMAND</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={clickMode === "start" ? "default" : "outline"}
                    className="h-8 px-3 font-rajdhani text-[0.7rem] uppercase tracking-[0.18em]"
                    onClick={() => setClickMode("start")}
                  >
                    Select Base
                  </Button>
                  <Button
                    size="sm"
                    variant={clickMode === "target" ? "default" : "outline"}
                    className="h-8 px-3 font-rajdhani text-[0.7rem] uppercase tracking-[0.18em]"
                    onClick={() => setClickMode("target")}
                  >
                    Select Enemy Base
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 font-rajdhani text-[0.7rem] uppercase tracking-[0.18em]"
                    onClick={() => setShowGrid((prev) => !prev)}
                  >
                    {showGrid ? "Hide Grid" : "Show Grid"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 font-rajdhani text-[0.7rem] uppercase tracking-[0.18em]"
                    onClick={saveGridLayout}
                  >
                    Save Grid Layout
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 font-rajdhani text-[0.7rem] uppercase tracking-[0.18em]"
                    onClick={clearGridLayout}
                  >
                    Clear Grid
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <p>Base: {start ? `${start.lat.toFixed(3)}, ${start.lng.toFixed(3)}` : "Not set"}</p>
                  <p>Enemy Base: {target ? `${target.lat.toFixed(3)}, ${target.lng.toFixed(3)}` : "Not set"}</p>
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">PRESETS</p>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {presetSlots.map((slot) => {
                    const preset = presets.find((entry) => entry.name === slot);
                    return (
                      <div key={slot} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">Preset {slot}</span>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[0.65rem] uppercase"
                            onClick={() => savePreset(slot)}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[0.65rem] uppercase"
                            onClick={() => preset && applyPreset(preset)}
                            disabled={!preset}
                          >
                            Load
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[0.65rem] uppercase text-red-400"
                            onClick={() => deletePreset(slot)}
                            disabled={!preset}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">ENEMY INFO</p>
                <div className="mt-3 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Enemy Air Defense</Label>
                    <Select value={defenseType} onValueChange={setDefenseType}>
                      <SelectTrigger className="bg-background/70">
                        <SelectValue placeholder="Select defense" />
                      </SelectTrigger>
                      <SelectContent>
                        {enemyDefenseOptions.map((option) => (
                          <SelectItem key={option.name} value={option.name}>
                            {option.name} ({option.group})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-[0.65rem] uppercase"
                        onClick={addDefenseUnit}
                      >
                        Add Defense
                      </Button>
                      <span className="text-[0.65rem] text-muted-foreground">
                        Total units: {totalDefenseCount}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Defense Units</Label>
                    <div className="space-y-2">
                      {defenseUnits.length === 0 && (
                        <p className="text-[0.7rem] text-muted-foreground">No defenses added yet.</p>
                      )}
                      {defenseUnits.map((unit) => (
                        <div key={unit.name} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-foreground">{unit.name}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => updateDefenseUnit(unit.name, -1)}
                            >
                              -
                            </Button>
                            <div className="min-w-[36px] rounded-md border border-border/60 bg-background/70 px-2 py-1 text-center text-xs text-foreground">
                              {unit.count}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0"
                              onClick={() => updateDefenseUnit(unit.name, 1)}
                            >
                              +
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[0.6rem] uppercase"
                              onClick={() => updateDefenseUnit(unit.name, 5)}
                            >
                              +5
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">EXPECTED REINFORCEMENTS</p>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {enemyReinforcements.map((aircraft) => (
                    <div key={`${aircraft.name}-${aircraft.group}`} className="flex items-center justify-between">
                      <span>{aircraft.name}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.max(1, Math.min(aircraft.count, 6)) }).map((_, index) => (
                          <span
                            key={`${aircraft.name}-${index}`}
                            className="h-2 w-2 rounded-full bg-emerald-400/80"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-orbitron text-xs tracking-[0.3em] text-primary">OUR TEAM</p>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="space-y-2 text-xs text-muted-foreground">
                    {pilotOptions.map((pilot) => (
                      <label key={pilot.id} className="flex items-center justify-between gap-3">
                        <span>{pilot.name}</span>
                        <Checkbox
                          checked={selectedPilotIds.includes(pilot.id)}
                          onCheckedChange={() => togglePilot(pilot)}
                        />
                      </label>
                    ))}
                  </div>

                  {selectedPilotSetups.map((setup) => {
                    const pilot = pilotOptions.find((entry) => entry.id === setup.pilotId);
                    const loadoutOptions = pilotLoadoutPools[setup.pilotId] ?? weaponOptions.slice(0, 4);
                    const totalCount = Object.values(setup.loadoutCounts).reduce((sum, qty) => sum + qty, 0);
                    const pilotWeight = loadoutOptions.reduce((sum, weapon) => {
                      const qty = setup.loadoutCounts[weapon.name] ?? 0;
                      return sum + (weapon.weight ?? 1.2) * qty;
                    }, 0);
                    const pilotCost = loadoutOptions.reduce((sum, weapon) => {
                      const qty = setup.loadoutCounts[weapon.name] ?? 0;
                      return sum + (weapon.cost ?? 250) * qty;
                    }, 0);

                    return (
                      <div key={setup.pilotId} className="rounded-lg border border-border/60 bg-background/40 p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold text-foreground">{pilot?.name ?? "Pilot"}</p>
                            <p className="text-[0.65rem] text-muted-foreground">{pilot?.callSign ?? "-"}</p>
                          </div>
                          <span className="text-[0.65rem] text-muted-foreground">Loadout {totalCount}/{GRID_MAX_LOADOUT}</span>
                        </div>

                        <div className="mt-3 space-y-2">
                          <Label className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">Aircraft</Label>
                          <div className="rounded-md border border-border/60 bg-background/70 px-3 py-2 text-xs text-foreground">
                            {setup.aircraft || "Unassigned"}
                          </div>
                        </div>

                        <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                          {loadoutOptions.map((weapon) => {
                            const qty = setup.loadoutCounts[weapon.name] ?? 0;
                            return (
                              <div key={weapon.name} className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-foreground">{weapon.name}</p>
                                  <p className="text-[0.65rem] text-muted-foreground">
                                    Weight {weapon.weight ?? 1.2} | Cost {weapon.cost ?? 250}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => adjustWeapon(setup.pilotId, weapon.name, -1)}
                                    disabled={qty === 0}
                                  >
                                    -
                                  </Button>
                                  <span className="min-w-[18px] text-center text-xs text-foreground">{qty}</span>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => adjustWeapon(setup.pilotId, weapon.name, 1)}
                                    disabled={totalCount >= GRID_MAX_LOADOUT}
                                  >
                                    +
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-3 text-[0.7rem] text-muted-foreground">
                          <p>Total loadout weight: {pilotWeight.toFixed(2)}</p>
                          <p>Estimated payload cost: {pilotCost.toFixed(0)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  <p>Total items: {totalLoadoutMetrics.totalCount}</p>
                  <p>Total weight: {totalLoadoutMetrics.totalWeight.toFixed(2)}</p>
                  <p>Total cost: {totalLoadoutMetrics.totalCost.toFixed(0)}</p>
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">RUN SIMULATION</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Select value={previewMode} onValueChange={(value) => setPreviewMode(value as SimulationGridRoute["mode"])}>
                    <SelectTrigger className="h-8 w-44 bg-background/70 text-xs">
                      <SelectValue placeholder="Preview route" />
                    </SelectTrigger>
                    <SelectContent>
                      {lastRoutes.map((route) => (
                        <SelectItem key={route.mode} value={route.mode}>
                          {route.mode.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 font-rajdhani text-[0.7rem] uppercase tracking-[0.18em]"
                    onClick={openResults}
                    disabled={!lastRunResult}
                  >
                    View Results
                  </Button>
                </div>
                <Button
                  className="mt-3 w-full font-rajdhani text-xs uppercase tracking-[0.2em]"
                  onClick={runSimulation}
                  disabled={isLoading}
                >
                  {isLoading ? "Running..." : "Generate Routes"}
                </Button>
                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
              </Panel>

            </div>
          </ScrollArea>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Simulation;
