import { FormEvent, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

const AddAircraft = () => {
  const modelOptions = ["F-35A", "F-22A", "Rafale C", "Su-57", "Eurofighter Typhoon", "J-20", "F-15EX"];
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    model: "",
    assignedPilots: "",
    missions: "",
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

  const submitAircraft = async (event: FormEvent) => {
    event.preventDefault();
    setResult(null);
    try {
      await api.addAircraft({
        id: form.id,
        name: form.name,
        model: form.model,
        assignedPilots: form.assignedPilots.split(",").map((item) => item.trim()).filter(Boolean),
        missions: form.missions.split("\n").map((item) => item.trim()).filter(Boolean).map((name) => ({ name })),
      });
      setResult("Aircraft added successfully.");
      setForm({ id: "", name: "", model: "", assignedPilots: "", missions: "" });
    } catch {
      setResult("Failed to add aircraft.");
    }
  };

  return (
    <BackgroundLayout>
      <PageHeader title="ADD AIRCRAFT" backTo="/aircraft" />
      <div className="mx-auto w-full max-w-3xl p-6">
        {!unlocked && (
          <form onSubmit={verifyAccess} className="space-y-3 border border-border/40 bg-card/40 p-5">
            <p className="font-rajdhani text-sm text-muted-foreground">Enter code to continue</p>
            <input type="password" inputMode="numeric" className="w-full border border-border bg-background/40 px-3 py-2" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} required />
            <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">VERIFY</button>
          </form>
        )}

        {unlocked && (
          <form onSubmit={submitAircraft} className="grid grid-cols-1 gap-4 border border-border/40 bg-card/40 p-5 md:grid-cols-2">
            <input className="border border-border bg-background/40 px-3 py-2" placeholder="Aircraft ID" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} required />
            <input className="border border-border bg-background/40 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <select className="border border-border bg-background/40 px-3 py-2 md:col-span-2" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} required>
              <option value="">Select Model</option>
              {modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Assigned Pilots (comma separated)" value={form.assignedPilots} onChange={(e) => setForm({ ...form, assignedPilots: e.target.value })} />
            <textarea className="min-h-28 border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Missions (one per line)" value={form.missions} onChange={(e) => setForm({ ...form, missions: e.target.value })} />
            <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-sm text-primary md:col-span-2">ADD AIRCRAFT</button>
          </form>
        )}
        {result && <p className="mt-3 text-sm text-primary">{result}</p>}
      </div>
    </BackgroundLayout>
  );
};

export default AddAircraft;
