import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type AircraftMaintenanceHistoryItem } from "@/lib/api";

type ComponentState = "Good" | "Warning" | "Critical";

type HealthMap = {
  engine: ComponentState;
  wings: ComponentState;
  avionics: ComponentState;
  fuel: ComponentState;
  landingGear: ComponentState;
};

interface Aircraft {
  id: string;
  name: string;
  model: string;
  assignedPilots: string[];
  componentStatus: Record<string, ComponentState>;
  openIssues: {
    id: number;
    aircraftId: string;
    component: string;
    severity: string;
    description?: string;
    status: string;
    createdAt: string;
  }[];
}

const defaultHealth: HealthMap = {
  engine: "Good",
  wings: "Good",
  avionics: "Good",
  fuel: "Good",
  landingGear: "Good",
};

interface Pilot {
  id: number;
  callSign: string;
  name: string;
}

const AircraftDetail = () => {
  const { id } = useParams();

  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [pilotOptions, setPilotOptions] = useState<Pilot[]>([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState<AircraftMaintenanceHistoryItem[]>([]);
  const [assignedPilot, setAssignedPilot] = useState("");
  const [health, setHealth] = useState<HealthMap>(defaultHealth);
  const [selectedPart, setSelectedPart] = useState<keyof HealthMap>("engine");

  const loadAircraft = () => {
    if (!id) {
      return;
    }

    api.getAircraftById(id).then((data: Aircraft) => {
      setAircraft(data);
      setAssignedPilot(data.assignedPilots[0] || "");
      setHealth({ ...defaultHealth, ...(data.componentStatus || {}) });
    });
  };

  const loadMaintenance = () => {
    if (!id) {
      return;
    }
    api.getAircraftMaintenanceHistory(id).then(setMaintenanceEntries);
  };

  useEffect(() => {
    loadAircraft();
    loadMaintenance();
    api.getPilots().then(setPilotOptions);
  }, [id]);

  const derivedStatus = useMemo(() => {
    if (!aircraft) {
      return "READY";
    }
    return aircraft.openIssues.length > 0 ? "NOT READY" : "READY";
  }, [aircraft]);

  const statusClass = useMemo(() => {
    const value = health[selectedPart];
    if (value === "Critical") {
      return "text-red-400";
    }
    if (value === "Warning") {
      return "text-amber-400";
    }
    return "text-green-400";
  }, [health, selectedPart]);

  const saveAircraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!aircraft) {
      return;
    }

    const updated = await api.updateAircraft(aircraft.id, {
      id: aircraft.id,
      name: aircraft.name,
      model: aircraft.model,
      healthStatus: aircraft.openIssues.length > 0 ? "MAINTENANCE" : "READY",
      lastMaintenance: undefined,
      assignedPilots: assignedPilot ? [assignedPilot] : [],
      missions: [],
    });

    setAircraft(updated);
    loadMaintenance();
  };

  if (!aircraft) {
    return (
      <BackgroundLayout>
        <PageHeader title="AIRCRAFT DETAILS" backTo="/aircraft" />
        <div className="p-6 font-rajdhani text-muted-foreground">Loading aircraft details...</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="AIRCRAFT DETAILS" backTo="/aircraft" />
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        <form onSubmit={saveAircraft} className="space-y-4 border border-border/40 bg-card/30 p-4 lg:col-span-2">
          <h2 className="font-orbitron text-sm text-primary">{aircraft.name}</h2>
          <p className="font-rajdhani text-sm text-muted-foreground">Aircraft ID: <span className="text-primary">{aircraft.id}</span></p>

          <div className="grid grid-cols-1 gap-2">
            <label className="text-xs text-muted-foreground">Assigned Pilot
              <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={assignedPilot} onChange={(e) => setAssignedPilot(e.target.value)}>
                <option value="">Unassigned</option>
                {pilotOptions.map((pilot) => (
                  <option key={pilot.id} value={pilot.callSign}>{pilot.callSign} ({pilot.name})</option>
                ))}
              </select>
            </label>
            <p className="font-rajdhani text-sm text-muted-foreground">Status: <span className="text-primary">{derivedStatus}</span></p>
          </div>

          <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">SAVE AIRCRAFT</button>

          <div className="border border-border/30 bg-background/20 p-3">
            <p className="mb-2 font-orbitron text-[0.7rem] tracking-[0.18em] text-muted-foreground">OPEN ISSUES</p>
            {aircraft.openIssues?.length ? (
              <div className="space-y-1">
                {aircraft.openIssues.map((issue) => (
                  <p key={issue.id} className="font-rajdhani text-xs text-amber-300">
                    {issue.component}: {issue.severity} ({issue.status})
                  </p>
                ))}
              </div>
            ) : (
              <p className="font-rajdhani text-xs text-muted-foreground">No open issues.</p>
            )}
          </div>
        </form>

        <div className="space-y-4 border border-border/40 bg-card/30 p-4">
          <h3 className="font-orbitron text-xs tracking-[0.18em] text-muted-foreground">2D BLUEPRINT INDICATOR</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <button type="button" onClick={() => setSelectedPart("wings")} className="border border-border/30 p-2 font-rajdhani text-xs">Wings</button>
            <button type="button" onClick={() => setSelectedPart("engine")} className="border border-border/30 p-2 font-rajdhani text-xs">Engine</button>
            <button type="button" onClick={() => setSelectedPart("landingGear")} className="border border-border/30 p-2 font-rajdhani text-xs">Landing Gear</button>
            <button type="button" onClick={() => setSelectedPart("fuel")} className="border border-border/30 p-2 font-rajdhani text-xs">Fuel</button>
            <button type="button" onClick={() => setSelectedPart("avionics")} className="col-span-2 border border-border/30 p-2 font-rajdhani text-xs">Avionics</button>
          </div>

          <p className="font-rajdhani text-sm text-muted-foreground">Selected: <span className="text-primary">{selectedPart}</span></p>
          <p className={`font-rajdhani text-sm ${statusClass}`}>Status: {health[selectedPart]}</p>
          <p className="font-rajdhani text-xs text-muted-foreground">Live status shown from aircraft component map.</p>
        </div>

        <div className="space-y-3 border border-border/40 bg-card/30 p-4 lg:col-span-3">
          <p className="font-orbitron text-xs tracking-[0.2em] text-primary">MAINTENANCE HISTORY</p>
          {maintenanceEntries.length === 0 && <p className="text-sm text-muted-foreground">No maintenance history for this aircraft.</p>}
          {maintenanceEntries.map((entry) => (
            <div key={entry.id} className="space-y-1 border border-border/40 bg-background/20 p-3">
              <p className="font-rajdhani text-sm text-primary">{entry.logType.replace(/_/g, " ")}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">{entry.createdAt}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">{entry.summary || "No summary"}</p>
            </div>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftDetail;
