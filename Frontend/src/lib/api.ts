import axios from "axios";

const client = axios.create({
  baseURL: "/api",
});

export interface PilotPayload {
  name: string;
  registrationNumber: string;
  rank: string;
  callSign: string;
  assignedAircraft: string;
  status: string;
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

export interface SimulationResult {
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
}

export const api = {
  getPin: () => client.get("/pin").then((res) => res.data),
  verifyPin: (code: string) => client.post("/pin/verify", { code }).then((res) => res.data),
  updatePin: (code: string) => client.put("/pin", { code }).then((res) => res.data),

  getPilots: () => client.get("/pilots").then((res) => res.data),
  getPilotById: (id: number) => client.get(`/pilots/${id}`).then((res) => res.data),
  addPilot: (payload: PilotPayload) => client.post("/pilots", payload).then((res) => res.data),

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
  addAircraft: (payload: AircraftPayload) => client.post("/aircraft", payload).then((res) => res.data),
  updateAircraft: (id: string, payload: AircraftPayload) => client.put(`/aircraft/${id}`, payload).then((res) => res.data),

  runTraining: (payload: TrainingRunPayload) => client.post("/training/run", payload).then((res) => res.data),

  getAirspaceZones: (): Promise<AirspaceZone[]> => client.get("/simulation/airspace-zones").then((res) => res.data),
  createAirspaceZone: (payload: AirspaceZonePayload): Promise<AirspaceZone> => client.post("/simulation/airspace-zones", payload).then((res) => res.data),
  getSimulationBase: (): Promise<MapCoordinate> => client.get("/simulation/base").then((res) => res.data),
  setSimulationBase: (location: MapCoordinate): Promise<MapCoordinate> => client.put("/simulation/base", { location }).then((res) => res.data),
  runSimulation: (payload: SimulationRunPayload): Promise<SimulationResult> => client.post("/simulation/run", payload).then((res) => res.data),
};
