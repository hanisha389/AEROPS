import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

interface Aircraft {
  id: string;
  name: string;
  model: string;
  healthStatus?: string;
  lastMaintenance?: string;
  assignedPilots: string[];
  missionDetails: { name: string; notes?: string }[];
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

interface Pilot {
  id: number;
  callSign: string;
  name: string;
}

type ComponentState = "Good" | "Warning" | "Critical";

type HealthMap = {
  engine: ComponentState;
  wings: ComponentState;
  avionics: ComponentState;
  fuel: ComponentState;
  landingGear: ComponentState;
};

const defaultHealth: HealthMap = {
  engine: "Good",
  wings: "Good",
  avionics: "Warning",
  fuel: "Good",
  landingGear: "Good",
};

const AircraftDetail = () => {
  const { id } = useParams();
  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [pilotOptions, setPilotOptions] = useState<Pilot[]>([]);
  const [assignedPilotInput, setAssignedPilotInput] = useState("");
  const [missionInput, setMissionInput] = useState("");
  const [health, setHealth] = useState<HealthMap>(defaultHealth);
  const [selectedPart, setSelectedPart] = useState<keyof HealthMap>("engine");

  useEffect(() => {
    if (!id) return;
    api.getAircraftById(id).then((data: Aircraft) => {
      setAircraft(data);
      setAssignedPilotInput(data.assignedPilots.join(", "));
      setMissionInput(data.missionDetails.map((m) => m.name).join("\n"));
      if (data.componentStatus && Object.keys(data.componentStatus).length > 0) {
        setHealth({ ...defaultHealth, ...data.componentStatus });
      }
    });
    api.getPilots().then(setPilotOptions);
  }, [id]);

  const statusClass = useMemo(() => {
    const value = health[selectedPart];
    if (value === "Critical") return "text-red-400";
    if (value === "Warning") return "text-amber-400";
    return "text-green-400";
  }, [health, selectedPart]);

  const saveAircraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!aircraft) return;

    const assignedPilots = assignedPilotInput.split(",").map((item) => item.trim()).filter(Boolean);
    const missions = missionInput.split("\n").map((item) => item.trim()).filter(Boolean).map((name) => ({ name }));

    const updated = await api.updateAircraft(aircraft.id, {
      id: aircraft.id,
      name: aircraft.name,
      model: aircraft.model,
      healthStatus: `${selectedPart}:${health[selectedPart]}`,
      lastMaintenance: aircraft.lastMaintenance,
      assignedPilots,
      missions,
    });

    setAircraft(updated);
  };

  const reportIssue = () => {
    if (!aircraft) return;
    const componentStatus = health[selectedPart];
    if (componentStatus === "Good") {
      window.alert("Only Warning/Critical issues can be reported.");
      return;
    }

    window.alert("Issue logging is generated automatically by training debrief. Save aircraft status first.");
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

          <label className="block font-rajdhani text-xs text-muted-foreground">Assigned Pilots (comma separated)</label>
          <input className="w-full border border-border bg-background/40 px-3 py-2" value={assignedPilotInput} onChange={(e) => setAssignedPilotInput(e.target.value)} />

          <label className="block font-rajdhani text-xs text-muted-foreground">Missions (one per line)</label>
          <textarea className="min-h-32 w-full border border-border bg-background/40 px-3 py-2" value={missionInput} onChange={(e) => setMissionInput(e.target.value)} />

          <div className="text-xs text-muted-foreground">
            Pilot Call Sign Suggestions: {pilotOptions.map((pilot) => pilot.callSign).join(", ")}
          </div>

          <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">SAVE AIRCRAFT</button>
        </form>

        <div className="space-y-4 border border-border/40 bg-card/30 p-4">
          <h3 className="font-orbitron text-xs tracking-[0.18em] text-muted-foreground">2D BLUEPRINT STATUS</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <button type="button" onClick={() => setSelectedPart("wings")} className="border border-border/30 p-2 font-rajdhani text-xs">Wings</button>
            <button type="button" onClick={() => setSelectedPart("engine")} className="border border-border/30 p-2 font-rajdhani text-xs">Engine</button>
            <button type="button" onClick={() => setSelectedPart("landingGear")} className="border border-border/30 p-2 font-rajdhani text-xs">Landing Gear</button>
            <button type="button" onClick={() => setSelectedPart("fuel")} className="border border-border/30 p-2 font-rajdhani text-xs">Fuel</button>
            <button type="button" onClick={() => setSelectedPart("avionics")} className="col-span-2 border border-border/30 p-2 font-rajdhani text-xs">Avionics</button>
          </div>

          <p className="font-rajdhani text-sm text-muted-foreground">Selected: <span className="text-primary">{selectedPart}</span></p>
          <p className={`font-rajdhani text-sm ${statusClass}`}>Status: {health[selectedPart]}</p>

          <select
            className="w-full border border-border bg-background/40 px-3 py-2"
            value={health[selectedPart]}
            onChange={(e) => setHealth({ ...health, [selectedPart]: e.target.value as ComponentState })}
          >
            <option value="Good">Good</option>
            <option value="Warning">Warning</option>
            <option value="Critical">Critical</option>
          </select>

          <button type="button" onClick={reportIssue} className="w-full border border-amber-500 px-4 py-2 font-orbitron text-xs text-amber-300">
            REPORT ISSUE TO ENGINEERS
          </button>

          <div className="border border-border/30 bg-background/20 p-2">
            <p className="mb-1 font-orbitron text-[11px] tracking-[0.12em] text-muted-foreground">OPEN ISSUES</p>
            <div className="space-y-1">
              {aircraft.openIssues?.length ? aircraft.openIssues.map((issue) => (
                <p key={issue.id} className="font-rajdhani text-xs text-amber-300">
                  {issue.component}: {issue.severity} ({issue.status})
                </p>
              )) : <p className="font-rajdhani text-xs text-muted-foreground">No open issues.</p>}
            </div>
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftDetail;
