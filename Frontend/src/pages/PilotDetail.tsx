import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import HumanBodyModel from "@/components/HumanBodyModel";

interface Pilot {
  id: number;
  name: string;
  image: string;
  callSign: string;
  assignedAircraft?: string;
  status: "ACTIVE" | "MEDICAL HOLD" | "ON LEAVE" | string;
  personalDetails: {
    serviceNumber: string;
  };
  medicalDetails: {
    fatigueLevel?: "LOW" | "MEDIUM" | "HIGH" | string;
    safeToAssign: boolean;
    pastInjuries: string[];
    clearanceRemarks?: string;
  };
  medicalLogs: {
    id: number;
    createdAt: string;
    fatigueLevel?: string;
    safeToAssign: boolean;
    remarks?: string;
    flightContext: string;
  }[];
  trainings: {
    trainingType: string;
    createdAt: string;
    result?: string;
    debrief?: string;
  }[];
  missions: {
    name: string;
    outcome?: string;
    notes?: string;
    duration?: string;
  }[];
}

const normalizeStatus = (value: string): "ACTIVE" | "MEDICAL HOLD" | "ON LEAVE" => {
  const normalized = String(value || "ACTIVE").toUpperCase();
  if (normalized === "ON LEAVE" || normalized === "MEDICAL HOLD") return normalized;
  return "ACTIVE";
};

const parseInjuryMarks = (injuries: string[]) =>
  injuries
    .map((entry) => {
      const [part, severity] = entry.split(":");
      if (!part || !severity) return null;
      return { part, severity };
    })
    .filter((entry): entry is { part: string; severity: string } => entry !== null);

const statusColors: Record<string, { border: string; bg: string; text: string }> = {
  "ACTIVE":       { border: 'hsl(142 68% 42% / 0.5)', bg: 'hsl(142 68% 42% / 0.12)', text: 'hsl(142 68% 55%)' },
  "MEDICAL HOLD": { border: 'hsl(4 80% 52% / 0.5)',   bg: 'hsl(4 80% 52% / 0.12)',   text: 'hsl(4 80% 65%)' },
  "ON LEAVE":     { border: 'hsl(38 95% 52% / 0.5)',  bg: 'hsl(38 95% 52% / 0.12)',  text: 'hsl(38 95% 65%)' },
};

