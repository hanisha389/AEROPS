import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import HumanBodyModel from "@/components/HumanBodyModel";

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
        <div className="p-6 font-rajdhani text-muted-foreground">Loading pilot details...</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="PILOT DETAILS" backTo="/pilots" />
      <div className="space-y-3 p-6">
        {/* Section 1: Pilot Info with Full Height Image */}
        <div className="border border-border/40 bg-card/30 p-4">
          <div className="flex gap-4 items-stretch min-h-64">
            {/* Left: Pilot Image - Full Height */}
            <div className="overflow-hidden border border-border/30 bg-black/30 flex-shrink-0 w-56">
              <img src={pilot.image} alt={pilot.name} className="h-full w-full object-cover object-[50%_15%]" />
            </div>
            {/* Right: Pilot Info */}
            <div className="flex-1 py-2">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-orbitron text-2xl text-primary">{pilot.name}</h2>
                  <p className="font-rajdhani text-xs text-muted-foreground mt-1">{pilot.callSign}</p>
                </div>
                <StatusBadge status={pilot.status || "ACTIVE"} align="right" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <p className="font-rajdhani text-sm text-muted-foreground">
                  Service Number: <span className="text-primary">{pilot.personalDetails.serviceNumber}</span>
                </p>
                <p className="font-rajdhani text-sm text-muted-foreground">
                  Assigned Aircraft: <span className="text-primary">{pilot.assignedAircraft || "Unassigned"}</span>
                </p>
                <p className="font-rajdhani text-sm text-muted-foreground">
                  Active Status: <span className="text-primary">{normalizeStatus(pilot.status)}</span>
                </p>
                <p className="font-rajdhani text-sm text-muted-foreground">
                  Fit for Flight: <span className="text-primary">{pilot.medicalDetails.safeToAssign ? "YES" : "NO"}</span>
                </p>
                <p className="font-rajdhani text-sm text-muted-foreground">
                  Fatigue Level: <span className="text-primary">{pilot.medicalDetails.fatigueLevel || "LOW"}</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Medical Info (Left) + All Logs (Right) */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Left: Medical Information */}
          <div className="border border-border/40 bg-card/30 p-4 lg:col-span-1">
            <h3 className="mb-3 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MEDICAL INFORMATION</h3>
            <div className="space-y-2">
              {/* Human Body Skeleton - Read-Only */}
              <div className="flex min-h-[10rem] items-start justify-center border border-border/30 bg-background/20 px-2 pt-2">
                <HumanBodyModel selectedParts={injuryMarks.map((item) => item.part)} readOnly={true} />
              </div>
              {/* Injury Marks and Clearance */}
              <div className="space-y-1 border-t border-border/30 pt-2">
                {injuryMarks.length === 0 && (
                  <p className="font-rajdhani text-xs text-muted-foreground">No active injury marks.</p>
                )}
                {injuryMarks.map((injury, index) => (
                  <p key={`${injury.part}-${index}`} className="font-rajdhani text-xs text-muted-foreground">
                    <span className="text-primary">{injury.part}</span>: {injury.severity}
                  </p>
                ))}
                <p className="font-rajdhani text-xs text-muted-foreground">
                  Clearance: <span className="text-primary">{pilot.medicalDetails.clearanceRemarks || "None"}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Middle: Training Details */}
          <div className="border border-border/40 bg-card/30 p-4 lg:col-span-1">
            <h3 className="mb-3 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">TRAINING DETAILS</h3>
            <div className="space-y-1">
              {missionHistory.length === 0 && pilot.missions.length === 0 && (
                <p className="font-rajdhani text-xs text-muted-foreground">No training records found.</p>
              )}
              {missionHistory.map((entry, index) => (
                <div key={`${entry.createdAt}-${index}`} className="border border-border/30 bg-background/20 p-2">
                  <p className="font-rajdhani text-xs text-primary">{entry.createdAt || "N/A"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground line-clamp-2">
                    {entry.trainingType}: {entry.result || "Completed"}
                  </p>
                </div>
              ))}
              {missionHistory.length === 0 && pilot.missions.map((entry, index) => (
                <div key={`${entry.name}-${index}`} className="border border-border/30 bg-background/20 p-2">
                  <p className="font-rajdhani text-xs text-primary">N/A</p>
                  <p className="font-rajdhani text-xs text-muted-foreground line-clamp-2">
                    {entry.name}: {entry.outcome || entry.notes || "Completed"}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Medical Record */}
          <div className="border border-border/40 bg-card/30 p-4 lg:col-span-1">
            <h3 className="mb-3 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MEDICAL RECORD</h3>
            <div className="space-y-1">
              {pilot.medicalLogs.length === 0 && (
                <p className="font-rajdhani text-xs text-muted-foreground">No medical records found.</p>
              )}
              {pilot.medicalLogs.map((record) => (
                <div key={record.id} className="border border-border/30 bg-background/20 p-2">
                  <p className="font-rajdhani text-xs text-primary">{record.createdAt || "N/A"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground line-clamp-2">
                    {record.flightContext}: {record.remarks || (record.safeToAssign ? "Cleared for flight" : "Medical hold")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotDetail;
