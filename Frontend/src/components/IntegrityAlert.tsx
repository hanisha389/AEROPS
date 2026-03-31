import { useEffect, useMemo, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { tamperEventName } from "@/lib/api";

interface IntegrityLogEntry {
  timestamp: string;
  tables: string[];
}

const formatTimestamp = (value?: string) => {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const IntegrityAlert = () => {
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState<string | undefined>(undefined);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<IntegrityLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ tables: string[]; timestamp: string }>).detail;
      setTables(detail?.tables || []);
      setTimestamp(detail?.timestamp);
      setOpen(true);
      setShowLogs(false);
      setLogsError(null);
    };

    window.addEventListener(tamperEventName, handler);
    return () => window.removeEventListener(tamperEventName, handler);
  }, []);

  const issueLabel = useMemo(() => {
    if (!tables.length) {
      return "Data mismatch detected. The primary database no longer matches the shadow copy.";
    }
    return `Data mismatch detected in: ${tables.join(", ")}.`;
  }, [tables]);

  const loadLogs = async () => {
    if (logsLoading) {
      return;
    }
    setLogsLoading(true);
    setLogsError(null);
    try {
      const response = await fetch("/api/integrity/logs");
      const data = await response.json();
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
      setShowLogs(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load logs";
      setLogsError(message);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleReset = async () => {
    await fetch("/api/integrity/reset", { method: "POST" });
    window.location.reload();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-5xl w-[92vw] min-h-[70vh] border border-primary/40 bg-[#0a111d] text-white shadow-[0_0_60px_rgba(14,165,233,0.35)]">
        <AlertDialogHeader className="space-y-4">
          <AlertDialogTitle className="font-orbitron text-2xl tracking-[0.24em] text-primary">
            Data Tampering Warning
          </AlertDialogTitle>
          <div className="rounded-xl border border-primary/20 bg-white/5 p-5 text-sm text-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.32em] text-primary/80">Detected At</div>
              <div className="font-mono text-sm text-white">{formatTimestamp(timestamp)}</div>
            </div>
            <p className="mt-4 text-base text-slate-100">{issueLabel}</p>
            <p className="mt-2 text-sm text-slate-400">
              Review the integrity logs or reset the primary database from the protected shadow copy.
            </p>
          </div>
        </AlertDialogHeader>

        {showLogs && (
          <div className="rounded-xl border border-primary/20 bg-[#0b1627]/80 p-5">
            <div className="text-xs uppercase tracking-[0.28em] text-primary/80">Integrity Logs</div>
            {logsError && <p className="mt-3 text-sm text-red-300">{logsError}</p>}
            {!logsError && logs.length === 0 && !logsLoading && (
              <p className="mt-3 text-sm text-slate-400">No integrity log entries recorded yet.</p>
            )}
            <div className="mt-4 max-h-60 space-y-3 overflow-y-auto pr-2">
              {logs.map((entry, index) => (
                <div key={`${entry.timestamp}-${index}`} className="rounded-lg border border-white/10 bg-black/30 p-3">
                  <div className="text-xs uppercase tracking-[0.24em] text-primary/70">{formatTimestamp(entry.timestamp)}</div>
                  <div className="mt-2 text-sm text-slate-200">
                    {entry.tables?.length ? `Tables: ${entry.tables.join(", ")}` : "Data mismatch detected."}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-end gap-3">
          <Button
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/10"
            onClick={loadLogs}
            disabled={logsLoading}
          >
            {logsLoading ? "Loading Logs..." : "View Logs"}
          </Button>
          <Button
            variant="destructive"
            className="bg-red-600 text-white hover:bg-red-500"
            onClick={handleReset}
          >
            Reset Database
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default IntegrityAlert;
