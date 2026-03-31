import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface SummaryEntry {
  label: string;
  value: string;
}

interface SummarySection {
  title: string;
  entries?: SummaryEntry[];
  lines?: string[];
}

export interface PersonnelSummaryData {
  classification: string;
  timestamp: string;
  title: string;
  subjectName: string;
  subjectIdLabel: string;
  subjectId: string;
  roleLabel: string;
  roleValue: string;
  statusLabel?: string;
  statusValue?: string;
  sections: SummarySection[];
  finalStatus?: string;
}

interface PersonnelSummaryTemplateProps {
  data: PersonnelSummaryData;
  mode?: "screen" | "print";
  className?: string;
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const PersonnelSummaryTemplate = forwardRef<HTMLDivElement, PersonnelSummaryTemplateProps>(
  ({ data, mode = "screen", className }, ref) => {
    return (
      <div ref={ref} className={cn("summary-shell font-mono text-[11px] leading-relaxed", className)} data-mode={mode}>
        <style>{`
          .summary-shell {
            --summary-bg: #0b0f14;
            --summary-text: #e5e7eb;
            --summary-border: rgba(148, 163, 184, 0.35);
            --summary-grid: rgba(148, 163, 184, 0.12);
            --summary-accent: #7dd3fc;
            --summary-muted: rgba(148, 163, 184, 0.75);
            --summary-stamp: #38bdf8;
          }

          .summary-shell[data-mode="print"] {
            --summary-bg: #f8fafc;
            --summary-text: #0f172a;
            --summary-border: #cbd5f5;
            --summary-grid: rgba(15, 23, 42, 0.08);
            --summary-accent: #0f172a;
            --summary-muted: rgba(15, 23, 42, 0.65);
            --summary-stamp: #0f172a;
          }

          .summary-surface {
            background-color: var(--summary-bg);
            color: var(--summary-text);
            border: 1px solid var(--summary-border);
            padding: 24px;
            background-image: linear-gradient(var(--summary-grid) 1px, transparent 1px),
              linear-gradient(90deg, var(--summary-grid) 1px, transparent 1px);
            background-size: 24px 24px;
          }

          .summary-header {
            border-bottom: 1px solid var(--summary-border);
            padding-bottom: 16px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }

          .summary-section {
            border: 1px solid var(--summary-border);
            padding: 12px;
            background: rgba(15, 23, 42, 0.2);
            margin-bottom: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .summary-shell[data-mode="print"] .summary-section {
            background: rgba(148, 163, 184, 0.12);
          }

          .summary-section-title {
            font-size: 11px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: var(--summary-accent);
            margin-bottom: 8px;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 16px;
          }

          .summary-label {
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--summary-muted);
          }

          .summary-value {
            font-size: 12px;
          }

          .summary-stamp {
            border: 2px solid var(--summary-stamp);
            color: var(--summary-stamp);
            padding: 6px 10px;
            text-transform: uppercase;
            letter-spacing: 0.22em;
            font-size: 10px;
            font-weight: 700;
            transform: rotate(-8deg);
            display: inline-block;
          }
        `}</style>
        <div className="summary-surface">
          <header className="summary-header">
            <div>
              <div className="text-sm tracking-[0.35em] uppercase">{data.title}</div>
              <div className="text-xs text-[var(--summary-muted)] mt-1">Timestamp</div>
              <div className="text-sm font-semibold tracking-[0.2em]">{formatTimestamp(data.timestamp)}</div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <span className="summary-stamp">{data.classification}</span>
            </div>
          </header>

          <section className="summary-section">
            <div className="summary-section-title">Subject Profile</div>
            <div className="summary-grid">
              <div>
                <div className="summary-label">Name</div>
                <div className="summary-value">{data.subjectName}</div>
              </div>
              <div>
                <div className="summary-label">{data.subjectIdLabel}</div>
                <div className="summary-value">{data.subjectId}</div>
              </div>
              <div>
                <div className="summary-label">{data.roleLabel}</div>
                <div className="summary-value">{data.roleValue}</div>
              </div>
              {data.statusLabel && data.statusValue && (
                <div>
                  <div className="summary-label">{data.statusLabel}</div>
                  <div className="summary-value">{data.statusValue}</div>
                </div>
              )}
            </div>
          </section>

          {data.sections.map((section) => (
            <section key={section.title} className="summary-section">
              <div className="summary-section-title">{section.title}</div>
              {section.entries && section.entries.length > 0 && (
                <div className="summary-grid">
                  {section.entries.map((entry) => (
                    <div key={entry.label}>
                      <div className="summary-label">{entry.label}</div>
                      <div className="summary-value">{entry.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {section.lines && section.lines.length > 0 && (
                <div className="mt-3 space-y-1">
                  {section.lines.map((line, index) => (
                    <div key={`${section.title}-${index}`} className="summary-value">
                      {line}
                    </div>
                  ))}
                </div>
              )}
              {(!section.entries || section.entries.length === 0) && (!section.lines || section.lines.length === 0) && (
                <div className="summary-value">No data recorded.</div>
              )}
            </section>
          ))}

          {data.finalStatus && (
            <section className="summary-section">
              <div className="summary-section-title">Final Status</div>
              <span className="summary-stamp">{data.finalStatus}</span>
            </section>
          )}
        </div>
      </div>
    );
  },
);

PersonnelSummaryTemplate.displayName = "PersonnelSummaryTemplate";

export default PersonnelSummaryTemplate;
