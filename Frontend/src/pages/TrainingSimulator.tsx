import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type MapCoordinate } from "@/lib/api";
import { COMMAND_LABELS, createCommand } from "@/training-sim/commands";
import { createTrainingMap } from "@/training-sim/map";
import { createSimulationEngine } from "@/training-sim/simulation";
import { createTelemetryCharts } from "@/training-sim/ui";
import "leaflet/dist/leaflet.css";

const DEBRIEF_KEY = "aerops-training-step2-debrief";

interface SimulatorContext {
  selectedPilotIds?: number[];
  selectedAircraftIds?: string[];
  duration?: string;
  notes?: string;
  trainingType?: string;
}

const FALLBACK_BASE: MapCoordinate = { lat: 26.988, lng: 75.875 };

const commandOrder = ["TAKEOFF", "INCREASE_SPEED", "TURN_LEFT", "TURN_RIGHT", "CLIMB", "HOLD"] as const;
const plannedCommandSequence: (typeof commandOrder)[number][] = [
  "TAKEOFF",
  "INCREASE_SPEED",
  "CLIMB",
  "TURN_LEFT",
  "HOLD",
  "INCREASE_SPEED",
  "TURN_RIGHT",
  "HOLD",
  "CLIMB",
];

const TrainingSimulator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const context = (location.state as SimulatorContext | undefined) || {};

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const speedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const altitudeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const headingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const mapControllerRef = useRef<any>(null);
  const chartControllerRef = useRef<any>(null);
  const engineRef = useRef<any>(null);

  const [baseLocation, setBaseLocation] = useState<MapCoordinate>(FALLBACK_BASE);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);

  const [aircraftState, setAircraftState] = useState({
    lat: FALLBACK_BASE.lat,
    lng: FALLBACK_BASE.lng,
    speed: 0,
    heading: 90,
    altitude: 0,
    currentCommand: null as any,
    commandQueue: [] as any[],
  });

  const [pilotState, setPilotState] = useState({
    gImpact: 1,
    heartRate: 74,
    stress: 12,
    fatigue: 6,
  });

  const [elapsed, setElapsed] = useState(0);

  const enqueuePlannedPath = (engine: any) => {
    plannedCommandSequence.forEach((type) => {
      const command = createCommand(type);
      if (command) {
        engine.enqueue({ ...command, origin: "planned" });
      }
    });
  };

  useEffect(() => {
    let mounted = true;
    api.getSimulationBase()
      .then((locationValue) => {
        if (!mounted) {
          return;
        }
        setBaseLocation(locationValue);
      })
      .catch(() => {
        if (!mounted) {
          return;
        }
        setBaseLocation(FALLBACK_BASE);
      })
      .finally(() => {
        if (mounted) {
          setLoaded(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loaded || !mapContainerRef.current || !speedCanvasRef.current || !altitudeCanvasRef.current || !headingCanvasRef.current) {
      return;
    }

    const mapController = createTrainingMap(mapContainerRef.current, baseLocation);
    mapControllerRef.current = mapController;

    const chartController = createTelemetryCharts({
      speedCanvas: speedCanvasRef.current,
      altitudeCanvas: altitudeCanvasRef.current,
      headingCanvas: headingCanvasRef.current,
    });
    chartControllerRef.current = chartController;

    const engine = createSimulationEngine({
      initialLocation: baseLocation,
      onFrame: (frame: any) => {
        mapController.updateAircraft(frame.aircraft, frame.aircraft.heading);
        mapController.appendPath(frame.aircraft);
        setAircraftState(frame.aircraft);
        setPilotState(frame.pilot);
        setElapsed(frame.elapsed);
      },
      onTelemetry: (sample: any) => {
        chartControllerRef.current?.push(sample);
      },
      onCommandChange: (currentCommand: any, commandQueue: any[]) => {
        setAircraftState((prev) => ({
          ...prev,
          currentCommand,
          commandQueue,
        }));
      },
    });

    engineRef.current = engine;
    enqueuePlannedPath(engine);
    engine.start();
    setRunning(true);

    return () => {
      engine.stop();
      chartController.destroy();
      chartControllerRef.current = null;
      mapController.destroy();
      mapControllerRef.current = null;
      engineRef.current = null;
    };
  }, [loaded, baseLocation]);

  const pushCommand = (type: (typeof commandOrder)[number]) => {
    const command = createCommand(type);
    if (!engineRef.current || !command) {
      return;
    }
    engineRef.current.enqueue({ ...command, origin: "manual" });
  };

  const resetSimulation = () => {
    if (!engineRef.current || !mapControllerRef.current) {
      return;
    }
    engineRef.current.reset(baseLocation);
    mapControllerRef.current.resetPath(baseLocation);
    enqueuePlannedPath(engineRef.current);
    setElapsed(0);
    setRunning(false);

    if (chartControllerRef.current) {
      chartControllerRef.current.destroy();
    }

    if (!speedCanvasRef.current || !altitudeCanvasRef.current || !headingCanvasRef.current) {
      chartControllerRef.current = null;
      return;
    }

    chartControllerRef.current = createTelemetryCharts({
      speedCanvas: speedCanvasRef.current,
      altitudeCanvas: altitudeCanvasRef.current,
      headingCanvas: headingCanvasRef.current,
    });
  };

  const startSimulation = () => {
    if (!engineRef.current) {
      return;
    }
    if (!engineRef.current.isRunning()) {
      engineRef.current.start();
    }
    if (aircraftState.altitude <= 1 && aircraftState.speed < 20) {
      const takeoff = createCommand("TAKEOFF");
      if (takeoff) {
        engineRef.current.enqueue({ ...takeoff, origin: "planned" });
      }
    }
    setRunning(true);
  };

  const finishAndReturn = () => {
    if (!engineRef.current) {
      navigate("/training");
      return;
    }

    const snapshot = engineRef.current.getSnapshot();
    engineRef.current.stop();

    const telemetry = Array.isArray(snapshot.telemetry) ? snapshot.telemetry : [];
    const commandHistory = Array.isArray(snapshot.commandHistory) ? snapshot.commandHistory : [];

    const peakG = telemetry.reduce((max: number, item: any) => Math.max(max, Number(item?.gImpact || 0)), Number(snapshot.pilot?.gImpact || 0));
    const peakStress = telemetry.reduce((max: number, item: any) => Math.max(max, Number(item?.stress || 0)), Number(snapshot.pilot?.stress || 0));
    const peakHeartRate = telemetry.reduce((max: number, item: any) => Math.max(max, Number(item?.heartRate || 0)), Number(snapshot.pilot?.heartRate || 0));
    const peakFatigue = telemetry.reduce((max: number, item: any) => Math.max(max, Number(item?.fatigue || 0)), Number(snapshot.pilot?.fatigue || 0));

    const minSpeed = telemetry.length ? Math.min(...telemetry.map((item: any) => Number(item?.speed || 0))) : 0;
    const maxSpeed = telemetry.length ? Math.max(...telemetry.map((item: any) => Number(item?.speed || 0))) : 0;
    const avgSpeed = telemetry.length
      ? telemetry.reduce((sum: number, item: any) => sum + Number(item?.speed || 0), 0) / telemetry.length
      : 0;
    const maxAltitude = telemetry.length ? Math.max(...telemetry.map((item: any) => Number(item?.altitude || 0))) : 0;
    const avgAltitude = telemetry.length
      ? telemetry.reduce((sum: number, item: any) => sum + Number(item?.altitude || 0), 0) / telemetry.length
      : 0;
    const minHeading = telemetry.length ? Math.min(...telemetry.map((item: any) => Number(item?.heading || 0))) : 0;
    const maxHeading = telemetry.length ? Math.max(...telemetry.map((item: any) => Number(item?.heading || 0))) : 0;

    const actionSummary = commandHistory.length
      ? commandHistory.slice(0, 18).map((entry: any) => {
        const start = Number(entry?.startedAt || 0).toFixed(1);
        const end = Number((entry?.endedAt ?? snapshot.elapsed) || 0).toFixed(1);
        const origin = entry?.origin === "planned" ? "AUTO" : "MANUAL";
        return `${origin} ${entry?.type || "UNKNOWN"} (${start}s -> ${end}s)`;
      })
      : ["AUTO HOLD pattern executed with low manual interaction."];

    const debrief = {
      duration: context.duration || `${Math.max(1, Math.round(snapshot.elapsed / 60))} min`,
      outcome: "Completed",
      notes: context.notes?.trim() || `Simulator complete. Peak G ${snapshot.pilot.gImpact.toFixed(1)}, stress ${snapshot.pilot.stress.toFixed(0)}%.`,
      elapsedSeconds: Number(snapshot.elapsed || 0),
      peakG: Number(peakG.toFixed(2)),
      peakStress: Number(peakStress.toFixed(1)),
      peakHeartRate: Number(peakHeartRate.toFixed(0)),
      peakFatigue: Number(peakFatigue.toFixed(1)),
      source: "simulator",
      plannedPath: plannedCommandSequence,
      actionSummary,
      telemetrySummary: {
        speedMin: Number(minSpeed.toFixed(1)),
        speedAvg: Number(avgSpeed.toFixed(1)),
        speedMax: Number(maxSpeed.toFixed(1)),
        altitudeAvg: Number(avgAltitude.toFixed(0)),
        altitudeMax: Number(maxAltitude.toFixed(0)),
        headingRange: `${minHeading.toFixed(0)}-${maxHeading.toFixed(0)}`,
      },
    };

    sessionStorage.setItem(DEBRIEF_KEY, JSON.stringify(debrief));
    navigate("/training", { replace: false });
  };

  return (
    <BackgroundLayout>
      <PageHeader title="TRAINING SIMULATOR" />
      <div className="space-y-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <section className="rounded border border-border/40 bg-background/20 p-3">
            <p className="mb-2 font-orbitron text-xs tracking-[0.16em] text-primary">MAP VIEW (AIRBASE + RUNWAY + AIRCRAFT)</p>
            <div ref={mapContainerRef} className="h-[420px] w-full rounded border border-border/40" />
            <p className="mt-2 text-xs text-muted-foreground">
              Base: {baseLocation.lat.toFixed(4)}, {baseLocation.lng.toFixed(4)}
            </p>
          </section>

          <section className="rounded border border-border/40 bg-background/20 p-3">
            <p className="mb-2 font-orbitron text-xs tracking-[0.16em] text-primary">RADIO COMMANDS</p>
            <div className="grid grid-cols-2 gap-2">
              {commandOrder.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => pushCommand(type)}
                  className="rounded border border-primary/50 px-2 py-2 text-xs text-primary hover:bg-primary/10"
                >
                  {COMMAND_LABELS[type]}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startSimulation}
                className="rounded border border-primary px-3 py-1 text-xs text-primary"
              >
                {running ? "Running" : "Start"}
              </button>
              <button
                type="button"
                onClick={resetSimulation}
                className="rounded border border-border px-3 py-1 text-xs text-muted-foreground"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={finishAndReturn}
                className="rounded border border-emerald-500 px-3 py-1 text-xs text-emerald-400"
              >
                End & Return
              </button>
            </div>

            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <p>Training Type: {context.trainingType || "Maneuver"}</p>
              <p>Pilots: {(context.selectedPilotIds || []).join(", ") || "None"}</p>
              <p>Aircraft: {(context.selectedAircraftIds || []).join(", ") || "None"}</p>
              <p>Current Command: {aircraftState.currentCommand?.type || "None"}</p>
              <p>Queued Commands: {aircraftState.commandQueue.length}</p>
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <section className="rounded border border-border/40 bg-background/20 p-3">
            <p className="mb-2 font-orbitron text-xs tracking-[0.16em] text-primary">LIVE SIMULATED DATA</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <p>Time: {elapsed.toFixed(1)} s</p>
              <p>Speed: {aircraftState.speed.toFixed(1)} kts</p>
              <p>Altitude: {aircraftState.altitude.toFixed(0)} m</p>
              <p>Heading: {aircraftState.heading.toFixed(0)} deg</p>
              <p>G Impact: {pilotState.gImpact.toFixed(2)} g</p>
              <p>Heart Rate: {pilotState.heartRate.toFixed(0)} bpm</p>
              <p>Stress: {pilotState.stress.toFixed(0)} %</p>
              <p>Fatigue: {pilotState.fatigue.toFixed(0)} %</p>
            </div>
          </section>

          <section className="rounded border border-border/40 bg-background/20 p-3">
            <p className="mb-2 font-orbitron text-xs tracking-[0.16em] text-primary">TELEMETRY GRAPHS (REAL-TIME)</p>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="h-48 rounded border border-border/30 p-2">
                <canvas ref={speedCanvasRef} />
              </div>
              <div className="h-48 rounded border border-border/30 p-2">
                <canvas ref={altitudeCanvasRef} />
              </div>
              <div className="h-48 rounded border border-border/30 p-2">
                <canvas ref={headingCanvasRef} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default TrainingSimulator;
