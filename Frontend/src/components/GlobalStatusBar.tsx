import { useEffect, useState } from 'react';
import { Wifi, AlertTriangle, Clock } from 'lucide-react';

const GlobalStatusBar = () => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const pad = (n: number) => String(n).padStart(2, '0');
    const timeStr = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
    const dateStr = time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[100] h-8 flex items-center justify-between px-5 select-none"
            style={{
                background: 'linear-gradient(to bottom, hsl(220 44% 6%) 0%, hsl(220 40% 8% / 0.9) 100%)',
                borderBottom: '1px solid hsl(218 28% 16% / 0.8)',
                backdropFilter: 'blur(12px)',
            }}
        >
            {/* Left: System identity */}
            <div className="flex items-center gap-5">
                <span
                    className="font-orbitron text-[10px] font-bold tracking-[0.35em]"
                    style={{ color: 'hsl(188 100% 48%)' }}
                >
                    AEROPS
                </span>
                <span
                    className="font-space text-[9px] tracking-[0.18em] uppercase"
                    style={{ color: 'hsl(215 14% 42%)' }}
                >
                    Air Ops Command System
                </span>
            </div>

            {/* Center: System status */}
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-1.5">
                    <span className="signal-dot green animate-blink" />
                    <span className="font-space text-[9px] tracking-[0.14em] font-semibold text-success">
                        SYSTEMS NOMINAL
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <Wifi size={9} className="text-primary" />
                    <span className="font-space text-[9px] tracking-[0.12em] text-primary">
                        CONNECTED
                    </span>
                </div>

                <div className="flex items-center gap-1.5">
                    <AlertTriangle size={9} className="text-warning" />
                    <span className="font-space text-[9px] tracking-[0.12em] text-warning">
                        0 ALERTS
                    </span>
                </div>
            </div>

            {/* Right: Clock */}
            <div className="flex items-center gap-3">
                <span className="font-space text-[9px] tracking-[0.12em] uppercase"
                    style={{ color: 'hsl(215 14% 40%)' }}>
                    {dateStr}
                </span>
                <div className="flex items-center gap-1.5">
                    <Clock size={9} style={{ color: 'hsl(215 14% 46%)' }} />
                    <span
                        className="font-orbitron text-[10px] font-medium tabular-nums"
                        style={{
                            color: 'hsl(210 20% 82%)',
                            letterSpacing: '0.1em',
                        }}
                    >
                        {timeStr}
                    </span>
                    <span
                        className="font-space text-[8px] tracking-wider"
                        style={{ color: 'hsl(215 14% 40%)' }}
                    >
                        IST
                    </span>
                </div>
            </div>
        </div>
    );
};

export default GlobalStatusBar;
