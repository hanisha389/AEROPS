import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import StatusBadge from "@/components/StatusBadge";
import IAFRankInsignia from "@/components/IAFRankInsignia";

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
            className="border border-primary px-4 py-2 font-orbitron text-xs tracking-[0.12em] text-primary"
          >
            ADD NEW ENGINEER
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          {engineers.map((engineer, index) => (
            <motion.button
              key={engineer.id}
              onClick={() => navigate(`/engineers/${engineer.id}`)}
              className="group flex h-full min-h-[26.5rem] flex-col overflow-hidden border border-border/40 bg-card/30 text-left transition-colors hover:border-primary/60 sm:min-h-[29rem]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <div className="h-[17rem] w-full overflow-hidden bg-black/30 sm:h-[19rem]">
                <img
                  src={getHighResImage(engineer.image)}
                  alt={engineer.name}
                  className="h-full w-full object-contain object-top grayscale transition-all duration-200 group-hover:grayscale-0"
                />
              </div>
              <div className="flex flex-1 flex-col justify-end px-3 pb-3 pt-2">
                <p className="line-clamp-1 font-orbitron text-base leading-tight text-primary sm:text-[1.05rem]">{engineer.name}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 font-rajdhani text-[1.02rem] text-muted-foreground">{engineer.role}</p>
                  <IAFRankInsignia rank={engineer.role} short />
                </div>
                <StatusBadge status={engineer.status || "Busy"} variant="plain" compact />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default EngineerInfo;
