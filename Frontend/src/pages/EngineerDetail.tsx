import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import PersonnelSummaryTemplate, { type PersonnelSummaryData } from "@/components/reports/PersonnelSummaryTemplate";
import { Panel } from "@/components/ui/custom/Panel";

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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryTimestamp, setSummaryTimestamp] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

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

  const summaryData = useMemo<PersonnelSummaryData | null>(() => {
    if (!engineer) {
      return null;
    }

    const activeLines = activeTasks.map((log) => {
      const details = parseLogDetails(log.description);
      return `${log.date} | ${log.aircraft || "N/A"} | ${details.component} | ${details.severity} | ${details.details}`;
    });

    const completedLines = completedTasks.map((log) => {
      return `${log.date} | ${log.aircraft || "N/A"} | ${log.type} | ${normalizeStatus(log.completionStatus)}`;
    });

    return {
      classification: "CONFIDENTIAL",
      timestamp: summaryTimestamp || new Date().toISOString(),
      title: "ENGINEER PERSONNEL SUMMARY",
      subjectName: engineer.name,
      subjectIdLabel: "Employee ID",
      subjectId: engineer.employeeId,
      roleLabel: "Role",
      roleValue: engineer.role,
      statusLabel: "Status",
      statusValue: engineer.status,
      sections: [
        {
          title: "Operational Profile",
          entries: [
            { label: "Specialization", value: engineer.specialization },
            { label: "Active Tasks", value: String(activeTasks.length) },
            { label: "Completed Tasks", value: String(completedTasks.length) },
          ],
        },
        {
          title: "Active Task Log",
          lines: activeLines,
        },
        {
          title: "Completed Task Log",
          lines: completedLines,
        },
      ],
      finalStatus: activeTasks.length > 0 ? "ACTIVE DUTY" : "STANDBY",
    };
  }, [engineer, activeTasks, completedTasks, summaryTimestamp]);

  const openSummary = () => {
    setSummaryTimestamp(new Date().toISOString());
    setSummaryOpen(true);
  };

  const handleDownloadSummary = async () => {
    if (!summaryRef.current || !summaryData) {
      return;
    }

    setGeneratingSummary(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const options = {
        margin: [10, 10, 10, 10],
        filename: `AEROPS-ENGINEER-${summaryData.subjectId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      };

      await html2pdf().set(options).from(summaryRef.current).save();
    } finally {
      setGeneratingSummary(false);
    }
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
      <div className="p-6 space-y-6 w-full">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-rajdhani font-bold text-gray-200 uppercase tracking-wider">{engineer.name}</h1>
            <p className="text-gray-400 font-inter text-sm mt-1">Engineer ID: {engineer.employeeId} | Clearance Level 3</p>
          </div>
          <button
            type="button"
            onClick={openSummary}
            className="rounded bg-accent/10 border border-accent/30 hover:bg-accent/20 px-4 py-2 font-rajdhani font-semibold text-sm tracking-[0.05em] text-accent transition-colors"
          >
            Generate Summary
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="p-6 lg:col-span-1">
            <div className="mb-4 h-[32rem] w-full overflow-hidden border border-white/10 bg-black/30 rounded-lg">
              <img src={engineer.image} alt={engineer.name} className="h-full w-full object-cover object-[50%_0%]" />
            </div>
            <StatusBadge status={engineer.status || "Busy"} align="right" />
            <h2 className="mt-3 font-rajdhani text-2xl font-bold text-gray-100">{engineer.name}</h2>
            <p className="font-inter text-sm text-muted-foreground">ID: <span className="text-gray-100">{engineer.employeeId}</span></p>
            <p className="font-inter text-sm text-muted-foreground">Role: <span className="text-gray-100">{engineer.role}</span></p>
            <p className="font-inter text-sm text-muted-foreground">Specialization: <span className="text-gray-100">{engineer.specialization}</span></p>
            <p className="font-inter text-sm text-muted-foreground">Status: <span className="text-gray-100">{engineer.status}</span></p>
          </Panel>

          <div className="space-y-5 lg:col-span-2">
            <Panel className="p-6">
              <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">ASSIGNED TASKS</h3>
            {activeTasks.length === 0 && (
              <p className="font-rajdhani text-sm text-muted-foreground">No active assigned issue tasks.</p>
            )}
            <div className="space-y-2">
              {activeTasks.map((log) => {
                const details = parseLogDetails(log.description);
                const status = normalizeStatus(log.completionStatus);
                return (
                  <div key={log.id} className="border border-border/30 bg-background/20 p-3 rounded-lg">
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
            </Panel>

            <Panel className="p-6">
              <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">COMPLETED TASK LOG</h3>
            <div className="space-y-2">
              {completedTasks.length === 0 && <p className="font-rajdhani text-sm text-muted-foreground">No completed issue tasks.</p>}
              {completedTasks.map((log, index) => (
                <div key={`${log.date}-${index}`} className="border border-border/30 bg-background/30 p-3 rounded-lg">
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
            </Panel>
          </div>
        </div>
      </div>

      {summaryData && (
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-orbitron text-sm tracking-[0.2em] text-primary">
                PERSONNEL SUMMARY
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
              <span className="font-rajdhani text-xs text-muted-foreground">Generated from active engineer record.</span>
              <button
                type="button"
                onClick={handleDownloadSummary}
                disabled={generatingSummary}
                className="border border-primary px-4 py-2 font-orbitron text-xs text-primary disabled:opacity-50"
              >
                {generatingSummary ? "GENERATING PDF..." : "DOWNLOAD PDF"}
              </button>
            </div>
            <PersonnelSummaryTemplate data={summaryData} mode="screen" />
          </DialogContent>
        </Dialog>
      )}

      {summaryData && (
        <div className="fixed left-[-10000px] top-0 opacity-0 pointer-events-none">
          <PersonnelSummaryTemplate ref={summaryRef} data={summaryData} mode="print" className="w-[794px]" />
        </div>
      )}
    </BackgroundLayout>
  );
};

export default EngineerDetail;
