import axios from "axios";

const client = axios.create({
  baseURL: "/api",
});

export interface PilotPayload {
  name: string;
  registrationNumber: string;
  rank: string;
  callSign: string;
  assignedAircraft?: string;
  status: string;
  onHoliday: boolean;
  image: string;
  medical: {
    injuries: string;
    fitForDuty: boolean;
    lastStatus: string;
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
  getOpenIssues: (): Promise<OpenIssue[]> => client.get("/engineers/open-issues").then((res) => res.data),

  getAircrafts: () => client.get("/aircraft").then((res) => res.data),
  getAircraftById: (id: string) => client.get(`/aircraft/${id}`).then((res) => res.data),
  addAircraft: (payload: AircraftPayload) => client.post("/aircraft", payload).then((res) => res.data),
  updateAircraft: (id: string, payload: AircraftPayload) => client.put(`/aircraft/${id}`, payload).then((res) => res.data),

  runTraining: (payload: TrainingRunPayload) => client.post("/training/run", payload).then((res) => res.data),
};
