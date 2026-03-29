import { FormEvent, SyntheticEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type AircraftMaintenanceHistoryItem } from "@/lib/api";
import { getCurrentRole } from "@/lib/rbac";

type ComponentState = "Good" | "Warning" | "Critical";
type ComponentKey = "engine" | "wings" | "avionics" | "fuel" | "landingGear";

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

interface EngineerOption {
  id: number;
  name: string;
  employeeId: string;
  status: string;
  specialization: string;
}

const COMPONENT_KEYS: ComponentKey[] = ["engine", "wings", "landingGear", "fuel", "avionics"];

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  engine: "Engine",
  wings: "Wings",
  landingGear: "Landing Gear",
  fuel: "Fuel System",
  avionics: "Avionics",
};

const COMPONENT_MARKER_POSITIONS: Record<ComponentKey, { top: string; left: string }> = {
  engine: { top: "57%", left: "49%" },
  wings: { top: "49%", left: "33%" },
  landingGear: { top: "73%", left: "50%" },
  fuel: { top: "54%", left: "66%" },
  avionics: { top: "38%", left: "50%" },
};

const isAssignmentRole = (role: string) => role === "ADMIN_COMMANDER" || role === "ENGINEER";

const mapIssueSeverityToState = (severity: string): ComponentState => {
  const normalized = severity.toUpperCase();
  if (normalized === "HIGH" || normalized === "CRITICAL") {
    return "Critical";
  }
  if (normalized === "MEDIUM" || normalized === "WARNING") {
    return "Warning";
  }
  return "Good";
};

const mergeState = (current: ComponentState, next: ComponentState): ComponentState => {
  const rank = { Good: 0, Warning: 1, Critical: 2 };
  return rank[next] > rank[current] ? next : current;
};

const normalizeComponentKey = (value: string): ComponentKey | null => {
  const normalized = normalizeComponentName(value);
  if (normalized.includes("landing") || normalized.includes("gear")) {
    return "landingGear";
  }
  if (normalized.includes("avionic")) {
    return "avionics";
  }
  if (normalized.includes("engine")) {
    return "engine";
  }
  if (normalized.includes("wing")) {
    return "wings";
  }
  if (normalized.includes("fuel")) {
    return "fuel";
  }
  return null;
};

const componentStateClass = (value: ComponentState): string => {
  if (value === "Critical") {
    return "text-red-400";
  }
  if (value === "Warning") {
    return "text-amber-400";
  }
  return "text-green-400";
};

const componentMarkerClass = (value: ComponentState): string => {
  if (value === "Critical") {
    return "border-red-400 bg-red-500/70";
  }
  if (value === "Warning") {
    return "border-amber-400 bg-amber-400/70";
  }
  return "border-emerald-400 bg-emerald-500/60";
};

const normalizeComponentName = (value: string): string => value.toLowerCase().replace(/[\s_-]+/g, "");

