export const COMMAND_PRESETS = {
  TAKEOFF: { type: "TAKEOFF", duration: 24, value: 4.6 },
  INCREASE_SPEED: { type: "INCREASE_SPEED", duration: 8, value: 5.2 },
  TURN_LEFT: { type: "TURN_LEFT", duration: 8, value: 8 },
  TURN_RIGHT: { type: "TURN_RIGHT", duration: 8, value: 8 },
  CLIMB: { type: "CLIMB", duration: 10, value: 16 },
  HOLD: { type: "HOLD", duration: 6, value: 0 },
};

export const COMMAND_LABELS = {
  TAKEOFF: "Takeoff",
  INCREASE_SPEED: "Increase Speed",
  TURN_LEFT: "Turn Left",
  TURN_RIGHT: "Turn Right",
  CLIMB: "Climb",
  HOLD: "Hold",
};

export const createCommand = (type) => {
  const preset = COMMAND_PRESETS[type];
  if (!preset) {
    return null;
  }
  return {
    ...preset,
    id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    remaining: preset.duration,
  };
};
