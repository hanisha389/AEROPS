import { useEffect, useMemo, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api, type GeneratedDocument } from "@/lib/api";
import { Panel } from "@/components/ui/custom/Panel";

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
        <PageHeader title="DOCUMENTATION READER" backTo="/documents" />
        <div className="p-6 max-w-4xl mx-auto">
          <div className="mb-4 flex justify-end">
            <button onClick={() => setSelectedDoc(null)} className="rounded bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 font-inter font-medium text-xs tracking-widest uppercase text-gray-300 transition-colors">
              CLOSE DOCUMENT
            </button>
          </div>

          <Panel className="p-8">
            <header className="border-b border-white/10 pb-6 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-rajdhani text-3xl font-bold text-gray-100 uppercase tracking-widest">{selectedDoc.title}</h2>
                  <p className="font-inter text-sm text-gray-400 mt-2">Document ID: {selectedDoc.id}</p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded bg-accent/20 text-accent border border-accent/30 mb-2">
                    {selectedDoc.documentType}
                  </span>
                  <p className="font-inter text-sm text-gray-400">{new Date(selectedDoc.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </header>

            {isMedical ? (
              <section className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_1fr]">
                <div className="overflow-hidden rounded border border-white/10 bg-black/40 aspect-square flex items-center justify-center">
                  {String(fields.pilotImage || "").trim() ? (
                    <img src={String(fields.pilotImage)} alt={String(fields.pilotName || "Pilot")} className="h-full w-full object-cover grayscale opacity-80" />
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
                      <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-1">Current Status</span>
                      <span className="font-inter text-sm font-medium text-gray-200">{String(fields.status || "N/A")}</span>
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
                  
                  <div className="border-t border-white/5 pt-4 mt-2">
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Reported Injuries</span>
                    <p className="font-inter text-sm text-gray-300">{String(fields.injuries || "None")}</p>
                  </div>
                  
                  <div className="border-t border-white/5 pt-4">
                    <span className="block text-[10px] uppercase tracking-widest text-gray-500 mb-2">Medical Officer Remarks</span>
                    <p className="font-inter text-sm text-gray-300 italic">"{String(fields.remarks || "No remarks provided.")}"</p>
                  </div>
                </div>
              </section>
            ) : (
              <section className="space-y-6">
                {selectedDoc.payload.fixedSections && selectedDoc.payload.fixedSections.length > 0 && (
                  <div className="space-y-3">
                    {selectedDoc.payload.fixedSections.map((section) => (
                      <div key={section} className="border-l-2 border-accent/50 bg-accent/5 p-4 rounded-r">
                        <h3 className="font-rajdhani text-sm font-semibold tracking-widest text-gray-200 uppercase">{section}</h3>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-black/20 p-5 rounded border border-white/5">  
                  <h3 className="mb-4 font-rajdhani text-xs font-bold tracking-[0.14em] text-gray-500 uppercase border-b border-white/5 pb-2">Structured Content</h3>
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
  }

  return (
    <BackgroundLayout>
      <PageHeader title="DATABASE ARCHIVE" />
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <Panel className="p-4 bg-gray-900/90">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 items-end">
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest font-inter mb-1">Document Type</label>
              <select className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm font-inter text-gray-200 outline-none focus:border-accent/50 transition-colors" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}> 
                <option value="">All Categories</option>
                {documentTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)} 
              </select>
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest font-inter mb-1">Pilot ID Registry</label>
              <input type="text" placeholder="Enter ID..." className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm font-inter text-gray-200 outline-none focus:border-accent/50 transition-colors placeholder:text-gray-600" value={pilotFilter} onChange={(e) => setPilotFilter(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-gray-400 uppercase tracking-widest font-inter mb-1">Aircraft Serial</label>
              <input type="text" placeholder="Enter Serial..." className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm font-inter text-gray-200 outline-none focus:border-accent/50 transition-colors placeholder:text-gray-600" value={aircraftFilter} onChange={(e) => setAircraftFilter(e.target.value)} />
            </div>
            <div>
              <button onClick={load} className="w-full rounded bg-accent/10 hover:bg-accent/20 border border-accent/30 px-3 py-2 font-rajdhani font-bold text-sm tracking-widest text-accent transition-colors">QUERY ARCHIVE</button>
            </div>
          </div>
        </Panel>

        <Panel className="p-0 overflow-hidden">
          {documents.length === 0 ? (
            <div className="p-8 text-center text-sm font-inter text-gray-500">No matching documents found in archive.</div>
          ) : (
            <div className="overflow-x-auto border-t border-white/5">
              <table className="w-full text-left font-inter text-sm">
                <thead>
                  <tr className="bg-black/40 border-b border-white/10">
                    <th className="px-6 py-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase w-20">ID</th>
                    <th className="px-6 py-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Title</th>
                    <th className="px-6 py-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Classification</th>
                    <th className="px-6 py-3 text-[10px] font-bold tracking-widest text-gray-500 uppercase">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {documents.map((doc) => (
                    <tr 
                      key={doc.id} 
                      onClick={() => setSelectedDoc(doc)} 
                      className="hover:bg-white/[0.03] cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4 text-gray-500 group-hover:text-accent font-mono transition-colors">#{doc.id}</td>
                      <td className="px-6 py-4 font-medium text-gray-200 group-hover:text-white transition-colors">{doc.title}</td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-1 text-[10px] font-bold tracking-widest uppercase rounded bg-gray-800 text-gray-400 border border-white/5">
                          {doc.documentType.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-400 whitespace-nowrap">{new Date(doc.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </BackgroundLayout>
  );
};

export default Documents;
