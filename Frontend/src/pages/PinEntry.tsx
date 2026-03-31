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
      <div className="flex flex-1 items-center justify-center">
        <motion.div
          className="relative z-10 w-full max-w-sm"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Outer card */}
          <div
            style={{
              background: 'hsl(220 40% 9% / 0.85)',
              border: '1px solid hsl(188 100% 48% / 0.2)',
              backdropFilter: 'blur(12px)',
            }}
            className="px-10 py-10 flex flex-col items-center"
          >
            {/* Top label */}
            <p
              className="font-space uppercase tracking-[0.35em] mb-6 flex items-center gap-3"
              style={{ fontSize: '9px', color: 'hsl(188 100% 62% / 0.7)' }}
            >
              <span style={{ display: 'inline-block', width: '24px', height: '1px', background: 'hsl(188 100% 48% / 0.4)' }} />
              IAF TACTICAL CONTROL SYSTEM
              <span style={{ display: 'inline-block', width: '24px', height: '1px', background: 'hsl(188 100% 48% / 0.4)' }} />
            </p>

            {/* AEROPS logo */}
            <h1
              className="font-orbitron font-bold tracking-[0.4em] mb-2"
              style={{ fontSize: '36px', color: 'hsl(210 20% 95%)' }}
            >
              AEROPS
            </h1>

            {/* Tagline */}
            <p
              className="font-space uppercase tracking-[0.2em] mb-8"
              style={{ fontSize: '9px', color: 'hsl(215 14% 50%)' }}
            >
              AIRCRAFT OPERATIONS PLATFORM
            </p>

            {/* Decorative line */}
            <div style={{ width: '100%', height: '1px', background: 'hsl(188 100% 48% / 0.15)', marginBottom: '28px' }} />

            {/* Identity verification label */}
            <p
              className="font-space uppercase tracking-[0.25em] mb-1"
              style={{ fontSize: '9px', color: 'hsl(188 100% 62% / 0.6)' }}
            >
              IDENTITY VERIFICATION
            </p>
            <p
              className="font-space uppercase tracking-[0.2em] mb-6"
              style={{ fontSize: '11px', color: 'hsl(188 100% 80%)' }}
            >
              ENTER ACCESS CODE
            </p>

            {/* PIN Entry dots */}
            <div
              className="flex gap-2 mb-6 cursor-text"
              onClick={() => document.getElementById('pin-input')?.focus()}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '44px',
                    height: '44px',
                    border: `1px solid ${error ? 'hsl(4 80% 52% / 0.6)' : pin[i] ? 'hsl(188 100% 48% / 0.7)' : 'hsl(188 100% 48% / 0.25)'}`,
                    background: error ? 'hsl(4 80% 52% / 0.08)' : pin[i] ? 'hsl(188 100% 48% / 0.08)' : 'hsl(220 42% 7% / 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    boxShadow: pin[i] ? '0 0 10px hsl(188 100% 48% / 0.2)' : 'none',
                  }}
                >
                  {pin[i] && (
                    <span
                      style={{
                        width: '7px',
                        height: '7px',
                        borderRadius: '50%',
                        background: 'hsl(188 100% 62%)',
                        boxShadow: '0 0 8px hsl(188 100% 48% / 0.9)',
                      }}
                    />
                  )}
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
              className="absolute opacity-0 -z-10 pointer-events-none"
            />

            {/* Error message */}
            <div className="h-5 mb-4 w-full text-center">
              {error && (
                <motion.p
                  style={{ fontSize: '9px', color: 'hsl(4 80% 60%)', letterSpacing: '0.15em' }}
                  className="font-space uppercase"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  ACCESS DENIED — INVALID CODE
                </motion.p>
              )}
            </div>

            {/* Authenticate button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px 0',
                border: '1px solid hsl(188 100% 48% / 0.55)',
                background: 'hsl(188 100% 48% / 0.08)',
                color: 'hsl(188 100% 75%)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.7 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'hsl(188 100% 48% / 0.18)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 20px hsl(188 100% 48% / 0.25)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'hsl(188 100% 48% / 0.08)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {loading ? 'VERIFYING...' : 'AUTHENTICATE'}
            </button>

            {/* Hint text */}
            <p
              className="font-space mt-6"
              style={{ fontSize: '9px', color: 'hsl(215 14% 38%)', letterSpacing: '0.12em' }}
            >
              HINT: ADMIN 123456 · ENG 222222 · PILOT 333333
            </p>
          </div>
        </motion.div>
      </div>
    </BackgroundLayout>
  );
};

export default PinEntry;
