import { Crown } from "lucide-react";
import { useSettings } from "../contexts/SettingsContext";

interface PremiumVIPCardProps {
  onUpgrade: () => void;
}

export function PremiumVIPCard({ onUpgrade }: PremiumVIPCardProps) {
  const { formatCurrency } = useSettings();

  return (
    <div
      onClick={onUpgrade}
      className="relative overflow-hidden rounded-[20px] cursor-pointer group select-none
                 bg-gradient-to-br from-[#1c0e00] via-[#2a1400] to-[#1c0e00]
                 border border-amber-900/40
                 shadow-[0_2px_16px_rgba(0,0,0,0.5),0_0_0_1px_rgba(251,191,36,0.07)]
                 transition-all duration-200 active:scale-[0.985]"
    >
      {/* Ambient gold glow */}
      <div className="absolute -top-6 -right-6 w-28 h-28 bg-amber-500/[0.12] rounded-full blur-2xl pointer-events-none" />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200
                      bg-white/[0.015] pointer-events-none" />

      {/* ── Two-column layout ── */}
      <div className="relative flex items-center justify-between px-4 py-4 gap-3">

        {/* LEFT — icon + title + subtitle + bullets */}
        <div className="flex flex-col min-w-0 gap-2">

          {/* Icon + name */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[9px] bg-gradient-to-br from-amber-400 to-amber-600
                            flex items-center justify-center shrink-0
                            shadow-[0_0_10px_rgba(251,191,36,0.4)]">
              <Crown className="h-[14px] w-[14px] text-white" strokeWidth={2} />
            </div>
            <div className="leading-none">
              <p className="text-[14px] font-bold text-white tracking-[-0.01em] leading-tight">VIP Premium</p>
              <p className="text-[10px] text-white/38 leading-tight mt-[1px]">Membership</p>
            </div>
          </div>

          {/* Subtitle */}
          <p className="text-[11px] text-white/45 leading-none">Unlock exclusive rewards</p>

          {/* Benefit bullets */}
          <div className="flex flex-col gap-1">
            {["2× Rewards", "Priority Support"].map(b => (
              <div key={b} className="flex items-center gap-1.5">
                <svg viewBox="0 0 12 12" className="w-3 h-3 shrink-0 text-amber-400" fill="none">
                  <circle cx="6" cy="6" r="5.5" stroke="currentColor" strokeOpacity="0.35" />
                  <path d="M3.5 6l1.8 1.8L8.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[11px] text-white/60 leading-none">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — badge + price + button, vertically stacked */}
        <div className="flex flex-col items-end justify-between gap-2 shrink-0">
          {/* Premium badge */}
          <span className="text-[8px] font-bold tracking-[0.15em] uppercase
                           px-2 py-[3px] rounded-full
                           bg-amber-400/[0.12] text-amber-400 border border-amber-400/20 leading-none">
            Premium
          </span>

          {/* Price — inline $4/month */}
          <div className="text-right leading-none">
            <span className="text-[20px] font-black text-white tabular-nums tracking-tight leading-none">
              {formatCurrency(4)}
            </span>
            <span className="text-[10px] text-white/35 ml-0.5">/mo</span>
          </div>

          {/* Upgrade button — 30% shorter = h-[26px] vs previous h-9 */}
          <button
            onClick={(e) => { e.stopPropagation(); onUpgrade(); }}
            className="h-[26px] px-4 rounded-full
                       bg-amber-500 hover:bg-amber-400 active:bg-amber-600
                       text-[11px] font-semibold text-gray-950
                       transition-colors duration-150
                       shadow-[0_3px_10px_rgba(251,191,36,0.38)]
                       whitespace-nowrap"
          >
            Upgrade
          </button>
        </div>
      </div>
    </div>
  );
}
