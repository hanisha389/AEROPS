import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { Panel } from "@/components/ui/custom/Panel";
import type { GeneratedDocument } from "@/lib/api";

interface DocumentViewerProps {
  document: GeneratedDocument;
  onClose: () => void;
  backTo?: string;
  headerTitle?: string;
}

const formatTimestamp = (value: string | number | boolean | null | undefined) => {
  if (value === null || value === undefined) {
    return "N/A";
  }
  const raw = String(value);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw || "N/A";
  }
  return date.toLocaleString();
};

const DocumentViewer = ({
  document,
  onClose,
  backTo = "/documents",
  headerTitle = "DOCUMENTATION READER",
}: DocumentViewerProps) => {
  const fields = document.payload.fields || {};
  const isMedical = document.documentType === "PILOT_MEDICAL_REPORT";
  const observations = String(fields.observations || fields.flightContext || "No observations recorded.");
  const injuries = String(fields.injuries || "None");
  const pilotId = fields.pilotId ?? document.pilotId ?? "N/A";
  const recordDate = fields.recordDate || document.createdAt;

  const vitals = [
    { label: "Fit For Duty", value: fields.fitForDuty },
    { label: "Fatigue Level", value: fields.fatigueLevel },
    { label: "Heart Rate", value: fields.heartRate },
    { label: "Blood Pressure", value: fields.bloodPressure },
    { label: "Oxygen Saturation", value: fields.oxygenSaturation },
    { label: "G Tolerance", value: fields.gToleranceLevel },
    { label: "Stress Level", value: fields.stressLevel },
  ].filter((item) => String(item.value ?? "").trim().length > 0);

  return (
    <BackgroundLayout>
      <PageHeader title={headerTitle} backTo={backTo} />
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-4 flex justify-end">
          <button
            onClick={onClose}
            className="rounded bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 font-inter font-medium text-xs tracking-widest uppercase text-gray-300 transition-colors"
          >
            CLOSE DOCUMENT
          </button>
        </div>

        <Panel className="p-8">
          <header className="border-b border-white/10 pb-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-rajdhani text-3xl font-bold text-gray-100 uppercase tracking-widest">
                  {document.title}
                </h2>
                <p className="font-inter text-sm text-gray-400 mt-2">Document ID: {document.id}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded bg-accent/20 text-accent border border-accent/30 mb-2">
                  {document.documentType}
                </span>
                <p className="font-inter text-sm text-gray-400">{formatTimestamp(document.createdAt)}</p>
              </div>
            </div>
          </header>

          {isMedical ? (
            <section className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
              <div className="overflow-hidden rounded border border-white/10 bg-black/40 aspect-square flex items-center justify-center">
                {String(fields.pilotImage || "").trim() ? (
                  <img
                    src={String(fields.pilotImage)}
                    alt={String(fields.pilotName || "Pilot")}
                    className="h-full w-full object-cover grayscale opacity-80"
                  />
                ) : (
                  <div className="text-xs font-inter text-gray-600 uppercase tracking-widest">Image Unavailable</div>
                )}
              </div>
              <div className="flex flex-col gap-4 bg-black/20 p-5 rounded border border-white/5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Subject Name</span>
                    <span className="font-inter text-sm font-medium text-gray-200">{String(fields.pilotName || "N/A")}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Pilot ID</span>
                    <span className="font-inter text-sm font-medium text-gray-200">{String(pilotId)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Record Date</span>
                    <span className="font-inter text-sm font-medium text-gray-200">{formatTimestamp(recordDate)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Current Status</span>
                    <span className="font-inter text-sm font-medium text-gray-200">
                      {String(fields.status || fields.currentStatus || "N/A")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Fit For Duty</span>
                    <span className="font-inter text-sm font-bold text-gray-200">
                      {String(fields.fitForDuty || "N/A")}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Fatigue Level</span>
                    <span className="font-inter text-sm font-medium text-gray-200">{String(fields.fatigueLevel || "N/A")}</span>
                  </div>
                </div>

                {vitals.length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Vitals / Medical Data</span>
                    <div className="grid grid-cols-2 gap-3">
                      {vitals.map((item) => (
                        <div key={item.label}>
                          <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">{item.label}</span>
                          <span className="font-inter text-sm text-gray-200">{String(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-white/5 pt-4">
                  <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Observations</span>
                  <p className="font-inter text-sm text-gray-300">{observations}</p>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Reported Injuries</span>
                  <p className="font-inter text-sm text-gray-300">{injuries}</p>
                </div>

                <div className="border-t border-white/5 pt-4">
                  <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Medical Officer Remarks</span>
                  <p className="font-inter text-sm text-gray-300 italic">"{String(fields.remarks || "No remarks provided.")}"</p>
                </div>
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              {document.payload.fixedSections && document.payload.fixedSections.length > 0 && (
                <div className="space-y-3">
                  {document.payload.fixedSections.map((section) => (
                    <div key={section} className="border-l-2 border-accent/50 bg-accent/5 p-4 rounded-r">
                      <h3 className="font-rajdhani text-sm font-semibold tracking-widest text-gray-200 uppercase">{section}</h3>
                    </div>
                  ))}
                </div>
              )}
              <div className="bg-black/20 p-5 rounded border border-white/5">
                <h3 className="mb-4 font-rajdhani text-xs font-bold tracking-[0.14em] text-gray-500 uppercase border-b border-white/5 pb-2">
                  Structured Content
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {Object.entries(fields).map(([key, value]) => (
                    <div key={key}>
                      <span className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">{key}</span>
                      <span className="font-inter text-sm text-gray-200">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </Panel>
      </div>
    </BackgroundLayout>
  );
};

export default DocumentViewer;
