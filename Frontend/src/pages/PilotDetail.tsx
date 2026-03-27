import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

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
            <img src={pilot.image} alt={pilot.name} className="h-72 w-64 object-cover" />
            <div className="space-y-1">
              <h2 className="font-orbitron text-lg text-primary">{pilot.name}</h2>
              <p className="font-rajdhani text-sm text-muted-foreground">Rank: <span className="text-primary">{pilot.rank}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Call Sign: <span className="text-primary">{pilot.callSign}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Registration: <span className="text-primary">{pilot.registrationNumber}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Assigned Aircraft: <span className="text-primary">{pilot.assignedAircraft || "Unassigned"}</span></p>
              <p className="font-rajdhani text-sm text-muted-foreground">Status: <span className="text-primary">{pilot.status}</span></p>
            </div>
          </div>
        </div>

        <div className="border border-border/40 bg-card/30 p-4">
          <h3 className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">MEDICAL INFO</h3>
          <p className="font-rajdhani text-sm text-muted-foreground">Injuries: <span className="text-primary">{pilot.medical.injuries}</span></p>
          <p className="font-rajdhani text-sm text-muted-foreground">Fit For Duty: <span className="text-primary">{pilot.medical.fitForDuty ? "Yes" : "No"}</span></p>
          <p className="font-rajdhani text-sm text-muted-foreground">Last Status: <span className="text-primary">{pilot.medical.lastStatus}</span></p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:col-span-3 lg:grid-cols-2">
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
      </div>
    </BackgroundLayout>
  );
};

export default PilotDetail;
