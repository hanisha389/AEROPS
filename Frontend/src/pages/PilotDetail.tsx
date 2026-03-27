import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import IAFRankInsignia from "@/components/IAFRankInsignia";
import HumanBodyModel from "@/components/HumanBodyModel";

interface Mission {
  name: string;
  duration?: string;
  status?: string;
  outcome?: string;
  notes?: string;
}

interface Pilot {
  id: number;
  name: string;
  callSign: string;
  rank: string;
  registrationNumber: string;
  assignedAircraft?: string;
  status: string;
  image: string;
  medical: {
    injuries: string;
    fitForDuty: boolean;
    lastStatus: string;
  };
  personalDetails: {
    fullName: string;
    serviceNumber: string;
    dateOfBirth?: string;
    dateOfJoining?: string;
    yearsOfService: number;
  };
  operationalStatus: {
    operationalState: string;
    baseLocation?: string;
    assignedSquadron?: string;
    assignedAircraftType?: string;
    lastMissionDate?: string;
    currentMissionAssignment?: string;
  };
  qualifications: {
    aircraftCertifications: string[];
    totalFlightHours: number;
    specializations: string[];
    trainingLevel: string;
    simulatorPerformanceScore: number;
  };
  performanceMetrics: {
    avgMissionSuccessRate: number;
    reactionTimeScore: number;
    maneuverAccuracy: number;
    decisionEfficiencyScore: number;
    last5TrainingResults: string[];
  };
  medicalDetails: {
    currentStatus: string;
    lastMedicalCheckDate?: string;
    nextDueCheck?: string;
    heartRate?: string;
    bloodPressure?: string;
    oxygenSaturation?: string;
    visionStatus?: string;
    gToleranceLevel?: string;
    fatigueLevel?: string;
    stressLevel?: string;
    sleepQualityScore: number;
    cognitiveReadiness: number;
    safeToAssign: boolean;
    lastClearedForFlight?: string;
    clearedBy?: string;
    clearanceRemarks?: string;
  };
  medicalLogs: {
    id: number;
    flightContext: string;
    fatigueLevel?: string;
    stressLevel?: string;
    sleepQualityScore: number;
    cognitiveReadiness: number;
    safeToAssign: boolean;
    remarks?: string;
    createdAt: string;
  }[];
  missions: Mission[];
  trainings: {
    trainingType: string;
    result?: string;
    aircraftId?: string;
    debrief?: string;
    createdAt: string;
  }[];
}

