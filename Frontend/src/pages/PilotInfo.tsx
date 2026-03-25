import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Mission {
  name: string;
  duration: string;
  status: string;
  outcome: string;
  notes: string;
}

interface Pilot {
  id: number;
  name: string;
  callSign: string;
  rank: string;
  registrationNumber: string;
  assignedAircraft: string;
  status: string;
  image: string;
  injury: string;
  medicalReport: string;
  missions: Mission[];
}

const statusColor = (s: string) => {
  switch (s) {
    case 'Active': return 'text-green-400';
    case 'Holiday': return 'text-yellow-400';
    case 'Rest': return 'text-amber-400';
    case 'Not Active': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
};

const PilotInfo = () => {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [selected, setSelected] = useState<Pilot | null>(null);
  const [expandedMission, setExpandedMission] = useState<number | null>(null);

  useEffect(() => {
    api.getPilots().then(setPilots);
  }, []);

  return (
    <BackgroundLayout>
      <PageHeader title="PILOT INFO" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          {pilots.map((pilot, i) => (
            <motion.div
              key={pilot.id}
              className="group flex cursor-pointer items-center gap-6 border border-border/40 bg-card/30 p-4 backdrop-blur-sm transition-all duration-200 hover:border-primary/60 hover:neon-border"
              onClick={() => { setSelected(pilot); setExpandedMission(null); }}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <div className="h-28 w-28 shrink-0 overflow-hidden">
                <img src={pilot.image} alt={pilot.name} className="h-full w-full object-cover grayscale transition-all group-hover:grayscale-0" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-orbitron text-base font-semibold text-primary">{pilot.name}</p>
                <p className="font-rajdhani text-sm text-muted-foreground">{pilot.rank}</p>
                <p className="font-rajdhani text-sm text-muted-foreground">Call Sign: <span className="text-primary">{pilot.callSign}</span></p>
                <p className={`font-rajdhani text-sm font-semibold ${statusColor(pilot.status)}`}>● {pilot.status}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          >
            <motion.div
              className="max-h-[85vh] w-full max-w-2xl overflow-y-auto border border-border/50 bg-card/90 p-6 backdrop-blur-md neon-border"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex gap-5">
                <img src={selected.image} alt={selected.name} className="h-32 w-32 object-cover" />
                <div>
                  <h2 className="font-orbitron text-lg text-primary neon-glow">{selected.name}</h2>
                  <p className="font-rajdhani text-sm text-muted-foreground">Call Sign: <span className="text-primary">{selected.callSign}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Reg: <span className="text-primary">{selected.registrationNumber}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Aircraft: <span className="text-primary">{selected.assignedAircraft}</span></p>
                  <p className={`font-rajdhani text-sm font-semibold ${statusColor(selected.status)}`}>● {selected.status}</p>
                </div>
              </div>

              <div className="mb-4 border-t border-border/30 pt-4">
                <h3 className="mb-1 font-orbitron text-xs tracking-widest text-muted-foreground">MEDICAL</h3>
                <p className="font-rajdhani text-sm text-primary">Injury: {selected.injury}</p>
                <p className="font-rajdhani text-sm text-muted-foreground">{selected.medicalReport}</p>
              </div>

              <div className="border-t border-border/30 pt-4">
                <h3 className="mb-2 font-orbitron text-xs tracking-widest text-muted-foreground">MISSIONS</h3>
                <div className="flex flex-col gap-1">
                  {selected.missions.map((m, i) => (
                    <div key={i} className="border border-border/20 bg-background/30">
                      <button
                        className="flex w-full items-center justify-between px-3 py-2 text-left font-rajdhani text-sm text-primary transition-colors hover:bg-primary/5"
                        onClick={() => setExpandedMission(expandedMission === i ? null : i)}
                      >
                        <span>{m.name}</span>
                        {expandedMission === i ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                      <AnimatePresence>
                        {expandedMission === i && (
                          <motion.div
                            className="border-t border-border/20 px-3 py-2"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                          >
                            <p className="font-rajdhani text-xs text-muted-foreground">Duration: <span className="text-primary">{m.duration}</span></p>
                            <p className="font-rajdhani text-xs text-muted-foreground">Status: <span className="text-primary">{m.status}</span></p>
                            <p className="font-rajdhani text-xs text-muted-foreground">Outcome: <span className="text-primary">{m.outcome}</span></p>
                            <p className="mt-1 font-rajdhani text-xs text-muted-foreground/70">{m.notes}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="mt-6 w-full border border-border/40 py-2 font-orbitron text-xs tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                CLOSE
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </BackgroundLayout>
  );
};

export default PilotInfo;
