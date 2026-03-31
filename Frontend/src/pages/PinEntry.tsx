import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import BackgroundLayout from '@/components/BackgroundLayout';
import BorderGlow from '@/components/BorderGlow';
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
      <div className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center px-4 py-8">
        <motion.div
          className="flex w-full max-w-3xl flex-col items-center"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px w-10 bg-cyan-500/35" />
            <p className="font-orbitron text-[10px] uppercase tracking-[0.38em] text-gray-400">
              IAF Tactical Control System
            </p>
            <span className="h-px w-10 bg-cyan-500/35" />
          </div>

          <h1 className="font-orbitron text-[3.4rem] leading-none font-bold tracking-[0.12em] text-white drop-shadow-[0_0_10px_rgba(0,212,255,0.18)]">
            AEROPS
          </h1>
          <p className="mt-1 font-orbitron text-[11px] uppercase tracking-[0.24em] text-gray-400">
            Airforce Operations Platform
          </p>

          <BorderGlow
            className="mt-8 w-full max-w-[22rem]"
            edgeSensitivity={30}
            glowColor="40 80 80"
            backgroundColor="#050d1b"
            borderRadius={2}
            glowRadius={40}
            glowIntensity={1}
            coneSpread={25}
            animated={false}
            colors={['#0e7490', '#22d3ee', '#38bdf8']}
            fillOpacity={0.4}
          >
            <div className="bg-[#050d1b]/88 p-7 shadow-[0_0_32px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <p className="text-center font-orbitron text-[9px] uppercase tracking-[0.26em] text-gray-500">
                Identity Verification
              </p>
              <p className="mt-1 text-center font-orbitron text-[12px] uppercase tracking-[0.2em] text-cyan-300/85">
                Enter Access Code
              </p>

              <div className="mt-5 flex cursor-text justify-center gap-3" onClick={() => document.getElementById('pin-input')?.focus()}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex h-12 w-11 items-center justify-center border text-sm font-bold transition-all duration-200 ${pin[i]
                        ? 'border-cyan-400/80 bg-cyan-500/5 text-cyan-300 shadow-[0_0_10px_rgba(0,212,255,0.22)]'
                        : 'border-cyan-700/45 text-cyan-500/40'
                      } ${error ? 'border-red-500/70 text-red-300' : ''}`}
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
                  className="mt-3 text-center font-orbitron text-[10px] tracking-[0.2em] text-red-400"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  INVALID CODE
                </motion.p>
              )}

              <button
                onClick={handleSubmit}
                disabled={loading}
                className="mt-5 w-full border border-cyan-500/55 bg-cyan-500/8 px-4 py-3 font-orbitron text-[11px] uppercase tracking-[0.22em] text-cyan-300 transition-all duration-200 hover:bg-cyan-500/14"
              >
                {loading ? 'Authenticating...' : 'Authenticate'}
              </button>
            </div>
          </BorderGlow>
        </motion.div>
      </div>
    </BackgroundLayout>
  );
};

export default PinEntry;
