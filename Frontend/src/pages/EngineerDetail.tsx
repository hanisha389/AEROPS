import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";

interface MaintenanceLog {
  id: number;
  date: string;
  aircraft?: string;
  type: string;
  description?: string;
  isCurrent?: boolean;
  completionStatus?: string;
  issueId?: number;
}

interface Engineer {
  id: number;
  name: string;
  role: string;
  employeeId: string;
  specialization: string;
  status: string;
  image: string;
  maintenanceLogs: MaintenanceLog[];
}

const normalizeStatus = (value?: string) => (value || "PENDING").trim().toUpperCase().replace(/\s+/g, "_");

const parseLogDetails = (description?: string) => {
  if (!description) {
    return { component: "N/A", severity: "N/A", details: "No details" };
  }

  const fields: Record<string, string> = {};
  description.split(";").forEach((part) => {
    const [key, ...rest] = part.split("=");
    if (!key || !rest.length) {
      return;
    }
    fields[key.trim().toLowerCase()] = rest.join("=").trim();
  });

  return {
    component: fields.component || "N/A",
    severity: fields.severity || "N/A",
    details: fields.details || description,
  };
};

const EngineerDetail = () => {
  const { id } = useParams();
  const [engineer, setEngineer] = useState<Engineer | null>(null);

  const sortedLogs = useMemo(() => {
    if (!engineer) return [];
    return [...engineer.maintenanceLogs].sort((a, b) => b.date.localeCompare(a.date));
  }, [engineer]);

  const activeTasks = useMemo(
    () => sortedLogs.filter((log) => log.issueId != null && normalizeStatus(log.completionStatus) !== "COMPLETE" && normalizeStatus(log.completionStatus) !== "COMPLETED"),
    [sortedLogs],
  );

  const completedTasks = useMemo(
    () => sortedLogs.filter((log) => log.issueId != null && (normalizeStatus(log.completionStatus) === "COMPLETE" || normalizeStatus(log.completionStatus) === "COMPLETED")),
    [sortedLogs],
  );

  const updateLogStatus = async (logId: number, completionStatus: string) => {
    if (!engineer) return;
    const updated = await api.updateEngineerLogStatus(engineer.id, logId, completionStatus);
    setEngineer(updated);
  };

  useEffect(() => {
    if (!id) return;
    api.getEngineerById(Number(id)).then(setEngineer);
  }, [id]);

  if (!engineer) {
    return (
      <BackgroundLayout>
        <PageHeader title="ENGINEER DETAILS" backTo="/engineers" />
        <div className="p-6 font-rajdhani text-muted-foreground">Loading engineer details...</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="ENGINEER DETAILS" backTo="/engineers" />
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        <div className="border border-border/40 bg-card/30 p-4 lg:col-span-1">
          <div className="mb-4 h-[30rem] w-full overflow-hidden border border-border/30 bg-black/30">
            <img src={engineer.image} alt={engineer.name} className="h-full w-full object-cover object-[50%_20%]" />
          </div>
          <StatusBadge status={engineer.status || "Busy"} align="right" />
          <h2 className="mt-3 font-orbitron text-xl text-primary">{engineer.name}</h2>
          <p className="font-rajdhani text-base text-muted-foreground">ID: <span className="text-primary">{engineer.employeeId}</span></p>
          <p className="font-rajdhani text-base text-muted-foreground">Role: <span className="text-primary">{engineer.role}</span></p>
          <p className="font-rajdhani text-base text-muted-foreground">Specialization: <span className="text-primary">{engineer.specialization}</span></p>
          <p className="font-rajdhani text-base text-muted-foreground">Status: <span className="text-primary">{engineer.status}</span></p>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="border border-border/40 bg-card/30 p-4">
            <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">ASSIGNED TASKS</h3>
            {activeTasks.length === 0 && (
              <p className="font-rajdhani text-sm text-muted-foreground">No active assigned issue tasks.</p>
            )}
            <div className="space-y-2">
              {activeTasks.map((log) => {
                const details = parseLogDetails(log.description);
                const status = normalizeStatus(log.completionStatus);
                return (
                  <div key={log.id} className="border border-border/30 bg-background/20 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-rajdhani text-sm text-primary">Aircraft: {log.aircraft || "N/A"}</p>
                      <p className="font-rajdhani text-xs text-muted-foreground">Issue #{log.issueId}</p>
                    </div>
                    <p className="font-rajdhani text-xs text-muted-foreground">Component: {details.component}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">Severity: {details.severity}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">Assigned: {log.date}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">Details: {details.details}</p>
                    <p className="mt-1 font-rajdhani text-xs text-primary">Status: {status}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => updateLogStatus(log.id, "IN_PROGRESS")}
                        disabled={status === "IN_PROGRESS"}
                        className="border border-border px-3 py-1 font-orbitron text-[0.65rem] text-muted-foreground disabled:opacity-60"
                      >
                        MARK IN PROGRESS
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLogStatus(log.id, "COMPLETE")}
                        className="border border-primary px-3 py-1 font-orbitron text-[0.65rem] text-primary"
                      >
                        MARK COMPLETE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border border-border/40 bg-card/30 p-4">
            <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">COMPLETED TASK LOG</h3>
            <div className="space-y-2">
              {completedTasks.length === 0 && <p className="font-rajdhani text-sm text-muted-foreground">No completed issue tasks.</p>}
              {completedTasks.map((log, index) => (
                <div key={`${log.date}-${index}`} className="border border-border/30 bg-background/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-rajdhani text-sm text-primary">{log.aircraft || "N/A"}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">{log.date}</p>
                  </div>
                  <p className="font-rajdhani text-xs text-muted-foreground">Issue #{log.issueId || "N/A"} - {log.type}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground/80">{log.description || "No details"}</p>
                  <p className="mt-1 font-rajdhani text-xs text-primary">Status: {normalizeStatus(log.completionStatus)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default EngineerDetail;
