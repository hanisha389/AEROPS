import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';

const PageHeader = ({ title, backTo = '/menu' }: { title: string; backTo?: string }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      className="flex items-center gap-4 mb-6"
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <button
        onClick={() => navigate(backTo)}
        className="flex h-8 w-8 items-center justify-center border border-border/50 bg-background/50 text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div>
        <h1 className="font-orbitron text-xl font-bold tracking-[0.25em] text-foreground">
          {title}
        </h1>
        <div className="mt-1 h-[1px] w-12 bg-primary/60" />
      </div>
    </motion.div>
  );
};

export default PageHeader;
