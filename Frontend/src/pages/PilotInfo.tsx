import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import IAFRankInsignia from "@/components/IAFRankInsignia";
import { Panel } from "@/components/ui/custom/Panel";

interface Pilot {
  id: number;
  name: string;
  rank: string;
  image: string;
  status?: string;
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
      <PageHeader title="PILOT PERSONNEL" />
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleAddPilot}
            className="rounded bg-accent/10 border border-accent/30 hover:bg-accent/20 px-4 py-2 font-rajdhani font-semibold text-sm tracking-[0.05em] text-accent transition-colors"
          >
            + REGISTER PERSONNEL
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {pilots.map((pilot, index) => (
            <motion.div
              key={pilot.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <Panel className="group flex h-full min-h-[26.5rem] flex-col p-0 cursor-pointer overflow-hidden hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300 sm:min-h-[29rem]" onClick={() => navigate(`/pilots/${pilot.id}`)}>
                <div className="h-[17rem] w-full overflow-hidden bg-black/50 sm:h-[19rem]">
                  <img
                    src={getHighResImage(pilot.image)}
                    alt={pilot.name}
                    className="h-full w-full object-cover object-[50%_8%] opacity-80 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-end p-4 bg-gradient-to-t from-background/90 to-transparent">
                  <p className="line-clamp-1 font-rajdhani font-bold text-[1.35rem] leading-tight text-gray-100 group-hover:text-white transition-colors">{pilot.name}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 mb-2">
                    <p className="line-clamp-1 font-inter text-xs text-muted-foreground uppercase tracking-wider">{pilot.rank}</p>
                    <IAFRankInsignia rank={pilot.rank} short />
                  </div>
                  <div className="mt-auto">
                    <StatusBadge status={pilot.status || "Active"} variant="plain" compact />
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotInfo;
