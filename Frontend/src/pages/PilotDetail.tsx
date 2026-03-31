import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, HeartPulse } from "lucide-react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DocumentViewer from "@/components/documents/DocumentViewer";
import PersonnelSummaryTemplate, { type PersonnelSummaryData } from "@/components/reports/PersonnelSummaryTemplate";
import { api, type GeneratedDocument } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import HumanBodyModel from "@/components/HumanBodyModel";
import { Panel } from "@/components/ui/custom/Panel";
import Folder from "@/components/Folder";

interface Pilot {
  id: number;
  name: string;
  image: string;
  callSign: string;
  assignedAircraft?: string;
  status: "ACTIVE" | "MEDICAL HOLD" | "ON LEAVE" | string;
  personalDetails: {
    serviceNumber: string;
  };
  medicalDetails: {
    fatigueLevel?: "LOW" | "MEDIUM" | "HIGH" | string;
    safeToAssign: boolean;
    pastInjuries: string[];
    clearanceRemarks?: string;
  };
  medicalLogs: {
    id: number;
    createdAt: string;
    fatigueLevel?: string;
    safeToAssign: boolean;
    remarks?: string;
    flightContext: string;
  }[];
  trainings: {
    trainingType: string;
    createdAt: string;
    result?: string;
    debrief?: string;
  }[];
  missions: {
    name: string;
    outcome?: string;
    notes?: string;
    duration?: string;
  }[];
}

type ArchiveCategory = "Combat Simulation" | "Maneuver" | "Basic Maneuvers";
type ArchiveSubcategory = "Air Combat" | "Target Practice" | "Evasive Maneuvers" | "Formation Flying" | "Takeoff" | "Landing";
type ArchiveFileType = "Training" | "Mission";

interface ArchiveFile {
  id: string;
  title: string;
  type: ArchiveFileType;
  date: string;
  status: string;
  category: ArchiveCategory;
  subcategory: ArchiveSubcategory;
}

const archiveFolders: Array<{ name: ArchiveCategory; color: string; subfolders: ArchiveSubcategory[] }> = [
  { name: "Combat Simulation", color: "#0EA5E9", subfolders: ["Air Combat", "Target Practice"] },
  { name: "Maneuver", color: "#22D3EE", subfolders: ["Evasive Maneuvers", "Formation Flying"] },
  { name: "Basic Maneuvers", color: "#38BDF8", subfolders: ["Takeoff", "Landing"] },
];

const normalizeStatus = (value: string): "ACTIVE" | "MEDICAL HOLD" | "ON LEAVE" => {
  const normalized = String(value || "ACTIVE").toUpperCase();
  if (normalized === "ON LEAVE" || normalized === "MEDICAL HOLD") {
    return normalized;
  }
  return "ACTIVE";
};

const normalizeArchiveText = (value: string | null | undefined) => String(value || "").toLowerCase();

const classifyTrainingEntry = (entry: Pilot["trainings"][number]) => {
  const label = normalizeArchiveText(entry.trainingType);
  if (label.includes("basic")) {
    if (label.includes("landing")) {
      return { category: "Basic Maneuvers" as const, subcategory: "Landing" as const };
    }
    if (label.includes("takeoff")) {
      return { category: "Basic Maneuvers" as const, subcategory: "Takeoff" as const };
    }
    return { category: "Basic Maneuvers" as const, subcategory: "Takeoff" as const };
  }
  if (label.includes("dogfight") || label.includes("combat")) {
    return { category: "Combat Simulation" as const, subcategory: "Air Combat" as const };
  }
  if (label.includes("precision") || label.includes("bomb")) {
    return { category: "Combat Simulation" as const, subcategory: "Target Practice" as const };
  }
  if (label.includes("maneuver") || label.includes("evasive")) {
    return { category: "Maneuver" as const, subcategory: "Evasive Maneuvers" as const };
  }
  return { category: "Basic Maneuvers" as const, subcategory: "Takeoff" as const };
};

