import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BackgroundLayout from "@/components/BackgroundLayout";
import PageHeader from "@/components/PageHeader";
import { api } from "@/lib/api";
import { Panel } from "@/components/ui/custom/Panel";

interface Aircraft {
  id: string;
  name: string;
  model: string;
  assignedPilot: string;
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
      <PageHeader title="AIRCRAFT FLEET" />
      <div className="p-6 max-w-7xl mx-auto flex flex-col gap-6">
        <div className="flex justify-end">
          <button
            onClick={handleAddAircraft}
            className="rounded bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white px-4 py-2 font-rajdhani font-semibold text-sm tracking-[0.05em] text-gray-300 transition-colors"
          >
            + REGISTER AIRCRAFT
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aircrafts.map((ac, index) => (
            <motion.div
              key={ac.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05, duration: 0.25 }}
            >
              <Panel 
                className="group p-5 cursor-pointer hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all flex flex-col h-full justify-between"
                onClick={() => navigate(`/aircraft/${ac.id}`)}
              >
                <div className="mb-4 pb-4 border-b border-white/5">
                  <h3 className="font-rajdhani font-bold text-xl text-gray-100 uppercase tracking-widest">{ac.name}</h3>
                  <p className="font-inter text-xs text-gray-400 mt-1 tracking-wider uppercase font-medium">{ac.model}</p>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="font-inter text-[10px] text-gray-500 uppercase tracking-widest mb-1">Assigned Pilot</span>
                    <span className="font-inter text-sm text-gray-200">{ac.assignedPilot || 'Unassigned'}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 group-hover:text-white">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
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

export default AircraftInfo;
