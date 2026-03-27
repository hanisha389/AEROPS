import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, OpenIssue } from "@/lib/api";

interface MaintenanceLog {
  id: number;
  date: string;
  aircraft?: string;
  type: string;
  description?: string;
  isCurrent?: boolean;
  completionStatus?: string;
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

const EngineerDetail = () => {
  const taskTypeOptions = ["Assigned", "Inspection", "Repair", "Diagnostics", "Calibration"];
  const componentOptions = ["engine", "wings", "avionics", "fuel", "landingGear"];
  const severityOptions = ["Warning", "Critical"];
  const { id } = useParams();
  const [engineer, setEngineer] = useState<Engineer | null>(null);
  const [issues, setIssues] = useState<OpenIssue[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<{ id: string }[]>([]);
  const [task, setTask] = useState({ aircraft: "", type: "Assigned", component: "engine", severity: "Warning", isCurrent: true, issueId: "" });

  const sortedLogs = useMemo(() => {
    if (!engineer) return [];
    return [...engineer.maintenanceLogs].sort((a, b) => b.date.localeCompare(a.date));
  }, [engineer]);

  const updateLogStatus = async (logId: number, completionStatus: string) => {
    if (!engineer) return;
    const updated = await api.updateEngineerLogStatus(engineer.id, logId, completionStatus);
    setEngineer(updated);
  };

  useEffect(() => {
    if (!id) return;
    api.getEngineerById(Number(id)).then(setEngineer);
    api.getOpenIssues().then(setIssues);
    api.getAircrafts().then((items) => setAircraftOptions(items.map((item: { id: string }) => ({ id: item.id }))));
  }, [id]);

  const assignIssue = (issueId: number) => {
    const issue = issues.find((item) => item.id === issueId);
    if (!issue) return;
    setTask({
      aircraft: issue.aircraftId,
      type: "Assigned",
      component: issue.component,
      severity: issue.severity,
      isCurrent: true,
      issueId: String(issue.id),
    });
  };

  const handleAssign = async (event: FormEvent) => {
    event.preventDefault();
    if (!engineer) return;

    const date = new Date().toISOString().slice(0, 10);
    const updated = await api.addEngineerLog(engineer.id, {
      aircraft: task.aircraft,
      type: task.type,
      description: `${task.component} ${task.severity} - requires ${task.type.toLowerCase()}`,
      isCurrent: task.isCurrent,
      issueId: task.issueId ? Number(task.issueId) : undefined,
      date,
    });
    setEngineer(updated);
    api.getOpenIssues().then(setIssues);

    setTask({ aircraft: "", type: "Assigned", component: "engine", severity: "Warning", isCurrent: true, issueId: "" });
  };

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
          <img src={engineer.image} alt={engineer.name} className="mb-4 h-72 w-full object-cover" />
          <h2 className="font-orbitron text-lg text-primary">{engineer.name}</h2>
          <p className="font-rajdhani text-sm text-muted-foreground">ID: <span className="text-primary">{engineer.employeeId}</span></p>
          <p className="font-rajdhani text-sm text-muted-foreground">Role: <span className="text-primary">{engineer.role}</span></p>
          <p className="font-rajdhani text-sm text-muted-foreground">Specialization: <span className="text-primary">{engineer.specialization}</span></p>
          <p className="font-rajdhani text-sm text-muted-foreground">Status: <span className="text-primary">{engineer.status}</span></p>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <div className="border border-border/40 bg-card/30 p-4">
            <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">ASSIGN WORK</h3>
            {issues.length > 0 && (
              <select
                className="mb-3 w-full border border-border bg-background/40 px-3 py-2"
                value={task.issueId}
                onChange={(e) => {
                  setTask((prev) => ({ ...prev, issueId: e.target.value }));
                  if (e.target.value) assignIssue(Number(e.target.value));
                }}
              >
                <option value="">Select pending aircraft issue</option>
                {issues.map((issue) => (
                  <option key={issue.id} value={String(issue.id)}>
                    {issue.aircraftId} - {issue.component} ({issue.severity})
                  </option>
                ))}
              </select>
            )}
            <form onSubmit={handleAssign} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select className="border border-border bg-background/40 px-3 py-2" value={task.aircraft} onChange={(e) => setTask({ ...task, aircraft: e.target.value })}>
                <option value="">Select Aircraft</option>
                {Array.from(new Set([...issues.map((item) => item.aircraftId), ...aircraftOptions.map((item) => item.id)])).map((aircraftId) => (
                  <option key={aircraftId} value={aircraftId}>{aircraftId}</option>
                ))}
              </select>
              <select className="border border-border bg-background/40 px-3 py-2" value={task.type} onChange={(e) => setTask({ ...task, type: e.target.value })} required>
                {taskTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="border border-border bg-background/40 px-3 py-2" value={task.component} onChange={(e) => setTask({ ...task, component: e.target.value })}>
                {componentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className="border border-border bg-background/40 px-3 py-2" value={task.severity} onChange={(e) => setTask({ ...task, severity: e.target.value })}>
                {severityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-muted-foreground md:col-span-2">
                <input type="checkbox" checked={task.isCurrent} onChange={(e) => setTask({ ...task, isCurrent: e.target.checked })} />
                Mark as current assignment
              </label>
              <button type="submit" className="border border-primary px-3 py-2 font-orbitron text-xs text-primary md:col-span-2">ASSIGN</button>
            </form>
          </div>

          <div className="border border-border/40 bg-card/30 p-4">
            <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MAINTENANCE LOG</h3>
            <div className="space-y-2">
              {sortedLogs.map((log, index) => (
                <div key={`${log.date}-${index}`} className="border border-border/30 bg-background/30 p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-rajdhani text-sm text-primary">{log.aircraft || "N/A"}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">{log.date}</p>
                  </div>
                  <p className="font-rajdhani text-xs text-muted-foreground">{log.type}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground/80">{log.description || "No details"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="font-rajdhani text-xs text-muted-foreground">Status:</p>
                    <select
                      className="border border-border bg-background/40 px-2 py-1 font-rajdhani text-xs"
                      value={log.completionStatus || "Pending"}
                      onChange={(e) => updateLogStatus(log.id, e.target.value)}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
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
