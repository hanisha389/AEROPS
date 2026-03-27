import { FormEvent, useState } from "react";
import { useEffect } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

const AddPilot = () => {
  const rankOptions = ["Lieutenant", "Captain", "Major", "Wing Commander"];
  const statusOptions = ["Active", "Rest", "Holiday", "Not Active"];
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
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
  const [aircraftOptions, setAircraftOptions] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    api.getAircrafts().then(setAircraftOptions);
  }, []);

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
    });

  const verifyAccess = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const check = await api.verifyPin(pin);
      if (check.valid) {
        setUnlocked(true);
        setResult(null);
      } else {
        setResult("Invalid code.");
      }
    } catch {
      setResult("Code verification failed.");
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setResult(null);

    if (!form.image.trim()) {
      setSubmitting(false);
      setResult("Profile picture is required.");
      return;
    }

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
        image: form.image,
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
      <PageHeader title="ADD PILOT" backTo="/pilots" />
      <div className="mx-auto w-full max-w-3xl p-6">
        {!unlocked && (
          <form onSubmit={verifyAccess} className="space-y-3 border border-border/40 bg-card/40 p-5">
            <p className="font-rajdhani text-sm text-muted-foreground">Enter code to continue</p>
            <input type="password" inputMode="numeric" className="w-full border border-border bg-background/40 px-3 py-2" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} required />
            <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">VERIFY</button>
          </form>
        )}

        {unlocked && (
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 border border-border/40 bg-card/40 p-5 md:grid-cols-2">
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Air Force Registration Number" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} required />
          <select className="border border-border bg-background/40 px-3 py-2" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} required>
            <option value="">Select Rank</option>
            {rankOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Call Sign" value={form.callSign} onChange={(e) => setForm({ ...form, callSign: e.target.value })} required />
          <select className="border border-border bg-background/40 px-3 py-2" value={form.assignedAircraft} onChange={(e) => setForm({ ...form, assignedAircraft: e.target.value })}>
            <option value="">Assign Aircraft (optional)</option>
            {aircraftOptions.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.name}</option>)}
          </select>
          <select className="border border-border bg-background/40 px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required>
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Face Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} required />
          <input
            type="file"
            accept="image/*"
            className="md:col-span-2"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const encoded = await toBase64(file);
              setForm((prev) => ({ ...prev, image: encoded }));
            }}
          />

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
        )}
        {result && <p className="mt-3 text-sm text-primary">{result}</p>}
      </div>
    </BackgroundLayout>
  );
};

export default AddPilot;
