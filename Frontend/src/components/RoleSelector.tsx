import { useMemo } from "react";
import { api, type UserRole } from "@/lib/api";
import { getCurrentPilotId, ROLE_LABELS, setCurrentPilotId, setCurrentRole } from "@/lib/rbac";

interface PilotLite {
  id: number;
  name: string;
  callSign: string;
}

interface RoleSelectorProps {
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  pilots: PilotLite[];
  onPilotContextChange: (pilotId: number | null) => void;
}

const roles: UserRole[] = ["ADMIN_COMMANDER", "PILOT", "ENGINEER"];

const RoleSelector = ({ role, onRoleChange, pilots, onPilotContextChange }: RoleSelectorProps) => {
  const selectedPilotId = getCurrentPilotId();

  const pilotOptions = useMemo(
    () => pilots.map((pilot) => ({ value: String(pilot.id), label: `${pilot.callSign} (${pilot.name})` })),
    [pilots],
  );

  const handleRole = (nextRole: UserRole) => {
    setCurrentRole(nextRole);
    if (nextRole !== "PILOT") {
      setCurrentPilotId(null);
      onPilotContextChange(null);
    }
    onRoleChange(nextRole);
  };

  const handlePilot = (rawValue: string) => {
    const value = rawValue ? Number(rawValue) : null;
    setCurrentPilotId(value);
    onPilotContextChange(value);
    api.getPilotById(value ?? -1).catch(() => undefined);
  };

  return (
    <div className="flex flex-wrap items-end gap-2 border border-border/40 bg-card/30 p-3">
      <div>
        <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Role</p>
        <select
          value={role}
          onChange={(event) => handleRole(event.target.value as UserRole)}
          className="mt-1 border border-border bg-background/40 px-2 py-1 text-xs"
        >
          {roles.map((item) => (
            <option key={item} value={item}>{ROLE_LABELS[item]}</option>
          ))}
        </select>
      </div>
      {role === "PILOT" && (
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">Pilot Context</p>
          <select
            value={selectedPilotId ? String(selectedPilotId) : ""}
            onChange={(event) => handlePilot(event.target.value)}
            className="mt-1 min-w-56 border border-border bg-background/40 px-2 py-1 text-xs"
          >
            <option value="">Select pilot profile</option>
            {pilotOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default RoleSelector;