const classifyMissionEntry = (entry: Pilot["missions"][number]) => {
  const label = normalizeArchiveText(`${entry.name} ${entry.outcome || ""} ${entry.notes || ""}`);
  if (label.includes("basic")) {
    if (label.includes("landing")) {
      return { category: "Basic Maneuvers" as const, subcategory: "Landing" as const };
    }
    if (label.includes("takeoff")) {
      return { category: "Basic Maneuvers" as const, subcategory: "Takeoff" as const };
    }
    return { category: "Basic Maneuvers" as const, subcategory: "Takeoff" as const };
  }
  if (label.includes("takeoff")) {
    return { category: "Basic Maneuvers" as const, subcategory: "Takeoff" as const };
  }
  if (label.includes("landing")) {
    return { category: "Basic Maneuvers" as const, subcategory: "Landing" as const };
  }
  if (label.includes("formation") || label.includes("escort")) {
    return { category: "Maneuver" as const, subcategory: "Formation Flying" as const };
  }
  if (label.includes("evasive") || label.includes("maneuver") || label.includes("defensive") || label.includes("break")) {
    return { category: "Maneuver" as const, subcategory: "Evasive Maneuvers" as const };
  }
  if (label.includes("target") || label.includes("bomb") || label.includes("range") || label.includes("practice")) {
    return { category: "Combat Simulation" as const, subcategory: "Target Practice" as const };
  }
  if (label.includes("combat") || label.includes("dogfight") || label.includes("intercept") || label.includes("strike") || label.includes("attack")) {
    return { category: "Combat Simulation" as const, subcategory: "Air Combat" as const };
  }
  return { category: "Maneuver" as const, subcategory: "Formation Flying" as const };
};

const parseInjuryMarks = (injuries: string[]) =>
  injuries
    .map((entry) => {
      const [part, severity] = entry.split(":");
      if (!part || !severity) {
        return null;
      }
      return { part, severity };
    })
    .filter((entry): entry is { part: string; severity: string } => entry !== null);

const formatRecordTimestamp = (value: string | number | boolean | null | undefined) => {
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

const buildMedicalLogDocuments = (pilot: Pilot): GeneratedDocument[] =>
  pilot.medicalLogs.map((record) => ({
    id: record.id,
    templateKey: "pilot_medical_log",
    documentType: "PILOT_MEDICAL_REPORT",
    title: `Medical Log - ${pilot.callSign}`,
    pilotId: pilot.id,
    createdByRole: "SYSTEM",
    createdAt: record.createdAt,
    payload: {
      title: "Pilot Medical Report",
      fixedSections: ["MEDICAL LOG ENTRY"],
      fields: {
        pilotName: pilot.name,
        pilotImage: pilot.image,
        pilotId: pilot.id,
        status: pilot.status,
        fitForDuty: record.safeToAssign ? "YES" : "NO",
        fatigueLevel: record.fatigueLevel || pilot.medicalDetails.fatigueLevel || "N/A",
        injuries: pilot.medicalDetails.pastInjuries?.length
          ? pilot.medicalDetails.pastInjuries.join(", ")
          : "None",
        observations: record.flightContext,
        remarks: record.remarks || "No remarks provided.",
        recordDate: record.createdAt,
      },
    },
  }));

const DataRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col mb-3">
    <span className="text-gray-400 font-inter text-xs uppercase tracking-wider mb-1">{label}</span>
    <span className="text-gray-100 font-inter text-sm font-medium">{value}</span>
  </div>
);

