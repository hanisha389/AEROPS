import { motion } from 'framer-motion';

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
      <motion.div
        className="relative z-10 min-h-screen"
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
