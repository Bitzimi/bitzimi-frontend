/**
 * AuctionCountdown — Phase 22.2
 *
 * Dual-timer support:
 *   Timer A  — time until auction starts (status = "upcoming")
 *   Timer B  — time remaining before auction ends (status = "live" | "paused")
 *
 * Renders nothing for draft/cancelled/ended (parent controls that display).
 */

import { useState, useEffect, useRef } from "react";
import { Clock, Zap } from "lucide-react";

interface Props {
  startsAt: string;
  endsAt: string | null;
  status: string;
  /** Called once when the active countdown reaches zero. */
  onExpire?: () => void;
  /** "full" = days + hours + min + sec blocks. "compact" = inline string. */
  variant?: "full" | "compact";
}

interface Diff {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function calcDiff(targetMs: number): Diff {
  const total = Math.max(0, targetMs - Date.now());
  const s = Math.floor(total / 1000);
  return {
    total,
    days:    Math.floor(s / 86400),
    hours:   Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function compactLabel(d: Diff): string {
  if (d.total <= 0) return "00:00";
  if (d.days > 0) return `${d.days}d ${pad(d.hours)}h ${pad(d.minutes)}m`;
  if (d.hours > 0) return `${pad(d.hours)}:${pad(d.minutes)}:${pad(d.seconds)}`;
  return `${pad(d.minutes)}:${pad(d.seconds)}`;
}

// ─── Full block variant ───────────────────────────────────────────────────────

function TimeBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2 min-w-[52px] text-center">
        <span className="text-2xl font-bold font-mono text-white tabular-nums">{pad(value)}</span>
      </div>
      <span className="text-[9px] text-zinc-600 uppercase tracking-widest mt-1">{label}</span>
    </div>
  );
}

function Separator() {
  return <span className="text-zinc-600 text-xl font-bold mb-4 select-none">:</span>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuctionCountdown({
  startsAt,
  endsAt,
  status,
  onExpire,
  variant = "compact",
}: Props) {
  const targetMs =
    status === "upcoming"
      ? new Date(startsAt).getTime()
      : status === "live" && endsAt
      ? new Date(endsAt).getTime()
      : null;

  const [diff, setDiff] = useState<Diff>(() =>
    targetMs ? calcDiff(targetMs) : { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 }
  );
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!targetMs) return;
    expiredRef.current = false;

    const tick = () => {
      const d = calcDiff(targetMs);
      setDiff(d);
      if (d.total <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire?.();
      }
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetMs, onExpire]);

  // ── Static states ──────────────────────────────────────────────────────────
  if (status === "ended" || status === "cancelled") return null;

  if (status === "paused") {
    return (
      <div className="flex items-center gap-1.5 text-yellow-400 text-sm font-medium">
        <Clock className="w-3.5 h-3.5" />
        <span>Paused</span>
      </div>
    );
  }

  if (status === "draft") {
    return (
      <div className="flex items-center gap-1.5 text-zinc-500 text-sm">
        <Clock className="w-3.5 h-3.5" />
        <span>Draft</span>
      </div>
    );
  }

  // ── Upcoming: Timer A ──────────────────────────────────────────────────────
  if (status === "upcoming") {
    if (variant === "full") {
      return (
        <div className="space-y-2">
          <p className="text-xs text-blue-400/70 uppercase tracking-widest text-center">Starts In</p>
          <div className="flex items-end justify-center gap-2">
            {diff.days > 0 && (
              <>
                <TimeBlock value={diff.days} label="Days" />
                <Separator />
              </>
            )}
            <TimeBlock value={diff.hours} label="Hours" />
            <Separator />
            <TimeBlock value={diff.minutes} label="Min" />
            <Separator />
            <TimeBlock value={diff.seconds} label="Sec" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-blue-400 text-sm">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-mono font-medium">{compactLabel(diff)}</span>
      </div>
    );
  }

  // ── Live: Timer B ──────────────────────────────────────────────────────────
  const urgent = diff.total > 0 && diff.total < 120_000; // < 2 min = urgent
  const finalMinute = diff.total > 0 && diff.total <= 60_000;

  if (variant === "full") {
    return (
      <div className="space-y-2">
        <p className={`text-xs uppercase tracking-widest text-center ${urgent ? "text-red-400" : "text-emerald-400/70"}`}>
          {finalMinute ? "⚡ Final Minute" : "Time Remaining"}
        </p>
        <div className="flex items-end justify-center gap-2">
          {diff.hours > 0 && (
            <>
              <TimeBlock value={diff.hours} label="Hours" />
              <Separator />
            </>
          )}
          <TimeBlock value={diff.minutes} label="Min" />
          <Separator />
          <TimeBlock value={diff.seconds} label="Sec" />
        </div>
        {finalMinute && (
          <p className="text-xs text-orange-400 text-center animate-pulse">
            A bid now will extend the timer to 10 min
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 text-sm font-mono font-medium ${
      urgent ? "text-red-400" : "text-emerald-400"
    } ${finalMinute ? "animate-pulse" : ""}`}>
      {finalMinute && <Zap className="w-3 h-3 flex-shrink-0" />}
      {!finalMinute && <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{compactLabel(diff)}</span>
    </div>
  );
}
