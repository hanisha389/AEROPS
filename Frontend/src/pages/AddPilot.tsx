import { FormEvent, useState } from "react";
import { useEffect } from "react";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

const AddPilot = () => {
  const rankOptions = ["Lieutenant", "Captain", "Major", "Wing Commander"];
  const statusOptions = ["ACTIVE", "INACTIVE", "ON LEAVE", "MEDICAL HOLD"];
  const trainingLevelOptions = ["Rookie", "Intermediate", "Expert"];
  const specializationOptions = ["Air Combat", "Ground Strike", "Reconnaissance"];
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [form, setForm] = useState({
    name: "",
    registrationNumber: "",
    rank: "",
    callSign: "",
    assignedAircraft: "",
    status: "ACTIVE",
    onHoliday: false,
    serviceNumber: "",
    dateOfBirth: "",
    dateOfJoining: "",
    yearsOfService: 0,
    baseLocation: "",
    assignedSquadron: "",
    assignedAircraftType: "",
    lastMissionDate: "",
    currentMissionAssignment: "",
    aircraftCertificationsText: "",
    totalFlightHours: 0,
    specializations: ["Air Combat"],
    trainingLevel: "Intermediate",
    simulatorPerformanceScore: 75,
    avgMissionSuccessRate: 75,
    reactionTimeScore: 70,
    maneuverAccuracy: 72,
    decisionEfficiencyScore: 74,
    last5TrainingResultsText: "Pass|Pass|Pass|Pass|Pass",
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
        assignedAircraft: form.assignedAircraft,
        status: form.status,
        skillLevel: form.trainingLevel,
        onHoliday: form.onHoliday,
        image: form.image,
        personalDetails: {
          fullName: form.name,
          serviceNumber: form.serviceNumber,
          dateOfBirth: form.dateOfBirth || undefined,
          dateOfJoining: form.dateOfJoining || undefined,
          yearsOfService: Number(form.yearsOfService || 0),
        },
        operationalStatus: {
          operationalState: form.status,
          baseLocation: form.baseLocation || undefined,
          assignedSquadron: form.assignedSquadron || undefined,
          assignedAircraftType: form.assignedAircraftType || undefined,
          lastMissionDate: form.lastMissionDate || undefined,
          currentMissionAssignment: form.currentMissionAssignment || undefined,
        },
        qualifications: {
          aircraftCertifications: form.aircraftCertificationsText.split("|").map((item) => item.trim()).filter(Boolean),
          totalFlightHours: Number(form.totalFlightHours || 0),
          flightHoursPerAircraft: {},
          specializations: form.specializations,
          trainingLevel: form.trainingLevel,
          simulatorPerformanceScore: Number(form.simulatorPerformanceScore || 0),
        },
        performanceMetrics: {
          avgMissionSuccessRate: Number(form.avgMissionSuccessRate || 0),
          reactionTimeScore: Number(form.reactionTimeScore || 0),
          maneuverAccuracy: Number(form.maneuverAccuracy || 0),
          decisionEfficiencyScore: Number(form.decisionEfficiencyScore || 0),
          last5TrainingResults: form.last5TrainingResultsText.split("|").map((item) => item.trim()).filter(Boolean),
        },
        medical: {
          injuries: form.injuries,
          fitForDuty: form.fitForDuty,
          lastStatus: form.lastStatus,
        },
        medicalDetails: {
          currentStatus: form.fitForDuty ? "Fit for Flight" : "Temporarily Grounded",
          lastMedicalCheckDate: form.lastMissionDate || undefined,
          nextDueCheck: undefined,
          heartRate: undefined,
          bloodPressure: undefined,
          oxygenSaturation: undefined,
          visionStatus: undefined,
          gToleranceLevel: undefined,
          pastInjuries: form.injuries && form.injuries !== "None" ? [form.injuries] : [],
          surgeries: [],
          chronicConditions: [],
          medication: [],
          fatigueLevel: "Low",
          stressLevel: "Low",
          sleepQualityScore: 80,
          cognitiveReadiness: 80,
          lastClearedForFlight: form.lastMissionDate || undefined,
          clearedBy: "MO-1",
          clearanceRemarks: form.fitForDuty ? "Fit for high-G maneuvers" : "Monitor before assignment",
          safeToAssign: form.fitForDuty,
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
        status: "ACTIVE",
        onHoliday: false,
        serviceNumber: "",
        dateOfBirth: "",
        dateOfJoining: "",
        yearsOfService: 0,
        baseLocation: "",
        assignedSquadron: "",
        assignedAircraftType: "",
        lastMissionDate: "",
        currentMissionAssignment: "",
        aircraftCertificationsText: "",
        totalFlightHours: 0,
        specializations: ["Air Combat"],
        trainingLevel: "Intermediate",
        simulatorPerformanceScore: 75,
        avgMissionSuccessRate: 75,
        reactionTimeScore: 70,
        maneuverAccuracy: 72,
        decisionEfficiencyScore: 74,
        last5TrainingResultsText: "Pass|Pass|Pass|Pass|Pass",
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
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Service Number" value={form.serviceNumber} onChange={(e) => setForm({ ...form, serviceNumber: e.target.value })} required />
          <input type="date" className="border border-border bg-background/40 px-3 py-2" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          <input type="date" className="border border-border bg-background/40 px-3 py-2" value={form.dateOfJoining} onChange={(e) => setForm({ ...form, dateOfJoining: e.target.value })} />
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Years of Service" value={form.yearsOfService} onChange={(e) => setForm({ ...form, yearsOfService: Number(e.target.value) })} />
          <select className="border border-border bg-background/40 px-3 py-2" value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value })} required>
            <option value="">Select Rank</option>
            {rankOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Call Sign" value={form.callSign} onChange={(e) => setForm({ ...form, callSign: e.target.value })} required />
          <select className="border border-border bg-background/40 px-3 py-2" value={form.assignedAircraft} onChange={(e) => setForm({ ...form, assignedAircraft: e.target.value })} required>
            <option value="">Assign Aircraft</option>
            {aircraftOptions.map((item) => <option key={item.id} value={item.id}>{item.id} - {item.name}</option>)}
          </select>
          <select className="border border-border bg-background/40 px-3 py-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} required>
            {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Face Image URL" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} required />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Current Base Location" value={form.baseLocation} onChange={(e) => setForm({ ...form, baseLocation: e.target.value })} />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Assigned Squadron" value={form.assignedSquadron} onChange={(e) => setForm({ ...form, assignedSquadron: e.target.value })} />
          <input className="border border-border bg-background/40 px-3 py-2" placeholder="Assigned Aircraft Type" value={form.assignedAircraftType} onChange={(e) => setForm({ ...form, assignedAircraftType: e.target.value })} />
          <input type="date" className="border border-border bg-background/40 px-3 py-2" value={form.lastMissionDate} onChange={(e) => setForm({ ...form, lastMissionDate: e.target.value })} />
          <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Current Mission Assignment" value={form.currentMissionAssignment} onChange={(e) => setForm({ ...form, currentMissionAssignment: e.target.value })} />
          <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Aircraft Certifications (use | separator)" value={form.aircraftCertificationsText} onChange={(e) => setForm({ ...form, aircraftCertificationsText: e.target.value })} />
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Total Flight Hours" value={form.totalFlightHours} onChange={(e) => setForm({ ...form, totalFlightHours: Number(e.target.value) })} />
          <select className="border border-border bg-background/40 px-3 py-2" value={form.trainingLevel} onChange={(e) => setForm({ ...form, trainingLevel: e.target.value })}>
            {trainingLevelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <div className="md:col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {specializationOptions.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.specializations.includes(option)}
                  onChange={(e) => {
                    const next = e.target.checked ? [...form.specializations, option] : form.specializations.filter((item) => item !== option);
                    setForm({ ...form, specializations: next });
                  }}
                />
                {option}
              </label>
            ))}
          </div>
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Simulator Performance Score" value={form.simulatorPerformanceScore} onChange={(e) => setForm({ ...form, simulatorPerformanceScore: Number(e.target.value) })} />
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Avg Mission Success Rate" value={form.avgMissionSuccessRate} onChange={(e) => setForm({ ...form, avgMissionSuccessRate: Number(e.target.value) })} />
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Reaction Time Score" value={form.reactionTimeScore} onChange={(e) => setForm({ ...form, reactionTimeScore: Number(e.target.value) })} />
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Maneuver Accuracy" value={form.maneuverAccuracy} onChange={(e) => setForm({ ...form, maneuverAccuracy: Number(e.target.value) })} />
          <input type="number" className="border border-border bg-background/40 px-3 py-2" placeholder="Decision Efficiency Score" value={form.decisionEfficiencyScore} onChange={(e) => setForm({ ...form, decisionEfficiencyScore: Number(e.target.value) })} />
          <input className="border border-border bg-background/40 px-3 py-2 md:col-span-2" placeholder="Last 5 Training Results (use | separator)" value={form.last5TrainingResultsText} onChange={(e) => setForm({ ...form, last5TrainingResultsText: e.target.value })} />
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
