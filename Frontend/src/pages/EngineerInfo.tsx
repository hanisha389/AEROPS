import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';

interface MaintenanceLog {
  date: string;
  aircraft: string;
  type: string;
  description: string;
}

interface Engineer {
  id: number;
  name: string;
  role: string;
  employeeId: string;
  specialization: string;
  image: string;
  aircraftWorkedOn: string[];
  maintenanceLogs: MaintenanceLog[];
}

const EngineerInfo = () => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [selected, setSelected] = useState<Engineer | null>(null);

  useEffect(() => {
    api.getEngineers().then(setEngineers);
  }, []);

  return (
    <BackgroundLayout>
      <PageHeader title="ENGINEER INFO" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-4">
          {engineers.map((eng, i) => (
            <motion.div
              key={eng.id}
              className="group flex cursor-pointer items-center gap-6 border border-border/40 bg-card/30 p-4 backdrop-blur-sm transition-all duration-200 hover:border-primary/60 hover:neon-border"
              onClick={() => setSelected(eng)}
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
            >
              <div className="h-28 w-28 shrink-0 overflow-hidden">
                <img src={eng.image} alt={eng.name} className="h-full w-full object-cover grayscale transition-all group-hover:grayscale-0" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="font-orbitron text-base font-semibold text-primary">{eng.name}</p>
                <p className="font-rajdhani text-sm text-muted-foreground">{eng.role}</p>
                <p className="font-rajdhani text-sm text-muted-foreground">Specialization: <span className="text-primary">{eng.specialization}</span></p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

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
                  <p className="font-rajdhani text-sm text-muted-foreground">ID: <span className="text-primary">{selected.employeeId}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Role: <span className="text-primary">{selected.role}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Specialization: <span className="text-primary">{selected.specialization}</span></p>
                  <p className="font-rajdhani text-sm text-muted-foreground">Aircraft: <span className="text-primary">{selected.aircraftWorkedOn.join(', ')}</span></p>
                </div>
              </div>

              <div className="border-t border-border/30 pt-4">
                <h3 className="mb-2 font-orbitron text-xs tracking-widest text-muted-foreground">MAINTENANCE LOGS</h3>
                <div className="flex flex-col gap-2">
                  {selected.maintenanceLogs.map((log, i) => (
                    <div key={i} className="border border-border/20 bg-background/30 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="font-rajdhani text-sm text-primary">{log.aircraft}</span>
                        <span className="font-rajdhani text-xs text-muted-foreground">{log.date}</span>
                      </div>
                      <p className="font-rajdhani text-xs text-muted-foreground">
                        <span className={log.type === 'Unscheduled' ? 'text-amber-400' : 'text-green-400'}>{log.type}</span> — {log.description}
                      </p>
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

export default EngineerInfo;