const PilotDetail = () => {
  const { id } = useParams();

  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [medicalDocuments, setMedicalDocuments] = useState<GeneratedDocument[]>([]);
  const [selectedMedicalDoc, setSelectedMedicalDoc] = useState<GeneratedDocument | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryTimestamp, setSummaryTimestamp] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [activeFolder, setActiveFolder] = useState<ArchiveCategory | null>(null);
  const [archiveDetail, setArchiveDetail] = useState<ArchiveFile | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    api.getPilotById(Number(id)).then((data: Pilot) => {
      setPilot(data);
    });
  }, [id]);

  useEffect(() => {
    if (!pilot) {
      return;
    }
    api
      .listDocuments({ type: "PILOT_MEDICAL_REPORT", pilotId: pilot.id })
      .then(setMedicalDocuments)
      .catch(() => setMedicalDocuments([]));
  }, [pilot]);

  const trainingRecords = useMemo(
    () => (pilot ? pilot.trainings : []),
    [pilot],
  );

  const missionRecords = useMemo(
    () => (pilot ? pilot.missions : []),
    [pilot],
  );

  const injuryMarks = useMemo(
    () => (pilot ? parseInjuryMarks(pilot.medicalDetails.pastInjuries || []) : []),
    [pilot],
  );

  const medicalLogDocuments = useMemo(() => {
    if (!pilot) {
      return [];
    }
    if (medicalDocuments.length > 0) {
      return medicalDocuments;
    }
    return buildMedicalLogDocuments(pilot);
  }, [pilot, medicalDocuments]);

  const archiveFiles = useMemo<ArchiveFile[]>(() => {
    if (!pilot) {
      return [];
    }

    const trainingFiles = trainingRecords.map((entry, index) => {
      const route = classifyTrainingEntry(entry);
      return {
        id: `training-${index}`,
        title: entry.trainingType,
        type: "Training",
        date: entry.createdAt || "N/A",
        status: entry.result || "Completed",
        category: route.category,
        subcategory: route.subcategory,
      };
    });

    const missionFiles = missionRecords.map((entry, index) => {
      const route = classifyMissionEntry(entry);
      return {
        id: `mission-${index}`,
        title: entry.name,
        type: "Mission",
        date: entry.duration || "N/A",
        status: entry.outcome || entry.notes || "Completed",
        category: route.category,
        subcategory: route.subcategory,
      };
    });

    return [...trainingFiles, ...missionFiles];
  }, [pilot, trainingRecords, missionRecords]);

  const folderCounts = useMemo(() => {
    const counts: Record<ArchiveCategory, number> = {
      "Combat Simulation": 0,
      Maneuver: 0,
      "Basic Maneuvers": 0,
    };
    archiveFiles.forEach((file) => {
      counts[file.category] += 1;
    });
    return counts;
  }, [archiveFiles]);

  const activeFolderFiles = useMemo(() => {
    if (!activeFolder) {
      return [];
    }
    return archiveFiles
      .filter((file) => file.category === activeFolder)
      .sort((a, b) => a.subcategory.localeCompare(b.subcategory) || a.title.localeCompare(b.title));
  }, [archiveFiles, activeFolder]);

  const handleFolderSelect = (folderName: ArchiveCategory) => {
    if (activeFolder === folderName) {
      setActiveFolder(null);
      return;
    }
    setActiveFolder(folderName);
  };

  const summaryData = useMemo<PersonnelSummaryData | null>(() => {
    if (!pilot) {
      return null;
    }

    const logLines = pilot.medicalLogs.map((log) => {
      const status = log.safeToAssign ? "CLEARED" : "GROUNDED";
      const remarks = log.remarks ? ` | ${log.remarks}` : "";
      return `${log.createdAt} | ${status} | ${log.flightContext}${remarks}`;
    });

    const trainingLines = pilot.trainings.map((entry) =>
      `${entry.createdAt || "N/A"} | ${entry.trainingType} | ${entry.result || "Completed"}`,
    );

    const missionLines = pilot.missions.map((entry) =>
      `${entry.name} | ${entry.outcome || entry.notes || "Completed"}`,
    );

    const injuries = pilot.medicalDetails.pastInjuries?.length
      ? pilot.medicalDetails.pastInjuries.join(", ")
      : "None";

    return {
      classification: "CONFIDENTIAL",
      timestamp: summaryTimestamp || new Date().toISOString(),
      title: "PILOT PERSONNEL SUMMARY",
      subjectName: pilot.name,
      subjectIdLabel: "Service No",
      subjectId: pilot.personalDetails.serviceNumber || "N/A",
      roleLabel: "Call Sign",
      roleValue: pilot.callSign,
      statusLabel: "Status",
      statusValue: pilot.status,
      sections: [
        {
          title: "Operational Profile",
          entries: [
            { label: "Assigned Aircraft", value: pilot.assignedAircraft || "Unassigned" },
            { label: "Fit For Flight", value: pilot.medicalDetails.safeToAssign ? "YES" : "NO" },
            { label: "Fatigue Level", value: pilot.medicalDetails.fatigueLevel || "LOW" },
          ],
        },
        {
          title: "Medical Summary",
          entries: [
            { label: "Active Injuries", value: injuries },
            { label: "Clearance Remarks", value: pilot.medicalDetails.clearanceRemarks || "None" },
          ],
        },
        {
          title: "Medical Logs",
          lines: logLines,
        },
        {
          title: "Training History",
          lines: trainingLines,
        },
        {
          title: "Mission Records",
          lines: missionLines,
        },
      ],
      finalStatus: pilot.medicalDetails.safeToAssign ? "APPROVED" : "REVIEW REQUIRED",
    };
  }, [pilot, summaryTimestamp]);

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
        filename: `AEROPS-PILOT-${summaryData.subjectId}.pdf`,
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

  if (selectedMedicalDoc) {
    return (
      <DocumentViewer
        document={selectedMedicalDoc}
        onClose={() => setSelectedMedicalDoc(null)}
        backTo={id ? `/pilots/${id}` : "/pilots"}
        headerTitle="MEDICAL DOCUMENT READER"
      />
    );
  }

  if (!pilot) {
    return (
      <BackgroundLayout>
        <PageHeader title="PILOT DETAILS" backTo="/pilots" />
        <div className="p-6 font-inter text-muted-foreground text-center">Loading personnel record...</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="PERSONNEL RECORD" backTo="/pilots" />
      <div className="flex flex-col gap-6 p-6 w-full">
        <header className="mb-2">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-rajdhani font-bold text-gray-200 uppercase tracking-wider">
                {pilot.name} - "{pilot.callSign}"
              </h1>
              <p className="text-gray-400 font-inter text-sm mt-1">Service No: {pilot.personalDetails.serviceNumber} | Access Level 4</p>
            </div>
            <button
              type="button"
              onClick={openSummary}
              className="rounded bg-accent/10 border border-accent/30 hover:bg-accent/20 px-4 py-2 font-rajdhani font-semibold text-sm tracking-[0.05em] text-accent transition-colors"
            >
              Generate Summary
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Panel */}
          <Panel className="col-span-1 p-6 flex flex-col items-center text-center">
            <div className="mb-6 h-[30rem] w-full overflow-hidden rounded-xl border border-white/10 bg-black/30">
              <img
                src={pilot.image}
                alt={pilot.name}
                className="h-full w-full object-cover object-[50%_5%]"
              />
            </div>
            <div className="mb-6 w-full flex justify-center py-2">
              <StatusBadge status={normalizeStatus(pilot.status)} />
            </div>

            <div className="w-full text-left bg-black/20 p-4 rounded-lg border border-white/5 space-y-4">
              <DataRow label="Assigned Aircraft" value={pilot.assignedAircraft || "Unassigned"} />
              <DataRow label="Fit for Flight" value={
                <span className={pilot.medicalDetails.safeToAssign ? "text-success" : "text-danger"}>
                  {pilot.medicalDetails.safeToAssign ? "YES" : "NO"}
                </span>
              } />
              <DataRow label="Fatigue Level" value={pilot.medicalDetails.fatigueLevel || "LOW"} />
            </div>
          </Panel>

          {/* Medical Panels */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Medical Information */}
              <Panel className="p-6">
                <h3 className="text-lg font-rajdhani font-medium text-gray-300 border-b border-white/5 pb-2 mb-4 uppercase">
                  Medical Information
                </h3>
                <div className="space-y-4">
                  <div className="flex min-h-[12rem] items-start justify-center bg-black/30 rounded-lg p-4 border border-white/5">
                    <HumanBodyModel selectedParts={injuryMarks.map((item) => item.part)} readOnly={true} />
                  </div>

                  <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                    <h4 className="text-xs uppercase text-gray-400 mb-2 font-inter">Active Injuries</h4>
                    {injuryMarks.length === 0 ? (
                      <p className="text-sm text-gray-300 font-inter">No active injury marks.</p>
                    ) : (
                      <ul className="space-y-2">
                        {injuryMarks.map((injury, index) => (
                          <li key={`injury-${index}`} className="flex gap-2 text-sm font-inter">
                            <span className="text-gray-200 font-semibold">{injury.part}:</span>
                            <span className="text-gray-300">{injury.severity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <DataRow label="Clearance Remarks" value={pilot.medicalDetails.clearanceRemarks || "None"} />
                </div>
              </Panel>

              {/* Recent Medical Logs */}
              <Panel className="p-6">
                <h3 className="text-lg font-rajdhani font-medium text-gray-300 border-b border-white/5 pb-2 mb-4 uppercase">
                  Medical Records
                </h3>
                <div className="space-y-3">
                  {medicalLogDocuments.length === 0 && (
                    <p className="text-sm font-inter text-gray-400">No medical records found.</p>
                  )}
                  {medicalLogDocuments.map((doc) => {
                    const fitForDuty = String(doc.payload.fields.fitForDuty || "").toUpperCase();
                    const statusLabel = fitForDuty === "YES" ? "CLEARED" : fitForDuty === "NO" ? "GROUNDED" : "STATUS UNKNOWN";
                    const statusClass = fitForDuty === "YES"
                      ? "border-success/30 bg-success/10 text-success"
                      : fitForDuty === "NO"
                        ? "border-danger/30 bg-danger/10 text-danger"
                        : "border-white/10 bg-white/5 text-gray-400";
                    const observations = String(doc.payload.fields.observations || doc.payload.fields.flightContext || "No observations recorded.");
                    const recordDate = doc.payload.fields.recordDate || doc.createdAt;

                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedMedicalDoc(doc)}
                        className="group w-full text-left bg-white/[0.02] p-3 rounded-lg border border-white/5 hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-black/40 text-accent">
                            <HeartPulse className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs text-gray-400 font-rajdhani font-medium">{formatRecordTimestamp(recordDate)}</span>
                              <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase ${statusClass}`}>
                                {statusLabel}
                              </span>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-gray-100 font-inter font-medium">{doc.title}</span>
                              <span className="text-[10px] uppercase tracking-widest text-accent/80 border border-accent/30 px-1.5 py-0.5 rounded">
                                MEDICAL LOG
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 font-inter mt-2 line-clamp-2">{observations}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Panel>
            </div>

          </div>
        </div>

        {/* Training Archive - Full Width */}
        <Panel className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h3 className="text-lg font-rajdhani font-medium text-gray-300 uppercase">
                Training & Mission Archive
              </h3>
              <p className="text-xs font-inter text-gray-400">Classified folder navigation for pilot operations.</p>
            </div>
            <div className="text-[10px] font-orbitron tracking-[0.3em] text-accent/70">ACCESS LEVEL 4</div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {archiveFolders.map((folder) => {
              const isActive = activeFolder === folder.name;
              return (
                <button
                  key={folder.name}
                  type="button"
                  onClick={() => handleFolderSelect(folder.name)}
                  className={`group flex flex-col items-center gap-3 rounded-lg border px-4 py-4 text-center transition-all ${
                    isActive
                      ? "border-accent/60 bg-accent/5 shadow-[0_0_16px_rgba(0,212,255,0.2)]"
                      : "border-white/10 bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="magic-hover magic-hover--glow">
                    <Folder color={folder.color} size={0.9} />
                  </div>
                  <div>
                    <p className="font-rajdhani text-sm uppercase tracking-widest text-gray-100">{folder.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {folderCounts[folder.name]} FILES
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div
            className={`mt-5 overflow-hidden transition-all duration-300 ${
              activeFolder ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            {activeFolder ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-inter uppercase tracking-[0.25em] text-muted-foreground">Classified Manifest</p>
                    <p className="font-rajdhani text-sm text-gray-200">{activeFolder}</p>
                  </div>
                  <p className="text-[10px] font-orbitron tracking-[0.3em] text-accent/70">
                    {activeFolderFiles.length} ENTRIES
                  </p>
                </div>

                {activeFolderFiles.length === 0 ? (
                  <p className="mt-4 text-sm font-inter text-muted-foreground">No files stored in this folder.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <div className="min-w-[640px] space-y-2">
                      <div className="grid grid-cols-[1.3fr_2fr_0.9fr_1fr_1.1fr] gap-3 border-b border-white/10 pb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        <span>Section</span>
                        <span>File</span>
                        <span>Type</span>
                        <span>Date</span>
                        <span>Status</span>
                      </div>
                      {activeFolderFiles.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setArchiveDetail(file)}
                          className="magic-hover magic-hover--glow w-full grid grid-cols-[1.3fr_2fr_0.9fr_1fr_1.1fr] items-center gap-3 rounded-lg border border-white/5 bg-black/30 px-3 py-3 text-left text-sm text-gray-200 transition-colors hover:border-white/20 hover:bg-white/[0.03]"
                          aria-label={`Open ${file.title} details`}
                        >
                          <span className="text-[11px] font-inter uppercase tracking-[0.2em] text-muted-foreground">
                            {file.subcategory}
                          </span>
                          <span className="font-rajdhani text-base text-gray-100 line-clamp-1">
                            {file.title}
                          </span>
                          <span className="text-xs uppercase tracking-[0.2em] text-gray-300">
                            {file.type}
                          </span>
                          <span className="text-xs text-gray-400">{file.date}</span>
                          <span className="text-xs uppercase tracking-[0.2em] text-accent/80">
                            {file.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 bg-white/[0.02] p-4 text-center">
                <p className="text-xs font-inter text-muted-foreground">Select a folder to reveal its classified manifest.</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      {archiveDetail && (
        <Dialog open={Boolean(archiveDetail)} onOpenChange={(open) => !open && setArchiveDetail(null)}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="font-orbitron text-sm tracking-[0.2em] text-primary">
                ARCHIVE FILE DETAIL
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-rajdhani text-lg text-gray-100">{archiveDetail.title}</p>
                <span className="text-[10px] font-orbitron tracking-[0.3em] text-accent/70">CONFIDENTIAL</span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Folder</p>
                  <p className="text-sm text-gray-200">{archiveDetail.category}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Section</p>
                  <p className="text-sm text-gray-200">{archiveDetail.subcategory}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Type</p>
                  <p className="text-sm text-gray-200">{archiveDetail.type}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Status</p>
                  <p className="text-sm text-gray-200">{archiveDetail.status}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Date</p>
                  <p className="text-sm text-gray-200">{archiveDetail.date}</p>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Summary</p>
                <p className="mt-2 text-sm text-gray-300">
                  This entry is sourced from archived pilot records and is read-only for review purposes.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {summaryData && (
        <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
          <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-orbitron text-sm tracking-[0.2em] text-primary">
                PERSONNEL SUMMARY
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
              <span className="font-rajdhani text-xs text-muted-foreground">Generated from active pilot record.</span>
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

export default PilotDetail;
