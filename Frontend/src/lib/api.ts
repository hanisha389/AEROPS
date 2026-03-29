import axios, { AxiosHeaders } from "axios";

const client = axios.create({
  baseURL: "/api",
});

export type UserRole = "ADMIN_COMMANDER" | "PILOT" | "ENGINEER";

const getRole = (): UserRole => {
  const role = (sessionStorage.getItem("aerops-role") || "ADMIN_COMMANDER").toUpperCase();
  if (role === "PILOT" || role === "ENGINEER" || role === "ADMIN_COMMANDER") {
    return role;
  }
  return "ADMIN_COMMANDER";
};

const getPilotId = (): string | null => sessionStorage.getItem("aerops-pilot-id");

client.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers || {});
  headers.set("x-role", getRole());
  const pilotId = getPilotId();
  if (pilotId) {
    headers.set("x-pilot-id", pilotId);
  }
  config.headers = headers;
  return config;
});

export interface PilotPayload {
  name: string;
  registrationNumber: string;
  rank: string;
  callSign: string;
  assignedAircraft: string;
  status: string;
  skillLevel?: string;
  onHoliday: boolean;
  image: string;
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
    flightHoursPerAircraft: Record<string, number>;
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
  medical: {
    injuries: string;
    fitForDuty: boolean;
    lastStatus: string;
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
    pastInjuries: string[];
    surgeries: string[];
    chronicConditions: string[];
    medication: string[];
    fatigueLevel?: string;
    stressLevel?: string;
    sleepQualityScore: number;
    cognitiveReadiness: number;
    lastClearedForFlight?: string;
    clearedBy?: string;
    clearanceRemarks?: string;
    safeToAssign: boolean;
  };
  missions: {
    name: string;
    aircraftName?: string;
    duration?: string;
    status?: string;
    outcome?: string;
    notes?: string;
  }[];
}

export interface PilotUpdatePayload {
  name: string;
  assignedAircraft?: string;
  skillLevel: string;
  status: "ACTIVE" | "INACTIVE" | "ON LEAVE" | "MEDICAL HOLD";
  leaveApplied: boolean;
}

export interface EngineerPayload {
  name: string;
  employeeId: string;
  role: string;
  specialization: string;
  status: string;
  onHoliday: boolean;
  image: string;
  maintenanceLogs: {
    aircraft?: string;
    type: string;
    description?: string;
    isCurrent: boolean;
    date: string;
    issueId?: number;
    completionStatus?: string;
  }[];
}

export interface AircraftPayload {
  id: string;
  name: string;
  model: string;
  healthStatus?: string;
  lastMaintenance?: string;
  assignedPilots: string[];
  missions: {
    name: string;
    notes?: string;
  }[];
}

export interface TrainingRunPayload {
  trainingType: "basic_maneuvers" | "one_v_one_dogfight" | "precision_bomb_drop";
  pilotIds: number[];
  aircraftIds: string[];
}

export interface TrainingChecklistPayload {
  fuelLevel: "OK" | "LOW" | "CRITICAL";
  engineStatus: "OK" | "ISSUE";
  avionicsCheck: "OK" | "ISSUE";
  weaponSystems: "OK" | "NOT REQUIRED";
  overallStatus: "READY" | "NOT READY";
}

export interface PostTrainingChecklistPayload extends TrainingChecklistPayload {
  damageObserved: "YES" | "NO";
  maintenanceRequired: "YES" | "NO";
}

export interface PilotMedicalReportPayload {
  injuries: {
    part: string;
    severity: "MINOR" | "MAJOR";
  }[];
  pilotId: number;
  fatigueLevel: "LOW" | "MEDIUM" | "HIGH";
  fitForDuty: "YES" | "NO";
  remarks: string;
}

export interface AircraftTrainingCheckPayload {
  aircraftId: string;
  checklist: TrainingChecklistPayload;
}

export interface AircraftPostTrainingCheckPayload {
  aircraftId: string;
  checklist: PostTrainingChecklistPayload;
}

export interface TrainingWorkflowPayload {
  pilotIds: number[];
  aircraftIds: string[];
  trainingType: "Maneuver" | "Dogfight" | "Precision Bombing";
  duration: string;
  notes: string;
  preTrainingChecks: AircraftTrainingCheckPayload[];
  postTrainingChecks: AircraftPostTrainingCheckPayload[];
  pilotMedicalReports: PilotMedicalReportPayload[];
}

