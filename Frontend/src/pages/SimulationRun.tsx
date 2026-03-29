import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { type MapCoordinate, type SimulationRunResponse, type SimulationStrategy } from "@/lib/api";
import "leaflet/dist/leaflet.css";

type StrategyName = "LOW_RISK" | "FUEL_EFFICIENT" | "COST_EFFICIENT";

const STRATEGY_LABELS: Record<StrategyName, string> = {
  LOW_RISK: "PLAN 1 - LEAST RISK",
  FUEL_EFFICIENT: "FUEL EFFICIENT",
  COST_EFFICIENT: "COST EFFICIENT",
};

const STRATEGY_DESCRIPTIONS: Record<StrategyName, string> = {
  LOW_RISK: "Plan 1 keeps the route farthest from enemy airspace and prioritizes survivability.",
  FUEL_EFFICIENT: "Plan 2 follows the shortest great-circle route for fuel-focused interception.",
  COST_EFFICIENT: "Plan 3 minimizes mission cost using operating cost and weapon expenditure.",
};

const PLAN_SEQUENCE: StrategyName[] = ["LOW_RISK", "FUEL_EFFICIENT", "COST_EFFICIENT"];

const toPositions = (points: MapCoordinate[]) => points.map((point) => [point.lat, point.lng] as [number, number]);

const toRadians = (value: number) => (value * Math.PI) / 180;
const toDegrees = (value: number) => (value * 180) / Math.PI;