const PilotDetail = () => {
  const { id } = useParams();
  const [pilot, setPilot] = useState<Pilot | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getPilotById(Number(id)).then(setPilot);
  }, [id]);

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
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        <div className="border border-border/40 bg-card/30 p-4 lg:col-span-2">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="h-[30rem] w-full overflow-hidden border border-border/30 bg-black/30 md:w-80 lg:h-[32rem] lg:w-84">
              <img src={pilot.image} alt={pilot.name} className="h-full w-full object-cover object-[50%_12%]" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-orbitron text-xl text-primary sm:text-2xl">{pilot.name}</h2>
                <StatusBadge status={pilot.status || "Active"} align="right" />
              </div>
              <div className="flex items-center gap-2">
                <p className="font-rajdhani text-base text-muted-foreground">Rank:</p>
                <IAFRankInsignia rank={pilot.rank} short />
              </div>
              <p className="font-rajdhani text-sm text-muted-foreground">Service Number: <span className="text-primary">{pilot.personalDetails.serviceNumber}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Call Sign: <span className="text-primary">{pilot.callSign}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Date of Birth: <span className="text-primary">{pilot.personalDetails.dateOfBirth || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Date of Joining: <span className="text-primary">{pilot.personalDetails.dateOfJoining || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Years of Service: <span className="text-primary">{pilot.personalDetails.yearsOfService}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Operational Status: <span className="text-primary">{pilot.operationalStatus.operationalState}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Base: <span className="text-primary">{pilot.operationalStatus.baseLocation || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Squadron: <span className="text-primary">{pilot.operationalStatus.assignedSquadron || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Assigned Aircraft: <span className="text-primary">{pilot.assignedAircraft || "Unassigned"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Aircraft Type: <span className="text-primary">{pilot.operationalStatus.assignedAircraftType || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Current Mission: <span className="text-primary">{pilot.operationalStatus.currentMissionAssignment || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Certifications: <span className="text-primary">{pilot.qualifications.aircraftCertifications.join(", ") || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Specializations: <span className="text-primary">{pilot.qualifications.specializations.join(", ") || "N/A"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Training Level: <span className="text-primary">{pilot.qualifications.trainingLevel}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Simulator Score: <span className="text-primary">{pilot.qualifications.simulatorPerformanceScore}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Success Rate: <span className="text-primary">{pilot.performanceMetrics.avgMissionSuccessRate}%</span></p>
            </div>
          </div>
        </div>

        <div className="border border-border/40 bg-card/30 p-4">
          <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MEDICAL INFO</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1.15fr]">
            <div className="space-y-1.5 bg-background/20 p-3">
              <p className="font-rajdhani text-base text-muted-foreground">Current Status: <span className="text-primary">{pilot.medicalDetails.currentStatus}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Safe To Assign: <span className="text-primary">{pilot.medicalDetails.safeToAssign ? "YES" : "NO"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Heart Rate: <span className="text-primary">{pilot.medicalDetails.heartRate || "N/A"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Blood Pressure: <span className="text-primary">{pilot.medicalDetails.bloodPressure || "N/A"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Oxygen Saturation: <span className="text-primary">{pilot.medicalDetails.oxygenSaturation || "N/A"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Fatigue: <span className="text-primary">{pilot.medicalDetails.fatigueLevel || "N/A"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Stress: <span className="text-primary">{pilot.medicalDetails.stressLevel || "N/A"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Sleep Score: <span className="text-primary">{pilot.medicalDetails.sleepQualityScore}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Cognitive Readiness: <span className="text-primary">{pilot.medicalDetails.cognitiveReadiness}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Cleared By: <span className="text-primary">{pilot.medicalDetails.clearedBy || "N/A"}</span></p>
              <p className="font-rajdhani text-base text-muted-foreground">Clearance Remarks: <span className="text-primary">{pilot.medicalDetails.clearanceRemarks || "N/A"}</span></p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex min-h-[28.5rem] items-start justify-center bg-background/20 px-4 pt-1 pb-3">
                <HumanBodyModel />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:col-span-2">
          <div className="border border-border/40 bg-card/30 p-4">
            <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MISSION DETAILS</h3>
            <div className="space-y-2">
              {pilot.missions.map((mission, index) => (
                <details key={`${mission.name}-${index}`} className="border border-border/30 bg-background/30 p-3">
                  <summary className="cursor-pointer font-orbitron text-xs text-primary">{mission.name}</summary>
                  <p className="mt-2 font-rajdhani text-xs text-muted-foreground">Duration: {mission.duration || "N/A"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Status: {mission.status || "N/A"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Outcome: {mission.outcome || "N/A"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground/80">{mission.notes || "No notes"}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="border border-border/40 bg-card/30 p-4">
            <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">TRAINING DETAILS</h3>
            <div className="space-y-2">
              {pilot.trainings.length === 0 && <p className="font-rajdhani text-xs text-muted-foreground">No training records yet.</p>}
              {pilot.trainings.map((item, index) => (
                <details key={`${item.createdAt}-${index}`} className="border border-border/30 bg-background/30 p-3">
                  <summary className="cursor-pointer font-orbitron text-xs text-primary">{item.trainingType}</summary>
                  <p className="mt-2 font-rajdhani text-xs text-muted-foreground">Result: {item.result || "Completed"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Aircraft: {item.aircraftId || "N/A"}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">Date: {item.createdAt}</p>
                  <p className="font-rajdhani text-xs text-muted-foreground/80">{item.debrief || "No debrief"}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        <div className="border border-border/40 bg-card/30 p-4 lg:col-start-3 lg:row-start-2 lg:self-start">
          <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MEDICAL LOGS</h3>
          <div className="space-y-1">
            {pilot.medicalLogs.length === 0 && <p className="font-rajdhani text-sm text-muted-foreground">No logs yet.</p>}
            {pilot.medicalLogs.slice(0, 6).map((entry) => (
              <p key={entry.id} className="font-rajdhani text-sm text-muted-foreground">
                {entry.createdAt.split("T")[0]} - {entry.flightContext} - {entry.safeToAssign ? "SAFE" : "NOT SAFE"}
              </p>
            ))}
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotDetail;
