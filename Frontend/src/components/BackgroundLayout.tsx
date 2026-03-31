import { motion } from 'framer-motion';
import GlobalStatusBar from '@/components/GlobalStatusBar';

const BackgroundLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Deep dark base */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'hsl(220 45% 6%)',
        }}
      />

      {/* bg.jpeg with reduced opacity */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          backgroundImage: 'url(/images/bg.jpeg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.22,
        }}
      />

      {/* Dark overlay to keep readability */}
      <div
        className="fixed inset-0 z-[2] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, hsl(220 45% 6% / 0.45) 0%, hsl(220 45% 4% / 0.75) 100%)',
        }}
      />

      {/* Status bar */}
      <GlobalStatusBar />

      {/* Main Content wrapper */}
      <motion.div
        className="relative z-10 min-h-screen pt-12 pb-8 px-6 lg:px-12 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default BackgroundLayout;
