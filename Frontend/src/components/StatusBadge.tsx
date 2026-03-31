interface StatusBadgeProps {
  status: string;
  align?: "left" | "center" | "right";
  compact?: boolean;
  variant?: "badge" | "plain";
}

const normalizeStatus = (value: string): "active" | "injured" | "offline" => {
  const status = value.toLowerCase();
  if (status.includes("injur") || status.includes("critical") || status.includes("danger")) return "injured";
  if (status.includes("offline") || status.includes("leave") || status.includes("hold") || status.includes("warning")) return "offline";
  return "active";
};

const badgeClasses = {
  active: "border-success/30 bg-success/10 text-success",
  injured: "border-danger/30 bg-danger/10 text-danger",
  offline: "border-warning/30 bg-warning/10 text-warning",
};

const dotClasses = {
  active: "bg-success shadow-[0_0_6px_hsl(var(--success)/0.7)]",
  injured: "bg-danger shadow-[0_0_6px_hsl(var(--danger)/0.7)]",
  offline: "bg-warning shadow-[0_0_6px_hsl(var(--warning)/0.6)]",
};

const textClasses = {
  active: "text-success",
  injured: "text-danger",
  offline: "text-warning",
};

const StatusBadge = ({ status, align = "left", compact = false, variant = "badge" }: StatusBadgeProps) => {
  const normalized = normalizeStatus(status);
  const wrapperClass =
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-start";

  if (variant === "plain") {
    return (
      <div className={`flex ${wrapperClass}`}>
        <span className={`inline-flex items-center gap-2 font-space tracking-widest uppercase font-semibold ${compact ? "text-[10px]" : "text-xs"} ${textClasses[normalized]}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[normalized]}`} />
          {status}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex ${wrapperClass}`}>
      <span
        className={`inline-flex items-center gap-2 border px-2 py-1 font-space tracking-[0.15em] uppercase font-semibold ${compact ? "text-[9px]" : "text-[10px]"
          } ${badgeClasses[normalized]}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[normalized]}`} />
        {status}
      </span>
    </div>
  );
};

export default StatusBadge;
