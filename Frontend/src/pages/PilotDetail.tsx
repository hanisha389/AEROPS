import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import HumanBodyModel from "@/components/HumanBodyModel";
import { Panel } from "@/components/ui/custom/Panel";

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

const normalizeStatus = (value: string): "ACTIVE" | "MEDICAL HOLD" | "ON LEAVE" => {
  const normalized = String(value || "ACTIVE").toUpperCase();
  if (normalized === "ON LEAVE" || normalized === "MEDICAL HOLD") {
    return normalized;
  }
  return "ACTIVE";
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

const DataRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col mb-3">
    <span className="text-gray-400 font-inter text-xs uppercase tracking-wider mb-1">{label}</span>
    <span className="text-gray-100 font-inter text-sm font-medium">{value}</span>
  </div>
);

const PilotDetail = () => {
  const { id } = useParams();

  const [pilot, setPilot] = useState<Pilot | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    api.getPilotById(Number(id)).then((data: Pilot) => {
      setPilot(data);
    });
  }, [id]);

  const missionHistory = useMemo(
    () => (pilot ? pilot.trainings : []),
    [pilot],
  );

  const injuryMarks = useMemo(
    () => (pilot ? parseInjuryMarks(pilot.medicalDetails.pastInjuries || []) : []),
    [pilot],
  );

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
      <div className="flex flex-col gap-6 p-6">
        <header className="mb-2">
          <h1 className="text-3xl font-rajdhani font-bold text-gray-200 uppercase tracking-wider">
            {pilot.name} - "{pilot.callSign}"
          </h1>
          <p className="text-gray-400 font-inter text-sm mt-1">Service No: {pilot.personalDetails.serviceNumber} | Access Level 4</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Panel */}
          <Panel className="col-span-1 p-6 flex flex-col items-center text-center">
            <img 
              src={pilot.image} 
              alt={pilot.name} 
              className="w-48 h-48 rounded-lg object-cover mb-6 border border-white/10 shadow-lg object-[50%_15%]" 
            />
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

          {/* Medical & Training Panels */}
          <div className="col-span-2 flex flex-col gap-6">
            
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
                  {pilot.medicalLogs.length === 0 && (
                    <p className="text-sm font-inter text-gray-400">No medical records found.</p>
                  )}
                  {pilot.medicalLogs.map((record) => (
                    <div key={record.id} className="bg-white/[0.02] p-3 rounded-lg border border-white/5 hover:bg-white/[0.04] transition-colors">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-gray-400 font-rajdhani font-medium">{record.createdAt}</span>
                        <span className={record.safeToAssign ? "text-xs font-bold text-success" : "text-xs font-bold text-danger"}>
                          {record.safeToAssign ? "CLEARED" : "GROUNDED"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 font-inter mt-1 line-clamp-2">{record.flightContext}</p>
                      {record.remarks && (
                        <p className="text-xs text-gray-500 font-inter mt-2 italic">"{record.remarks}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* Training Details - Full Width Bottom Panel */}
            <Panel className="p-6">
              <h3 className="text-lg font-rajdhani font-medium text-gray-300 border-b border-white/5 pb-2 mb-4 uppercase">
                Training & Mission History
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {missionHistory.length === 0 && pilot.missions.length === 0 && (
                  <p className="text-sm font-inter text-gray-400 col-span-2">No training or mission records found.</p>
                )}
                
                {missionHistory.map((entry, index) => (
                  <div key={`training-${index}`} className="flex flex-col bg-white/[0.02] p-4 rounded-lg border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs text-gray-400 font-inter uppercase tracking-wide">Training</span>
                       <span className="text-xs text-gray-500 font-inter">{entry.createdAt || "N/A"}</span>
                    </div>
                    <span className="text-sm text-gray-100 font-inter font-medium mb-1">{entry.trainingType}</span>
                    <span className="text-xs font-inter text-gray-300">
                      {entry.result || "Completed"}
                    </span>
                  </div>
                ))}

                {missionHistory.length === 0 && pilot.missions.map((entry, index) => (
                  <div key={`mission-${index}`} className="flex flex-col bg-white/[0.02] p-4 rounded-lg border border-white/5">
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-xs text-secondary-foreground font-inter uppercase tracking-wide">Mission</span>
                    </div>
                    <span className="text-sm text-gray-100 font-inter font-medium mb-1">{entry.name}</span>
                    <span className="text-xs text-gray-400 font-inter line-clamp-2">
                      {entry.outcome || entry.notes || "Completed"} 
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotDetail;
