import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import IAFRankInsignia from "@/components/IAFRankInsignia";
import { Panel } from "@/components/ui/custom/Panel";
import MagicBento from "@/components/MagicBento";

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

const getStatusStripClass = (status?: string) => {
  const value = (status || "active").toLowerCase();
  if (value.includes("active")) return "bg-green-900";
  if (value.includes("hold") || value.includes("medical") || value.includes("injur") || value.includes("critical") || value.includes("damage")) {
    return "bg-red-900";
  }
  if (value.includes("warning") || value.includes("leave") || value.includes("offline")) {
    return "bg-amber-900";
  }
  return "bg-amber-900";
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
            <motion.button
              key={pilot.id}
              type="button"
              onClick={() => navigate(`/pilots/${pilot.id}`)}
              className="text-left no-button-glow focus-visible:outline-none"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <MagicBento
                enableBorderGlow
                glowColor="0, 212, 255"
                spotlightRadius={360}
                className="h-full rounded-xl"
              >
                <Panel className="group relative flex h-full min-h-[26.5rem] flex-col p-0 cursor-pointer overflow-hidden hover:-translate-y-1 hover:border-accent/40 transition-all duration-300 sm:min-h-[29rem]">
                  <div className={`absolute left-0 top-0 h-1 w-full ${getStatusStripClass(pilot.status)}`} />
                  <div className="h-[17rem] w-full overflow-hidden bg-black/50 sm:h-[19rem]">
                    <img
                      src={getHighResImage(pilot.image)}
                      alt={pilot.name}
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder.svg";
                      }}
                      className="h-full w-full object-cover object-[50%_8%] opacity-80 grayscale transition-all duration-300 group-hover:opacity-100 group-hover:grayscale-0"
                    />
                  </div>
                  <div className="flex min-h-[7.5rem] flex-1 flex-col justify-between gap-3 p-4 bg-gradient-to-t from-background/90 to-transparent">
                    <div className="space-y-1.5">
                      <p className="line-clamp-1 font-rajdhani font-bold text-[1.35rem] leading-tight text-gray-100 group-hover:text-white transition-colors">{pilot.name}</p>
                      <div className="flex items-center justify-between gap-2">
                        <p className="line-clamp-1 font-inter text-xs text-muted-foreground uppercase tracking-wider">{pilot.rank}</p>
                        <IAFRankInsignia rank={pilot.rank} short />
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <StatusBadge status={pilot.status || "Active"} variant="plain" compact />
                    </div>
                  </div>
                </Panel>
              </MagicBento>
            </motion.button>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default PilotInfo;
