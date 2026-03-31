import { useEffect, useMemo, useRef, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DocumentPdfTemplate from "@/components/documents/DocumentPdfTemplate";
import { api, type GeneratedDocument } from "@/lib/api";
import { Panel } from "@/components/ui/custom/Panel";

const Documents = () => {
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [pilotFilter, setPilotFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement | null>(null);

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

  const handleDownloadPdf = async () => {
    if (!selectedDoc || !pdfRef.current) {
      return;
    }

    setGeneratingPdf(true);
    setPdfError(null);
    const html2pdf = (await import("html2pdf.js")).default;
    const options = {
      margin: [10, 10, 10, 10],
      filename: `AEROPS-DOC-${selectedDoc.id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    try {
      await html2pdf().set(options).from(pdfRef.current).save();
    } catch (error) {
      setPdfError("PDF download failed. Please retry.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <BackgroundLayout>
      <PageHeader title="DATABASE ARCHIVE" />
      <div className="space-y-6 p-6 w-full">
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

      <Dialog open={Boolean(selectedDoc)} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-sm tracking-[0.2em] text-primary">
              DOCUMENT PDF VIEWER
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
            <span className="font-rajdhani text-xs text-muted-foreground">Rendered from active document payload.</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!selectedDoc || generatingPdf}
                className="border border-primary px-4 py-2 font-orbitron text-xs text-primary disabled:opacity-50"
              >
                DOWNLOAD PDF
              </button>
            </div>
          </div>

          {pdfError && (
            <div className="border border-danger/30 bg-danger/10 p-4 text-center text-xs text-danger">
              {pdfError}
            </div>
          )}

          {selectedDoc && (
            <DocumentPdfTemplate document={selectedDoc} mode="screen" />
          )}
        </DialogContent>
      </Dialog>

      {selectedDoc && (
        <div className="fixed left-[-10000px] top-0 pointer-events-none -z-50">
          <DocumentPdfTemplate ref={pdfRef} document={selectedDoc} mode="print" className="w-[794px]" />
        </div>
      )}
    </BackgroundLayout>
  );
};

export default Documents;
