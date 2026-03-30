import { FormEvent, SyntheticEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type AircraftMaintenanceHistoryItem } from "@/lib/api";
import { getCurrentRole } from "@/lib/rbac";
import { Panel } from "@/components/ui/custom/Panel";

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
    return "text-danger font-bold";
  }
  if (value === "Warning") {
    return "text-yellow-400 font-bold";
  }
  return "text-success font-bold";
};

const componentMarkerClass = (value: ComponentState): string => {
  if (value === "Critical") {
    return "border-danger bg-danger/80 animate-pulse";
  }
  if (value === "Warning") {
    return "border-yellow-400 bg-yellow-400/80 animate-pulse";
  }
  return "border-success bg-success/60";
};

const normalizeComponentName = (value: string): string => value.toLowerCase().replace(/[\s_-]+/g, "");

const DataRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col mb-3">
    <span className="text-gray-400 font-inter text-xs uppercase tracking-wider mb-1">{label}</span>
    <span className="text-gray-100 font-inter text-sm font-medium">{value}</span>
  </div>
);

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
    if (!id) return;
    const data: Aircraft = await api.getAircraftById(id);
    setAircraft(data);
    setAssignedPilot(data.assignedPilots[0] || "");
  };

  const loadMaintenance = async () => {
    if (!id) return;
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
      if (!component) continue;
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
      if (component) grouped[component] += 1;
    }
    return grouped;
  }, [aircraft]);

  const derivedStatus = useMemo(() => {
    if (!aircraft) return "READY";
    return aircraft.openIssues.length > 0 ? "NOT READY" : "READY";
  }, [aircraft]);

  const statusClass = useMemo(() => {
    return componentStateClass(componentHealth[selectedPart]);
  }, [componentHealth, selectedPart]);

  const handleBlueprintImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (image.dataset.fallbackApplied === "true") return;
    image.dataset.fallbackApplied = "true";
    image.src = "/aircraft.svg";
  };

  const saveAircraft = async (event: FormEvent) => {
    event.preventDefault();
    if (!aircraft) return;

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
    if (!canAssignIssues) return;
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
        <div className="p-6 font-inter text-muted-foreground text-center">Loading aircraft database...</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="AIRCRAFT DIAGNOSTICS" backTo="/aircraft" />
      <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
        <header className="mb-2">
          <h1 className="text-3xl font-rajdhani font-bold text-gray-200 uppercase tracking-wider">
            {aircraft.name}
          </h1>
          <p className="text-gray-400 font-inter text-sm mt-1">ID: {aircraft.id} | MODEL: {aircraft.model}</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Overview Panel */}
            <Panel className="p-6">
              <form onSubmit={saveAircraft} className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4">
                  <div className="flex flex-col w-full md:w-1/2">
                    <label className="text-xs text-gray-400 font-inter uppercase tracking-widest mb-2">Assigned Pilot</label>
                    <select 
                      className="bg-black/30 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200 font-inter focus:border-accent/50 outline-none transition-colors" 
                      value={assignedPilot} 
                      onChange={(e) => setAssignedPilot(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {pilotOptions.map((pilot) => (
                        <option key={pilot.id} value={pilot.callSign}>{pilot.callSign} ({pilot.name})</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex flex-col items-start md:items-end">
                    <span className="text-xs text-gray-400 font-inter uppercase tracking-widest mb-1">Status</span>
                    <span className="font-rajdhani font-bold text-xl text-white">
                      {derivedStatus}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button type="submit" className="bg-accent/10 hover:bg-accent/20 border border-accent/40 text-accent font-rajdhani font-bold text-sm tracking-widest px-6 py-2 rounded transition-colors">
                    UPDATE CONFIGURATION
                  </button>
                </div>
              </form>
            </Panel>

            {/* Open Issues Panel */}
            <Panel className="p-6">
              <h3 className="text-lg font-rajdhani font-medium text-gray-300 border-b border-white/5 pb-2 mb-4 uppercase">
                Active Diagnostic Issues
              </h3>
              {assignmentMessage && <p className="mb-4 text-sm text-success bg-success/10 p-2 rounded border border-success/20">{assignmentMessage}</p>}
              
              {aircraft.openIssues && aircraft.openIssues.length > 0 ? (
                <div className="space-y-3">
                  {aircraft.openIssues.map((issue) => (
                    <div key={issue.id} className="bg-black/20 border border-white/5 p-4 rounded-lg flex flex-col gap-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-rajdhani font-bold text-lg text-gray-200 uppercase">{issue.component}</p>
                          <p className="font-inter text-sm text-gray-400 mt-1">{issue.description || "No detailed description provided."}</p>
                        </div>
                        <span className={`text-xs font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/10`}>
                          {issue.severity}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-1">
                        <span className="text-xs text-gray-500 font-inter uppercase">STATUS: {issue.status}</span>
                        
                        {canAssignIssues && (
                          <div className="flex gap-2 items-center">
                            <select
                              className="bg-background/80 border border-white/10 rounded px-2 py-1 text-xs text-gray-300 font-inter outline-none focus:border-accent/40"
                              value={assignmentByIssue[issue.id] || ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                setAssignmentByIssue((prev) => ({ ...prev, [issue.id]: value }));
                              }}
                            >
                              <option value="">Assign Engineer</option>
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
                              className="bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-inter text-gray-200 px-3 py-1 rounded transition-colors disabled:opacity-50"
                            >
                              {assigningIssueId === issue.id ? "..." : (issue.status === "Assigned" ? "REASSIGN" : "ASSIGN")}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-success/5 border border-success/10 p-4 rounded-lg flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <p className="font-inter text-sm text-success">All systems nominal. No open diagnostic issues reported.</p>
                </div>
              )}
            </Panel>
            
            {/* Maintenance History */}
            <Panel className="p-6">
              <h3 className="text-lg font-rajdhani font-medium text-gray-300 border-b border-white/5 pb-2 mb-4 uppercase">
                Maintenance Logs
              </h3>
              {maintenanceEntries.length === 0 ? (
                <p className="text-sm font-inter text-gray-400">No previous maintenance history logged.</p>
              ) : (
                <div className="space-y-3">
                  {maintenanceEntries.map((entry) => (
                    <div key={entry.id} className="bg-white/[0.02] border border-white/5 p-3 rounded-lg flex justify-between items-center group hover:bg-white/[0.04] transition-colors">
                      <div className="flex flex-col">
                        <span className="font-rajdhani font-medium text-gray-200 text-sm">{entry.logType.replace(/_/g, " ")}</span>
                        <span className="font-inter text-gray-400 text-xs mt-1">{entry.summary || "Standard maintenance procedure"}</span>
                      </div>
                      <span className="text-xs text-gray-500 font-inter tabular-nums">{new Date(entry.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            
          </div>

          <div className="lg:col-span-1">
            {/* Blueprint Overview Panel */}
            <Panel className="p-6 sticky top-6">
              <h3 className="text-lg font-rajdhani font-medium text-gray-300 border-b border-white/5 pb-2 mb-4 uppercase flex justify-between items-center">
                System Schematic
                <span className="text-[10px] text-accent tracking-widest px-2 py-1 bg-accent/10 rounded">LIVE</span>
              </h3>
              
              <div className="relative bg-black/40 rounded-lg p-2 border border-white/5 mb-6 aspect-square max-h-80 mx-auto flex items-center justify-center">
                <img
                  src="/aircraft.svg"
                  alt="Aircraft diagram"
                  className="w-full h-full object-contain opacity-80"
                  loading="lazy"
                  onError={handleBlueprintImageError}
                />
                {COMPONENT_KEYS.map((component) => {
                  const position = COMPONENT_MARKER_POSITIONS[component];
                  const state = componentHealth[component];
                  const hasIssue = openIssuesByComponent[component] > 0;
                  const isSelected = selectedPart === component;
                  return (
                    <div key={component} className="absolute" style={{ top: position.top, left: position.left }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPart(component)}
                        className={`relative flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all hover:scale-110 shadow-xl ${componentMarkerClass(state)}`}
                        title={`${COMPONENT_LABELS[component]}: ${state}`}
                      >
                        {isSelected && <span className="absolute inset-0 rounded-full border-2 border-white/80 animate-ping shadow-[0_0_15px_rgba(255,255,255,0.5)]"></span>}
                        <span className={`block h-4 w-4 rounded-full border-2 border-white/90 shadow-lg bg-current`}></span>
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-inter text-xs text-gray-400 uppercase tracking-widest">Selected System</span>
                  <span className={`text-xs px-2 py-1 rounded font-bold`}>
                    {componentHealth[selectedPart].toUpperCase()}
                  </span>
                </div>
                <h4 className="font-rajdhani text-2xl font-bold text-gray-100 mb-2">{COMPONENT_LABELS[selectedPart]}</h4>
                <p className="font-inter text-sm text-gray-400 line-clamp-2 min-h-10">
                  {componentHealth[selectedPart] === 'Good' 
                    ? `The ${COMPONENT_LABELS[selectedPart]} system is operating within optimal parameters.` 
                    : `Diagnostic alert detected in ${COMPONENT_LABELS[selectedPart]}. Check active issues for details.`}
                </p>
                
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {COMPONENT_KEYS.map((component) => (
                    <button
                      key={component}
                      type="button"
                      onClick={() => setSelectedPart(component)}
                      className={`text-xs font-inter py-2 rounded transition-colors ${selectedPart === component ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400'}`}
                    >
                      {COMPONENT_LABELS[component]}
                    </button>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftDetail;
