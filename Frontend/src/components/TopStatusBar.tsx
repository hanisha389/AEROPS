import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Clock3, Wifi } from "lucide-react";

const pad = (value: number) => String(value).padStart(2, "0");

const formatTimestamp = (now: Date) => {
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  const offsetMinutes = -now.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHour = pad(Math.floor(absoluteOffset / 60));
  const offsetMinute = pad(absoluteOffset % 60);

  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}:${second}`,
    zone: `UTC${sign}${offsetHour}:${offsetMinute}`,
  };
};

const TopStatusBar = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const alertsCount = 0;
  const connectionStatus = "Connected";
  const connectionClass = connectionStatus === "Connected" ? "text-green-400" : "text-red-400";
  const alertsClass = alertsCount > 5 ? "text-red-400" : "text-amber-400";
  const timestamp = formatTimestamp(now);

  return (
    <div className="fixed left-0 right-0 top-0 z-50 h-10 border-b border-cyan-900/40 bg-[#070e1a]/95 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md sm:px-6">
      <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-3 text-[9px] font-inter uppercase tracking-[0.18em] text-gray-400 sm:text-[10px]">
        <div className="flex items-center gap-1.5 whitespace-nowrap">
          <Activity className="h-3 w-3 text-cyan-400" />
          <span className="font-orbitron text-gray-400">AEROPS / IAF-CTRL</span>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            <span className="text-gray-400">SYSTEMS ONLINE</span>
          </div>
          <span className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Wifi className={`h-3 w-3 ${connectionClass}`} />
            <span className="text-gray-400">NETWORK ACTIVE</span>
          </div>
          <span className="h-3 w-px bg-white/10" />
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <AlertTriangle className={`h-3 w-3 ${alertsClass}`} />
            <span className="text-gray-400">{alertsCount} ALERTS</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 whitespace-nowrap text-gray-400">
          <Clock3 className="h-3 w-3 text-cyan-400" />
          <span className="text-gray-400">{timestamp.date}</span>
          <span className="font-medium text-cyan-300">{timestamp.time}</span>
          <span className="text-gray-400">{timestamp.zone}</span>
        </div>
      </div>
    </div>
  );
};

export default TopStatusBar;
