import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TrainingReportData {
  squadronName: string;
  operationId: string;
  timestamp: string;
  classification: string;
  pilots: {
    id: number;
    name: string;
    callSign: string;
    rank?: string;
    assignedAircraft?: string | null;
    skillLevel?: string;
  }[];
  training: {
    scenarioName: string;
    completionStatus: string;
    duration: string;
    score?: number;
    grade?: string;
    debriefSource?: string;
  };
  notes: string;
  preTrainingChecks: {
    aircraftId: string;
    checklist: Record<string, string>;
  }[];
  postTrainingChecks: {
    aircraftId: string;
    checklist: Record<string, string>;
  }[];
  pilotInspections: {
    pilotId: number;
    callSign: string;
    baselineFatigue: string;
    hydration: string;
    pulseStable: string;
    remarks: string;
  }[];
  medicalReports: {
    pilotId: number;
    callSign: string;
    fatigueLevel: string;
    fitForDuty: string;
    injuries: string[];
    remarks: string;
  }[];
  debriefMetrics?: {
    peakG?: number;
    peakStress?: number;
    peakHeartRate?: number;
    peakFatigue?: number;
    telemetrySummary?: {
      speedMin?: number;
      speedAvg?: number;
      speedMax?: number;
      altitudeAvg?: number;
      altitudeMax?: number;
      headingRange?: string;
    };
    plannedPath?: string[];
    actionSummary?: string[];
  };
  evaluation: {
    summary: string;
    recommendations: string[];
    finalStatus: string;
  };
  medicalNotes: string[];
  cognitiveNotes: string[];
}

interface TrainingReportTemplateProps {
  data: TrainingReportData;
  mode?: "screen" | "print";
  className?: string;
}

const formatLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toUpperCase();

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const TrainingReportTemplate = forwardRef<HTMLDivElement, TrainingReportTemplateProps>(
  ({ data, mode = "screen", className }, ref) => {
    const scoreLabel = data.training.score !== undefined ? `${data.training.score}/100` : "N/A";
    const gradeLabel = data.training.grade || "N/A";

    return (
      <div ref={ref} className={cn("report-shell font-mono text-[11px] leading-relaxed", className)} data-mode={mode}>
        <style>{`
          .report-shell {
            --report-bg: #0b0f14;
            --report-text: #e5e7eb;
            --report-border: rgba(148, 163, 184, 0.35);
            --report-grid: rgba(148, 163, 184, 0.12);
            --report-accent: #7dd3fc;
            --report-muted: rgba(148, 163, 184, 0.75);
            --report-stamp: #38bdf8;
          }

          .report-shell[data-mode="print"] {
            --report-bg: #f8fafc;
            --report-text: #0f172a;
            --report-border: #cbd5f5;
            --report-grid: rgba(15, 23, 42, 0.08);
            --report-accent: #0f172a;
            --report-muted: rgba(15, 23, 42, 0.65);
            --report-stamp: #0f172a;
          }

          .report-surface {
            background-color: var(--report-bg);
            color: var(--report-text);
            border: 1px solid var(--report-border);
            padding: 24px;
            background-image: linear-gradient(var(--report-grid) 1px, transparent 1px),
              linear-gradient(90deg, var(--report-grid) 1px, transparent 1px);
            background-size: 24px 24px;
          }

          .report-header {
            border-bottom: 1px solid var(--report-border);
            padding-bottom: 16px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }

          .report-section {
            border: 1px solid var(--report-border);
            padding: 12px;
            background: rgba(15, 23, 42, 0.2);
            margin-bottom: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .report-shell[data-mode="print"] .report-section {
            background: rgba(148, 163, 184, 0.12);
          }

          .report-section-title {
            font-size: 11px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: var(--report-accent);
            margin-bottom: 8px;
          }

          .report-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 16px;
          }

          .report-label {
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--report-muted);
          }

          .report-value {
            font-size: 12px;
          }

          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }

          .report-table th,
          .report-table td {
            border-bottom: 1px solid var(--report-border);
            padding: 6px 4px;
            text-align: left;
          }

          .report-table th {
            text-transform: uppercase;
            letter-spacing: 0.2em;
            font-size: 9px;
            color: var(--report-muted);
          }

          .report-stamp {
            border: 2px solid var(--report-stamp);
            color: var(--report-stamp);
            padding: 6px 10px;
            text-transform: uppercase;
            letter-spacing: 0.22em;
            font-size: 10px;
            font-weight: 700;
            transform: rotate(-8deg);
            display: inline-block;
          }

          .report-page-break {
            break-before: page;
            page-break-before: always;
          }
        `}</style>
        <div className="report-surface">
          <header className="report-header">
            <div>
              <div className="text-sm tracking-[0.35em] uppercase">{data.squadronName}</div>
              <div className="text-xs text-[var(--report-muted)] mt-1">Operation / Training ID</div>
              <div className="text-sm font-semibold tracking-[0.2em]">{data.operationId}</div>
              <div className="text-xs text-[var(--report-muted)] mt-2">Timestamp</div>
              <div>{formatTimestamp(data.timestamp)}</div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className="report-stamp">{data.classification}</span>
              <span className="text-xs tracking-[0.25em] uppercase">Official Airforce Debrief</span>
            </div>
          </header>

          <section className="report-section">
            <div className="report-section-title">Pilot Details</div>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Pilot</th>
                  <th>ID</th>
                  <th>Rank</th>
                  <th>Call Sign</th>
                  <th>Aircraft</th>
                  <th>Skill</th>
                </tr>
              </thead>
              <tbody>
                {data.pilots.map((pilot) => (
                  <tr key={pilot.id}>
                    <td>{pilot.name}</td>
                    <td>#{pilot.id}</td>
                    <td>{pilot.rank || "N/A"}</td>
                    <td>{pilot.callSign}</td>
                    <td>{pilot.assignedAircraft || "Unassigned"}</td>
                    <td>{pilot.skillLevel || "Standard"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="report-section">
            <div className="report-section-title">Training Summary</div>
            <div className="report-grid">
              <div>
                <div className="report-label">Scenario Name</div>
                <div className="report-value">{data.training.scenarioName}</div>
              </div>
              <div>
                <div className="report-label">Completion Status</div>
                <div className="report-value">{data.training.completionStatus}</div>
              </div>
              <div>
                <div className="report-label">Duration</div>
                <div className="report-value">{data.training.duration}</div>
              </div>
              <div>
                <div className="report-label">Score / Evaluation</div>
                <div className="report-value">{scoreLabel} ({gradeLabel})</div>
              </div>
              <div>
                <div className="report-label">Debrief Source</div>
                <div className="report-value">{data.training.debriefSource || "N/A"}</div>
              </div>
              <div>
                <div className="report-label">Debrief Notes</div>
                <div className="report-value">{data.notes || "No notes recorded."}</div>
              </div>
            </div>
          </section>

          {data.debriefMetrics && (
            <section className="report-section">
              <div className="report-section-title">Flight Metrics</div>
              <div className="report-grid">
                <div>
                  <div className="report-label">Peak G</div>
                  <div className="report-value">{data.debriefMetrics.peakG ?? "N/A"}</div>
                </div>
                <div>
                  <div className="report-label">Peak Stress</div>
                  <div className="report-value">{data.debriefMetrics.peakStress ?? "N/A"}%</div>
                </div>
                <div>
                  <div className="report-label">Peak Heart Rate</div>
                  <div className="report-value">{data.debriefMetrics.peakHeartRate ?? "N/A"} bpm</div>
                </div>
                <div>
                  <div className="report-label">Peak Fatigue</div>
                  <div className="report-value">{data.debriefMetrics.peakFatigue ?? "N/A"}%</div>
                </div>
              </div>
              {data.debriefMetrics.telemetrySummary && (
                <div className="mt-3 report-grid">
                  <div>
                    <div className="report-label">Speed Range</div>
                    <div className="report-value">
                      {data.debriefMetrics.telemetrySummary.speedMin ?? "N/A"} - {data.debriefMetrics.telemetrySummary.speedMax ?? "N/A"} kts
                    </div>
                  </div>
                  <div>
                    <div className="report-label">Speed Avg</div>
                    <div className="report-value">{data.debriefMetrics.telemetrySummary.speedAvg ?? "N/A"} kts</div>
                  </div>
                  <div>
                    <div className="report-label">Altitude Avg</div>
                    <div className="report-value">{data.debriefMetrics.telemetrySummary.altitudeAvg ?? "N/A"} m</div>
                  </div>
                  <div>
                    <div className="report-label">Altitude Max</div>
                    <div className="report-value">{data.debriefMetrics.telemetrySummary.altitudeMax ?? "N/A"} m</div>
                  </div>
                  <div>
                    <div className="report-label">Heading Range</div>
                    <div className="report-value">{data.debriefMetrics.telemetrySummary.headingRange || "N/A"}</div>
                  </div>
                </div>
              )}
            </section>
          )}

          <section className="report-section report-page-break">
            <div className="report-section-title">Responses Section</div>
            {data.preTrainingChecks.map((check) => (
              <div key={`pre-${check.aircraftId}`} className="mb-4">
                <div className="text-xs tracking-[0.2em] uppercase mb-2">Pre-Training Check - Aircraft {check.aircraftId}</div>
                <div className="report-grid">
                  {Object.entries(check.checklist).map(([key, value]) => (
                    <div key={key}>
                      <div className="report-label">{formatLabel(key)}</div>
                      <div className="report-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {data.postTrainingChecks.map((check) => (
              <div key={`post-${check.aircraftId}`} className="mb-4">
                <div className="text-xs tracking-[0.2em] uppercase mb-2">Post-Training Check - Aircraft {check.aircraftId}</div>
                <div className="report-grid">
                  {Object.entries(check.checklist).map(([key, value]) => (
                    <div key={key}>
                      <div className="report-label">{formatLabel(key)}</div>
                      <div className="report-value">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {data.pilotInspections.map((inspection) => (
              <div key={`inspection-${inspection.pilotId}`} className="mb-4">
                <div className="text-xs tracking-[0.2em] uppercase mb-2">Pilot Pre-Inspection - {inspection.callSign}</div>
                <div className="report-grid">
                  <div>
                    <div className="report-label">Baseline Fatigue</div>
                    <div className="report-value">{inspection.baselineFatigue}</div>
                  </div>
                  <div>
                    <div className="report-label">Hydration</div>
                    <div className="report-value">{inspection.hydration}</div>
                  </div>
                  <div>
                    <div className="report-label">Pulse Stable</div>
                    <div className="report-value">{inspection.pulseStable}</div>
                  </div>
                  <div>
                    <div className="report-label">Remarks</div>
                    <div className="report-value">{inspection.remarks}</div>
                  </div>
                </div>
              </div>
            ))}

            {data.medicalReports.map((medical) => (
              <div key={`medical-${medical.pilotId}`} className="mb-4">
                <div className="text-xs tracking-[0.2em] uppercase mb-2">Medical Log - {medical.callSign}</div>
                <div className="report-grid">
                  <div>
                    <div className="report-label">Fatigue Level</div>
                    <div className="report-value">{medical.fatigueLevel}</div>
                  </div>
                  <div>
                    <div className="report-label">Fit For Duty</div>
                    <div className="report-value">{medical.fitForDuty}</div>
                  </div>
                  <div>
                    <div className="report-label">Injuries</div>
                    <div className="report-value">{medical.injuries.join(", ")}</div>
                  </div>
                  <div>
                    <div className="report-label">Remarks</div>
                    <div className="report-value">{medical.remarks}</div>
                  </div>
                </div>
              </div>
            ))}

            {data.debriefMetrics?.plannedPath && data.debriefMetrics.plannedPath.length > 0 && (
              <div className="mb-4">
                <div className="text-xs tracking-[0.2em] uppercase mb-2">Planned Route</div>
                <div className="space-y-1">
                  {data.debriefMetrics.plannedPath.map((step, index) => (
                    <div key={`${step}-${index}`} className="report-value">{index + 1}. {step}</div>
                  ))}
                </div>
              </div>
            )}

            {data.debriefMetrics?.actionSummary && data.debriefMetrics.actionSummary.length > 0 && (
              <div className="mb-2">
                <div className="text-xs tracking-[0.2em] uppercase mb-2">Flight Actions</div>
                <div className="space-y-1">
                  {data.debriefMetrics.actionSummary.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="report-value">{entry}</div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="report-section">
            <div className="report-section-title">Medical / Cognitive Notes</div>
            <div className="report-grid">
              <div>
                <div className="report-label">Medical Notes</div>
                <div className="report-value">
                  {data.medicalNotes.length > 0 ? data.medicalNotes.join(" | ") : "No medical notes recorded."}
                </div>
              </div>
              <div>
                <div className="report-label">Cognitive Notes</div>
                <div className="report-value">
                  {data.cognitiveNotes.length > 0 ? data.cognitiveNotes.join(" | ") : "No cognitive notes recorded."}
                </div>
              </div>
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-title">Final Evaluation</div>
            <div className="report-grid">
              <div>
                <div className="report-label">Assessment Summary</div>
                <div className="report-value">{data.evaluation.summary}</div>
              </div>
              <div>
                <div className="report-label">Recommendations</div>
                <div className="report-value">{data.evaluation.recommendations.join(" | ")}</div>
              </div>
            </div>
            <div className="mt-4">
              <span className="report-stamp">{data.evaluation.finalStatus}</span>
            </div>
          </section>
        </div>
      </div>
    );
  },
);

TrainingReportTemplate.displayName = "TrainingReportTemplate";

export default TrainingReportTemplate;