const greatCirclePoint = (start: MapCoordinate, end: MapCoordinate, ratio: number): MapCoordinate => {
  if (ratio <= 0) return start;
  if (ratio >= 1) return end;

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

const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`;
const formatMoney = (value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const SimulationRun = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const simulation = (location.state as { simulation?: SimulationRunResponse } | undefined)?.simulation;

  useEffect(() => {
    if (!simulation) {
      navigate("/simulation", { replace: true });
    }
  }, [navigate, simulation]);

  const [selectedStrategyName, setSelectedStrategyName] = useState<StrategyName>("LOW_RISK");

  const strategies = useMemo(() => simulation?.strategies ?? [], [simulation]);

  useEffect(() => {
    if (!strategies.length) {
      setSelectedStrategyName("LOW_RISK");
      return;
    }
    if (!strategies.some((item) => item.name === selectedStrategyName)) {
      setSelectedStrategyName("LOW_RISK");
    }
  }, [selectedStrategyName, strategies]);

  if (!simulation) {
    return null;
  }

  const activeStrategy: SimulationStrategy | null =
    strategies.find((item) => item.name === selectedStrategyName) ?? strategies[0] ?? null;

  const aircraftPath = geodesicInterpolatePath(activeStrategy?.path ?? simulation.bestAircraftPath);
  const shipPath = geodesicInterpolatePath(simulation.enemyRoute);
  const activeInterceptPoint: MapCoordinate =
    activeStrategy?.path[activeStrategy.path.length - 1] ?? simulation.interceptLocation;

  const mapCenter: [number, number] = aircraftPath.length
    ? [aircraftPath[Math.floor(aircraftPath.length / 2)].lat, aircraftPath[Math.floor(aircraftPath.length / 2)].lng]
    : [simulation.interceptLocation.lat, simulation.interceptLocation.lng];

  return (
    <BackgroundLayout>
      <PageHeader title="SIMULATION RUN" />
      <div className="space-y-5 px-4 pb-10">
        <section className="rounded border border-border/40 bg-background/30 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {PLAN_SEQUENCE.map((name, index) => (
              <button
                key={name}
                type="button"
                onClick={() => setSelectedStrategyName(name)}
                className={`border px-3 py-1 font-orbitron text-[0.65rem] ${selectedStrategyName === name ? "border-primary text-primary" : "border-border/50 text-muted-foreground"}`}
              >
                {`PLAN ${index + 1} - ${name === "LOW_RISK" ? "LOW RISK" : name === "FUEL_EFFICIENT" ? "FUEL" : "COST"}`}
              </button>
            ))}
          </div>
          <MapContainer center={mapCenter} zoom={5} scrollWheelZoom={false} className="h-[430px] w-full">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {shipPath.length > 1 && (
              <Polyline positions={toPositions(shipPath)} pathOptions={{ color: "#ef4444", weight: 3, dashArray: "6 8" }}>
                <Tooltip>Target Route</Tooltip>
              </Polyline>
            )}
            {aircraftPath.length > 1 && (
              <Polyline positions={toPositions(aircraftPath)} pathOptions={{ color: "#38bdf8", weight: 4 }}>
                <Tooltip>Aircraft Route</Tooltip>
              </Polyline>
            )}
            <CircleMarker
              center={[activeInterceptPoint.lat, activeInterceptPoint.lng]}
              radius={8}
              pathOptions={{ color: "#facc15", fillColor: "#facc15", fillOpacity: 1 }}
            >
              <Tooltip>Intercept Point</Tooltip>
            </CircleMarker>
          </MapContainer>
        </section>

        {activeStrategy && (
          <>
            <section className="rounded border border-border/40 bg-background/30 p-4">
              <p className="font-orbitron text-xs tracking-[0.2em] text-primary">STRATEGY INFO</p>
              <p className="mt-2 text-sm text-primary">{STRATEGY_LABELS[activeStrategy.name]}</p>
              <p className="mt-1 text-sm text-muted-foreground">{STRATEGY_DESCRIPTIONS[activeStrategy.name]}</p>
            </section>

            <section className="rounded border border-border/40 bg-background/30 p-4">
              <p className="font-orbitron text-xs tracking-[0.2em] text-primary">TRAJECTORY ANALYSIS</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Distance: {activeStrategy.raw_metrics.distance_km.toFixed(2)} km</p>
                <p>Time: {(activeStrategy.raw_metrics.time_hours * 60).toFixed(2)} min</p>
                <p>Fuel Usage: {activeStrategy.raw_metrics.fuel_used.toFixed(2)}</p>
                <p>Mission Cost: {formatMoney(activeStrategy.raw_metrics.mission_cost)}</p>
                <p>Risk: {formatPercent(activeStrategy.metrics.risk)}</p>
                <p>Aircraft Score: {activeStrategy.raw_metrics.aircraft_score.toFixed(1)}</p>
                <p>Weapon Score: {activeStrategy.raw_metrics.weapon_score.toFixed(1)}</p>
                <p>Total Score: {activeStrategy.raw_metrics.total_score.toFixed(1)}</p>
                <p>Survival Probability: {formatPercent(activeStrategy.raw_metrics.survival_probability)}</p>
              </div>
            </section>

            <section className="rounded border border-border/40 bg-background/30 p-4">
              <p className="font-orbitron text-xs tracking-[0.2em] text-primary">WHAT-IF ANALYSIS</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Interception - Return Probability: {formatPercent(activeStrategy.what_if.interception.return_probability)}</p>
                <p>Reinforcements - Return Probability: {formatPercent(activeStrategy.what_if.reinforcements.return_probability)}</p>
                <p>Bad Weather - Return Probability: {formatPercent(activeStrategy.what_if.bad_weather.return_probability)}</p>
                <p>Low Fuel - Return Probability: {formatPercent(activeStrategy.what_if.low_fuel.return_probability)}</p>
              </div>
            </section>

            <section className="rounded border border-border/40 bg-background/30 p-4">
              <p className="font-orbitron text-xs tracking-[0.2em] text-primary">TARGET AND SPEED PROFILE</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>Target: {simulation.targetProfile.targetType.replaceAll("_", " ")}</p>
                <p>Target Speed: {simulation.targetProfile.speedKmh.toFixed(1)} km/h</p>
                <p>Target Defense Level: {simulation.targetProfile.defenseLevel.toFixed(2)}</p>
              </div>
            </section>

            <section className="rounded border border-border/40 bg-background/30 p-4">
              <p className="font-orbitron text-xs tracking-[0.2em] text-primary">AIRCRAFT LOADOUT AND SURVIVABILITY</p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {simulation.aircraftLoadout.map((item) => (
                  <div key={item.aircraftId} className="border border-border/40 px-2 py-2">
                    <p className="text-primary">{item.aircraftId} - {item.aircraftName}</p>
                    <p>Final Weight: {item.totalWeightKg.toFixed(0)} kg</p>
                    <p>Payload Weight: {item.payloadWeightKg.toFixed(0)} / {item.ordnanceLimitKg.toFixed(0)} kg</p>
                    <p>Effective Speed: {item.effectiveSpeedKmh.toFixed(0)} km/h</p>
                    <p>Effective Range: {item.effectiveRangeKm.toFixed(0)} km</p>
                    <p>Total Score: {item.totalScore.toFixed(1)}</p>
                    <p>Survival Probability: {formatPercent(item.survivalProbability)}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </BackgroundLayout>
  );
};

export default SimulationRun;