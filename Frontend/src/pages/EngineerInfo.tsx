import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import { Panel } from "@/components/ui/custom/Panel";
import MagicBento from "@/components/MagicBento";

interface Engineer {
  id: number;
  name: string;
  role: string;
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
  if (value.includes("active") || value.includes("duty") || value.includes("busy")) return "bg-green-900";
  if (value.includes("hold") || value.includes("medical") || value.includes("injur") || value.includes("critical") || value.includes("damage")) {
    return "bg-red-900";
  }
  if (value.includes("warning") || value.includes("leave") || value.includes("offline")) {
    return "bg-amber-900";
  }
  return "bg-amber-900";
};

const EngineerInfo = () => {
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getEngineers().then(setEngineers);
  }, []);

  const handleAddEngineer = () => {
    navigate("/add-engineer");
  };

  return (
    <BackgroundLayout>
      <PageHeader title="ENGINEER INFO" />
      <div className="p-6">
        <div className="mb-4 flex justify-end">
          <button
            onClick={handleAddEngineer}
            className="rounded bg-accent/10 border border-accent/30 hover:bg-accent/20 px-4 py-2 font-rajdhani font-semibold text-sm tracking-[0.05em] text-accent transition-colors"
          >
            ADD NEW ENGINEER
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {engineers.map((engineer, index) => (
            <motion.button
              key={engineer.id}
              onClick={() => navigate(`/engineers/${engineer.id}`)}
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
                  <div className={`absolute left-0 top-0 h-1 w-full ${getStatusStripClass(engineer.status)}`} />
                  <div className="h-[17rem] w-full overflow-hidden bg-black/50 sm:h-[19rem]">
                    <img
                      src={getHighResImage(engineer.image)}
                      alt={engineer.name}
                      onError={(event) => {
                        event.currentTarget.src = "/placeholder.svg";
                      }}
                      className="h-full w-full object-cover object-top opacity-80 grayscale transition-all duration-200 group-hover:opacity-100 group-hover:grayscale-0"
                    />
                  </div>
                  <div className="flex min-h-[7.5rem] flex-1 flex-col justify-between gap-3 p-4 bg-gradient-to-t from-background/90 to-transparent">
                    <div className="space-y-1.5">
                      <p className="line-clamp-1 font-rajdhani font-bold text-[1.35rem] leading-tight text-gray-100 group-hover:text-white transition-colors">
                        {engineer.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="line-clamp-1 font-inter text-xs text-muted-foreground uppercase tracking-wider">{engineer.role}</p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-white/5">
                      <StatusBadge status={engineer.status || "Busy"} variant="plain" compact />
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

export default EngineerInfo;
