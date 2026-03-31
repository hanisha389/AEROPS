import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import HumanBodyModel from "@/components/HumanBodyModel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import TrainingReportTemplate, { type TrainingReportData } from "@/components/training/TrainingReportTemplate";
import { Panel } from "@/components/ui/custom/Panel";
import { api } from "@/lib/api";
import { getCurrentRole } from "@/lib/rbac";

const DEBRIEF_KEY = "aerops-training-step2-debrief";

type TrainingType = "Maneuver" | "Dogfight" | "Precision Bombing";
type SystemStatus = "OK" | "ISSUE";
type WingsStatus = "OK" | "DAMAGE";
type FuelSystemStatus = "OK" | "LOW" | "CRITICAL" | "ISSUE";
type OverallStatus = "READY" | "NOT READY";
type YesNo = "YES" | "NO";
type Fatigue = "LOW" | "MEDIUM" | "HIGH";
type InjurySeverity = "MINOR" | "MAJOR";
type Hydration = "OK" | "LOW";

interface PilotOption {
  id: number;
  name: string;
  callSign: string;
  rank?: string;
  status: string;
  assignedAircraft?: string | null;
  skillLevel?: string;
}

interface SimulatorDebrief {
  duration: string;
  outcome: string;
  notes: string;
  elapsedSeconds?: number;
  peakG?: number;
  peakStress?: number;
  peakHeartRate?: number;
  peakFatigue?: number;
  source?: "simulator" | "planned";
  plannedPath?: string[];
  actionSummary?: string[];
  telemetrySummary?: {
    speedMin?: number;
    speedAvg?: number;
    speedMax?: number;
    altitudeAvg?: number;
    altitudeMax?: number;
    headingRange?: string;
  };
}

interface PerformanceReview {
  score: number;
  grade: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS IMPROVEMENT";
  summary: string;
  recommendations: string[];
  pilotBreakdown: {
    pilotId: number;
    callSign: string;
    score: number;
    grade: "EXCELLENT" | "GOOD" | "FAIR" | "NEEDS IMPROVEMENT";
  }[];
}

interface ChecklistState {
  engineStatus: SystemStatus;
  wingsStatus: WingsStatus;
  landingGearStatus: SystemStatus;
  avionicsStatus: SystemStatus;
  fuelSystemStatus: FuelSystemStatus;
  overallStatus: OverallStatus;
}

interface PostChecklistState extends ChecklistState {
  damageObserved: YesNo;
  maintenanceRequired: YesNo;
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
  engineStatus: "OK",
  wingsStatus: "OK",
  landingGearStatus: "OK",
  avionicsStatus: "OK",
  fuelSystemStatus: "OK",
  overallStatus: "READY",
};

const postCheckDefaults: PostChecklistState = {
  ...preCheckDefaults,
  damageObserved: "NO",
  maintenanceRequired: "NO",
};

const pilotInspectionDefaults: PilotPreInspection = {
  baselineFatigue: "LOW",
  hydration: "OK",
  pulseStable: "YES",
  remarks: "",
};

const durationOptions = ["20 min", "30 min", "45 min", "60 min", "90 min"];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getSkillFactor = (skillLevel?: string) => {
  const value = (skillLevel || "").toLowerCase();
  if (value.includes("expert") || value.includes("ace") || value.includes("advanced")) {
    return 1.18;
  }
  if (value.includes("rookie") || value.includes("novice") || value.includes("beginner") || value.includes("cadet")) {
    return 0.86;
  }
  return 1.0;
};

const gradeFromScore = (score: number): PerformanceReview["grade"] => {
  if (score >= 85) return "EXCELLENT";
  if (score >= 72) return "GOOD";
  if (score >= 58) return "FAIR";
  return "NEEDS IMPROVEMENT";
};

const parseDurationMinutes = (raw: string) => {
  const match = raw.match(/\d+/);
  return Number(match?.[0] || 30);
};

