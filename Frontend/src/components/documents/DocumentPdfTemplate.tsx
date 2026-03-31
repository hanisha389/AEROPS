import { forwardRef } from "react";
import type { GeneratedDocument } from "@/lib/api";
import { cn } from "@/lib/utils";

interface DocumentPdfTemplateProps {
  document: GeneratedDocument;
  mode?: "screen" | "print";
  className?: string;
}

const formatTimestamp = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const raw = String(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString();
};

const DocumentPdfTemplate = forwardRef<HTMLDivElement, DocumentPdfTemplateProps>(
  ({ document, mode = "screen", className }, ref) => {
    const fields = document.payload.fields || {};
    const isMedical = document.documentType === "PILOT_MEDICAL_REPORT";
    const observations = String(fields.observations || fields.flightContext || "No observations recorded.");
    const injuries = String(fields.injuries || "None");
    const pilotImage = String(fields.pilotImage || "").trim();

    return (
      <div ref={ref} className={cn("pdf-shell font-mono text-[11px] leading-relaxed", className)} data-mode={mode}>
        <style>{`
          .pdf-shell {
            --pdf-bg: #0b0f14;
            --pdf-text: #e5e7eb;
            --pdf-border: rgba(148, 163, 184, 0.35);
            --pdf-grid: rgba(148, 163, 184, 0.12);
            --pdf-accent: #7dd3fc;
            --pdf-muted: rgba(148, 163, 184, 0.75);
          }

          .pdf-shell[data-mode="print"] {
            --pdf-bg: #f8fafc;
            --pdf-text: #0f172a;
            --pdf-border: #cbd5f5;
            --pdf-grid: rgba(15, 23, 42, 0.08);
            --pdf-accent: #0f172a;
            --pdf-muted: rgba(15, 23, 42, 0.65);
          }

          .pdf-surface {
            background-color: var(--pdf-bg);
            color: var(--pdf-text);
            border: 1px solid var(--pdf-border);
            padding: 24px;
            background-image: linear-gradient(var(--pdf-grid) 1px, transparent 1px),
              linear-gradient(90deg, var(--pdf-grid) 1px, transparent 1px);
            background-size: 24px 24px;
          }

          .pdf-header {
            border-bottom: 1px solid var(--pdf-border);
            padding-bottom: 16px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
          }

          .pdf-section {
            border: 1px solid var(--pdf-border);
            padding: 12px;
            background: rgba(15, 23, 42, 0.2);
            margin-bottom: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }

          .pdf-shell[data-mode="print"] .pdf-section {
            background: rgba(148, 163, 184, 0.12);
          }

          .pdf-section-title {
            font-size: 11px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: var(--pdf-accent);
            margin-bottom: 8px;
          }

          .pdf-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px 16px;
          }

          .pdf-medical-grid {
            display: grid;
            grid-template-columns: 150px 1fr;
            gap: 12px;
            align-items: start;
          }

          .pdf-image {
            width: 150px;
            height: 180px;
            border: 1px solid var(--pdf-border);
            background: rgba(15, 23, 42, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
          }

          .pdf-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            filter: grayscale(100%);
          }

          .pdf-label {
            font-size: 10px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--pdf-muted);
          }

          .pdf-value {
            font-size: 12px;
          }
        `}</style>
        <div className="pdf-surface">
          <header className="pdf-header">
            <div>
              <div className="text-sm tracking-[0.35em] uppercase">{document.title}</div>
              <div className="text-xs text-[var(--pdf-muted)] mt-1">Document ID</div>
              <div className="text-sm font-semibold tracking-[0.2em]">{document.id}</div>
            </div>
            <div className="text-right">
              <div className="text-xs tracking-[0.25em] uppercase">{document.documentType}</div>
              <div className="text-xs text-[var(--pdf-muted)] mt-2">{formatTimestamp(document.createdAt)}</div>
            </div>
          </header>

          {isMedical ? (
            <section className="pdf-section">
              <div className="pdf-section-title">Medical Log Entry</div>
              <div className="pdf-medical-grid">
                <div className="pdf-image">
                  {pilotImage ? (
                    <img src={pilotImage} alt={String(fields.pilotName || "Pilot")} />
                  ) : (
                    <span className="pdf-label">Image Unavailable</span>
                  )}
                </div>
                <div className="pdf-grid">
                  <div>
                    <div className="pdf-label">Pilot Name</div>
                    <div className="pdf-value">{String(fields.pilotName || "N/A")}</div>
                  </div>
                  <div>
                    <div className="pdf-label">Pilot ID</div>
                    <div className="pdf-value">{String(fields.pilotId || document.pilotId || "N/A")}</div>
                  </div>
                  <div>
                    <div className="pdf-label">Record Date</div>
                    <div className="pdf-value">{formatTimestamp(fields.recordDate || document.createdAt)}</div>
                  </div>
                  <div>
                    <div className="pdf-label">Status</div>
                    <div className="pdf-value">{String(fields.status || fields.currentStatus || "N/A")}</div>
                  </div>
                  <div>
                    <div className="pdf-label">Fit For Duty</div>
                    <div className="pdf-value">{String(fields.fitForDuty || "N/A")}</div>
                  </div>
                  <div>
                    <div className="pdf-label">Fatigue Level</div>
                    <div className="pdf-value">{String(fields.fatigueLevel || "N/A")}</div>
                  </div>
                </div>
              </div>

              <div className="pdf-section" style={{ marginTop: "12px" }}>
                <div className="pdf-section-title">Observations</div>
                <div className="pdf-value">{observations}</div>
              </div>

              <div className="pdf-section" style={{ marginTop: "12px" }}>
                <div className="pdf-section-title">Reported Injuries</div>
                <div className="pdf-value">{injuries}</div>
              </div>

              <div className="pdf-section" style={{ marginTop: "12px" }}>
                <div className="pdf-section-title">Remarks</div>
                <div className="pdf-value">{String(fields.remarks || "No remarks provided.")}</div>
              </div>
            </section>
          ) : (
            <section className="pdf-section">
              <div className="pdf-section-title">Structured Content</div>
              <div className="pdf-grid">
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key}>
                    <div className="pdf-label">{key}</div>
                    <div className="pdf-value">{String(value)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  },
);

DocumentPdfTemplate.displayName = "DocumentPdfTemplate";

export default DocumentPdfTemplate;
