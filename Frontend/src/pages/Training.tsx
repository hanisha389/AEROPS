import { FormEvent, useEffect, useMemo, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

type TrainingType = "basic_maneuvers" | "one_v_one_dogfight" | "precision_bomb_drop";

interface PilotOption {
  id: number;
  name: string;
  callSign: string;
  assignedAircraft?: string | null;
}

interface AircraftOption {
  id: string;
  name: string;
}

interface Debrief {
  trainingType: string;
  winnerPilotId?: number;
  events: { kind: string; message: string }[];
}

const trainingLabels: Record<TrainingType, string> = {
  basic_maneuvers: "Basic Maneuvers",
  one_v_one_dogfight: "1v1 Dogfight",
  precision_bomb_drop: "Precision Bomb Drop",
};

const Training = () => {
  const [trainingType, setTrainingType] = useState<TrainingType>("basic_maneuvers");
  const [pilotOptions, setPilotOptions] = useState<PilotOption[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [selectedPilots, setSelectedPilots] = useState<number[]>([]);
  const [selectedAircraft, setSelectedAircraft] = useState<string[]>([]);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [running, setRunning] = useState(false);

  const isBasicManeuvers = trainingType === "basic_maneuvers";
  const maxPilots = useMemo(() => (trainingType === "one_v_one_dogfight" ? 2 : 1), [trainingType]);
  const selectedPrimaryAircraft = selectedAircraft[0] ?? null;

  const pilotsForSelectedAircraft = useMemo(() => {
    if (!selectedPrimaryAircraft) {
      return [];
    }
    return pilotOptions.filter((pilot) => pilot.assignedAircraft === selectedPrimaryAircraft);
  }, [pilotOptions, selectedPrimaryAircraft]);

  useEffect(() => {
    api.getPilots().then(setPilotOptions);
    api.getAircrafts().then(setAircraftOptions);
  }, []);

  useEffect(() => {
    setSelectedPilots([]);
    setSelectedAircraft([]);
  }, [trainingType]);

  useEffect(() => {
    if (!isBasicManeuvers) {
      return;
    }
    if (pilotsForSelectedAircraft.length === 1) {
      setSelectedPilots([pilotsForSelectedAircraft[0].id]);
      return;
    }
    setSelectedPilots((prev) => prev.filter((id) => pilotsForSelectedAircraft.some((pilot) => pilot.id === id)).slice(0, 1));
  }, [isBasicManeuvers, pilotsForSelectedAircraft]);

  const togglePilot = (pilotId: number) => {
    setSelectedPilots((prev) => {
      if (prev.includes(pilotId)) {
        return prev.filter((id) => id !== pilotId);
      }
      if (prev.length >= maxPilots) {
        return [...prev.slice(1), pilotId];
      }
      return [...prev, pilotId];
    });
  };

  const toggleAircraft = (aircraftId: string) => {
    if (isBasicManeuvers) {
      setSelectedAircraft((prev) => (prev[0] === aircraftId ? [] : [aircraftId]));
      return;
    }
    setSelectedAircraft((prev) => {
      if (prev.includes(aircraftId)) {
        return prev.filter((id) => id !== aircraftId);
      }
      if (prev.length >= maxPilots) {
        return [...prev.slice(1), aircraftId];
      }
      return [...prev, aircraftId];
    });
  };

  const runTraining = async (event: FormEvent) => {
    event.preventDefault();

    if (isBasicManeuvers) {
      if (selectedAircraft.length !== 1) {
        window.alert("Select exactly one aircraft for Basic Maneuvers.");
        return;
      }
      if (selectedPilots.length !== 1) {
        window.alert("Select one assigned pilot for the selected aircraft.");
        return;
      }
    }

    if (selectedPilots.length !== maxPilots) {
      window.alert(`Select exactly ${maxPilots} pilot(s).`);
      return;
    }

    if (selectedAircraft.length === 0) {
      window.alert("Select at least one aircraft.");
      return;
    }

    setRunning(true);
    try {
      const response = await api.runTraining({
        trainingType,
        pilotIds: selectedPilots,
        aircraftIds: selectedAircraft,
      });
      setDebrief(response);
    } finally {
      setRunning(false);
    }
  };

  return (
    <BackgroundLayout>
      <PageHeader title="TRAINING" />
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        <form onSubmit={runTraining} className="space-y-4 border border-border/40 bg-card/30 p-4 lg:col-span-2">
          <h2 className="font-orbitron text-sm text-primary">START TRAINING DRILL</h2>

          <div>
            <p className="mb-2 font-rajdhani text-xs text-muted-foreground">Training Type</p>
            <select className="w-full border border-border bg-background/40 px-3 py-2" value={trainingType} onChange={(e) => setTrainingType(e.target.value as TrainingType)}>
              <option value="basic_maneuvers">Basic Maneuvers</option>
              <option value="one_v_one_dogfight">1v1 Dogfight</option>
              <option value="precision_bomb_drop">Precision Bomb Drop</option>
            </select>
          </div>

          {!isBasicManeuvers && (
            <div>
              <p className="mb-2 font-rajdhani text-xs text-muted-foreground">Select Pilot(s)</p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {pilotOptions.map((pilot) => {
                  const checked = selectedPilots.includes(pilot.id);
                  return (
                    <label key={pilot.id} className={`flex cursor-pointer items-center justify-between border px-3 py-2 ${checked ? "border-primary bg-primary/10" : "border-border/40"}`}>
                      <span className="font-rajdhani text-sm">{pilot.callSign} ({pilot.name})</span>
                      <input type="checkbox" checked={checked} onChange={() => togglePilot(pilot.id)} />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 font-rajdhani text-xs text-muted-foreground">{isBasicManeuvers ? "Select Aircraft (Required)" : "Select Aircraft"}</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {aircraftOptions.map((aircraft) => {
                const checked = selectedAircraft.includes(aircraft.id);
                return (
                  <label key={aircraft.id} className={`flex cursor-pointer items-center justify-between border px-3 py-2 ${checked ? "border-primary bg-primary/10" : "border-border/40"}`}>
                    <span className="font-rajdhani text-sm">{aircraft.id} ({aircraft.name})</span>
                    <input type="checkbox" checked={checked} onChange={() => toggleAircraft(aircraft.id)} />
                  </label>
                );
              })}
            </div>
          </div>

          {isBasicManeuvers && selectedPrimaryAircraft && (
            <div>
              <p className="mb-2 font-rajdhani text-xs text-muted-foreground">Assigned Pilot</p>
              {pilotsForSelectedAircraft.length === 0 && (
                <p className="border border-border/40 bg-background/30 px-3 py-2 font-rajdhani text-xs text-muted-foreground">
                  No pilot is assigned to the selected aircraft.
                </p>
              )}
              {pilotsForSelectedAircraft.length === 1 && (
                <p className="border border-primary/40 bg-primary/10 px-3 py-2 font-rajdhani text-sm text-primary">
                  Auto-selected: {pilotsForSelectedAircraft[0].callSign} ({pilotsForSelectedAircraft[0].name})
                </p>
              )}
              {pilotsForSelectedAircraft.length > 1 && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {pilotsForSelectedAircraft.map((pilot) => {
                    const checked = selectedPilots.includes(pilot.id);
                    return (
                      <label key={pilot.id} className={`flex cursor-pointer items-center justify-between border px-3 py-2 ${checked ? "border-primary bg-primary/10" : "border-border/40"}`}>
                        <span className="font-rajdhani text-sm">{pilot.callSign} ({pilot.name})</span>
                        <input
                          type="radio"
                          name="basic-maneuvers-pilot"
                          checked={checked}
                          onChange={() => setSelectedPilots([pilot.id])}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={running} className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">
            {running ? "RUNNING TRAINING..." : "COMPLETE TRAINING"}
          </button>
        </form>

        <div className="border border-border/40 bg-card/30 p-4">
          <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">DEBRIEF</h3>
          {!debrief && <p className="font-rajdhani text-sm text-muted-foreground">No training debrief yet.</p>}
          {debrief && (
            <div className="space-y-2">
              <p className="font-rajdhani text-sm text-primary">Drill: {trainingLabels[debrief.trainingType as TrainingType] || debrief.trainingType}</p>
              {debrief.winnerPilotId && <p className="font-rajdhani text-sm text-primary">Winner Pilot ID: {debrief.winnerPilotId}</p>}
              {debrief.events.map((entry, index) => (
                <p key={`${entry.kind}-${index}`} className="border border-border/30 bg-background/30 p-2 font-rajdhani text-xs text-muted-foreground">
                  {entry.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Training;