const AircraftDetail = () => {
  const role = getCurrentRole();
  const canAssignIssues = isAssignmentRole(role);
  const { id } = useParams();

  const [aircraft, setAircraft] = useState<Aircraft | null>(null);
  const [pilotOptions, setPilotOptions] = useState<Pilot[]>([]);
  const [engineerOptions, setEngineerOptions] = useState<EngineerOption[]>([]);
  const [maintenanceEntries, setMaintenanceEntries] = useState<AircraftMaintenanceHistoryItem[]>([]);
  const [assignedPilot, setAssignedPilot] = useState("");
  const [selectedPart, setSelectedPart] = useState<keyof HealthMap>("engine");
  const [assignmentByIssue, setAssignmentByIssue] = useState<Record<number, string>>({});
  const [assigningIssueId, setAssigningIssueId] = useState<number | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);

  const loadAircraft = async () => {
    if (!id) {
      return;
    }

    const data: Aircraft = await api.getAircraftById(id);
    setAircraft(data);
    setAssignedPilot(data.assignedPilots[0] || "");
  };

  const loadMaintenance = async () => {
    if (!id) {
      return;
    }
    const rows = await api.getAircraftMaintenanceHistory(id);
    setMaintenanceEntries(rows);
  };

  const loadEngineers = async () => {
    if (!canAssignIssues) {
      setEngineerOptions([]);
      return;
    }
    const engineers = await api.getEngineers();
    setEngineerOptions(engineers);
  };

  useEffect(() => {
    void loadAircraft();
    void loadMaintenance();
    api.getPilots().then(setPilotOptions);
    void loadEngineers();
  }, [id, canAssignIssues]);

  const componentHealth = useMemo<HealthMap>(() => {
    const current: HealthMap = { ...defaultHealth, ...(aircraft?.componentStatus || {}) };
    for (const issue of aircraft?.openIssues || []) {
      const component = normalizeComponentKey(issue.component);
      if (!component) {
        continue;
      }
      current[component] = mergeState(current[component], mapIssueSeverityToState(issue.severity));
    }
    return current;
  }, [aircraft]);

  const openIssuesByComponent = useMemo(() => {
    const grouped: Record<ComponentKey, number> = {
      engine: 0,
      wings: 0,
      avionics: 0,
      fuel: 0,
      landingGear: 0,
    };
    for (const issue of aircraft?.openIssues || []) {
      const component = normalizeComponentKey(issue.component);
      if (component) {
        grouped[component] += 1;
      }
    }
    return grouped;
  }, [aircraft]);

  const derivedStatus = useMemo(() => {
    if (!aircraft) {
      return "READY";
    }
    return aircraft.openIssues.length > 0 ? "NOT READY" : "READY";
  }, [aircraft]);

  const statusClass = useMemo(() => {
    return componentStateClass(componentHealth[selectedPart]);
  }, [componentHealth, selectedPart]);

  const handleBlueprintImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") {
      return;
    }
    image.dataset.fallbackApplied = "true";
    image.src = "/aircraft.svg";
  };

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
    void loadMaintenance();
  };

  const assignIssue = async (issueId: number, issueAircraftId: string, currentStatus: string) => {
    if (!canAssignIssues) {
      return;
    }
    const selectedEngineer = assignmentByIssue[issueId];
    if (!selectedEngineer) {
      window.alert("Select an engineer before assigning this issue.");
      return;
    }

    setAssigningIssueId(issueId);
    setAssignmentMessage(null);
    try {
      await api.assignIssueToEngineer({
        issueId,
        aircraftId: issueAircraftId,
        engineerId: Number(selectedEngineer),
      });
      setAssignmentMessage(currentStatus === "Assigned" ? "Issue reassigned successfully." : "Issue assigned successfully.");
      await loadAircraft();
      await loadMaintenance();
    } finally {
      setAssigningIssueId(null);
    }
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
            {assignmentMessage && <p className="mb-2 text-xs text-primary">{assignmentMessage}</p>}
            {aircraft.openIssues?.length ? (
              <div className="space-y-2">
                {aircraft.openIssues.map((issue) => (
                  <div key={issue.id} className="space-y-1 border border-border/30 bg-background/20 p-2">
                    <p className="font-rajdhani text-xs text-amber-300">
                      {issue.component}: {issue.severity} ({issue.status})
                    </p>
                    {issue.description && <p className="font-rajdhani text-xs text-muted-foreground">{issue.description}</p>}
                    {canAssignIssues && (
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                        <select
                          className="border border-border bg-background/40 px-2 py-1 text-xs"
                          value={assignmentByIssue[issue.id] || ""}
                          onChange={(event) => {
                            const value = event.target.value;
                            setAssignmentByIssue((prev) => ({ ...prev, [issue.id]: value }));
                          }}
                        >
                          <option value="">Select engineer</option>
                          {engineerOptions.map((engineer) => (
                            <option key={engineer.id} value={String(engineer.id)}>
                              {engineer.employeeId} - {engineer.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => assignIssue(issue.id, issue.aircraftId, issue.status)}
                          disabled={assigningIssueId === issue.id}
                          className="border border-primary px-3 py-1 font-orbitron text-[0.65rem] text-primary disabled:opacity-60"
                        >
                          {assigningIssueId === issue.id ? "ASSIGNING..." : issue.status === "Assigned" ? "REASSIGN" : "ASSIGN"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-rajdhani text-xs text-muted-foreground">No open issues.</p>
            )}
          </div>
        </form>

        <div className="space-y-4 border border-border/40 bg-card/30 p-4">
          <h3 className="font-orbitron text-xs tracking-[0.18em] text-muted-foreground">2D BLUEPRINT INDICATOR</h3>
          <div className="relative border border-border/30 bg-background/20 p-3">
            <img
              src="/aircraft.svg"
              alt={`${aircraft.name} 2D blueprint indicator`}
              className="h-auto w-full object-contain"
              loading="lazy"
              onError={handleBlueprintImageError}
            />
            {COMPONENT_KEYS.map((component) => {
              const position = COMPONENT_MARKER_POSITIONS[component];
              const state = componentHealth[component];
              const hasIssue = openIssuesByComponent[component] > 0;
              return (
                <button
                  key={component}
                  type="button"
                  onClick={() => setSelectedPart(component)}
                  className={`absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border ${componentMarkerClass(state)} ${selectedPart === component ? "ring-2 ring-primary" : ""}`}
                  style={{ top: position.top, left: position.left }}
                  title={`${COMPONENT_LABELS[component]}: ${state}${hasIssue ? " (open issue)" : ""}`}
                />
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            {COMPONENT_KEYS.map((component) => (
              <button
                key={component}
                type="button"
                onClick={() => setSelectedPart(component)}
                className={`border border-border/30 p-2 font-rajdhani text-xs ${selectedPart === component ? "border-primary text-primary" : ""}`}
              >
                {COMPONENT_LABELS[component]}
              </button>
            ))}
          </div>

          <p className="font-rajdhani text-sm text-muted-foreground">Selected: <span className="text-primary">{COMPONENT_LABELS[selectedPart as ComponentKey]}</span></p>
          <p className={`font-rajdhani text-sm ${statusClass}`}>Status: {componentHealth[selectedPart]}</p>
          <p className="font-rajdhani text-xs text-muted-foreground">Marker color and status are linked to current open issue and component state data.</p>
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
