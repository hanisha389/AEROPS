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
  if (normalized === "HIGH" || normalized === "CRITICAL") return "Critical";
  if (normalized === "MEDIUM" || normalized === "WARNING") return "Warning";
  return "Good";
};

const mergeState = (current: ComponentState, next: ComponentState): ComponentState => {
  const rank = { Good: 0, Warning: 1, Critical: 2 };
  return rank[next] > rank[current] ? next : current;
};

const normalizeComponentKey = (value: string): ComponentKey | null => {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, "");
  if (normalized.includes("landing") || normalized.includes("gear")) return "landingGear";
  if (normalized.includes("avionic")) return "avionics";
  if (normalized.includes("engine")) return "engine";
  if (normalized.includes("wing")) return "wings";
  if (normalized.includes("fuel")) return "fuel";
  return null;
};

const stateColor = (state: ComponentState) => {
  if (state === "Critical") return { dot: 'hsl(4 80% 60%)', glow: 'hsl(4 80% 52%)' };
  if (state === "Warning") return  { dot: 'hsl(38 95% 56%)', glow: 'hsl(38 95% 52%)' };
  return { dot: 'hsl(142 68% 48%)', glow: 'hsl(142 68% 42%)' };
};

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
    if (!canAssignIssues) { setEngineerOptions([]); return; }
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
    const grouped: Record<ComponentKey, number> = { engine: 0, wings: 0, avionics: 0, fuel: 0, landingGear: 0 };
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
    if (!selectedEngineer) { window.alert("Select an engineer before assigning this issue."); return; }
    setAssigningIssueId(issueId);
    setAssignmentMessage(null);
    try {
      await api.assignIssueToEngineer({ issueId, aircraftId: issueAircraftId, engineerId: Number(selectedEngineer) });
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
        <PageHeader title="AIRCRAFT DIAGNOSTICS" backTo="/aircraft" />
        <div className="flex justify-center items-center h-64">
          <div
            className="font-space tracking-[0.2em] animate-pulse"
            style={{ fontSize: '11px', color: 'hsl(188 100% 55%)', border: '1px solid hsl(188 100% 48% / 0.2)', background: 'hsl(188 100% 48% / 0.05)', padding: '12px 24px', textTransform: 'uppercase' }}
          >
            ESTABLISHING TELEMETRY LINK...
          </div>
        </div>
      </BackgroundLayout>
    );
  }

  const selectedColor = stateColor(componentHealth[selectedPart]);

  return (
    <BackgroundLayout>
      <PageHeader title="AIRCRAFT DIAGNOSTICS" backTo="/aircraft" />

      {/* ── Aircraft header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1
            className="font-orbitron font-bold uppercase"
            style={{ fontSize: '28px', letterSpacing: '0.08em', color: 'hsl(210 20% 96%)', marginBottom: '4px' }}
          >
            {aircraft.name}
          </h1>
          <p
            className="font-space uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'hsl(215 14% 45%)' }}
          >
            ID: {aircraft.id} · MODEL: {aircraft.model}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '4px' }}>FLEET STATUS</p>
          <div
            className="font-orbitron font-bold uppercase tracking-widest"
            style={{
              fontSize: '14px',
              color: derivedStatus === 'READY' ? 'hsl(142 68% 55%)' : 'hsl(4 80% 60%)',
            }}
          >
            {derivedStatus}
          </div>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

        {/* ── Left column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Mission Assignment panel */}
          <div style={{ border: '1px solid hsl(218 28% 18%)', background: 'hsl(220 40% 8% / 0.7)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(218 28% 15%)' }}>
              <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', color: 'hsl(215 14% 45%)' }}>MISSION ASSIGNMENT</span>
            </div>
            <div style={{ padding: '16px' }}>
              <form onSubmit={saveAircraft}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 42%)', display: 'block', marginBottom: '6px' }}>
                      ASSIGNED PILOT
                    </label>
                    <select
                      style={{
                        width: '100%',
                        background: 'hsl(220 42% 7%)',
                        border: '1px solid hsl(218 28% 22%)',
                        color: 'hsl(210 20% 88%)',
                        padding: '8px 12px',
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '13px',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                      value={assignedPilot}
                      onChange={(e) => setAssignedPilot(e.target.value)}
                    >
                      <option value="">-- UNASSIGNED --</option>
                      {pilotOptions.map((pilot) => (
                        <option key={pilot.id} value={pilot.callSign}>
                          {pilot.callSign} ({pilot.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    style={{
                      padding: '8px 20px',
                      border: '1px solid hsl(188 100% 48% / 0.45)',
                      background: 'hsl(188 100% 48% / 0.08)',
                      color: 'hsl(188 100% 70%)',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: '10px',
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'hsl(188 100% 48% / 0.16)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'hsl(188 100% 48% / 0.08)'; }}
                  >
                    UPDATE CONFIG
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Active Diagnostic Issues */}
          <div style={{ border: '1px solid hsl(218 28% 18%)', background: 'hsl(220 40% 8% / 0.7)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(218 28% 15%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', color: 'hsl(215 14% 45%)' }}>ACTIVE DIAGNOSTIC ISSUES</span>
              {aircraft.openIssues.length > 0 && (
                <span className="font-space" style={{ fontSize: '9px', color: 'hsl(4 80% 60%)', letterSpacing: '0.1em' }}>
                  {aircraft.openIssues.length} open
                </span>
              )}
            </div>
            <div style={{ padding: '16px' }}>
              {assignmentMessage && (
                <p
                  className="font-space uppercase tracking-wider"
                  style={{ fontSize: '10px', color: 'hsl(142 68% 55%)', background: 'hsl(142 68% 42% / 0.08)', border: '1px solid hsl(142 68% 42% / 0.2)', padding: '8px 12px', marginBottom: '12px' }}
                >
                  {assignmentMessage}
                </p>
              )}
              {aircraft.openIssues && aircraft.openIssues.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {aircraft.openIssues.map((issue) => {
                    const isCritical = issue.severity.toUpperCase() === 'CRITICAL' || issue.severity.toUpperCase() === 'HIGH';
                    const isAssigned = issue.status === "Assigned";
                    return (
                      <div
                        key={issue.id}
                        style={{
                          position: 'relative',
                          border: `1px solid ${isCritical ? 'hsl(4 80% 52% / 0.3)' : 'hsl(38 95% 52% / 0.2)'}`,
                          background: isCritical ? 'hsl(4 80% 52% / 0.04)' : 'hsl(38 95% 52% / 0.03)',
                          padding: '12px 14px 12px 18px',
                        }}
                      >
                        {/* Severity strip */}
                        <div style={{
                          position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                          background: isCritical ? 'hsl(4 80% 55%)' : 'hsl(38 95% 55%)',
                        }} />

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div>
                            <p
                              className="font-orbitron font-bold uppercase"
                              style={{ fontSize: '12px', letterSpacing: '0.12em', color: 'hsl(210 20% 92%)', marginBottom: '3px' }}
                            >
                              {issue.component}
                            </p>
                            <p className="font-inter" style={{ fontSize: '11px', color: 'hsl(215 14% 52%)' }}>
                              {issue.description || 'No detailed description.'}
                            </p>
                          </div>
                          <span
                            className="font-space uppercase tracking-widest"
                            style={{
                              fontSize: '9px',
                              border: `1px solid ${isCritical ? 'hsl(4 80% 52% / 0.35)' : 'hsl(38 95% 52% / 0.3)'}`,
                              color: isCritical ? 'hsl(4 80% 62%)' : 'hsl(38 95% 60%)',
                              padding: '3px 10px',
                              flexShrink: 0,
                              marginLeft: '10px',
                            }}
                          >
                            {issue.severity}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                          <span className="font-space uppercase" style={{ fontSize: '9px', letterSpacing: '0.15em', color: 'hsl(215 14% 44%)' }}>
                            STATUS: <span style={{ color: 'hsl(210 20% 75%)' }}>{issue.status}</span>
                          </span>
                          {canAssignIssues && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <select
                                style={{
                                  background: 'hsl(220 42% 7%)',
                                  border: '1px solid hsl(218 28% 22%)',
                                  color: 'hsl(210 15% 75%)',
                                  padding: '6px 10px',
                                  fontFamily: "'Space Grotesk', sans-serif",
                                  fontSize: '10px',
                                  letterSpacing: '0.08em',
                                  textTransform: 'uppercase',
                                  outline: 'none',
                                }}
                                value={assignmentByIssue[issue.id] || ""}
                                onChange={(event) => setAssignmentByIssue((prev) => ({ ...prev, [issue.id]: event.target.value }))}
                              >
                                <option value="">Assign Engineer</option>
                                {engineerOptions.map((engineer) => (
                                  <option key={engineer.id} value={String(engineer.id)}>
                                    [{engineer.employeeId}] {engineer.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => assignIssue(issue.id, issue.aircraftId, issue.status)}
                                disabled={assigningIssueId === issue.id}
                                style={{
                                  padding: '6px 14px',
                                  border: '1px solid hsl(188 100% 48% / 0.4)',
                                  background: 'hsl(188 100% 48% / 0.07)',
                                  color: 'hsl(188 100% 70%)',
                                  fontFamily: "'Space Grotesk', sans-serif",
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  letterSpacing: '0.15em',
                                  textTransform: 'uppercase',
                                  cursor: assigningIssueId === issue.id ? 'not-allowed' : 'pointer',
                                  opacity: assigningIssueId === issue.id ? 0.6 : 1,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {assigningIssueId === issue.id ? 'WAIT...' : (isAssigned ? 'REASSIGN' : 'ASSIGN')}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid hsl(142 68% 42% / 0.2)', background: 'hsl(142 68% 42% / 0.05)', padding: '14px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'hsl(142 68% 48%)', flexShrink: 0 }} />
                  <p className="font-space uppercase" style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'hsl(142 68% 55%)' }}>
                    All systems nominal. No active diagnostic issues.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Maintenance Logs */}
          <div style={{ border: '1px solid hsl(218 28% 18%)', background: 'hsl(220 40% 8% / 0.7)' }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(218 28% 15%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', color: 'hsl(215 14% 45%)' }}>MAINTENANCE LOGS</span>
              {maintenanceEntries.length > 0 && (
                <span className="font-space" style={{ fontSize: '9px', color: 'hsl(215 14% 42%)', letterSpacing: '0.12em' }}>
                  {maintenanceEntries.length} items
                </span>
              )}
            </div>
            <div style={{ padding: '0' }}>
              {maintenanceEntries.length === 0 ? (
                <p
                  className="font-space uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'hsl(215 14% 38%)', padding: '20px 16px', textAlign: 'center', borderBottom: '1px dashed hsl(218 28% 16%)' }}
                >
                  No maintenance history.
                </p>
              ) : (
                maintenanceEntries.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid hsl(218 28% 14%)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(220 40% 10% / 0.5)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div>
                      <p
                        className="font-space uppercase tracking-widest"
                        style={{ fontSize: '11px', fontWeight: 600, color: 'hsl(210 20% 85%)', marginBottom: '2px' }}
                      >
                        {entry.logType.replace(/_/g, " ")}
                      </p>
                      <p className="font-inter" style={{ fontSize: '11px', color: 'hsl(215 14% 48%)' }}>
                        {entry.summary || "Standard maintenance procedure"}
                      </p>
                    </div>
                    <span
                      className="font-space"
                      style={{ fontSize: '10px', letterSpacing: '0.1em', color: 'hsl(215 14% 38%)', flexShrink: 0, marginLeft: '12px' }}
                    >
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Right column: System Schematic ── */}
        <div style={{ border: '1px solid hsl(218 28% 18%)', background: 'hsl(220 40% 8% / 0.7)', position: 'sticky', top: '60px' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(218 28% 15%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', color: 'hsl(215 14% 45%)' }}>SYSTEM SCHEMATIC</span>
            <span
              className="font-space uppercase tracking-widest"
              style={{ fontSize: '8px', color: 'hsl(142 68% 55%)', border: '1px solid hsl(142 68% 42% / 0.3)', background: 'hsl(142 68% 42% / 0.06)', padding: '2px 8px' }}
            >
              LIVE
            </span>
          </div>

          {/* Blueprint */}
          <div
            style={{
              position: 'relative',
              background: 'hsl(220 42% 5% / 0.8)',
              aspectRatio: '1/1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
              borderBottom: '1px solid hsl(218 28% 15%)',
            }}
          >
            {/* Grid overlay */}
            <div
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.25,
                backgroundImage: 'linear-gradient(hsl(218 28% 20% / 0.4) 1px, transparent 1px), linear-gradient(90deg, hsl(218 28% 20% / 0.4) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: 'radial-gradient(circle at center, transparent 20%, hsl(220 45% 5% / 0.85) 100%)',
              }}
            />

            <img
              src="/aircraft.svg"
              alt="Aircraft schematic"
              style={{ width: '90%', height: '90%', objectFit: 'contain', opacity: 0.7, mixBlendMode: 'screen', position: 'relative', zIndex: 1 }}
              loading="lazy"
              onError={handleBlueprintImageError}
            />

            {/* Component markers */}
            {COMPONENT_KEYS.map((component) => {
              const position = COMPONENT_MARKER_POSITIONS[component];
              const state = componentHealth[component];
              const hasIssue = openIssuesByComponent[component] > 0;
              const isSelected = selectedPart === component;
              const color = stateColor(state);

              return (
                <div key={component} style={{ position: 'absolute', top: position.top, left: position.left, zIndex: 10 }}>
                  <button
                    type="button"
                    onClick={() => setSelectedPart(component)}
                    style={{
                      width: '36px', height: '36px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transform: 'translate(-50%,-50%)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                    title={`${COMPONENT_LABELS[component]}: ${state}`}
                  >
                    {isSelected && (
                      <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        border: `2px solid ${color.dot}`,
                        animation: 'ping 1.2s ease-out infinite',
                        opacity: 0.4,
                      }} />
                    )}
                    <div
                      style={{
                        width: '12px', height: '12px',
                        borderRadius: '50%',
                        background: color.dot,
                        boxShadow: hasIssue || isSelected ? `0 0 10px ${color.glow}` : `0 0 4px ${color.glow}`,
                        border: `1px solid hsl(0 0% 100% / 0.15)`,
                        transition: 'all 0.2s ease',
                        transform: isSelected ? 'scale(1.3)' : 'scale(1)',
                        animation: hasIssue ? 'damage-pulse 1.5s ease-in-out infinite' : 'none',
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Selected component info */}
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 42%)' }}>SELECTED SYSTEM</span>
              <span
                className="font-space uppercase tracking-widest"
                style={{
                  fontSize: '9px',
                  border: `1px solid ${selectedColor.dot}40`,
                  background: `${selectedColor.dot}14`,
                  color: selectedColor.dot,
                  padding: '2px 10px',
                }}
              >
                {componentHealth[selectedPart]}
              </span>
            </div>

            <h4
              className="font-orbitron font-bold uppercase"
              style={{ fontSize: '18px', letterSpacing: '0.1em', color: 'hsl(210 20% 92%)', marginBottom: '8px' }}
            >
              {COMPONENT_LABELS[selectedPart]}
            </h4>

            <p
              className="font-inter"
              style={{ fontSize: '11px', color: 'hsl(215 14% 50%)', lineHeight: 1.55, marginBottom: '16px', borderLeft: '2px solid hsl(218 28% 22%)', paddingLeft: '10px' }}
            >
              {componentHealth[selectedPart] === 'Good'
                ? `${COMPONENT_LABELS[selectedPart]} telemetry is green. Systems operating within parameters.`
                : `Diagnostic alert in ${COMPONENT_LABELS[selectedPart]}. Review active issues.`}
            </p>

            {/* Component buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {COMPONENT_KEYS.map((component) => {
                const color = stateColor(componentHealth[component]);
                return (
                  <button
                    key={component}
                    type="button"
                    onClick={() => setSelectedPart(component)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '7px 10px',
                      border: selectedPart === component ? `1px solid hsl(188 100% 48% / 0.4)` : '1px solid hsl(218 28% 18%)',
                      background: selectedPart === component ? 'hsl(188 100% 48% / 0.07)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedPart !== component) (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(218 28% 26%)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedPart !== component) (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(218 28% 18%)';
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color.dot, flexShrink: 0 }} />
                    <span className="font-space" style={{ fontSize: '9px', letterSpacing: '0.1em', color: selectedPart === component ? 'hsl(188 100% 70%)' : 'hsl(215 14% 55%)', textTransform: 'uppercase' }}>
                      {COMPONENT_LABELS[component]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftDetail;