const buildOperationId = (timestamp: string, pilotIds: number[], trainingType: TrainingType) => {
  const date = new Date(timestamp);
  const dateCode = `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
  const timeCode = `${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}`;
  const pilotCode = pilotIds.length ? pilotIds.join("-") : "NA";
  const typeCode = trainingType.replace(/\s+/g, "-").toUpperCase();
  return `TRN-${typeCode}-${dateCode}-${timeCode}-${pilotCode}`;
};

const Training = () => {
  const role = getCurrentRole();
  const navigate = useNavigate();

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
  const [debrief, setDebrief] = useState<SimulatorDebrief | null>(null);
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
  const [reportTimestamp, setReportTimestamp] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    api.getPilots().then((rows) => setPilotOptions(rows));
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(DEBRIEF_KEY);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as SimulatorDebrief;
      if (parsed?.duration && parsed?.outcome && parsed?.notes != null) {
        setDebrief(parsed);
        setStep((prev) => Math.max(prev, 3));
      }
    } catch {
      // Ignore malformed simulator payload.
    } finally {
      sessionStorage.removeItem(DEBRIEF_KEY);
    }
  }, []);

  const activePilotOptions = useMemo(
    () => pilotOptions.filter((pilot) => (pilot.status || "").toUpperCase() === "ACTIVE"),
    [pilotOptions],
  );

  const selectedPilotObjects = useMemo(
    () => pilotOptions.filter((pilot) => selectedPilots.includes(pilot.id)),
    [pilotOptions, selectedPilots],
  );

  const plannedPath = useMemo(() => {
    if (trainingType === "Dogfight") {
      return [
        "Takeoff and formation build",
        "Acceleration lane",
        "Lead turn left",
        "Defensive break right",
        "Altitude ladder climb",
        "Rejoin and controlled hold",
      ];
    }
    if (trainingType === "Precision Bombing") {
      return [
        "Takeoff and climb",
        "Ingress corridor hold",
        "Target approach turn",
        "Stabilized strike pass",
        "Egress climb",
        "Return hold pattern",
      ];
    }
    return [
      "Takeoff roll and climb",
      "Speed build segment",
      "Left turn pattern",
      "Right correction",
      "Altitude hold",
      "Return and settle",
    ];
  }, [trainingType]);

  const generatePlannedDebrief = () => {
    if (selectedPilotObjects.length === 0) {
      return null;
    }

    const avgSkill = selectedPilotObjects
      .map((pilot) => getSkillFactor(pilot.skillLevel))
      .reduce((sum, value) => sum + value, 0) / selectedPilotObjects.length;
    const missionLoad = trainingType === "Dogfight" ? 1.2 : trainingType === "Precision Bombing" ? 1.1 : 1;
    const minutes = parseDurationMinutes(duration);

    const peakG = clamp(3.4 * missionLoad - (avgSkill - 1) * 1.1, 2.1, 5.6);
    const peakStress = clamp(46 * missionLoad - (avgSkill - 1) * 22, 18, 88);
    const peakHeartRate = clamp(136 * missionLoad - (avgSkill - 1) * 16, 92, 188);
    const peakFatigue = clamp(40 * missionLoad - (avgSkill - 1) * 15, 12, 84);

    const baseSpeed = trainingType === "Precision Bombing" ? 255 : trainingType === "Dogfight" ? 295 : 270;
    const speedAvg = clamp(baseSpeed + (avgSkill - 1) * 22, 210, 340);
    const speedMin = clamp(speedAvg - 42, 160, 300);
    const speedMax = clamp(speedAvg + 38, 210, 390);
    const altitudeAvg = trainingType === "Dogfight" ? 3450 : 3150;
    const altitudeMax = altitudeAvg + 650;

    return {
      duration,
      outcome: "Completed",
      notes: notes?.trim() || `Auto-generated debrief from planned ${trainingType.toLowerCase()} route.`,
      elapsedSeconds: minutes * 60,
      peakG: Number(peakG.toFixed(2)),
      peakStress: Number(peakStress.toFixed(1)),
      peakHeartRate: Number(peakHeartRate.toFixed(0)),
      peakFatigue: Number(peakFatigue.toFixed(1)),
      source: "planned" as const,
      plannedPath,
      actionSummary: plannedPath.map((stepLabel, index) => `AUTO STEP ${index + 1}: ${stepLabel}`),
      telemetrySummary: {
        speedMin: Number(speedMin.toFixed(1)),
        speedAvg: Number(speedAvg.toFixed(1)),
        speedMax: Number(speedMax.toFixed(1)),
        altitudeAvg: Number(altitudeAvg.toFixed(0)),
        altitudeMax: Number(altitudeMax.toFixed(0)),
        headingRange: trainingType === "Dogfight" ? "35-335" : "60-295",
      },
    };
  };

  const performanceReview = useMemo<PerformanceReview | null>(() => {
    if (!debrief || selectedPilotObjects.length === 0) {
      return null;
    }

    const peakG = debrief.peakG ?? 2;
    const peakStress = debrief.peakStress ?? 20;
    const peakHeartRate = debrief.peakHeartRate ?? 95;
    const peakFatigue = debrief.peakFatigue ?? 18;

    const pilotBreakdown = selectedPilotObjects.map((pilot, index) => {
      const skillFactor = getSkillFactor(pilot.skillLevel);
      const stabilityPenalty = Math.max(0, peakG - 2.5) * 10 + peakStress * 0.16 + Math.max(0, peakHeartRate - 125) * 0.2 + peakFatigue * 0.11;
      const profileOffset = ((pilot.id + index) % 5) - 2;
      const score = Math.round(clamp(84 + (skillFactor - 1) * 26 - stabilityPenalty + profileOffset, 35, 99));
      return {
        pilotId: pilot.id,
        callSign: pilot.callSign,
        score,
        grade: gradeFromScore(score),
      };
    });

    const score = Math.round(pilotBreakdown.reduce((sum, item) => sum + item.score, 0) / pilotBreakdown.length);
    const grade = gradeFromScore(score);

    if (grade === "EXCELLENT") {
      return {
        score,
        grade,
        summary: "Pilot team maintained stable control with efficient maneuver execution.",
        recommendations: ["Proceed to post-training aircraft check.", "Schedule normal recovery window."],
        pilotBreakdown,
      };
    }

    if (grade === "GOOD") {
      return {
        score,
        grade,
        summary: "Mission profile completed with minor strain indicators.",
        recommendations: ["Run full airframe post-check.", "Monitor hydration and fatigue in medical step."],
        pilotBreakdown,
      };
    }

    if (grade === "FAIR") {
      return {
        score,
        grade,
        summary: "Pilot completed the sortie but showed notable physiological load.",
        recommendations: ["Inspect aircraft stress points before next sortie.", "Recommend recovery protocol and follow-up medical checks."],
        pilotBreakdown,
      };
    }

    return {
      score,
      grade,
      summary: "Pilot performance degraded under load and requires corrective training.",
      recommendations: ["Escalate aircraft and systems inspection scope.", "Mark pilot for enhanced medical review before redeployment."],
      pilotBreakdown,
    };
  }, [debrief, selectedPilotObjects]);

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
  }, [trainingType, selectedPilots]);

  useEffect(() => {
    setCompletionDebrief(null);
  }, [trainingType, selectedPilots, notes, duration]);

  useEffect(() => {
    if (completionDebrief) {
      setReportTimestamp(new Date().toISOString());
    } else {
      setReportTimestamp(null);
    }
  }, [completionDebrief]);

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
    if (!performanceReview) {
      window.alert("Open Step 3 debrief review before completing the workflow.");
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

  const startTrainingExecution = () => {
    if (!selectedPilots.length) {
      window.alert("Select pilot(s) in Step 1 first.");
      return;
    }
    if (!aircraftSelectionValid) {
      window.alert("Selected pilots must have valid assigned aircraft for this training type.");
      return;
    }

    navigate("/training/simulator", {
      state: {
        selectedPilotIds: selectedPilots,
        selectedAircraftIds,
        duration,
        notes,
        trainingType,
      },
    });
  };

  const step0Complete = true;
  const step1Complete =
    selectedPilots.length === requiredPilotCount
    && aircraftSelectionValid
    && selectedAircraftIds.every((aircraftId) => !!preCheckByAircraft[aircraftId])
    && selectedPilots.every((pilotId) => !!pilotPreInspectionByPilot[pilotId]);
  const step2Complete = !!debrief;
  const step3Complete = !!performanceReview;
  const step4Complete = step3Complete && selectedAircraftIds.every((aircraftId) => !!postCheckByAircraft[aircraftId]);

  const reportData = useMemo<TrainingReportData | null>(() => {
    if (!completionDebrief || !debrief || !performanceReview) {
      return null;
    }

    const timestamp = reportTimestamp || new Date().toISOString();
    const operationId = buildOperationId(timestamp, selectedPilots, trainingType);
    const finalStatus = performanceReview.grade === "EXCELLENT" || performanceReview.grade === "GOOD"
      ? "APPROVED"
      : "REVIEW REQUIRED";

    const pilots = selectedPilotObjects.map((pilot) => ({
      id: pilot.id,
      name: pilot.name,
      callSign: pilot.callSign,
      rank: pilot.rank || "N/A",
      assignedAircraft: pilot.assignedAircraft || "Unassigned",
      skillLevel: pilot.skillLevel || "Standard",
    }));

    const preTrainingChecks = selectedAircraftIds.map((aircraftId) => ({
      aircraftId,
      checklist: preCheckByAircraft[aircraftId] || preCheckDefaults,
    }));

    const postTrainingChecks = selectedAircraftIds.map((aircraftId) => ({
      aircraftId,
      checklist: postCheckByAircraft[aircraftId] || postCheckDefaults,
    }));

    const pilotInspections = selectedPilotObjects.map((pilot) => {
      const inspection = pilotPreInspectionByPilot[pilot.id] || pilotInspectionDefaults;
      return {
        pilotId: pilot.id,
        callSign: pilot.callSign,
        baselineFatigue: inspection.baselineFatigue,
        hydration: inspection.hydration,
        pulseStable: inspection.pulseStable,
        remarks: inspection.remarks?.trim() || "None",
      };
    });

    const medicalReports = selectedPilotObjects.map((pilot) => {
      const medical = medicalByPilot[pilot.id] || {
        fatigueLevel: "LOW",
        fitForDuty: "YES",
        remarks: "",
        selectedSeverity: "MINOR",
        injuries: [],
      };
      const injuries = medical.injuries.length
        ? medical.injuries.map((injury) => `${injury.part}: ${injury.severity}`)
        : ["None"];
      return {
        pilotId: pilot.id,
        callSign: pilot.callSign,
        fatigueLevel: medical.fatigueLevel,
        fitForDuty: medical.fitForDuty,
        injuries,
        remarks: medical.remarks?.trim() || "None",
      };
    });

    const medicalNotes = selectedPilotObjects.flatMap((pilot) => {
      const notes: string[] = [];
      const preInspection = pilotPreInspectionByPilot[pilot.id];
      const medical = medicalByPilot[pilot.id];

      if (preInspection?.remarks?.trim()) {
        notes.push(`Pre-Inspection (${pilot.callSign}): ${preInspection.remarks.trim()}`);
      }
      if (medical?.remarks?.trim()) {
        notes.push(`Post-Training (${pilot.callSign}): ${medical.remarks.trim()}`);
      }
      if (medical?.injuries?.length) {
        notes.push(`Injuries (${pilot.callSign}): ${medical.injuries.map((injury) => `${injury.part}: ${injury.severity}`).join(", ")}`);
      }

      return notes;
    });

    const cognitiveNotes = [debrief.notes?.trim(), performanceReview.summary]
      .filter((note): note is string => Boolean(note && note.trim().length));

    return {
      squadronName: "AEROPS TRAINING SQUADRON",
      operationId,
      timestamp,
      classification: "CONFIDENTIAL",
      pilots,
      training: {
        scenarioName: trainingType,
        completionStatus: completionDebrief.outcome,
        duration: debrief.duration,
        score: performanceReview.score,
        grade: performanceReview.grade,
        debriefSource: debrief.source === "planned" ? "AUTO PLANNED ROUTE" : "SIMULATOR RUN",
      },
      notes: debrief.notes,
      preTrainingChecks,
      postTrainingChecks,
      pilotInspections,
      medicalReports,
      debriefMetrics: {
        peakG: debrief.peakG,
        peakStress: debrief.peakStress,
        peakHeartRate: debrief.peakHeartRate,
        peakFatigue: debrief.peakFatigue,
        telemetrySummary: debrief.telemetrySummary,
        plannedPath: debrief.plannedPath,
        actionSummary: debrief.actionSummary,
      },
      evaluation: {
        summary: performanceReview.summary,
        recommendations: performanceReview.recommendations,
        finalStatus,
      },
      medicalNotes,
      cognitiveNotes,
    };
  }, [
    completionDebrief,
    debrief,
    performanceReview,
    reportTimestamp,
    selectedPilots,
    selectedPilotObjects,
    selectedAircraftIds,
    trainingType,
    preCheckByAircraft,
    postCheckByAircraft,
    pilotPreInspectionByPilot,
    medicalByPilot,
  ]);

  const canGenerateReport = Boolean(reportData);

  const maxUnlockedStep = useMemo(() => {
    let unlocked = 0;
    if (step0Complete) unlocked = 1;
    if (step1Complete) unlocked = 2;
    if (step2Complete) unlocked = 3;
    if (step3Complete) unlocked = 4;
    if (step4Complete) unlocked = 5;
    return unlocked;
  }, [step0Complete, step1Complete, step2Complete, step3Complete, step4Complete]);

  const goToStep = (nextStep: number) => {
    if (nextStep <= maxUnlockedStep) {
      setStep(nextStep);
      return;
    }
    window.alert("Complete the current step before moving forward.");
  };

  const goNext = () => {
    if (step === 2 && !debrief) {
      const autoDebrief = generatePlannedDebrief();
      if (!autoDebrief) {
        window.alert("Select pilot(s) in Step 1 before creating a debrief.");
        return;
      }
      setDebrief(autoDebrief);
      setStep(3);
      return;
    }
    const target = Math.min(5, step + 1);
    goToStep(target);
  };

  const handleDownloadReport = async () => {
    if (!reportRef.current || !reportData) {
      return;
    }

    setGeneratingReport(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const options = {
        margin: [10, 10, 10, 10],
        filename: `AEROPS-TRAINING-${reportData.operationId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      };

      await html2pdf().set(options).from(reportRef.current).save();
    } finally {
      setGeneratingReport(false);
    }
  };

  const stepLabels = [
    "STEP 0 - TYPE",
    "STEP 1 - PRE-CHECK",
    "STEP 2 - EXECUTION",
    "STEP 3 - DEBRIEF",
    "STEP 4 - AIRCRAFT CHECK",
    "STEP 5 - MEDICAL",
  ];
  const totalSteps = stepLabels.length - 1;
  const progressScale = totalSteps > 0 ? Math.min(1, Math.max(0, step / totalSteps)) : 0;

  useEffect(() => {
    const target = stepRefs.current[step];
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step]);

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
      <div className="p-6 w-full">
        <Panel className="p-4">
          <form onSubmit={runTraining} className="space-y-4">
            <h2 className="font-orbitron text-sm text-primary">STEP-BASED TRAINING FLOW</h2>

            <div className="relative space-y-3">
              <div className="absolute left-5 top-4 bottom-4 w-px bg-white/10" />
              <div
                className="absolute left-5 top-4 bottom-4 w-px origin-top bg-accent/70 shadow-[0_0_12px_rgba(0,212,255,0.45)]"
                style={{ transform: `scaleY(${progressScale})` }}
              />

              {stepLabels.map((label, index) => {
                const isActive = step === index;
                const isComplete = index < maxUnlockedStep;
                const isAccessible = index <= maxUnlockedStep;
                const [stepLabel, stepTitle] = label.split(" - ");
                const numberLabel = stepLabel?.replace("STEP ", "") || String(index);
                const nodeLabel = isActive ? numberLabel : isComplete ? "OK" : numberLabel;

                return (
                  <div key={label} className="grid grid-cols-[2.5rem_1fr] gap-4">
                    <div className="flex items-start justify-center pt-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-orbitron tracking-[0.2em] ${isActive
                          ? "border-accent text-accent bg-accent/10"
                          : isComplete
                            ? "border-white/20 text-gray-200"
                            : "border-white/5 text-muted-foreground"}`}
                      >
                        {nodeLabel}
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border bg-background/20 p-3 transition-colors ${isActive
                        ? "border-accent/50 shadow-[0_0_18px_rgba(0,212,255,0.12)]"
                        : "border-white/5"}`}
                    >
                      <button
                        ref={(element) => {
                          stepRefs.current[index] = element;
                        }}
                        type="button"
                        onClick={() => goToStep(index)}
                        aria-current={isActive ? "step" : undefined}
                        className={`w-full text-left ${isAccessible ? "" : "cursor-not-allowed"}`}
                      >
                        <span className="block text-[10px] font-inter uppercase tracking-[0.28em] text-muted-foreground">{stepLabel}</span>
                        <span className={`font-rajdhani text-sm tracking-widest ${isActive ? "text-gray-100" : "text-gray-300"}`}>
                          {stepTitle || label}
                        </span>
                      </button>

                      <div
                        className={`overflow-hidden transition-all duration-300 ${isActive ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"}`}
                      >
                        {isActive && (
                          <div className="pt-4">
                            {index === 0 && (
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

                            {index === 1 && (
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
                                      <label className="text-xs text-muted-foreground">Engine Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.engineStatus} onChange={(e) => updatePreCheck(aircraftId, { engineStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Wings Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.wingsStatus} onChange={(e) => updatePreCheck(aircraftId, { wingsStatus: e.target.value as WingsStatus })}><option>OK</option><option>DAMAGE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Landing Gear Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.landingGearStatus} onChange={(e) => updatePreCheck(aircraftId, { landingGearStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Avionics Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.avionicsStatus} onChange={(e) => updatePreCheck(aircraftId, { avionicsStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Fuel System Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.fuelSystemStatus} onChange={(e) => updatePreCheck(aircraftId, { fuelSystemStatus: e.target.value as FuelSystemStatus })}><option>OK</option><option>LOW</option><option>CRITICAL</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="md:col-span-2 text-xs text-muted-foreground">Overall Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.overallStatus} onChange={(e) => updatePreCheck(aircraftId, { overallStatus: e.target.value as OverallStatus })}><option>READY</option><option>NOT READY</option></select>
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {index === 2 && (
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
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={startTrainingExecution}
                                      className="border border-primary px-4 py-2 font-orbitron text-xs text-primary"
                                    >
                                      START TRAINING
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const autoDebrief = generatePlannedDebrief();
                                        if (!autoDebrief) {
                                          window.alert("Select pilot(s) in Step 1 before using auto route debrief.");
                                          return;
                                        }
                                        setDebrief(autoDebrief);
                                        setStep(3);
                                      }}
                                      className="border border-border px-4 py-2 font-orbitron text-xs text-muted-foreground"
                                    >
                                      SKIP SIMULATOR (AUTO ROUTE)
                                    </button>
                                  </div>

                                  {debrief && (
                                    <div className="mt-3 space-y-1">
                                      <p className="font-rajdhani text-sm text-primary">Debrief Summary</p>
                                      <p className="font-rajdhani text-xs text-muted-foreground">Duration: {debrief.duration}</p>
                                      <p className="font-rajdhani text-xs text-muted-foreground">Outcome: {debrief.outcome}</p>
                                      <p className="font-rajdhani text-xs text-muted-foreground">Source: {debrief.source === "planned" ? "Auto Planned Route" : "Simulator Run"}</p>
                                      <p className="font-rajdhani text-xs text-muted-foreground">Notes: {debrief.notes}</p>
                                      <p className="font-rajdhani text-xs text-muted-foreground">Proceed to Step 3 for pilot performance review.</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {index === 3 && (
                              <div className="space-y-3">
                                <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 3 - POST-TRAINING DEBRIEF</p>
                                {!debrief && <p className="text-xs text-muted-foreground">Run Step 2 first to generate debrief data.</p>}
                                {debrief && performanceReview && (
                                  <div className="space-y-2 border border-border/30 bg-background/20 p-3">
                                    <p className="font-orbitron text-xs tracking-[0.14em] text-primary">PILOT PERFORMANCE REVIEW</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Debrief Source: {debrief.source === "planned" ? "Auto Planned Route" : "Simulator Run"}</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Duration: {debrief.duration}</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Performance Score: {performanceReview.score}/100</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Grade: {performanceReview.grade}</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Peak G: {(debrief.peakG ?? 0).toFixed(2)} g</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Peak Stress: {(debrief.peakStress ?? 0).toFixed(0)}%</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Peak Heart Rate: {(debrief.peakHeartRate ?? 0).toFixed(0)} bpm</p>
                                    <p className="font-rajdhani text-xs text-muted-foreground">Peak Fatigue: {(debrief.peakFatigue ?? 0).toFixed(0)}%</p>
                                    {debrief.telemetrySummary && (
                                      <div className="border border-border/30 bg-background/30 p-2">
                                        <p className="mb-1 text-[0.65rem] text-muted-foreground">Telemetry Summary</p>
                                        <p className="text-xs text-muted-foreground">Speed: {debrief.telemetrySummary.speedMin ?? 0} - {debrief.telemetrySummary.speedMax ?? 0} kts (avg {debrief.telemetrySummary.speedAvg ?? 0})</p>
                                        <p className="text-xs text-muted-foreground">Altitude: avg {debrief.telemetrySummary.altitudeAvg ?? 0} m, peak {debrief.telemetrySummary.altitudeMax ?? 0} m</p>
                                        <p className="text-xs text-muted-foreground">Heading Range: {debrief.telemetrySummary.headingRange || "N/A"}</p>
                                      </div>
                                    )}

                                    <div className="border border-border/30 bg-background/30 p-2">
                                      <p className="mb-1 text-[0.65rem] text-muted-foreground">Pilot Scores</p>
                                      {performanceReview.pilotBreakdown.map((item) => (
                                        <p key={item.pilotId} className="text-xs text-muted-foreground">
                                          <span className="text-primary">{item.callSign}</span>: {item.score}/100 ({item.grade})
                                        </p>
                                      ))}
                                    </div>

                                    {Array.isArray(debrief.plannedPath) && debrief.plannedPath.length > 0 && (
                                      <div className="border border-border/30 bg-background/30 p-2">
                                        <p className="mb-1 text-[0.65rem] text-muted-foreground">Planned Route</p>
                                        {debrief.plannedPath.map((pathStep, index) => (
                                          <p key={`${pathStep}-${index}`} className="text-xs text-muted-foreground">{index + 1}. {pathStep}</p>
                                        ))}
                                      </div>
                                    )}

                                    {Array.isArray(debrief.actionSummary) && debrief.actionSummary.length > 0 && (
                                      <div className="border border-border/30 bg-background/30 p-2">
                                        <p className="mb-1 text-[0.65rem] text-muted-foreground">Flight Actions</p>
                                        {debrief.actionSummary.slice(0, 8).map((item, index) => (
                                          <p key={`${item}-${index}`} className="text-xs text-muted-foreground">{item}</p>
                                        ))}
                                      </div>
                                    )}

                                    <p className="font-rajdhani text-xs text-muted-foreground">Assessment: {performanceReview.summary}</p>
                                    <div className="border border-border/30 bg-background/30 p-2">
                                      <p className="mb-1 text-[0.65rem] text-muted-foreground">Recommendations</p>
                                      {performanceReview.recommendations.map((item) => (
                                        <p key={item} className="text-xs text-muted-foreground">- {item}</p>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {index === 4 && (
                              <div className="space-y-3">
                                <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 4 - POST-TRAINING AIRCRAFT CHECK</p>
                                {selectedAircraftIds.map((aircraftId) => {
                                  const check = postCheckByAircraft[aircraftId] || postCheckDefaults;
                                  return (
                                    <div key={aircraftId} className="grid grid-cols-1 gap-2 border border-border/30 bg-background/20 p-3 md:grid-cols-2">
                                      <p className="md:col-span-2 text-xs text-primary">Aircraft {aircraftId}</p>
                                      <label className="text-xs text-muted-foreground">Engine Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.engineStatus} onChange={(e) => updatePostCheck(aircraftId, { engineStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Wings Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.wingsStatus} onChange={(e) => updatePostCheck(aircraftId, { wingsStatus: e.target.value as WingsStatus })}><option>OK</option><option>DAMAGE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Landing Gear Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.landingGearStatus} onChange={(e) => updatePostCheck(aircraftId, { landingGearStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Avionics Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.avionicsStatus} onChange={(e) => updatePostCheck(aircraftId, { avionicsStatus: e.target.value as SystemStatus })}><option>OK</option><option>ISSUE</option></select>
                                      </label>
                                      <label className="text-xs text-muted-foreground">Fuel System Status
                                        <select className="mt-1 w-full border border-border bg-background/40 px-2 py-1" value={check.fuelSystemStatus} onChange={(e) => updatePostCheck(aircraftId, { fuelSystemStatus: e.target.value as FuelSystemStatus })}><option>OK</option><option>LOW</option><option>CRITICAL</option><option>ISSUE</option></select>
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
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {index === 5 && (
                              <div>
                                <p className="mb-2 font-orbitron text-xs tracking-[0.18em] text-muted-foreground">STEP 5 - PILOT MEDICAL REPORT (BODY MAP)</p>
                                <div className="space-y-3">
                                  {selectedPilots.length === 0 && <p className="text-xs text-muted-foreground">Select pilots in Step 1 first.</p>}
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
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStep((prev) => Math.max(0, prev - 1))} className="rounded border border-border px-4 py-2 font-orbitron text-xs text-muted-foreground">PREV</button>
              <button type="button" onClick={goNext} className="rounded border border-border px-4 py-2 font-orbitron text-xs text-muted-foreground">NEXT</button>
              <button type="submit" disabled={running || step < 5} className="rounded border border-primary px-4 py-2 font-orbitron text-xs text-primary">
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

          {completionDebrief && (
            <div className="border border-border/30 bg-background/20 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-orbitron text-xs tracking-[0.14em] text-primary">MILITARY REPORT READY</p>
                  <p className="font-rajdhani text-xs text-muted-foreground">
                    Operation ID: {reportData?.operationId || "PENDING"}
                  </p>
                  <p className="font-rajdhani text-xs text-muted-foreground">
                    Report Status: {canGenerateReport ? "READY FOR EXPORT" : "INCOMPLETE DATA"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    disabled={!canGenerateReport}
                    className="border border-border px-4 py-2 font-orbitron text-xs text-muted-foreground disabled:opacity-50"
                  >
                    PREVIEW REPORT
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    disabled={!canGenerateReport || generatingReport}
                    className="border border-primary px-4 py-2 font-orbitron text-xs text-primary disabled:opacity-50"
                  >
                    {generatingReport ? "GENERATING PDF..." : "DOWNLOAD PDF"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {reportData && (
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
              <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="font-orbitron text-sm tracking-[0.2em] text-primary">
                    MILITARY REPORT PREVIEW
                  </DialogTitle>
                </DialogHeader>
                <div className="pt-4">
                  <TrainingReportTemplate data={reportData} mode="screen" />
                </div>
              </DialogContent>
            </Dialog>
          )}

          {reportData && (
            <div className="fixed left-[-10000px] top-0 opacity-0 pointer-events-none">
              <TrainingReportTemplate ref={reportRef} data={reportData} mode="print" className="w-[794px]" />
            </div>
          )}
          </form>
        </Panel>
      </div>
    </BackgroundLayout>
  );
};

export default Training;
