import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

interface Aircraft {
  id: string;
  name: string;
  model: string;
  assignedPilot: string;
  missions: string[];
}

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
      <PageHeader title="AIRCRAFT INFO" />
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleAddAircraft}
            className="border border-primary px-4 py-2 font-orbitron text-xs tracking-[0.12em] text-primary"
          >
            ADD NEW AIRCRAFT
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {aircrafts.map((ac, index) => (
            <motion.button
              key={ac.id}
              onClick={() => navigate(`/aircraft/${ac.id}`)}
              className="flex items-center justify-between border border-border/40 bg-card/30 px-5 py-4 text-left transition-colors hover:border-primary/60"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <div>
                <p className="font-orbitron text-sm text-primary">{ac.name}</p>
                <p className="font-rajdhani text-xs text-muted-foreground">{ac.model}</p>
              </div>
              <div className="text-right">
                <p className="font-rajdhani text-xs text-muted-foreground">Assigned Pilot</p>
                <p className="font-rajdhani text-sm text-primary">{ac.assignedPilot}</p>
                <p className="font-rajdhani text-xs text-muted-foreground">Missions: {ac.missions.length}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default AircraftInfo;
