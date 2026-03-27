import { FormEvent, useState } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

const AddEngineer = () => {
  const roleOptions = ["Avionics Specialist", "Engine Mechanic", "Airframe Specialist", "Weapons Systems Tech", "Navigation Systems", "QA Inspector"];
  const specializationOptions = ["Avionics", "Jet Engines", "Structural", "Weapons", "Navigation", "Hydraulics"];
  const statusOptions = ["On Duty", "Off Duty", "Holiday"];
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    employeeId: "",
    role: "",
    specialization: "",
    status: "On Duty",
    onHoliday: false,
    image: "",
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

  const toBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
    });

  const submitEngineer = async (event: FormEvent) => {
    event.preventDefault();
    setResult(null);

    if (!form.image.trim()) {
      setResult("Profile picture is required.");
      return;
    }

    try {
      await api.addEngineer({
        ...form,
        maintenanceLogs: [],
      });
      setResult("Engineer added successfully.");
      setForm({
        name: "",
        employeeId: "",
        role: "",
        specialization: "",
        status: "On Duty",
        onHoliday: false,
        image: "",
      });
    } catch {
      setResult("Failed to add engineer.");
    }
  };

  return (
    <BackgroundLayout>
      <PageHeader title="ADD ENGINEER" backTo="/engineers" />
      <div className="mx-auto w-full max-w-3xl p-6">
        {!unlocked && (
          <form onSubmit={verifyAccess} className="space-y-3 border border-border/40 bg-card/40 p-5">
            <p className="font-rajdhani text-sm text-muted-foreground">Enter code to continue</p>
            <input type="password" inputMode="numeric" className="w-full border border-border bg-background/40 px-3 py-2" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value)} required />
            <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-xs text-primary">VERIFY</button>
          </form>
        )}

        {unlocked && (
          <form onSubmit={submitEngineer} className="grid grid-cols-1 gap-4 border border-border/40 bg-card/40 p-5 md:grid-cols-2">
            <input className="border border-border bg-background/40 px-3 py-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="border border-border bg-background/40 px-3 py-2" placeholder="Service ID" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} required />
            <select className="border border-border bg-background/40 px-3 py-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} required>
              <option value="">Select Role</option>
              {roleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select className="border border-border bg-background/40 px-3 py-2" value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} required>
              <option value="">Select Specialization</option>
              {specializationOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select className="border border-border bg-background/40 px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required>
              {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.onHoliday} onChange={(e) => setForm({ ...form, onHoliday: e.target.checked })} />
              On Holiday
            </label>

            <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Profile Picture URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} required />
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

            <button type="submit" className="border border-primary px-4 py-2 font-orbitron text-sm text-primary md:col-span-2">ADD ENGINEER</button>
          </form>
        )}
        {result && <p className="mt-3 text-sm text-primary">{result}</p>}
      </div>
    </BackgroundLayout>
  );
};

export default AddEngineer;
