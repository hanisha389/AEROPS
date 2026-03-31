import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui/custom/Panel";
import MagicBento from "@/components/MagicBento";

interface Aircraft {
  id: string;
  name: string;
  model: string;
  assignedPilot: string;
}

type HealthState = "OPERATIONAL" | "WARNING" | "CRITICAL";

const getAircraftHealth = (aircraft: Aircraft): HealthState => {
  const hint = `${aircraft.name} ${aircraft.model}`.toLowerCase();
  if (hint.includes("critical") || hint.includes("damage") || hint.includes("issue")) {
    return "CRITICAL";
  }
  if (!aircraft.assignedPilot || aircraft.assignedPilot.toLowerCase() === "unassigned") {
    return "WARNING";
  }
  return "OPERATIONAL";
};

const healthStripClass: Record<HealthState, string> = {
  OPERATIONAL: "bg-green-700",
  WARNING: "bg-amber-700",
  CRITICAL: "bg-red-700",
};

const healthBadgeClass: Record<HealthState, string> = {
  OPERATIONAL: "border-green-500/40 bg-green-500/10 text-green-400",
  WARNING: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  CRITICAL: "border-red-500/40 bg-red-500/10 text-red-400",
};

const AircraftInfo = () => {
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getAircrafts().then(setAircrafts);
  }, []);

  const handleAddAircraft = () => {
    navigate("/add-aircraft");
  };

  return (
    <BackgroundLayout>
      <PageHeader title="AIRCRAFT FLEET" />
      <div className="p-6 w-full flex flex-col gap-6">
        <div className="flex justify-end">
          <button
            onClick={handleAddAircraft}
            className="rounded bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white px-4 py-2 font-rajdhani font-semibold text-sm tracking-[0.05em] text-gray-300 transition-colors"
          >
            + REGISTER AIRCRAFT
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {aircrafts.map((ac, index) => (
            <motion.button
              key={ac.id}
              type="button"
              onClick={() => navigate(`/aircraft/${ac.id}`)}
              className="text-left no-button-glow focus-visible:outline-none"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <MagicBento
                enableBorderGlow
                glowColor="0, 212, 255"
                spotlightRadius={360}
                className="w-full rounded-xl"
              >
                <Panel className="group relative w-full overflow-hidden p-5 md:p-6 hover:-translate-y-0.5 hover:border-accent/40 transition-all">
                  {(() => {
                    const health = getAircraftHealth(ac);
                    return (
                      <>
                        <div className={`absolute left-0 top-0 h-1 w-full ${healthStripClass[health]}`} />
                        <div className="absolute right-4 top-4">
                          <span className={`inline-flex items-center rounded border px-2 py-1 text-[10px] font-orbitron tracking-[0.14em] ${healthBadgeClass[health]}`}>
                            {health}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-4 pt-3 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                          <div className="min-w-0 md:pr-4">
                            <h3 className="truncate font-rajdhani text-xl font-bold uppercase tracking-widest text-gray-100">
                              {ac.name}
                            </h3>
                            <p className="mt-1 font-inter text-xs font-medium uppercase tracking-wider text-gray-400">
                              {ac.model}
                            </p>
                          </div>

                          <div className="border-t border-white/10 pt-3 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                            <span className="mb-1 block font-inter text-[10px] uppercase tracking-widest text-gray-500">
                              Assigned Pilot
                            </span>
                            <span className="font-inter text-sm text-gray-200">{ac.assignedPilot || "Unassigned"}</span>
                          </div>

                          <div className="flex items-center justify-end gap-2 text-gray-400">
                            <span className="font-inter text-[10px] uppercase tracking-[0.22em] text-gray-500">Open</span>
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 transition-colors group-hover:border-accent/40 group-hover:bg-accent/10">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 group-hover:text-accent">
                                <path d="m9 18 6-6-6-6" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </Panel>
              </MagicBento>
            </motion.button>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftInfo;
