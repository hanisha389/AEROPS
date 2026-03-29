import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import { getCurrentRole, canAccessRoute, ROLE_LABELS } from '@/lib/rbac';
import { Shield, Wrench, Plane, GraduationCap, MonitorPlay, FileText } from 'lucide-react';

const menuItems = [
  { label: 'PILOT INFO', path: '/pilots', icon: Shield },
  { label: 'ENGINEER INFO', path: '/engineers', icon: Wrench },
  { label: 'AIRCRAFT INFO', path: '/aircraft', icon: Plane },
  { label: 'TRAINING', path: '/training', icon: GraduationCap },
  { label: 'SIMULATION', path: '/simulation', icon: MonitorPlay },
  { label: 'DOCUMENTS', path: '/documents', icon: FileText },
];

const MainMenu = () => {
  const [hovered, setHovered] = useState<number | null>(null);
  const role = getCurrentRole();
  const navigate = useNavigate();

  const visibleItems = useMemo(
    () => menuItems.filter((item) => canAccessRoute(item.path, role)),
    [role],
  );

  return (
    <BackgroundLayout>
      <div className="flex min-h-screen">
        {/* Left menu */}
        <div className="flex w-80 flex-col justify-center border-r border-border/30 p-8">
          <motion.h1
            className="mb-2 font-orbitron text-2xl font-bold tracking-[0.3em] text-primary neon-glow"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            AEROPS
          </motion.h1>
          <motion.p
            className="mb-12 font-rajdhani text-xs tracking-[0.15em] text-muted-foreground"
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            MAIN MENU
          </motion.p>

          <p className="mb-4 font-rajdhani text-[0.65rem] tracking-[0.18em] text-muted-foreground">
            ACCESS PROFILE: {ROLE_LABELS[role]}
          </p>

          <nav className="flex flex-col gap-1">
            {visibleItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.path}
                  className={`group flex items-center gap-4 border-l-2 px-4 py-3 text-left font-rajdhani text-lg font-medium tracking-wider transition-all duration-200 ${
                    hovered === i
                      ? 'border-primary bg-primary/5 text-primary neon-glow'
                      : 'border-transparent text-muted-foreground hover:border-primary/50 hover:text-primary/80'
                  }`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => navigate(item.path)}
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* Right side overlay */}
        <div className="flex flex-1 items-center justify-center">
          <motion.div
            className="text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
          >
            <p className="font-orbitron text-xs tracking-[0.3em] text-muted-foreground/40">
              SYSTEM STATUS: ONLINE
            </p>
            <p className="mt-2 font-rajdhani text-xs tracking-widest text-muted-foreground/30">
              CLEARANCE LEVEL: ALPHA
            </p>
            <p className="mt-1 font-rajdhani text-xs tracking-widest text-muted-foreground/20">
              {new Date().toISOString().split('T')[0]}
            </p>
          </motion.div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default MainMenu;
