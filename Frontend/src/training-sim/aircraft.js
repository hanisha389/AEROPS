const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const createAircraftState = (baseLocation) => ({
  lat: baseLocation.lat,
  lng: baseLocation.lng,
  speed: 0,
  heading: 90,
  altitude: 0,
  commandQueue: [],
  currentCommand: null,
});

export const createPilotState = () => ({
  gImpact: 1,
  heartRate: 74,
  stress: 12,
  fatigue: 6,
});

export const updateAircraftByCommand = (aircraft, dtSec) => {
  let turnRate = 0;
  let acceleration = 0;
  let climbRate = 0;

  if (aircraft.currentCommand) {
    switch (aircraft.currentCommand.type) {
      case "TAKEOFF":
        acceleration = aircraft.currentCommand.value;
        if (aircraft.speed > 125) {
          climbRate = 11;
        }
        break;
      case "INCREASE_SPEED":
        acceleration = aircraft.currentCommand.value;
        break;
      case "TURN_LEFT":
        turnRate = -aircraft.currentCommand.value;
        break;
      case "TURN_RIGHT":
        turnRate = aircraft.currentCommand.value;
        break;
      case "CLIMB":
        climbRate = aircraft.currentCommand.value;
        break;
      case "HOLD":
      default:
        break;
    }

    aircraft.currentCommand.remaining -= dtSec;
    if (aircraft.currentCommand.remaining <= 0) {
      aircraft.currentCommand = null;
    }
  }

  if (acceleration === 0 && aircraft.speed > 110) {
    acceleration = -0.8;
  }

  aircraft.speed = clamp(aircraft.speed + acceleration * dtSec, 0, 420);
  aircraft.heading = (aircraft.heading + turnRate * dtSec + 360) % 360;

  if (climbRate === 0 && aircraft.altitude > 0 && aircraft.speed < 100) {
    climbRate = -7;
  }
  aircraft.altitude = clamp(aircraft.altitude + climbRate * dtSec, 0, 12000);

  const metersPerSecond = aircraft.speed * 0.514444;
  const distanceMeters = metersPerSecond * dtSec;
  const headingRad = (aircraft.heading * Math.PI) / 180;
  const latRad = (aircraft.lat * Math.PI) / 180;

  aircraft.lat += (distanceMeters * Math.cos(headingRad)) / 111320;
  aircraft.lng += (distanceMeters * Math.sin(headingRad)) / (111320 * Math.max(0.2, Math.cos(latRad)));

  const gImpact = clamp(1 + Math.abs(turnRate) / 7 + Math.max(0, aircraft.speed - 180) / 180, 1, 6.5);

  return {
    turnRate,
    gImpact,
  };
};

export const updatePilotVitals = (pilotState, gImpact, dtSec) => {
  const stressDelta = (gImpact - 1) * 10 * dtSec;
  const fatigueDelta = (gImpact - 1) * 0.35 * dtSec;

  pilotState.stress = clamp(pilotState.stress + stressDelta - 0.45 * dtSec, 0, 100);
  pilotState.fatigue = clamp(pilotState.fatigue + fatigueDelta, 0, 100);

  const targetHeartRate = 72 + pilotState.stress * 0.85 + (gImpact - 1) * 22;
  pilotState.heartRate += (targetHeartRate - pilotState.heartRate) * Math.min(1, dtSec * 2.2);
  pilotState.heartRate = clamp(pilotState.heartRate, 60, 205);

  pilotState.gImpact = gImpact;
};
