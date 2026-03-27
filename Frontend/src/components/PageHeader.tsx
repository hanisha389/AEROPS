import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const PageHeader = ({ title, backTo = '/menu' }: { title: string; backTo?: string }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      className="flex items-center gap-4 border-b border-border/30 px-6 py-4"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <button
        onClick={() => navigate(backTo)}
        className="flex items-center gap-2 font-rajdhani text-sm tracking-wider text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        BACK
      </button>
      <h1 className="font-orbitron text-lg tracking-[0.2em] text-primary neon-glow">
        {title}
      </h1>
    </motion.div>
  );
};

export default PageHeader;
