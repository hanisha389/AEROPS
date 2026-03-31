import { motion } from 'framer-motion';
import TopStatusBar from '@/components/TopStatusBar';

const BackgroundLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/images/bg.jpeg)',
          filter: 'blur(3px) brightness(0.4)',
        }}
      />
      <div className="fixed inset-0 z-[1] bg-background/70" />
      <div className="pointer-events-none fixed inset-0 z-[2]">
        <div className="tactical-noise" />
        <div className="tactical-ambient" />
        <div className="tactical-grid" />
        <div className="tactical-nodes" />
        <div className="tactical-ping tactical-ping--one" />
        <div className="tactical-ping tactical-ping--two" />
      </div>
      <TopStatusBar />
      <motion.div
        className="relative z-10 min-h-screen pt-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default BackgroundLayout;