export interface MaintenanceEntryPayload {
  aircraftId: string;
  issueType: "Engine" | "Avionics" | "Structural";
  severity: "LOW" | "MEDIUM" | "HIGH";
  notes: string;
}

export interface MaintenanceCompletePayload {
  issueResolved: "YES" | "NO";
  notes: string;
}

export interface MaintenanceEntry {
  id: number;
  aircraftId: string;
  issueType: string;
  severity: string;
  status: string;
  issueResolved?: "YES" | "NO";
  engineerNotes?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AircraftMaintenanceHistoryItem {
  id: number;
  aircraftId: string;
  logType: string;
  summary: string;
  createdAt: string;
  documentId?: number | null;
}

export interface GeneratedDocument {
  id: number;
  templateKey: string;
  documentType: string;
  title: string;
  pilotId?: number;
  aircraftId?: string;
  maintenanceEntryId?: number;
  createdByRole: string;
  createdAt: string;
  payload: {
    title: string;
    fixedSections: string[];
    fields: Record<string, string | number | boolean | null>;
  };
}

export interface OpenIssue {
  id: number;
  aircraftId: string;
  component: string;
  severity: string;
  description?: string;
  status: string;
  createdAt: string;
}

export interface MapCoordinate {
  lat: number;
  lng: number;
}

export interface AirspaceZonePayload {
  countryName: string;
  center: MapCoordinate;
  radiusKm: number;
  zoneType: "friendly" | "neutral" | "enemy";
}

export interface AirspaceZone extends AirspaceZonePayload {
  id: number;
}

export interface EnemyAircraftUnitPayload {
  aircraftType: string;
  quantity: number;
}

export interface WeaponLoadoutItemPayload {
  aircraftId: string;
  weaponType: string;
  quantity: number;
}

export interface SimulationRunPayload {
  missionType: "water" | "air" | "ground";
  waterTargetType?: "cargo_ship" | "warship" | "submarine";
  routeCoordinates: MapCoordinate[];
  groundTargetLocation?: MapCoordinate;
  groundAirDefenseLevel: number;
  groundDefenseCount: number;
  enemyAircraftUnits: EnemyAircraftUnitPayload[];
  aircraftRouteWaypoints: MapCoordinate[];
  selectedPilotIds: number[];
  weaponLoadout: WeaponLoadoutItemPayload[];
}

export interface SimulationPilotContext {
  id: number;
  name: string;
  callSign: string;
  aircraftId?: string | null;
}

export interface SimulationTimelineStep {
  timeSeconds: number;
  aircraftPosition: MapCoordinate;
  enemyPosition: MapCoordinate;
  fuelRemaining: number;
  distanceToTarget: number;
  aircraftSpeedKmh: number;
  targetSpeedKmh: number;
  status: "searching" | "locked" | "intercepted" | "failed";
  statusFlags: string[];
}

export interface SimulationEventLog {
  timeSeconds: number;
  description: string;
}

export interface SimulationTrajectoryMetrics {
  totalDistanceKm: number;
  pathDeviationKm: number;
  interceptPoint: MapCoordinate;
  interceptTimeSeconds: number | null;
}

export interface SimulationFuelMetrics {
  fuelConsumptionRatePerHour: number;
  remainingRangeKm: number;
  returnFeasibility: number;
}

export interface SimulationThreatMetrics {
  timeInEnemyAirspaceSeconds: number;
  exposurePercentage: number;
  enemyStrengthImpact: number;
}

export interface SimulationPerformanceMetrics {
  pilotEfficiency: number;
  weaponReadiness: number;
}

export interface SimulationMetrics {
  trajectory: SimulationTrajectoryMetrics;
  fuel: SimulationFuelMetrics;
  threat: SimulationThreatMetrics;
  performance: SimulationPerformanceMetrics;
}

export interface SimulationFinalResult {
  status: "Active" | "Success" | "Failed";
  interceptTimeSeconds: number | null;
  successRatePercent: number;
  timeElapsedSeconds: number;
  fuelRemaining: number;
}

export interface SimulationRunResponse {
  baseLocation: MapCoordinate;
  interceptLocation: MapCoordinate;
  timeToInterceptMinutes: number;
  bestAircraftId: string;
  bestAircraftPath: MapCoordinate[];
  enemyRoute: MapCoordinate[];
  explanation: string;
  successProbability: number;
  riskLevel: number;
  fuelFeasibility: number;
  threatLevel: number;
  missionEfficiencyScore: number;
  selectedPilots: SimulationPilotContext[];
  aircraftUsed: string[];
  weaponLoadout: WeaponLoadoutItemPayload[];
  timeline: SimulationTimelineStep[];
  finalResult: SimulationFinalResult;
  metrics: SimulationMetrics;
  eventLog: SimulationEventLog[];
}

export const api = {
  getPin: () => client.get("/pin").then((res) => res.data),
  verifyPin: (code: string) => client.post("/pin/verify", { code }).then((res) => res.data),
  updatePin: (code: string) => client.put("/pin", { code }).then((res) => res.data),

  getPilots: () => client.get("/pilots").then((res) => res.data),
  getPilotById: (id: number) => client.get(`/pilots/${id}`).then((res) => res.data),
  addPilot: (payload: PilotPayload) => client.post("/pilots", payload).then((res) => res.data),
  updatePilot: (id: number, payload: PilotUpdatePayload) => client.put(`/pilots/${id}`, payload).then((res) => res.data),

  getEngineers: () => client.get("/engineers").then((res) => res.data),
  getEngineerById: (id: number) => client.get(`/engineers/${id}`).then((res) => res.data),
  addEngineer: (payload: EngineerPayload) => client.post("/engineers", payload).then((res) => res.data),
  addEngineerLog: (engineerId: number, payload: EngineerPayload["maintenanceLogs"][number]) =>
    client.post(`/engineers/${engineerId}/logs`, payload).then((res) => res.data),
  updateEngineerLogStatus: (engineerId: number, logId: number, completionStatus: string) =>
    client.put(`/engineers/${engineerId}/logs/${logId}/status`, { completionStatus }).then((res) => res.data),
  getOpenIssues: (): Promise<OpenIssue[]> => client.get("/engineers/open-issues").then((res) => res.data),

  getAircrafts: () => client.get("/aircraft").then((res) => res.data),
  getAircraftById: (id: string) => client.get(`/aircraft/${id}`).then((res) => res.data),
  getAircraftMaintenanceHistory: (id: string): Promise<AircraftMaintenanceHistoryItem[]> =>
    client.get(`/aircraft/${id}/maintenance-history`).then((res) => res.data),
  addAircraft: (payload: AircraftPayload) => client.post("/aircraft", payload).then((res) => res.data),
  updateAircraft: (id: string, payload: AircraftPayload) => client.put(`/aircraft/${id}`, payload).then((res) => res.data),

  runTraining: (payload: TrainingRunPayload) => client.post("/training/run", payload).then((res) => res.data),
  completeTrainingWorkflow: (payload: TrainingWorkflowPayload) => client.post("/training/workflow/complete", payload).then((res) => res.data),

  listMaintenanceEntries: (): Promise<MaintenanceEntry[]> => client.get("/maintenance").then((res) => res.data),
  createMaintenanceEntry: (payload: MaintenanceEntryPayload): Promise<MaintenanceEntry> => client.post("/maintenance", payload).then((res) => res.data),
  completeMaintenanceEntry: (entryId: number, payload: MaintenanceCompletePayload): Promise<MaintenanceEntry> =>
    client.put(`/maintenance/${entryId}/complete`, payload).then((res) => res.data),

  listDocuments: (params?: { type?: string; pilotId?: number; aircraftId?: string }): Promise<GeneratedDocument[]> =>
    client.get("/documents", { params }).then((res) => res.data),
  listDocumentTemplates: () => client.get("/documents/templates").then((res) => res.data),

  getAirspaceZones: (): Promise<AirspaceZone[]> => client.get("/simulation/airspace-zones").then((res) => res.data),
  createAirspaceZone: (payload: AirspaceZonePayload): Promise<AirspaceZone> => client.post("/simulation/airspace-zones", payload).then((res) => res.data),
  getSimulationBase: (): Promise<MapCoordinate> => client.get("/simulation/base").then((res) => res.data),
  setSimulationBase: (location: MapCoordinate): Promise<MapCoordinate> => client.put("/simulation/base", { location }).then((res) => res.data),
  runSimulation: (payload: SimulationRunPayload): Promise<SimulationRunResponse> => client.post("/simulation/run", payload).then((res) => res.data),
};
