import { FormEvent, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

const AddPilot = () => {
  const [form, setForm] = useState({
    name: "",
    registrationNumber: "",
    rank: "",
    callSign: "",
    assignedAircraft: "",
    status: "Active",
    onHoliday: false,
    image: "",
    injuries: "None",
    fitForDuty: true,
    lastStatus: "Fit for duty",
    missionsText: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    const missions = form.missionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => ({ name: line }));

    try {
      await api.addPilot({
        name: form.name,
        registrationNumber: form.registrationNumber,
        rank: form.rank,
        callSign: form.callSign,
        assignedAircraft: form.assignedAircraft || undefined,
        status: form.status,
        onHoliday: form.onHoliday,
        image:
          form.image ||
          "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face",
        medical: {
          injuries: form.injuries,
          fitForDuty: form.fitForDuty,
          lastStatus: form.lastStatus,
        },
        missions,
      });
      setResult("Pilot added successfully.");
      setForm({
        name: "",
        registrationNumber: "",
        rank: "",
        callSign: "",
        assignedAircraft: "",
        status: "Active",
        onHoliday: false,
        image: "",
        injuries: "None",
        fitForDuty: true,
        lastStatus: "Fit for duty",
        missionsText: "",
      });
    } catch {
      setResult("Failed to add pilot. Check if registration number is unique.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BackgroundLayout>
      <PageHeader title="ADD PILOT" />
      <div className="mx-auto w-full max-w-3xl p-6">
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 border border-border/40 bg-card/40 p-5 md:grid-cols-2">
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Air Force Registration Number" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Rank" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Call Sign" value={form.callSign} onChange={(e) => setForm({ ...form, callSign: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Assigned Aircraft ID" value={form.assignedAircraft} onChange={(e) => setForm({ ...form, assignedAircraft: e.target.value })} />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Face Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />

          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Injuries" value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Last Medical Status" value={form.lastStatus} onChange={(e) => setForm({ ...form, lastStatus: e.target.value })} />

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={form.onHoliday} onChange={(e) => setForm({ ...form, onHoliday: e.target.checked })} />
            On Holiday
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={form.fitForDuty} onChange={(e) => setForm({ ...form, fitForDuty: e.target.checked })} />
            Fit For Duty
          </label>

          <textarea
            className="min-h-28 border border-border bg-background/40 px-3 py-2 md:col-span-2"
            placeholder="Mission names (one per line)"
            value={form.missionsText}
            onChange={(e) => setForm({ ...form, missionsText: e.target.value })}
          />

          <button type="submit" disabled={submitting} className="border border-primary px-4 py-2 font-orbitron text-sm text-primary md:col-span-2">
            {submitting ? "ADDING..." : "ADD PILOT"}
          </button>
        </form>
        {result && <p className="mt-3 text-sm text-primary">{result}</p>}
      </div>
    </BackgroundLayout>
  );
};

export default AddPilot;
