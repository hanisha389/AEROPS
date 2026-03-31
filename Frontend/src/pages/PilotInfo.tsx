import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import IAFRankInsignia from "@/components/IAFRankInsignia";
import { Panel } from "@/components/ui/custom/Panel";
import { Activity, Clock } from "lucide-react";

interface Pilot {
  id: number;
  name: string;
  rank: string;
  image: string;
  status?: string;
  callSign?: string;
}

const getHighResImage = (url: string) => {
  if (!url.includes("images.unsplash.com")) return url;
  return url
    .replace(/([?&])w=\d+/, "$1w=900")
    .replace(/([?&])h=\d+/, "$1h=1200");
};

const PilotInfo = () => {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getPilots().then(setPilots);
  }, []);

  const handleAddPilot = () => {
    navigate("/add-pilot");
  };

  return (
    <BackgroundLayout>
      <PageHeader title="PERSONNEL ROSTER" />
      <div className="w-full flex-1">
        <div className="mb-6 flex justify-between items-center border-b border-border/40 pb-4">
          <div className="flex gap-4">
            <div className="px-4 py-2 border border-border/50 bg-background/50">
              <span className="font-space text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Total Active</span>
              <span className="font-orbitron font-bold text-xl text-primary">{pilots.length}</span>
            </div>
            <div className="px-4 py-2 border border-border/50 bg-background/50">
              <span className="font-space text-[10px] tracking-widest text-muted-foreground uppercase block mb-1">Squadron Status</span>
              <span className="font-orbitron font-bold text-xl text-success">READY</span>
            </div>
          </div>
          <button
            onClick={handleAddPilot}
            className="tac-btn"
          >
            + REGISTER PERSONNEL
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {pilots.map((pilot, index) => {
            const isInjured = pilot.status?.toLowerCase().includes('injur');
            const isOffline = pilot.status?.toLowerCase().includes('leave');
            const statusColor = isInjured ? 'bg-danger' : isOffline ? 'bg-warning' : 'bg-success';

            return (
              <motion.div
                key={pilot.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Panel
                  className="group flex flex-col p-0 cursor-pointer overflow-hidden border-border/30 hover:border-primary/50 transition-all duration-300 transform-gpu hover:-translate-y-1 relative"
                  onClick={() => navigate(`/pilots/${pilot.id}`)}
                >
                  {/* Status Strip Top */}
                  <div className={`h-1 w-full ${statusColor}`} />

                  {/* Image wrapper */}
                  <div className="relative h-[280px] w-full overflow-hidden bg-background">
                    <img
                      src={getHighResImage(pilot.image)}
                      alt={pilot.name}
                      className="h-full w-full object-cover object-[50%_15%] opacity-70 group-hover:opacity-100 transition-opacity duration-500 mix-blend-luminosity group-hover:mix-blend-normal"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent opacity-90" />

                    {/* Badge Overlay */}
                    <div className="absolute top-3 left-3">
                      <StatusBadge status={pilot.status || "Active"} variant="badge" />
                    </div>

                    <div className="absolute top-3 right-3 opacity-60 group-hover:opacity-100 transition-opacity">
                      <IAFRankInsignia rank={pilot.rank} short />
                    </div>
                  </div>

                  {/* Content below image (overlaps slightly) */}
                  <div className="relative z-10 flex flex-col p-4 pt-0 -mt-20">
                    <p className="font-orbitron font-bold text-lg text-foreground group-hover:text-primary transition-colors tracking-widest uppercase">
                      {pilot.name}
                    </p>
                    <p className="font-space text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-4">
                      {pilot.rank} {pilot.callSign ? `// "${pilot.callSign}"` : ''}
                    </p>

                    <hr className="mil-divider mb-4 group-hover:border-primary/30 transition-colors" />

                    {/* Telemetry Footer */}
                    <div className="flex justify-between items-center text-muted-foreground group-hover:text-foreground transition-colors">
                      <div className="flex items-center gap-2">
                        <Activity size={12} className={isInjured ? 'text-danger' : 'text-success'} />
                        <span className="font-space text-[9px] uppercase tracking-widest">
                          {isInjured ? 'MED-HOLD' : 'CLR-FLIGHT'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-60">
                        <Clock size={10} />
                        <span className="font-space text-[9px] tabular-nums tracking-wider uppercase bg-secondary px-1 py-0.5 rounded-sm">
                          LOG: 400H
                        </span>
                      </div>
                    </div>
                  </div>
                </Panel>
              </motion.div>
            )
          })}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotInfo;
