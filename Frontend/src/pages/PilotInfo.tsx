import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";

interface Pilot {
  id: number;
  name: string;
  rank: string;
  image: string;
}

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
      <PageHeader title="PILOT INFO" />
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleAddPilot}
            className="border border-primary px-4 py-2 font-orbitron text-xs tracking-[0.12em] text-primary"
          >
            ADD NEW PILOT
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {pilots.map((pilot, index) => (
            <motion.button
              key={pilot.id}
              onClick={() => navigate(`/pilots/${pilot.id}`)}
              className="group overflow-hidden border border-border/40 bg-card/30 text-left transition-colors hover:border-primary/60"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <div className="mx-auto w-full max-w-[170px]">
                <img src={pilot.image} alt={pilot.name} className="h-72 w-full object-contain bg-black/30 grayscale transition-all duration-200 group-hover:grayscale-0" />
              </div>
              <div className="p-4">
                <p className="font-orbitron text-sm text-primary">{pilot.name}</p>
                <p className="font-rajdhani text-sm text-muted-foreground">{pilot.rank}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotInfo;
