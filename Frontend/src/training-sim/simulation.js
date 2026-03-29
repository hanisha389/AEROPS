import { createAircraftState, createPilotState, updateAircraftByCommand, updatePilotVitals } from "@/training-sim/aircraft";
import { createTelemetryStore, pushTelemetrySample } from "@/training-sim/telemetry";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const createSimulationEngine = ({
  initialLocation,
  onFrame,
  onTelemetry,
  onCommandChange,
}) => {
  const aircraft = createAircraftState(initialLocation);
  const pilot = createPilotState();
  const telemetry = createTelemetryStore();

  let rafId = null;
  let running = false;
  let elapsed = 0;
  let lastTs = 0;
  let activeCommandRecord = null;
  let commandHistory = [];

  const ensureCurrentCommand = () => {
    if (!aircraft.currentCommand && aircraft.commandQueue.length > 0) {
      aircraft.currentCommand = aircraft.commandQueue.shift() || null;
      if (aircraft.currentCommand) {
        activeCommandRecord = {
          id: aircraft.currentCommand.id,
          type: aircraft.currentCommand.type,
          origin: aircraft.currentCommand.origin || "manual",
          startedAt: elapsed,
          durationSec: aircraft.currentCommand.duration,
          value: aircraft.currentCommand.value,
        };
        commandHistory.push(activeCommandRecord);
      }
      if (onCommandChange) {
        onCommandChange(aircraft.currentCommand, [...aircraft.commandQueue]);
      }
    }
  };

  const step = (dtSec) => {
    ensureCurrentCommand();

    const hadCommand = Boolean(aircraft.currentCommand);
    const result = updateAircraftByCommand(aircraft, dtSec);
    updatePilotVitals(pilot, result.gImpact, dtSec);

    if (hadCommand && !aircraft.currentCommand && onCommandChange) {
      if (activeCommandRecord && activeCommandRecord.endedAt == null) {
        activeCommandRecord.endedAt = elapsed;
      }
      activeCommandRecord = null;
      onCommandChange(null, [...aircraft.commandQueue]);
    }

    elapsed += dtSec;

    telemetry.sampleAccumulator += dtSec;
    if (telemetry.sampleAccumulator >= 0.25) {
      telemetry.sampleAccumulator = 0;
      const sample = {
        time: elapsed,
        speed: aircraft.speed,
        altitude: aircraft.altitude,
        heading: aircraft.heading,
        gImpact: pilot.gImpact,
        heartRate: pilot.heartRate,
        stress: pilot.stress,
        fatigue: pilot.fatigue,
      };
      pushTelemetrySample(telemetry, sample);
      if (onTelemetry) {
        onTelemetry(sample, telemetry.points);
      }
    }

    if (onFrame) {
      onFrame({
        elapsed,
        aircraft: { ...aircraft, commandQueue: [...aircraft.commandQueue] },
        pilot: { ...pilot },
      });
    }
  };

  const frame = (ts) => {
    if (!running) {
      return;
    }

    if (!lastTs) {
      lastTs = ts;
    }

    const dtSec = clamp((ts - lastTs) / 1000, 0, 0.1);
    lastTs = ts;

    step(dtSec);
    rafId = window.requestAnimationFrame(frame);
  };

  return {
    start() {
      if (running) {
        return;
      }
      running = true;
      lastTs = 0;
      rafId = window.requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      if (activeCommandRecord && activeCommandRecord.endedAt == null) {
        activeCommandRecord.endedAt = elapsed;
      }
      rafId = null;
      lastTs = 0;
    },
    reset(baseLocation) {
      this.stop();
      aircraft.lat = baseLocation.lat;
      aircraft.lng = baseLocation.lng;
      aircraft.speed = 0;
      aircraft.heading = 90;
      aircraft.altitude = 0;
      aircraft.commandQueue = [];
      aircraft.currentCommand = null;
      pilot.gImpact = 1;
      pilot.heartRate = 74;
      pilot.stress = 12;
      pilot.fatigue = 6;
      elapsed = 0;
      telemetry.points = [];
      telemetry.sampleAccumulator = 0;
      activeCommandRecord = null;
      commandHistory = [];
      if (onCommandChange) {
        onCommandChange(null, []);
      }
      if (onFrame) {
        onFrame({
          elapsed,
          aircraft: { ...aircraft, commandQueue: [] },
          pilot: { ...pilot },
        });
      }
    },
    enqueue(command) {
      if (!command) {
        return;
      }
      aircraft.commandQueue.push({ ...command });
      if (onCommandChange) {
        onCommandChange(aircraft.currentCommand, [...aircraft.commandQueue]);
      }
    },
    getSnapshot() {
      return {
        elapsed,
        aircraft: { ...aircraft, commandQueue: [...aircraft.commandQueue] },
        pilot: { ...pilot },
        telemetry: [...telemetry.points],
        commandHistory: [...commandHistory],
      };
    },
    isRunning() {
      return running;
    },
  };
};
