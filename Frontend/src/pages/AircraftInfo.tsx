import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Aircraft {
  id: string;
  name: string;
  model: string;
  assignedPilot: string;
  assignedPilots: string[];
  missions: string[];
  lastMaintenance: string;
  healthStatus?: string;
}

const AircraftInfo = () => {
  const [aircrafts, setAircrafts] = useState<Aircraft[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    api.getAircrafts().then(setAircrafts);
  }, []);

  return (
    <BackgroundLayout>
      <PageHeader title="AIRCRAFT INFO" />
      <div className="p-6">
        <div className="flex flex-col gap-2">
          {aircrafts.map((ac, i) => (
            <motion.div
              key={ac.id}
              className="border border-border/40 bg-card/30 backdrop-blur-sm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <button
                className="flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-primary/5"
                onClick={() => setExpanded(expanded === ac.id ? null : ac.id)}
              >
                <div className="flex items-center gap-4">
                  {expanded === ac.id ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="font-orbitron text-sm tracking-wider text-primary">{ac.name}</span>
                  <span className="font-rajdhani text-xs text-muted-foreground">({ac.model})</span>
                </div>
                <span className="font-rajdhani text-sm text-muted-foreground">Pilot: <span className="text-primary">{ac.assignedPilot}</span></span>
              </button>

              <AnimatePresence>
                {expanded === ac.id && (
                  <motion.div
                    className="border-t border-border/20 px-5 py-4"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <div className="mb-4 grid grid-cols-2 gap-x-8 gap-y-1">
                      <p className="font-rajdhani text-sm text-muted-foreground">Aircraft ID: <span className="text-primary">{ac.id}</span></p>
                      <p className="font-rajdhani text-sm text-muted-foreground">Last Maintenance: <span className="text-primary">{ac.lastMaintenance}</span></p>
                      <p className="font-rajdhani text-sm text-muted-foreground">Missions: <span className="text-primary">{ac.missions.length}</span></p>
                      <p className="font-rajdhani text-sm text-muted-foreground">Assigned Pilots: <span className="text-primary">{ac.assignedPilots.length}</span></p>
                    </div>

                    <div className="mb-3">
                      <h4 className="mb-1 font-orbitron text-xs tracking-widest text-muted-foreground">MISSIONS</h4>
                      <div className="flex flex-wrap gap-2">
                        {ac.missions.map((m, j) => (
                          <span key={j} className="border border-border/30 bg-background/30 px-2 py-0.5 font-rajdhani text-xs text-primary">{m}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="mb-2 font-orbitron text-xs tracking-widest text-muted-foreground">ASSIGNED PILOTS</h4>
                      <div className="flex flex-wrap gap-2">
                        {ac.assignedPilots.map((pilotName, j) => (
                          <span key={j} className="border border-border/30 bg-background/30 px-2 py-0.5 font-rajdhani text-xs text-primary">
                            {pilotName}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftInfo;
