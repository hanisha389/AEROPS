import BackgroundLayout from '@/components/BackgroundLayout';
import PageHeader from '@/components/PageHeader';
import { motion } from 'framer-motion';

const Training = () => (
  <BackgroundLayout>
    <PageHeader title="TRAINING" />
    <div className="flex min-h-[60vh] items-center justify-center">
      <motion.p
        className="font-orbitron text-sm tracking-[0.3em] text-muted-foreground/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        MODULE UNDER DEVELOPMENT
      </motion.p>
    </div>
  </BackgroundLayout>
);

export default Training;
