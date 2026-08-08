type StatusVariant =
  | "active" | "pending" | "paused" | "completed" | "rejected"
  | "approved" | "review" | "verified" | "unverified" | "expired"
  | "processing" | "submitted" | "confirming" | "failed";

const STATUS_CONFIG: Record<StatusVariant, { label: string; classes: string }> = {
  active:      { label: "Active",      classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" },
  approved:    { label: "Approved",    classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" },
  verified:    { label: "Verified",    classes: "bg-emerald-500/12 text-emerald-400 border-emerald-500/20" },
  completed:   { label: "Completed",   classes: "bg-blue-500/12 text-blue-400 border-blue-500/20" },
  confirming:  { label: "Confirming",  classes: "bg-blue-500/12 text-blue-400 border-blue-500/20" },
  processing:  { label: "Processing",  classes: "bg-indigo-500/12 text-indigo-400 border-indigo-500/20" },
  pending:     { label: "Pending",     classes: "bg-amber-500/12 text-amber-400 border-amber-500/20" },
  submitted:   { label: "Submitted",   classes: "bg-amber-500/12 text-amber-400 border-amber-500/20" },
  review:      { label: "In Review",   classes: "bg-amber-500/12 text-amber-400 border-amber-500/20" },
  paused:      { label: "Paused",      classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  unverified:  { label: "Unverified",  classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20" },
  rejected:    { label: "Rejected",    classes: "bg-red-500/12 text-red-400 border-red-500/20" },
  failed:      { label: "Failed",      classes: "bg-red-500/12 text-red-400 border-red-500/20" },
  expired:     { label: "Expired",     classes: "bg-red-500/12 text-red-400 border-red-500/20" },
};

interface StatusBadgeProps {
  status: StatusVariant | string;
  label?: string;         // Override label
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as StatusVariant] ?? {
    label: status,
    classes: "bg-zinc-500/12 text-zinc-400 border-zinc-500/20",
  };

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-full border
        ${size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1"}
        ${config.classes}
      `}
    >
      {label ?? config.label}
    </span>
  );
}
