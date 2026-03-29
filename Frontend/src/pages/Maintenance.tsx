import { FormEvent, useEffect, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type MaintenanceEntry } from "@/lib/api";
import { getCurrentRole } from "@/lib/rbac";

const Maintenance = () => {
  const role = getCurrentRole();
  const [entries, setEntries] = useState<MaintenanceEntry[]>([]);
  const [aircraftId, setAircraftId] = useState("");
  const [issueType, setIssueType] = useState<"Engine" | "Avionics" | "Structural">("Engine");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH">("LOW");
  const [notes, setNotes] = useState("");
  const [completion, setCompletion] = useState<Record<number, { issueResolved: "YES" | "NO"; notes: string }>>({});
  const [loading, setLoading] = useState(false);

  const loadEntries = () => {
    api.listMaintenanceEntries().then(setEntries);
  };

  useEffect(() => {
    if (role === "ADMIN_COMMANDER" || role === "ENGINEER") {
      loadEntries();
    }
  }, [role]);

  const createEntry = async (event: FormEvent) => {
    event.preventDefault();
    if (!aircraftId.trim()) {
      window.alert("Aircraft ID is required.");
      return;
    }
    setLoading(true);
    try {
      await api.createMaintenanceEntry({ aircraftId, issueType, severity, notes });
      setAircraftId("");
      setNotes("");
      loadEntries();
    } finally {
      setLoading(false);
    }
  };

  const completeEntry = async (entryId: number) => {
    const state = completion[entryId] || { issueResolved: "YES" as const, notes: "" };
    if (!state.notes.trim()) {
      window.alert("Completion notes are required.");
      return;
    }
    setLoading(true);
    try {
      await api.completeMaintenanceEntry(entryId, state);
      loadEntries();
    } finally {
      setLoading(false);
    }
  };

  if (role !== "ADMIN_COMMANDER" && role !== "ENGINEER") {
    return (
      <BackgroundLayout>
        <PageHeader title="MAINTENANCE" />
        <div className="p-6 font-rajdhani text-sm text-muted-foreground">Current role does not have access to maintenance workflow.</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="MAINTENANCE" />
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        <form onSubmit={createEntry} className="space-y-3 border border-border/40 bg-card/30 p-4 lg:col-span-1">
          <p className="font-orbitron text-xs tracking-[0.2em] text-primary">CREATE MAINTENANCE ENTRY</p>
          <label className="text-xs text-muted-foreground">Aircraft ID
            <input className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={aircraftId} onChange={(e) => setAircraftId(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Issue Type
            <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={issueType} onChange={(e) => setIssueType(e.target.value as "Engine" | "Avionics" | "Structural")}>
              <option>Engine</option>
              <option>Avionics</option>
              <option>Structural</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Severity
            <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={severity} onChange={(e) => setSeverity(e.target.value as "LOW" | "MEDIUM" | "HIGH")}>
              <option>LOW</option>
              <option>MEDIUM</option>
              <option>HIGH</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Notes
            <textarea className="mt-1 min-h-24 w-full border border-border bg-background/40 px-2 py-1" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <button disabled={loading} className="border border-primary px-3 py-2 font-orbitron text-xs text-primary">CREATE ENTRY</button>
        </form>

        <div className="space-y-3 lg:col-span-2">
          <p className="font-orbitron text-xs tracking-[0.2em] text-primary">MAINTENANCE ENTRIES</p>
          {entries.length === 0 && <p className="text-sm text-muted-foreground">No maintenance entries.</p>}
          {entries.map((entry) => {
            const state = completion[entry.id] || { issueResolved: "YES" as const, notes: "" };
            return (
              <div key={entry.id} className="space-y-2 border border-border/40 bg-card/30 p-3">
                <p className="font-rajdhani text-sm text-primary">#{entry.id} {entry.aircraftId} - {entry.issueType} ({entry.severity})</p>
                <p className="font-rajdhani text-xs text-muted-foreground">Status: {entry.status} | Created: {entry.createdAt}</p>
                <p className="font-rajdhani text-xs text-muted-foreground">Notes: {entry.engineerNotes || "None"}</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <label className="text-xs text-muted-foreground">Issue Resolved
                    <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={state.issueResolved} onChange={(e) => setCompletion((prev) => ({ ...prev, [entry.id]: { ...state, issueResolved: e.target.value as "YES" | "NO" } }))}>
                      <option>YES</option>
                      <option>NO</option>
                    </select>
                  </label>
                  <label className="md:col-span-2 text-xs text-muted-foreground">Completion Notes
                    <input className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={state.notes} onChange={(e) => setCompletion((prev) => ({ ...prev, [entry.id]: { ...state, notes: e.target.value } }))} />
                  </label>
                </div>
                <button disabled={loading} onClick={() => completeEntry(entry.id)} className="border border-primary px-3 py-1 font-orbitron text-[0.65rem] text-primary">COMPLETE MAINTENANCE</button>
              </div>
            );
          })}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Maintenance;
