import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import { getCurrentRole, canAccessRoute } from '@/lib/rbac';
import { Target, Wrench, Plane, GraduationCap, MonitorPlay } from 'lucide-react';

const menuItems = [
  { label: 'PILOT INFO', path: '/pilots', icon: Target },
  { label: 'ENGINEER INFO', path: '/engineers', icon: Wrench },
  { label: 'AIRCRAFT INFO', path: '/aircraft', icon: Plane },
  { label: 'TRAINING', path: '/training', icon: GraduationCap },
  { label: 'SIMULATION', path: '/simulation', icon: MonitorPlay },
];

const MainMenu = () => {
  const role = getCurrentRole();
  const navigate = useNavigate();

  const visibleItems = useMemo(
    () => menuItems.filter((item) => canAccessRoute(item.path, role)),
    [role],
  );

  return (
    <BackgroundLayout>
      {/* Full-height flex row that overrides the default column layout */}
      <div
        className="flex flex-row"
        style={{ minHeight: 'calc(100vh - 48px)', margin: '-2rem -3rem', padding: 0 }}
      >
        {/* ─── Sidebar ─── */}
        <div
          style={{
            width: '220px',
            minWidth: '220px',
            background: 'hsl(220 42% 6% / 0.85)',
            borderRight: '1px solid hsl(188 100% 48% / 0.1)',
            display: 'flex',
            flexDirection: 'column',
            padding: '40px 24px',
            backdropFilter: 'blur(8px)',
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: '32px' }}>
            <h1
              className="font-orbitron font-bold tracking-[0.35em]"
              style={{ fontSize: '22px', color: 'hsl(188 100% 72%)', lineHeight: 1 }}
            >
              AEROPS
            </h1>
            <p
              className="font-space uppercase tracking-[0.2em]"
              style={{ fontSize: '8px', color: 'hsl(215 14% 40%)', marginTop: '4px' }}
            >
              MAIN MENU
            </p>
          </div>

          {/* Nav items */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {visibleItems.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.path}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.07 }}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    borderRadius: '2px',
                    transition: 'all 0.18s ease',
                    color: 'hsl(215 14% 55%)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'hsl(188 100% 72%)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'hsl(188 100% 48% / 0.06)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.color = 'hsl(215 14% 55%)';
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  }}
                >
                  <Icon
                    size={15}
                    style={{ flexShrink: 0, color: 'hsl(188 100% 55%)' }}
                  />
                  <span
                    className="font-space uppercase tracking-[0.12em]"
                    style={{ fontSize: '11px', fontWeight: 500 }}
                  >
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
          </nav>
        </div>

        {/* ─── Main area ─── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{ textAlign: 'center' }}
          >
            <p
              className="font-space uppercase tracking-[0.35em]"
              style={{ fontSize: '11px', color: 'hsl(188 100% 62% / 0.5)', marginBottom: '6px' }}
            >
              SYSTEM STATUS: ONLINE
            </p>
            <p
              className="font-space uppercase tracking-[0.2em]"
              style={{ fontSize: '9px', color: 'hsl(215 14% 35%)' }}
            >
              CLEARANCE LEVEL: ALPHA
            </p>
            <p
              className="font-orbitron"
              style={{ fontSize: '9px', color: 'hsl(215 14% 30%)', marginTop: '4px', letterSpacing: '0.15em' }}
            >
              {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
            </p>
          </motion.div>
        </div>
      </div>
    </BackgroundLayout>
  );
};

export default MainMenu;
