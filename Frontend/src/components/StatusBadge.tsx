interface StatusBadgeProps {
  status: string;
  align?: "left" | "center" | "right";
  compact?: boolean;
  variant?: "badge" | "plain";
}

const statusStyles: Record<"active" | "injured" | "offline", string> = {
  active: "border-green-500/50 bg-green-500/10 text-green-400",
  injured: "border-red-500/50 bg-red-500/10 text-red-400",
  offline: "border-amber-500/50 bg-amber-500/10 text-amber-400",
};

const normalizeStatus = (value: string): "active" | "injured" | "offline" => {
  const status = value.toLowerCase();
  if (status.includes("injur") || status.includes("medical") || status.includes("hold") || status.includes("critical") || status.includes("damage")) {
    return "injured";
  }
  if (status.includes("offline") || status.includes("leave") || status.includes("holiday")) return "offline";
  return "active";
};

const StatusBadge = ({ status, align = "left", compact = false, variant = "badge" }: StatusBadgeProps) => {
  const normalized = normalizeStatus(status);
  const wrapperClass =
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

  const plainStyles: Record<"active" | "injured" | "offline", string> = {
    active: "text-green-400",
    injured: "text-red-400",
    offline: "text-amber-400",
  };

  if (variant === "plain") {
    return (
      <div className={`flex ${wrapperClass}`}>
        <span className={`inline-flex items-center gap-1.5 font-rajdhani ${compact ? "text-sm" : "text-base"} ${plainStyles[normalized]}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${wrapperClass}`}>
      <span
        className={`inline-flex items-center gap-1 border px-2 py-1 font-orbitron tracking-[0.08em] ${compact ? "text-[10px]" : "text-xs"
          } ${statusStyles[normalized]}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {status.toUpperCase()}
      </span>
    </div>
  );
};

export default StatusBadge;
