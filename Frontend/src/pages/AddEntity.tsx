import { FormEvent, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

type EntityType = "pilot" | "engineer" | "aircraft";

const AddEntity = () => {
  const [entityType, setEntityType] = useState<EntityType>("pilot");
  const [result, setResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pilot, setPilot] = useState({
    name: "",
    registrationNumber: "",
    rank: "",
    callSign: "",
  });

  const [engineer, setEngineer] = useState({
    name: "",
    employeeId: "",
    role: "",
    specialization: "",
  });

  const [aircraft, setAircraft] = useState({
    id: "",
    name: "",
    model: "",
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      if (entityType === "pilot") {
        await api.addEntity("pilot", {
          ...pilot,
          status: "Active",
          onHoliday: false,
          image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
          medical: { injuries: "None", fitForDuty: true, lastStatus: "Fit for duty" },
          missions: [],
        });
      }

      if (entityType === "engineer") {
        await api.addEntity("engineer", {
          ...engineer,
          status: "On Duty",
          onHoliday: false,
          image: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop&crop=face",
          maintenanceLogs: [],
        });
      }

      if (entityType === "aircraft") {
        await api.addEntity("aircraft", {
          ...aircraft,
          assignedPilots: [],
          missions: [],
        });
      }

      setResult(`${entityType.toUpperCase()} created successfully.`);
    } catch {
      setResult(`Failed to create ${entityType}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BackgroundLayout>
      <PageHeader title="ADD ENTITY" />
      <div className="mx-auto w-full max-w-2xl p-6">
        <form onSubmit={onSubmit} className="space-y-4 border border-border/40 bg-card/40 p-5">
          <select
            className="w-full border border-border bg-background/40 px-3 py-2"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value as EntityType)}
          >
            <option value="pilot">Pilot</option>
            <option value="engineer">Engineer</option>
            <option value="aircraft">Aircraft</option>
          </select>

          {entityType === "pilot" && (
            <>
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Name" value={pilot.name} onChange={(e) => setPilot({ ...pilot, name: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Registration Number" value={pilot.registrationNumber} onChange={(e) => setPilot({ ...pilot, registrationNumber: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Rank" value={pilot.rank} onChange={(e) => setPilot({ ...pilot, rank: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Call Sign" value={pilot.callSign} onChange={(e) => setPilot({ ...pilot, callSign: e.target.value })} required />
            </>
          )}

          {entityType === "engineer" && (
            <>
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Name" value={engineer.name} onChange={(e) => setEngineer({ ...engineer, name: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Service ID" value={engineer.employeeId} onChange={(e) => setEngineer({ ...engineer, employeeId: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Role" value={engineer.role} onChange={(e) => setEngineer({ ...engineer, role: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Specialization" value={engineer.specialization} onChange={(e) => setEngineer({ ...engineer, specialization: e.target.value })} required />
            </>
          )}

          {entityType === "aircraft" && (
            <>
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Aircraft ID" value={aircraft.id} onChange={(e) => setAircraft({ ...aircraft, id: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Name" value={aircraft.name} onChange={(e) => setAircraft({ ...aircraft, name: e.target.value })} required />
              <input className="w-full border border-border bg-background/40 px-3 py-2" placeholder="Model" value={aircraft.model} onChange={(e) => setAircraft({ ...aircraft, model: e.target.value })} required />
            </>
          )}

          <button type="submit" disabled={submitting} className="w-full border border-primary px-4 py-2 font-orbitron text-sm text-primary">
            {submitting ? "SAVING..." : "SAVE"}
          </button>
        </form>
        {result && <p className="mt-3 text-sm text-primary">{result}</p>}
      </div>
    </BackgroundLayout>
  );
};

export default AddEntity;
