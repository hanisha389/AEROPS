import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip } from "react-leaflet";
import { useLocation, useNavigate } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { type SimulationRunResponse } from "@/lib/api";
import "leaflet/dist/leaflet.css";

const toPositions = (points: { lat: number; lng: number }[]) =>
  points.map((point) => [point.lat, point.lng] as [number, number]);

const formatCoord = (point: { lat: number; lng: number }) => `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;

const formatTime = (seconds: number | null | undefined) => {
  if (seconds == null) {
    return "N/A";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
};

const SimulationRun = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const simulation = (location.state as { simulation?: SimulationRunResponse } | undefined)?.simulation;

  useEffect(() => {
    if (!simulation) {
      navigate("/simulation", { replace: true });
    }
  }, [navigate, simulation]);

  const timeline = useMemo(() => simulation?.timeline ?? [], [simulation]);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    setStepIndex(0);
  }, [simulation]);

  useEffect(() => {
    if (!timeline.length) {
      return undefined;
    }
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev + 1) % timeline.length);
    }, 600);
    return () => clearInterval(interval);
  }, [timeline]);

  if (!simulation) {
    return null;
  }

  const currentStep = timeline[stepIndex] ?? null;
  const mapCenter = currentStep
    ? [currentStep.aircraftPosition.lat, currentStep.aircraftPosition.lng]
    : [simulation.interceptLocation.lat, simulation.interceptLocation.lng];

  const liveMetrics = [
    {
      label: "Distance to Target",
      value: `${currentStep ? currentStep.distanceToTarget.toFixed(2) : "0.00"} km`,
    },
    {
      label: "Time Elapsed",
      value: formatTime(currentStep?.timeSeconds),
    },
    {
      label: "Fuel Remaining",
      value: `${currentStep ? currentStep.fuelRemaining.toFixed(1) : 100.0}%`,
    },
    {
      label: "Aircraft Speed",
      value: `${currentStep ? currentStep.aircraftSpeedKmh.toFixed(1) : 0} km/h`,
    },
    {
      label: "Target Speed",
      value: `${currentStep ? currentStep.targetSpeedKmh.toFixed(1) : 0} km/h`,
    },
    {
      label: "Intercept Status",
      value: currentStep?.status.replace(/^[a-z]/, (char) => char.toUpperCase()) ?? "Pending",
    },
  ];

  const summaryStats = [
    {
      title: "Estimated Intercept Time",
      value: formatTime(simulation.finalResult.interceptTimeSeconds),
    },
    {
      title: "Current Efficiency Score",
      value: `${simulation.missionEfficiencyScore.toFixed(1)}%`,
    },
    {
      title: "Threat Exposure",
      value: `${simulation.metrics.threat.exposurePercentage.toFixed(1)}%`,
    },
    {
      title: "Mission Status",
      value: simulation.finalResult.status,
      tone:
        simulation.finalResult.status === "Success"
          ? "text-emerald-400"
          : simulation.finalResult.status === "Failed"
          ? "text-rose-400"
          : "text-amber-400",
    },
  ];

  const eventLog = simulation.eventLog;

  return (
    <BackgroundLayout>
      <PageHeader title="SIMULATION RUN" />
      <div className="space-y-6 px-4 pb-10">
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="rounded border border-border/40 bg-background/40 p-2">
            <p className="mb-3 font-orbitron text-xs tracking-[0.2em] text-primary">LIVE SIMULATION VIEW</p>
            <MapContainer center={mapCenter as [number, number]} zoom={5} scrollWheelZoom={false} dragging={false} className="h-[420px] w-full">
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {simulation.enemyRoute.length > 1 && (
                <Polyline positions={toPositions(simulation.enemyRoute)} pathOptions={{ color: "#ef4444", weight: 3, dashArray: "6 8" }} />
              )}
              {simulation.bestAircraftPath.length > 1 && (
                <Polyline positions={toPositions(simulation.bestAircraftPath)} pathOptions={{ color: "#38bdf8", weight: 4 }} />
              )}
              <CircleMarker
                center={[simulation.interceptLocation.lat, simulation.interceptLocation.lng]}
                radius={10}
                pathOptions={{ color: "#facc15", fillColor: "#facc15", fillOpacity: 1 }}
              >
                <Tooltip>Intercept Point</Tooltip>
              </CircleMarker>
              {currentStep && (
                <>
                  <CircleMarker
                    center={[currentStep.aircraftPosition.lat, currentStep.aircraftPosition.lng]}
                    radius={8}
                    pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 0.9 }}
                  >
                    <Tooltip>Friendly Aircraft</Tooltip>
                  </CircleMarker>
                  <CircleMarker
                    center={[currentStep.enemyPosition.lat, currentStep.enemyPosition.lng]}
                    radius={7}
                    pathOptions={{ color: "#ef4444", fillColor: "#ef4444", fillOpacity: 0.8 }}
                  >
                    <Tooltip>Enemy Target</Tooltip>
                  </CircleMarker>
                </>
              )}
            </MapContainer>
          </section>

          <section className="rounded border border-border/40 bg-background/30 p-4">
            <p className="font-orbitron text-xs tracking-[0.2em] text-primary">LIVE METRICS</p>
            <div className="mt-4 space-y-3">
              {liveMetrics.map((metric) => (
                <div key={metric.label} className="flex items-center justify-between rounded border border-border/50 bg-card/50 px-3 py-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{metric.label}</p>
                    <p className="mt-1 text-lg font-orbitron">{metric.value}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded border border-dashed border-primary/60 bg-primary/5 px-3 py-2 text-sm text-primary">
              <p>Mission Success Rate</p>
              <p className="font-orbitron text-2xl">{simulation.finalResult.successRatePercent.toFixed(1)}%</p>
            </div>
          </section>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {summaryStats.map((stat) => (
            <article key={stat.title} className="rounded border border-border/40 bg-card/60 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{stat.title}</p>
              <p className={`mt-2 text-2xl font-orbitron ${stat.tone ?? "text-primary"}`}>{stat.value}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded border border-border/40 bg-background/30 p-4">
            <p className="font-orbitron text-xs tracking-[0.2em] text-primary">TRAJECTORY ANALYSIS</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Total Distance Traveled: {simulation.metrics.trajectory.totalDistanceKm.toFixed(2)} km</p>
              <p>Path Deviation: {simulation.metrics.trajectory.pathDeviationKm.toFixed(2)} km</p>
              <p>Intercept Point: {formatCoord(simulation.metrics.trajectory.interceptPoint)}</p>
              <p>Intercept Time: {formatTime(simulation.metrics.trajectory.interceptTimeSeconds)}</p>
            </div>
          </section>

          <section className="rounded border border-border/40 bg-background/30 p-4">
            <p className="font-orbitron text-xs tracking-[0.2em] text-primary">FUEL ANALYSIS</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Consumption Rate: {simulation.metrics.fuel.fuelConsumptionRatePerHour.toFixed(2)}% / hr</p>
              <p>Remaining Range: {simulation.metrics.fuel.remainingRangeKm.toFixed(2)} km</p>
              <p>Return Feasibility: {simulation.metrics.fuel.returnFeasibility.toFixed(1)}%</p>
            </div>
          </section>

          <section className="rounded border border-border/40 bg-background/30 p-4">
            <p className="font-orbitron text-xs tracking-[0.2em] text-primary">THREAT ANALYSIS</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Time in Enemy Airspace: {simulation.metrics.threat.timeInEnemyAirspaceSeconds.toFixed(1)} s</p>
              <p>Exposure %: {simulation.metrics.threat.exposurePercentage.toFixed(1)}%</p>
              <p>Enemy Strength Impact: {simulation.metrics.threat.enemyStrengthImpact.toFixed(1)}</p>
            </div>
          </section>

          <section className="rounded border border-border/40 bg-background/30 p-4">
            <p className="font-orbitron text-xs tracking-[0.2em] text-primary">PERFORMANCE ANALYSIS</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Pilot Efficiency: {simulation.metrics.performance.pilotEfficiency.toFixed(1)}%</p>
              <p>Weapon Readiness: {simulation.metrics.performance.weaponReadiness.toFixed(1)}%</p>
            </div>
          </section>
        </div>

        <section className="rounded border border-border/40 bg-background/30 p-4">
          <p className="font-orbitron text-xs tracking-[0.2em] text-primary">EVENT LOG</p>
          <div className="mt-3 space-y-2 text-sm text-muted-foreground">
            {eventLog.map((entry, index) => (
              <div key={`${entry.timeSeconds}-${index}`} className="flex items-center justify-between rounded border border-border/50 bg-card/30 px-3 py-2">
                <span className="font-orbitron text-xs text-primary">T+{entry.timeSeconds.toFixed(1)}s</span>
                <span>{entry.description}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </BackgroundLayout>
  );
};

export default SimulationRun;
