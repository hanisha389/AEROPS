import type { UserRole } from "@/lib/api";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN_COMMANDER: "ADMIN / COMMANDER",
  PILOT: "PILOT",
  ENGINEER: "ENGINEER",
};

const routeRoleMap: Record<string, UserRole[]> = {
  "/menu": ["ADMIN_COMMANDER", "PILOT", "ENGINEER"],
  "/pilots": ["ADMIN_COMMANDER", "PILOT"],
  "/pilots/:id": ["ADMIN_COMMANDER", "PILOT"],
  "/engineers": ["ADMIN_COMMANDER", "ENGINEER"],
  "/engineers/:id": ["ADMIN_COMMANDER", "ENGINEER"],
  "/aircraft": ["ADMIN_COMMANDER", "PILOT", "ENGINEER"],
  "/aircraft/:id": ["ADMIN_COMMANDER", "PILOT", "ENGINEER"],
  "/training": ["ADMIN_COMMANDER", "PILOT"],
  "/simulation": ["ADMIN_COMMANDER"],
  "/simulation/run": ["ADMIN_COMMANDER"],
  "/documents": ["ADMIN_COMMANDER", "PILOT", "ENGINEER"],
  "/add-pilot": ["ADMIN_COMMANDER"],
  "/add-engineer": ["ADMIN_COMMANDER"],
  "/add-aircraft": ["ADMIN_COMMANDER"],
};

export const getCurrentRole = (): UserRole => {
  const value = (sessionStorage.getItem("aerops-role") || "ADMIN_COMMANDER").toUpperCase();
  if (value === "PILOT" || value === "ENGINEER" || value === "ADMIN_COMMANDER") {
    return value;
  }
  return "ADMIN_COMMANDER";
};

export const setCurrentRole = (role: UserRole): void => {
  sessionStorage.setItem("aerops-role", role);
};

export const getCurrentPilotId = (): number | null => {
  const raw = sessionStorage.getItem("aerops-pilot-id");
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const setCurrentPilotId = (pilotId: number | null): void => {
  if (pilotId == null) {
    sessionStorage.removeItem("aerops-pilot-id");
    return;
  }
  sessionStorage.setItem("aerops-pilot-id", String(pilotId));
};

export const canAccessRoute = (route: string, role: UserRole): boolean => {
  const allowed = routeRoleMap[route];
  if (!allowed) {
    return true;
  }
  return allowed.includes(role);
};
