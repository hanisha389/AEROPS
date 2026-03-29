import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import { api } from '@/lib/api';
import { setCurrentPilotId, setCurrentRole } from '@/lib/rbac';

const PinEntry = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const inputRef = (el: HTMLInputElement | null) => { if (el) el.focus(); };

  const handleInput = (val: string) => {
    if (val.length <= 6 && /^\d*$/.test(val)) {
      setPin(val);
      setError(false);
    }
  };

  const handleSubmit = async () => {
    if (pin.length !== 6) {
      setError(true);
      return;
    }

    setLoading(true);
    try {
      if (pin === '123456') {
        sessionStorage.setItem('aerops-auth', 'true');
        setCurrentRole('ADMIN_COMMANDER');
        setCurrentPilotId(null);
        navigate('/menu');
        return;
      }

      if (pin === '222222') {
        sessionStorage.setItem('aerops-auth', 'true');
        setCurrentRole('ENGINEER');
        setCurrentPilotId(null);
        navigate('/menu');
        return;
      }

      if (pin === '333333') {
        sessionStorage.setItem('aerops-auth', 'true');
        setCurrentRole('PILOT');
        setCurrentPilotId(null);
        navigate('/menu');
        return;
      }

      setCurrentRole('ADMIN_COMMANDER');
      const result = await api.verifyPin(pin);
      if (result.valid) {
        sessionStorage.setItem('aerops-auth', 'true');
        setCurrentRole('ADMIN_COMMANDER');
        setCurrentPilotId(null);
        navigate('/menu');
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <BackgroundLayout>
      <div className="flex min-h-screen items-center justify-center">
        <motion.div
          className="flex flex-col items-center gap-8"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <h1 className="font-orbitron text-3xl font-bold tracking-[0.3em] text-primary neon-glow">
            AEROPS
          </h1>
          <p className="font-orbitron text-sm tracking-[0.25em] text-muted-foreground">
            ENTER ACCESS CODE
          </p>

          <div className="flex cursor-text gap-3" onClick={() => document.getElementById('pin-input')?.focus()}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex h-14 w-11 items-center justify-center border font-orbitron text-xl font-bold transition-all duration-200 ${
                  pin[i]
                    ? 'border-primary neon-border text-primary'
                    : 'border-border text-muted-foreground'
                } ${error ? 'border-destructive shadow-[0_0_10px_hsl(0_80%_55%/0.4)]' : ''}`}
              >
                {pin[i] ? '●' : ''}
              </div>
            ))}
          </div>

          <input
            id="pin-input"
            type="text"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={6}
            ref={inputRef}
            style={{ position: 'fixed', top: '-100px', opacity: 0 }}
          />

          {error && (
            <motion.p
              className="font-orbitron text-sm tracking-widest text-destructive"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ textShadow: '0 0 10px hsl(0 80% 55% / 0.5)' }}
            >
              INVALID CODE
            </motion.p>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="neon-border border border-primary px-10 py-2.5 font-orbitron text-sm tracking-[0.2em] text-primary transition-all duration-200 hover:bg-primary/10 hover:neon-border-strong"
          >
            {loading ? 'VERIFYING...' : 'ENTER'}
          </button>
        </motion.div>
      </div>
    </BackgroundLayout>
  );
};

export default PinEntry;
