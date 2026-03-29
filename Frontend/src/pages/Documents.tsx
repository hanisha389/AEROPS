import { useEffect, useMemo, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type GeneratedDocument } from "@/lib/api";

const Documents = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [pilotFilter, setPilotFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);

  const load = () => {
    api.listDocuments({
      type: typeFilter || undefined,
      pilotId: pilotFilter ? Number(pilotFilter) : undefined,
      aircraftId: aircraftFilter || undefined,
    }).then(setDocuments);
  };

  useEffect(() => {
    load();
  }, []);

  const documentTypes = useMemo(
    () => Array.from(new Set(documents.map((doc) => doc.documentType))).sort(),
    [documents],
  );

  if (selectedDoc) {
    const fields = selectedDoc.payload.fields;
    const relatedEntity = selectedDoc.pilotId ? `Pilot #${selectedDoc.pilotId}` : selectedDoc.aircraftId ? `Aircraft ${selectedDoc.aircraftId}` : "General";
    const isMedical = selectedDoc.documentType === "PILOT_MEDICAL_REPORT";

    return (
      <BackgroundLayout>
        <PageHeader title="DOCUMENT VIEW" backTo="/documents" />
        <div className="p-6">
          <div className="mb-3 flex justify-end">
            <button onClick={() => setSelectedDoc(null)} className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">BACK TO DOCUMENTS</button>
          </div>

          <article className="space-y-4 border border-border/40 bg-card/30 p-5">
            <header className="border-b border-border/30 pb-3">
              <h2 className="font-orbitron text-lg text-primary">{selectedDoc.title}</h2>
              <p className="font-rajdhani text-sm text-muted-foreground">Date: {selectedDoc.createdAt}</p>
              <p className="font-rajdhani text-sm text-muted-foreground">Related Entity: {relatedEntity}</p>
              <p className="font-rajdhani text-sm text-muted-foreground">Type: {selectedDoc.documentType}</p>
            </header>

            {isMedical ? (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-[15rem_1fr]">
                <div className="overflow-hidden border border-border/30 bg-background/20">
                  {String(fields.pilotImage || "").trim() ? (
                    <img src={String(fields.pilotImage)} alt={String(fields.pilotName || "Pilot")} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-56 items-center justify-center text-xs text-muted-foreground">No pilot image</div>
                  )}
                </div>
                <div className="space-y-1 border border-border/30 bg-background/20 p-3">
                  <p className="font-rajdhani text-sm text-muted-foreground">Pilot: <span className="text-primary">{String(fields.pilotName || "N/A")}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Status: <span className="text-primary">{String(fields.status || "N/A")}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Fit for Flight: <span className="text-primary">{String(fields.fitForDuty || "N/A")}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Fatigue Level: <span className="text-primary">{String(fields.fatigueLevel || "N/A")}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Injuries: <span className="text-primary">{String(fields.injuries || "None")}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Remarks: <span className="text-primary">{String(fields.remarks || "None")}</span></p>
                </div>
              </section>
            ) : (
              <section className="space-y-2">
                {selectedDoc.payload.fixedSections.map((section) => (
                  <div key={section} className="border border-border/30 bg-background/20 p-3">
                    <h3 className="font-orbitron text-xs tracking-[0.14em] text-primary">{section}</h3>
                  </div>
                ))}
                <div className="border border-border/30 bg-background/20 p-3">
                  <h3 className="mb-2 font-orbitron text-xs tracking-[0.14em] text-primary">Structured Content</h3>
                  {Object.entries(fields).map(([key, value]) => (
                    <p key={key} className="font-rajdhani text-sm text-muted-foreground">
                      <span className="text-primary">{key}</span>: {String(value)}
                    </p>
                  ))}
                </div>
              </section>
            )}
          </article>
        </div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="DOCUMENTS" />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 border border-border/40 bg-card/30 p-4 md:grid-cols-4">
          <label className="text-xs text-muted-foreground">Type
            <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All</option>
              {documentTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Pilot ID
            <input className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={pilotFilter} onChange={(e) => setPilotFilter(e.target.value)} />
          </label>
          <label className="text-xs text-muted-foreground">Aircraft ID
            <input className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={aircraftFilter} onChange={(e) => setAircraftFilter(e.target.value)} />
          </label>
          <div className="flex items-end">
            <button onClick={load} className="w-full border border-primary px-3 py-2 font-orbitron text-xs text-primary">APPLY FILTERS</button>
          </div>
        </div>

        <div className="space-y-3">
          {documents.length === 0 && <p className="text-sm text-muted-foreground">No documents found.</p>}
          {documents.map((doc) => (
            <button key={doc.id} onClick={() => setSelectedDoc(doc)} className="w-full border border-border/40 bg-card/30 p-3 text-left hover:border-primary/60">
              <p className="font-orbitron text-xs text-primary">#{doc.id} {doc.title}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">{doc.documentType}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">{doc.createdAt}</p>
            </button>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default Documents;
