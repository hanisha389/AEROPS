import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Circle, MapContainer, Marker, Polyline, Rectangle, TileLayer } from "react-leaflet";
import L from "leaflet";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/ui/custom/Panel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  MapCoordinate,
  SimulationGridCell,
  SimulationGridRoute,
  SimulationGridZoneType,
} from "@/lib/api";
import "leaflet/dist/leaflet.css";

interface SimulationGridResultState {
  grid: SimulationGridCell[];
  routes: SimulationGridRoute[];
  start: MapCoordinate;
  target: MapCoordinate;
  defenseRadiusKm: number;
}

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

const routeLabels: Record<SimulationGridRoute["mode"], string> = {
  direct: "Direct Strike",
  safe: "Safe Corridor",
  balanced: "Balanced Push",
};

const routeReasons: Record<SimulationGridRoute["mode"], string> = {
  direct: "Fastest path with minimal detours; choose when speed outweighs exposure.",
  safe: "Detours around red cells to minimize exposure and keep risk lowest.",
  balanced: "Trades limited exposure for reduced distance and higher tempo.",
};

const routeColors: Record<SimulationGridRoute["mode"], string> = {
  direct: "rgba(248, 113, 113, 0.95)",
  safe: "rgba(56, 189, 248, 0.95)",
  balanced: "rgba(250, 204, 21, 0.95)",
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

const SimulationGridResults = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as { result?: SimulationGridResultState } | undefined)?.result;

  const routes = result?.routes ?? [];
  const [selectedMode, setSelectedMode] = useState<SimulationGridRoute["mode"]>("safe");
  const [isUserChoice, setIsUserChoice] = useState(false);

  useEffect(() => {
    if (!result) {
      navigate("/simulation", { replace: true });
      return;
    }
    if (!routes.length || isUserChoice) {
      return;
    }
    const leastRisk = routes.reduce((best, current) => {
      if (!best) return current;
      if (current.red_ratio < best.red_ratio) return current;
      if (current.red_ratio === best.red_ratio && current.risk < best.risk) return current;
      return best;
    }, routes[0]);
    setSelectedMode(leastRisk.mode);
  }, [navigate, result, routes, isUserChoice]);

  const activeRoute = useMemo(() => routes.find((route) => route.mode === selectedMode) ?? routes[0], [routes, selectedMode]);

  if (!result || !activeRoute) {
    return null;
  }

  const { grid, start, target, defenseRadiusKm } = result;

  return (
    <BackgroundLayout>
      <PageHeader title="SIMULATION RESULTS" />
      <div className="px-6 pb-8 pt-4">
        <div className="flex h-[calc(100vh-160px)] gap-4 overflow-hidden">
          <Panel className="w-2/5 p-3">
            <div className="h-full overflow-hidden rounded-lg">
              <MapContainer
                center={MAP_CENTER}
                zoom={5}
                minZoom={4}
                maxZoom={7}
                scrollWheelZoom={false}
                maxBounds={MAP_BOUNDS}
                maxBoundsViscosity={1.0}
                className="h-full w-full"
              >
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
                      color: zoneStroke(cell.zone),
                      fillColor: zoneFill(cell.zone),
                      fillOpacity: 0.75,
                      weight: 0.6,
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

                {routes.map((route) => (
                  <Polyline
                    key={route.mode}
                    positions={route.path.map((point) => [point.lat, point.lng])}
                    pathOptions={{
                      color: routeColors[route.mode],
                      weight: route.mode === activeRoute.mode ? 3.5 : 2.2,
                      opacity: route.mode === activeRoute.mode ? 0.95 : 0.6,
                    }}
                  />
                ))}

                {start && <Marker position={[start.lat, start.lng]} icon={startIcon} />}
                {target && <Marker position={[target.lat, target.lng]} icon={targetIcon} />}
              </MapContainer>
            </div>
          </Panel>

          <ScrollArea className="h-full w-3/5">
            <div className="space-y-4 pr-2">
              <Panel className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-orbitron text-xs tracking-[0.3em] text-primary">ROUTE ANALYSIS</p>
                    <p className="mt-2 text-sm text-muted-foreground">Select an approach to review the risk profile and mission outputs.</p>
                  </div>
                  <Select
                    value={selectedMode}
                    onValueChange={(value) => {
                      setIsUserChoice(true);
                      setSelectedMode(value as SimulationGridRoute["mode"]);
                    }}
                  >
                    <SelectTrigger className="h-8 w-48 bg-background/70 text-xs">
                      <SelectValue placeholder="Select approach" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((route) => (
                        <SelectItem key={route.mode} value={route.mode}>
                          {routeLabels[route.mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-foreground">{routeLabels[activeRoute.mode]}</p>
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs uppercase" onClick={() => navigate("/simulation")}
                  >
                    Run Simulation Again
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{routeReasons[activeRoute.mode]}</p>
              </Panel>

              <Panel className="border border-primary/40 bg-primary/10 p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">RISK BREAKDOWN</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <div>
                    <p className="text-foreground">Red exposure</p>
                    <p>{(activeRoute.red_ratio * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-foreground">Yellow exposure</p>
                    <p>{(activeRoute.yellow_ratio * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-foreground">Green coverage</p>
                    <p>{(activeRoute.green_ratio * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-foreground">Overall risk</p>
                    <p>{activeRoute.risk}</p>
                  </div>
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">MISSION OUTPUT</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                  <p>Success Probability: {activeRoute.success}%</p>
                  <p>Casualty Rate: {activeRoute.casualty_percentage}%</p>
                  <p>Aircraft Losses: {activeRoute.aircraft_losses}</p>
                  <p>Loss Count: {activeRoute.losses}</p>
                  <p>Distance: {activeRoute.distance_km} km</p>
                  <p>Time: {activeRoute.time_hours} hrs</p>
                  <p>Estimated Cost: {activeRoute.estimated_cost}</p>
                </div>
              </Panel>

              <Panel className="p-4">
                <p className="font-orbitron text-xs tracking-[0.3em] text-primary">WHY THIS ROUTE</p>
                <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                  <p>This approach keeps exposure lowest by shifting away from red cells and staying within safer corridors.</p>
                  <p>It balances mission tempo with survivability, providing a predictable risk envelope for the current loadout.</p>
                  <p>Use the selector above to compare risk, distance, and cost across all approaches.</p>
                </div>
              </Panel>
            </div>
          </ScrollArea>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default SimulationGridResults;