const PilotDetail = () => {
  const { id } = useParams();
  const [pilot, setPilot] = useState<Pilot | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getPilotById(Number(id)).then((data: Pilot) => setPilot(data));
  }, [id]);

  const missionHistory = useMemo(() => (pilot ? pilot.trainings : []), [pilot]);
  const injuryMarks = useMemo(
    () => (pilot ? parseInjuryMarks(pilot.medicalDetails.pastInjuries || []) : []),
    [pilot],
  );

  if (!pilot) {
    return (
      <BackgroundLayout>
        <PageHeader title="PERSONNEL RECORD" backTo="/pilots" />
        <div className="flex justify-center items-center h-64">
          <div
            className="font-space tracking-[0.2em] animate-pulse"
            style={{ fontSize: '11px', color: 'hsl(188 100% 55%)', border: '1px solid hsl(188 100% 48% / 0.2)', background: 'hsl(188 100% 48% / 0.05)', padding: '12px 24px', textTransform: 'uppercase' }}
          >
            RETRIEVING PERSONNEL RECORD...
          </div>
        </div>
      </BackgroundLayout>
    );
  }

  const status = normalizeStatus(pilot.status);
  const statusStyle = statusColors[status] || statusColors["ACTIVE"];
  const isMedicalHold = status === "MEDICAL HOLD";
  const fatigueHigh = pilot.medicalDetails.fatigueLevel === 'HIGH';

  return (
    <BackgroundLayout>
      <PageHeader title="PERSONNEL RECORD" backTo="/pilots" />

      {/* ── Pilot name header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="font-orbitron font-bold uppercase mb-1"
            style={{ fontSize: '26px', letterSpacing: '0.08em', color: 'hsl(210 20% 95%)' }}
          >
            {pilot.name}
          </h1>
          <p
            className="font-space uppercase"
            style={{ fontSize: '10px', letterSpacing: '0.2em', color: 'hsl(215 14% 46%)' }}
          >
            "{pilot.callSign}" · {pilot.personalDetails.serviceNumber} · Access Level 4
          </p>
        </div>

        {isMedicalHold && (
          <div
            className="font-space uppercase tracking-widest"
            style={{
              fontSize: '10px',
              border: '1px solid hsl(4 80% 52% / 0.5)',
              background: 'hsl(4 80% 52% / 0.12)',
              color: 'hsl(4 80% 65%)',
              padding: '6px 14px',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'hsl(4 80% 60%)', flexShrink: 0 }} />
            MEDICAL HOLD
          </div>
        )}
      </div>

      {/* ── Three-column grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr 320px', gap: '20px', alignItems: 'start' }}>

        {/* ── Column 1: Photo + quick stats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Photo */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', background: 'hsl(220 40% 7%)', border: '1px solid hsl(218 28% 18%)' }}>
            {pilot.image ? (
              <img
                src={pilot.image}
                alt={pilot.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%', mixBlendMode: 'luminosity', opacity: 0.85 }}
              />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(215 14% 35%)' }}>
                <span className="font-space" style={{ fontSize: '10px', letterSpacing: '0.2em' }}>NO IMAGE</span>
              </div>
            )}
            {/* Bottom gradient */}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, hsl(220 40% 6%) 0%, transparent 50%)', pointerEvents: 'none' }} />
          </div>

          {/* Quick stats below photo */}
          <div style={{ border: '1px solid hsl(218 28% 18%)', borderTop: 'none', background: 'hsl(220 40% 8% / 0.7)', padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '4px' }}>FLIGHT STATUS</p>
              <div
                className="font-space uppercase tracking-widest"
                style={{
                  fontSize: '10px',
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  border: `1px solid ${statusStyle.border}`,
                  background: statusStyle.bg,
                  color: statusStyle.text,
                  padding: '4px 10px',
                }}
              >
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusStyle.text, flexShrink: 0 }} />
                {status}
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '4px' }}>ASSIGNED AIRCRAFT</p>
              <p className="font-orbitron" style={{ fontSize: '13px', color: 'hsl(210 20% 90%)', letterSpacing: '0.1em' }}>
                {pilot.assignedAircraft || 'UNASSIGNED'}
              </p>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '4px' }}>FIT FOR FLIGHT</p>
              <p
                className="font-space uppercase tracking-widest"
                style={{ fontSize: '11px', color: pilot.medicalDetails.safeToAssign ? 'hsl(142 68% 55%)' : 'hsl(4 80% 60%)' }}
              >
                {pilot.medicalDetails.safeToAssign ? 'CLEARED' : 'GROUNDED'}
              </p>
            </div>

            <div>
              <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '4px' }}>FATIGUE LEVEL</p>
              <div
                className="font-space uppercase tracking-widest"
                style={{
                  fontSize: '10px',
                  display: 'inline-block',
                  border: fatigueHigh ? '1px solid hsl(4 80% 52% / 0.4)' : '1px solid hsl(38 95% 52% / 0.3)',
                  background: fatigueHigh ? 'hsl(4 80% 52% / 0.1)' : 'hsl(38 95% 52% / 0.08)',
                  color: fatigueHigh ? 'hsl(4 80% 62%)' : 'hsl(38 95% 60%)',
                  padding: '3px 10px',
                }}
              >
                {pilot.medicalDetails.fatigueLevel || 'LOW'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Medical Assessment (body model + injuries) ── */}
        <div style={{ border: '1px solid hsl(218 28% 18%)', background: 'hsl(220 40% 8% / 0.6)' }}>
          {/* Section header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(218 28% 16%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', color: 'hsl(215 14% 45%)' }}>MEDICAL ASSESSMENT</span>
          </div>

          {/* Body model */}
          <div
            style={{
              position: 'relative',
              height: '300px',
              display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
              paddingTop: '20px',
              background: 'hsl(220 42% 6% / 0.5)',
              borderBottom: '1px solid hsl(218 28% 15%)',
            }}
          >
            <HumanBodyModel selectedParts={injuryMarks.map((item) => item.part)} readOnly={true} />
          </div>

          {/* Injury list */}
          <div style={{ padding: '16px' }}>
            <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '10px' }}>
              ACTIVE INJURIES / TRAUMA
            </p>
            {injuryMarks.length === 0 ? (
              <div style={{ border: '1px solid hsl(142 68% 42% / 0.2)', background: 'hsl(142 68% 42% / 0.05)', padding: '10px 14px' }}>
                <p className="font-space uppercase" style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'hsl(142 68% 55%)' }}>
                  No active physical trauma. Bio-metrics stable.
                </p>
              </div>
            ) : (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {injuryMarks.map((injury, index) => (
                  <li key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid hsl(218 28% 16%)', paddingBottom: '8px' }}>
                    <span className="font-inter" style={{ fontSize: '13px', fontWeight: 600, color: 'hsl(210 20% 90%)', textTransform: 'uppercase' }}>{injury.part}</span>
                    <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', border: '1px solid hsl(4 80% 52% / 0.3)', background: 'hsl(4 80% 52% / 0.1)', color: 'hsl(4 80% 65%)', padding: '3px 10px' }}>{injury.severity}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Medical officer remarks */}
            <div style={{ marginTop: '16px', borderTop: '1px solid hsl(218 28% 16%)', paddingTop: '12px' }}>
              <p className="font-space uppercase" style={{ fontSize: '8px', letterSpacing: '0.2em', color: 'hsl(215 14% 40%)', marginBottom: '8px' }}>MEDICAL OFFICER REMARKS</p>
              <p className="font-inter" style={{ fontSize: '12px', fontStyle: 'italic', color: 'hsl(210 15% 70%)', borderLeft: '2px solid hsl(188 100% 48% / 0.3)', paddingLeft: '10px', lineHeight: 1.5 }}>
                "{pilot.medicalDetails.clearanceRemarks || "Cleared for all operational parameters."}"
              </p>
            </div>
          </div>
        </div>

        {/* ── Column 3: Medical Records ── */}
        <div style={{ border: '1px solid hsl(218 28% 18%)', background: 'hsl(220 40% 8% / 0.6)' }}>
          {/* Section header */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid hsl(218 28% 16%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="font-space uppercase tracking-widest" style={{ fontSize: '9px', color: 'hsl(215 14% 45%)' }}>MEDICAL RECORDS</span>
            <span className="font-space" style={{ fontSize: '9px', color: 'hsl(188 100% 55%)' }}>
              {(missionHistory.length || pilot.medicalLogs?.length || 0)} items
            </span>
          </div>

          {/* Log entries */}
          <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {/* Medical logs */}
            {pilot.medicalLogs && pilot.medicalLogs.length > 0
              ? pilot.medicalLogs.map((log) => {
                const cleared = log.safeToAssign;
                return (
                  <div
                    key={log.id}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid hsl(218 28% 14%)',
                      background: 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(220 40% 10% / 0.5)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span className="font-space" style={{ fontSize: '8px', color: 'hsl(215 14% 38%)', letterSpacing: '0.1em' }}>
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}
                      </span>
                      <span
                        className="font-space uppercase tracking-widest"
                        style={{
                          fontSize: '8px',
                          color: cleared ? 'hsl(142 68% 55%)' : 'hsl(4 80% 60%)',
                          border: `1px solid ${cleared ? 'hsl(142 68% 42% / 0.3)' : 'hsl(4 80% 52% / 0.3)'}`,
                          background: cleared ? 'hsl(142 68% 42% / 0.08)' : 'hsl(4 80% 52% / 0.08)',
                          padding: '2px 8px',
                        }}
                      >
                        {cleared ? 'CLEARED' : 'GROUNDED'}
                      </span>
                    </div>
                    <p className="font-inter" style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(210 20% 88%)', marginBottom: '2px', textTransform: 'capitalize' }}>
                      {log.flightContext || 'Medical Review'}
                    </p>
                    {log.remarks && (
                      <p className="font-inter" style={{ fontSize: '10px', color: 'hsl(215 14% 50%)', fontStyle: 'italic' }}>
                        "{log.remarks}"
                      </p>
                    )}
                  </div>
                );
              })
              : /* fallback: training entries as log */
              missionHistory.length > 0
                ? missionHistory.map((entry, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid hsl(218 28% 14%)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'hsl(220 40% 10% / 0.5)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <span className="font-space" style={{ fontSize: '8px', color: 'hsl(215 14% 38%)', letterSpacing: '0.1em' }}>
                        {entry.createdAt || 'N/A'}
                      </span>
                      <span
                        className="font-space uppercase tracking-widest"
                        style={{
                          fontSize: '8px',
                          color: entry.result === 'FAILED' ? 'hsl(4 80% 60%)' : 'hsl(142 68% 55%)',
                          border: `1px solid ${entry.result === 'FAILED' ? 'hsl(4 80% 52% / 0.3)' : 'hsl(142 68% 42% / 0.3)'}`,
                          background: entry.result === 'FAILED' ? 'hsl(4 80% 52% / 0.08)' : 'hsl(142 68% 42% / 0.08)',
                          padding: '2px 8px',
                        }}
                      >
                        {entry.result || 'CLEARED'}
                      </span>
                    </div>
                    <p className="font-inter" style={{ fontSize: '12px', fontWeight: 600, color: 'hsl(210 20% 88%)', marginBottom: '2px' }}>
                      {entry.trainingType}
                    </p>
                    {entry.debrief && (
                      <p className="font-inter" style={{ fontSize: '10px', color: 'hsl(215 14% 50%)', fontStyle: 'italic' }}>
                        "{entry.debrief}"
                      </p>
                    )}
                  </div>
                ))
                : (
                  <div style={{ padding: '24px 16px', textAlign: 'center' }}>
                    <span className="font-space uppercase" style={{ fontSize: '10px', color: 'hsl(215 14% 35%)', letterSpacing: '0.2em' }}>NO RECORDS FOUND</span>
                  </div>
                )
            }
          </div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotDetail;
