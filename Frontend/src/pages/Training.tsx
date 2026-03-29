import { FormEvent, useEffect, useMemo, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import HumanBodyModel from "@/components/HumanBodyModel";
import { api } from "@/lib/api";
import { getCurrentRole } from "@/lib/rbac";

type TrainingType = "Maneuver" | "Dogfight" | "Precision Bombing";
type FuelLevel = "OK" | "LOW" | "CRITICAL";
type SystemStatus = "OK" | "ISSUE";
type WeaponSystems = "OK" | "NOT REQUIRED";
type OverallStatus = "READY" | "NOT READY";
type YesNo = "YES" | "NO";
type Fatigue = "LOW" | "MEDIUM" | "HIGH";
type InjurySeverity = "MINOR" | "MAJOR";
type Hydration = "OK" | "LOW";
type CheckValue = "NORMAL" | "LOW";
type TireCondition = "GOOD" | "WEAR";

interface PilotOption {
  id: number;
  name: string;
  callSign: string;
  status: string;
  assignedAircraft?: string | null;
}

interface ChecklistState {
  fuelLevel: FuelLevel;
  engineStatus: SystemStatus;
  avionicsCheck: SystemStatus;
  weaponSystems: WeaponSystems;
  overallStatus: OverallStatus;
  hydraulicPressure: CheckValue;
  tireCondition: TireCondition;
  navSystems: SystemStatus;
}

interface PostChecklistState extends ChecklistState {
  damageObserved: YesNo;
  maintenanceRequired: YesNo;
  fluidLeakDetected: YesNo;
  birdStrikeSigns: YesNo;
}

interface MedicalState {
  fatigueLevel: Fatigue;
  fitForDuty: YesNo;
  remarks: string;
  selectedSeverity: InjurySeverity;
  injuries: { part: string; severity: InjurySeverity }[];
}

interface PilotPreInspection {
  baselineFatigue: Fatigue;
  hydration: Hydration;
  pulseStable: YesNo;
  remarks: string;
}

const preCheckDefaults: ChecklistState = {
  fuelLevel: "OK",
  engineStatus: "OK",
  avionicsCheck: "OK",
  weaponSystems: "OK",
  overallStatus: "READY",
  hydraulicPressure: "NORMAL",
  tireCondition: "GOOD",
  navSystems: "OK",
};

const postCheckDefaults: PostChecklistState = {
  ...preCheckDefaults,
  damageObserved: "NO",
  maintenanceRequired: "NO",
  fluidLeakDetected: "NO",
  birdStrikeSigns: "NO",
};

const pilotInspectionDefaults: PilotPreInspection = {
  baselineFatigue: "LOW",
  hydration: "OK",
  pulseStable: "YES",
  remarks: "",
};

const durationOptions = ["20 min", "30 min", "45 min", "60 min", "90 min"];

const Training = () => {
  const role = getCurrentRole();

  const [step, setStep] = useState(0);
  const [trainingType, setTrainingType] = useState<TrainingType>("Maneuver");
  const [pilotOptions, setPilotOptions] = useState<PilotOption[]>([]);
  const [selectedPilots, setSelectedPilots] = useState<number[]>([]);
  const [duration, setDuration] = useState(durationOptions[2]);
  const [notes, setNotes] = useState("");
  const [preCheckByAircraft, setPreCheckByAircraft] = useState<Record<string, ChecklistState>>({});
  const [postCheckByAircraft, setPostCheckByAircraft] = useState<Record<string, PostChecklistState>>({});
  const [pilotPreInspectionByPilot, setPilotPreInspectionByPilot] = useState<Record<number, PilotPreInspection>>({});
  const [medicalByPilot, setMedicalByPilot] = useState<Record<number, MedicalState>>({});
  const [trainingRunning, setTrainingRunning] = useState(false);
  const [debrief, setDebrief] = useState<{ duration: string; outcome: string; notes: string } | null>(null);
  const [completionDebrief, setCompletionDebrief] = useState<{
    trainingType: TrainingType;
    duration: string;
    outcome: string;
    notes: string;
    updatedAircraftIds: string[];
    updatedPilotIds: number[];
    documentsGenerated: number;
  } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    api.getPilots().then((rows) => setPilotOptions(rows));
  }, []);

  const activePilotOptions = useMemo(
    () => pilotOptions.filter((pilot) => (pilot.status || "").toUpperCase() === "ACTIVE"),
    [pilotOptions],
  );

  const selectedPilotObjects = useMemo(
    () => activePilotOptions.filter((pilot) => selectedPilots.includes(pilot.id)),
    [activePilotOptions, selectedPilots],
  );

  const selectedAircraftIds = useMemo(() => {
    const mapped = selectedPilotObjects.map((pilot) => pilot.assignedAircraft).filter(Boolean) as string[];
    return Array.from(new Set(mapped));
  }, [selectedPilotObjects]);

  const aircraftSelectionValid = useMemo(() => {
    if (trainingType === "Dogfight") {
      return selectedAircraftIds.length === 2;
    }
    return selectedAircraftIds.length === 1;
  }, [trainingType, selectedAircraftIds]);

  const requiredPilotCount = useMemo(() => (trainingType === "Dogfight" ? 2 : 1), [trainingType]);

  useEffect(() => {
    if (!selectedAircraftIds.length) {
      setPreCheckByAircraft({});
      setPostCheckByAircraft({});
      return;
    }

    const nextPre: Record<string, ChecklistState> = {};
    const nextPost: Record<string, PostChecklistState> = {};
    selectedAircraftIds.forEach((aircraftId) => {
      nextPre[aircraftId] = preCheckByAircraft[aircraftId] || preCheckDefaults;
      nextPost[aircraftId] = postCheckByAircraft[aircraftId] || postCheckDefaults;
    });
    setPreCheckByAircraft(nextPre);
    setPostCheckByAircraft(nextPost);
  }, [selectedAircraftIds]);

  useEffect(() => {
    setDebrief(null);
  }, [trainingType, selectedPilots, duration, notes]);

  useEffect(() => {
    setCompletionDebrief(null);
  }, [trainingType, selectedPilots, notes, duration]);

  useEffect(() => {
    const next: Record<number, MedicalState> = {};
    selectedPilots.forEach((pilotId) => {
      const baseline = pilotPreInspectionByPilot[pilotId]?.baselineFatigue || "LOW";
      next[pilotId] = medicalByPilot[pilotId] || {
        fatigueLevel: baseline,
        fitForDuty: "YES",
        remarks: "",
        selectedSeverity: "MINOR",
        injuries: [],
      };
    });
    setMedicalByPilot(next);
  }, [selectedPilots, pilotPreInspectionByPilot]);

  useEffect(() => {
    const next: Record<number, PilotPreInspection> = {};
    selectedPilots.forEach((pilotId) => {
      next[pilotId] = pilotPreInspectionByPilot[pilotId] || pilotInspectionDefaults;
    });
    setPilotPreInspectionByPilot(next);
  }, [selectedPilots]);

  const togglePilot = (pilotId: number) => {
    setSelectedPilots((prev) => {
      if (prev.includes(pilotId)) {
        return prev.filter((id) => id !== pilotId);
      }
      if (prev.length >= requiredPilotCount) {
        return [...prev.slice(1), pilotId];
      }
      return [...prev, pilotId];
    });
  };

  const updatePreCheck = (aircraftId: string, patch: Partial<ChecklistState>) => {
    setPreCheckByAircraft((prev) => ({ ...prev, [aircraftId]: { ...prev[aircraftId], ...patch } }));
  };

  const updatePostCheck = (aircraftId: string, patch: Partial<PostChecklistState>) => {
    setPostCheckByAircraft((prev) => ({ ...prev, [aircraftId]: { ...prev[aircraftId], ...patch } }));
  };

  const addOrToggleInjury = (pilotId: number, part: string) => {
    setMedicalByPilot((prev) => {
      const medical = prev[pilotId];
      const existingIndex = medical.injuries.findIndex((item) => item.part === part);
      if (existingIndex >= 0) {
        return {
          ...prev,
          [pilotId]: {
            ...medical,
            injuries: medical.injuries.filter((item) => item.part !== part),
          },
        };
      }
      return {
        ...prev,
        [pilotId]: {
          ...medical,
          injuries: [...medical.injuries, { part, severity: medical.selectedSeverity }],
        },
      };
    });
  };

  const runTraining = async (event: FormEvent) => {
    event.preventDefault();

    if (!selectedPilots.length) {
      window.alert("Select at least one ACTIVE pilot.");
      return;
    }
    if (trainingType === "Dogfight" && selectedPilots.length !== 2) {
      window.alert("Dogfight training requires exactly two pilots.");
      return;
    }
    if (trainingType !== "Dogfight" && selectedPilots.length !== 1) {
      window.alert("Maneuver and Precision Bombing require exactly one pilot.");
      return;
    }
    if (!aircraftSelectionValid) {
      window.alert("Selected pilot assignment does not satisfy aircraft requirements.");
      return;
    }
    if (!debrief) {
      window.alert("Run Step 2 training execution before completing the workflow.");
      return;
    }

    setRunning(true);
    try {
      const response = await api.completeTrainingWorkflow({
        trainingType,
        pilotIds: selectedPilots,
        aircraftIds: selectedAircraftIds,
        duration: debrief.duration,
        notes: debrief.notes,
        preTrainingChecks: selectedAircraftIds.map((aircraftId) => ({
          aircraftId,
          checklist: preCheckByAircraft[aircraftId],
        })),
        postTrainingChecks: selectedAircraftIds.map((aircraftId) => ({
          aircraftId,
          checklist: postCheckByAircraft[aircraftId],
        })),
        pilotMedicalReports: selectedPilots.map((pilotId) => ({
          pilotId,
          fatigueLevel: medicalByPilot[pilotId].fatigueLevel,
          fitForDuty: medicalByPilot[pilotId].fitForDuty,
          injuries: medicalByPilot[pilotId].injuries,
          remarks: medicalByPilot[pilotId].remarks,
        })),
      });
      setCompletionDebrief({
        trainingType,
        duration: debrief.duration,
        outcome: "Completed",
        notes: debrief.notes,
        updatedAircraftIds: response.updatedAircraftIds,
        updatedPilotIds: response.updatedPilotIds,
        documentsGenerated: response.createdDocumentIds.length,
      });
    } finally {
      setRunning(false);
    }
  };

  const startTrainingExecution = async () => {
    if (!selectedPilots.length) {
      window.alert("Select pilot(s) in Step 1 first.");
      return;
    }
    if (!aircraftSelectionValid) {
      window.alert("Selected pilots must have valid assigned aircraft for this training type.");
      return;
    }

    setTrainingRunning(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 1600));
      setDebrief({
        duration,
        outcome: "Completed",
        notes: notes.trim() || `${trainingType} training completed for ${selectedPilots.length} pilot(s).`,
      });
      setStep(3);
    } finally {
      setTrainingRunning(false);
    }
  };

  const step0Complete = true;
  const step1Complete =
    selectedPilots.length === requiredPilotCount
    && aircraftSelectionValid
    && selectedAircraftIds.every((aircraftId) => !!preCheckByAircraft[aircraftId])
    && selectedPilots.every((pilotId) => !!pilotPreInspectionByPilot[pilotId]);
  const step2Complete = !!debrief;
  const step3Complete = step2Complete && selectedAircraftIds.every((aircraftId) => !!postCheckByAircraft[aircraftId]);

  const maxUnlockedStep = useMemo(() => {
    let unlocked = 0;
    if (step0Complete) unlocked = 1;
    if (step1Complete) unlocked = 2;
    if (step2Complete) unlocked = 3;
    if (step3Complete) unlocked = 4;
    return unlocked;
  }, [step0Complete, step1Complete, step2Complete, step3Complete]);

  const goToStep = (nextStep: number) => {
    if (nextStep <= maxUnlockedStep) {
      setStep(nextStep);
      return;
    }
    window.alert("Complete the current step before moving forward.");
  };

  const goNext = () => {
    const target = Math.min(4, step + 1);
    goToStep(target);
  };

  if (role !== "ADMIN_COMMANDER" && role !== "PILOT") {
    return (
      <BackgroundLayout>
        <PageHeader title="TRAINING" />
        <div className="p-6 font-rajdhani text-sm text-muted-foreground">Current role does not have access to training workflow.</div>
      </BackgroundLayout>
    );
  }

  return (
    <BackgroundLayout>
      <PageHeader title="TRAINING" />
      <div className="p-6">
        <form onSubmit={runTraining} className="space-y-4 border border-border/40 bg-card/30 p-4">
          <h2 className="font-orbitron text-sm text-primary">STEP-BASED TRAINING FLOW</h2>

          <div className="flex flex-wrap gap-2 border border-border/30 bg-background/20 p-2">
            {[0, 1, 2, 3, 4].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => goToStep(index)}
                className={`px-3 py-1 font-orbitron text-[0.65rem] ${step === index ? "border border-primary text-primary" : "border border-border/40 text-muted-foreground"}`}
              >
                STEP {index}
              </button>
            ))}
          </div>

          {step === 0 && (
            <div>
              <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 0 - TRAINING TYPE</p>
              <label className="block text-xs text-muted-foreground">Type
                <select className="mt-1 w-full border border-border bg-background/40 px-2 py-2" value={trainingType} onChange={(e) => setTrainingType(e.target.value as TrainingType)}>
                  <option>Maneuver</option>
                  <option>Dogfight</option>
                  <option>Precision Bombing</option>
                </select>
              </label>
              <p className="mt-2 text-xs text-muted-foreground">Maneuver/Precision Bombing: 1 pilot and assigned aircraft. Dogfight: 2 pilots with 2 different assigned aircraft.</p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 1 - PILOT + PRE-TRAINING INSPECTION</p>

              <div>
                <p className="mb-1 text-xs text-muted-foreground">Select ACTIVE Pilot(s)</p>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {activePilotOptions.map((pilot) => {
                    const checked = selectedPilots.includes(pilot.id);
                    return (
                      <label key={pilot.id} className={`flex cursor-pointer items-center justify-between border px-3 py-2 ${checked ? "border-primary bg-primary/10" : "border-border/40"}`}>
                        <span className="font-rajdhani text-sm">
                          {pilot.callSign} ({pilot.name}) - {pilot.assignedAircraft || "Unassigned"}
                        </span>
                        <input type="checkbox" checked={checked} onChange={() => togglePilot(pilot.id)} />
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Auto-assigned aircraft: {selectedAircraftIds.join(", ") || "None"}</p>
              </div>

              {selectedPilots.map((pilotId) => {
                const pilot = pilotOptions.find((row) => row.id === pilotId);
                const check = pilotPreInspectionByPilot[pilotId] || pilotInspectionDefaults;
                if (!pilot) return null;
                return (
                  <div key={`pilot-pre-${pilotId}`} className="grid grid-cols-1 gap-2 border border-border/30 bg-background/20 p-3 md:grid-cols-2">
                    <p className="md:col-span-2 text-xs text-primary">Pilot Inspection - {pilot.callSign}</p>
                    <label className="text-xs text-muted-foreground">Baseline Fatigue
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.baselineFatigue} onChange={(e) => setPilotPreInspectionByPilot((prev) => ({ ...prev, [pilotId]: { ...check, baselineFatigue: e.target.value as Fatigue } }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Hydration
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.hydration} onChange={(e) => setPilotPreInspectionByPilot((prev) => ({ ...prev, [pilotId]: { ...check, hydration: e.target.value as Hydration } }))}><option>OK</option><option>LOW</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Pulse Stable
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.pulseStable} onChange={(e) => setPilotPreInspectionByPilot((prev) => ({ ...prev, [pilotId]: { ...check, pulseStable: e.target.value as YesNo } }))}><option>YES</option><option>NO</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Pilot Remarks
                      <input className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.remarks} onChange={(e) => setPilotPreInspectionByPilot((prev) => ({ ...prev, [pilotId]: { ...check, remarks: e.target.value } }))} />
                    </label>
                  </div>
                );
              })}

              {selectedAircraftIds.map((aircraftId) => {
                const check = preCheckByAircraft[aircraftId] || preCheckDefaults;
                return (
                  <div key={aircraftId} className="grid grid-cols-1 gap-2 border border-border/30 bg-background/20 p-3 md:grid-cols-2">
                    <p className="md:col-span-2 text-xs text-primary">Aircraft {aircraftId}</p>
                    <label className="text-xs text-muted-foreground">Fuel Level
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.fuelLevel} onChange={(e) => updatePreCheck(aircraftId, { fuelLevel: e.target.value as FuelLevel })}><option>OK</option><option>LOW</option><option>CRITICAL</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Engine Status
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.engineStatus} onChange={(e) => updatePreCheck(aircraftId, { engineStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Avionics Check
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.avionicsCheck} onChange={(e) => updatePreCheck(aircraftId, { avionicsCheck: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Weapon Systems
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.weaponSystems} onChange={(e) => updatePreCheck(aircraftId, { weaponSystems: e.target.value as WeaponSystems })}><option>OK</option><option>NOT REQUIRED</option></select>
                    </label>
                    <label className="md:col-span-2 text-xs text-muted-foreground">Overall Status
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.overallStatus} onChange={(e) => updatePreCheck(aircraftId, { overallStatus: e.target.value as OverallStatus })}><option>READY</option><option>NOT READY</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Hydraulic Pressure
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.hydraulicPressure} onChange={(e) => updatePreCheck(aircraftId, { hydraulicPressure: e.target.value as CheckValue })}><option>NORMAL</option><option>LOW</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Navigation Systems
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.navSystems} onChange={(e) => updatePreCheck(aircraftId, { navSystems: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                    </label>
                    <label className="md:col-span-2 text-xs text-muted-foreground">Tire Condition
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.tireCondition} onChange={(e) => updatePreCheck(aircraftId, { tireCondition: e.target.value as TireCondition })}><option>GOOD</option><option>WEAR</option></select>
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 2 - TRAINING EXECUTION</p>
              <label className="block text-xs text-muted-foreground">Duration
                <select className="mt-1 w-full border border-border bg-background/40 px-2 py-2" value={duration} onChange={(e) => setDuration(e.target.value)}>
                  {durationOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">Debrief Notes
                <textarea className="mt-1 min-h-24 w-full border border-border bg-background/40 px-2 py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>

              <p className="font-rajdhani text-xs text-muted-foreground">Pilots and aircraft are auto-selected from Step 1.</p>

              <div className="border border-border/30 bg-background/20 p-3">
                <button
                  type="button"
                  onClick={startTrainingExecution}
                  disabled={trainingRunning}
                  className="border border-primary px-4 py-2 font-orbitron text-xs text-primary"
                >
                  {trainingRunning ? "STARTING TRAINING..." : "START TRAINING"}
                </button>

                {trainingRunning && (
                  <p className="mt-2 font-rajdhani text-sm text-muted-foreground">Training simulation in progress...</p>
                )}

                {debrief && (
                  <div className="mt-3 space-y-1">
                    <p className="font-rajdhani text-sm text-primary">Debrief Summary</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">Duration: {debrief.duration}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">Outcome: {debrief.outcome}</p>
                    <p className="font-rajdhani text-xs text-muted-foreground">Notes: {debrief.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 3 - POST-TRAINING AIRCRAFT CHECK</p>
              {selectedAircraftIds.map((aircraftId) => {
                const check = postCheckByAircraft[aircraftId] || postCheckDefaults;
                return (
                  <div key={aircraftId} className="grid grid-cols-1 gap-2 border border-border/30 bg-background/20 p-3 md:grid-cols-2">
                    <p className="md:col-span-2 text-xs text-primary">Aircraft {aircraftId}</p>
                    <label className="text-xs text-muted-foreground">Fuel Level
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.fuelLevel} onChange={(e) => updatePostCheck(aircraftId, { fuelLevel: e.target.value as FuelLevel })}><option>OK</option><option>LOW</option><option>CRITICAL</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Engine Status
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.engineStatus} onChange={(e) => updatePostCheck(aircraftId, { engineStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Avionics Check
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.avionicsCheck} onChange={(e) => updatePostCheck(aircraftId, { avionicsCheck: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Weapon Systems
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.weaponSystems} onChange={(e) => updatePostCheck(aircraftId, { weaponSystems: e.target.value as WeaponSystems })}><option>OK</option><option>NOT REQUIRED</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Overall Status
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.overallStatus} onChange={(e) => updatePostCheck(aircraftId, { overallStatus: e.target.value as OverallStatus })}><option>READY</option><option>NOT READY</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Damage Observed
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.damageObserved} onChange={(e) => updatePostCheck(aircraftId, { damageObserved: e.target.value as YesNo })}><option>NO</option><option>YES</option></select>
                    </label>
                    <label className="md:col-span-2 text-xs text-muted-foreground">Maintenance Required
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.maintenanceRequired} onChange={(e) => updatePostCheck(aircraftId, { maintenanceRequired: e.target.value as YesNo })}><option>NO</option><option>YES</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Fluid Leak Detected
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.fluidLeakDetected} onChange={(e) => updatePostCheck(aircraftId, { fluidLeakDetected: e.target.value as YesNo })}><option>NO</option><option>YES</option></select>
                    </label>
                    <label className="text-xs text-muted-foreground">Bird Strike Signs
                      <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.birdStrikeSigns} onChange={(e) => updatePostCheck(aircraftId, { birdStrikeSigns: e.target.value as YesNo })}><option>NO</option><option>YES</option></select>
                    </label>
                  </div>
                );
              })}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 4 - PILOT MEDICAL REPORT (BODY MAP)</p>
              <div className="space-y-3">
                {selectedPilots.length === 0 && <p className="text-xs text-muted-foreground">Select pilots in Step 2 first.</p>}
                {selectedPilots.map((pilotId) => {
                  const pilot = pilotOptions.find((row) => row.id === pilotId);
                  const medical = medicalByPilot[pilotId];
                  if (!pilot || !medical) {
                    return null;
                  }

                  return (
                    <div key={pilotId} className="border border-border/30 bg-background/20 p-3">
                      <p className="text-xs text-primary">{pilot.callSign} ({pilot.name})</p>
                      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <label className="text-xs text-muted-foreground">Fatigue Level
                          <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={medical.fatigueLevel} onChange={(e) => setMedicalByPilot((prev) => ({ ...prev, [pilotId]: { ...prev[pilotId], fatigueLevel: e.target.value as Fatigue } }))}><option>LOW</option><option>MEDIUM</option><option>HIGH</option></select>
                        </label>
                        <label className="text-xs text-muted-foreground">Fit for Flight
                          <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={medical.fitForDuty} onChange={(e) => setMedicalByPilot((prev) => ({ ...prev, [pilotId]: { ...prev[pilotId], fitForDuty: e.target.value as YesNo } }))}><option>YES</option><option>NO</option></select>
                        </label>
                        <label className="text-xs text-muted-foreground">Injury Severity to Mark
                          <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={medical.selectedSeverity} onChange={(e) => setMedicalByPilot((prev) => ({ ...prev, [pilotId]: { ...prev[pilotId], selectedSeverity: e.target.value as InjurySeverity } }))}><option>MINOR</option><option>MAJOR</option></select>
                        </label>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[13rem_1fr]">
                        <div className="border border-border/30 bg-background/20 p-2">
                          <HumanBodyModel
                            onPartClick={(part) => addOrToggleInjury(pilotId, part)}
                            selectedParts={medical.injuries.map((item) => item.part)}
                          />
                          <p className="mt-1 text-[0.65rem] text-muted-foreground">Click body areas to add/remove injuries.</p>
                        </div>
                        <div className="space-y-2">
                          <label className="block text-xs text-muted-foreground">Remarks
                            <textarea className="mt-1 min-h-20 w-full border border-border bg-background/40 px-2 py-1" value={medical.remarks} onChange={(e) => setMedicalByPilot((prev) => ({ ...prev, [pilotId]: { ...prev[pilotId], remarks: e.target.value } }))} />
                          </label>
                          <div className="border border-border/30 bg-background/20 p-2">
                            <p className="mb-1 text-[0.65rem] text-muted-foreground">Injury Marks</p>
                            {medical.injuries.length === 0 && <p className="text-xs text-muted-foreground">No injury marks.</p>}
                            {medical.injuries.map((injury) => (
                              <p key={`${pilotId}-${injury.part}`} className="text-xs text-muted-foreground">
                                <span className="text-primary">{injury.part}</span>: {injury.severity}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setStep((prev) => Math.max(0, prev - 1))} className="border border-border px-4 py-2 font-orbitron text-xs text-muted-foreground">PREV</button>
            <button type="button" onClick={goNext} className="border border-border px-4 py-2 font-orbitron text-xs text-muted-foreground">NEXT</button>
            <button type="submit" disabled={running || step < 4} className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">
              {running ? "PROCESSING TRAINING..." : "COMPLETE TRAINING"}
            </button>
          </div>

          {completionDebrief && (
            <div className="space-y-1 border border-border/30 bg-background/20 p-3">
              <p className="font-orbitron text-xs tracking-[0.14em] text-primary">TRAINING DEBRIEF</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Type: {completionDebrief.trainingType}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Duration: {completionDebrief.duration}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Outcome: {completionDebrief.outcome}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Notes: {completionDebrief.notes}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Updated Aircraft: {completionDebrief.updatedAircraftIds.join(", ") || "None"}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Updated Pilots: {completionDebrief.updatedPilotIds.join(", ") || "None"}</p>
              <p className="font-rajdhani text-xs text-muted-foreground">Documents Generated: {completionDebrief.documentsGenerated}</p>
            </div>
          )}
        </form>
      </div>
    </BackgroundLayout>
  );
};

export default Training;
