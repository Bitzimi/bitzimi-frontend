import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;       // Tailwind text color class
  iconBg?: string;          // Tailwind bg class
  trend?: {
    direction: "up" | "down" | "neutral";
    value: string;
    label?: string;
  };
  loading?: boolean;
  onClick?: () => void;
}

export function StatCard({
  title, value, subtitle, icon: Icon,
  iconColor = "text-indigo-400",
  iconBg = "bg-indigo-500/10",
  trend,
  loading = false,
  onClick,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5 animate-pulse">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-zinc-700/50" />
          <div className="w-16 h-4 rounded bg-zinc-700/50" />
        </div>
        <div className="w-24 h-7 rounded bg-zinc-700/50 mb-2" />
        <div className="w-32 h-3.5 rounded bg-zinc-800" />
      </div>
    );
  }

  const trendIcon = trend?.direction === "up"
    ? TrendingUp
    : trend?.direction === "down"
    ? TrendingDown
    : Minus;

  const trendColor = trend?.direction === "up"
    ? "text-emerald-400"
    : trend?.direction === "down"
    ? "text-red-400"
    : "text-zinc-500";

  const TrendIcon = trendIcon;

  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl bg-[#18181b] border border-white/[0.06] p-5
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:border-white/[0.10] hover:bg-[#1c1c22]" : ""}
      `}
    >
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} />
        </div>

        {/* Trend badge */}
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3.5 h-3.5" />
            <span>{trend.value}</span>
          </div>
        )}
      </div>

      {/* Value */}
      <p className="text-2xl font-bold text-white tracking-tight mb-0.5 tabular-nums">
        {value}
      </p>

      {/* Title */}
      <p className="text-sm text-zinc-400 font-medium">{title}</p>

      {/* Subtitle / trend label */}
      {(subtitle || trend?.label) && (
        <p className="text-xs text-zinc-600 mt-1">
          {trend?.label ?? subtitle}
        </p>
      )}
    </div>
  );
}
