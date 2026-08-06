/**
 * AuctionHome — Phase 22.2
 *
 * Marketplace homepage with three independent sections:
 *   • Live Auctions
 *   • Upcoming Auctions
 *   • Recently Ended Auctions
 *
 * Features: skeleton loading, empty states per section, auto-refresh on live.
 * Reuses Phase 22.1 endpoint: GET /api/v1/auctions
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Gavel, Loader2, AlertCircle, Radio, Clock, History, RefreshCw, Trophy, CalendarClock } from "lucide-react";
import AuctionCard, { AuctionCardSkeleton, AuctionPublic } from "../components/AuctionCard";

const API = import.meta.env.VITE_API_URL ?? "";
const tok = () => localStorage.getItem("bitzimi_access_token") ?? "";

// ─── Section empty states ─────────────────────────────────────────────────────

function SectionEmpty({
  icon: Icon,
  title,
  sub,
}: {
  icon: React.ElementType;
  title: string;
  sub: string;
}) {
  return (
    <div className="col-span-full flex flex-col items-center gap-3 py-10 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-white/[0.06] flex items-center justify-center">
        <Icon className="w-6 h-6 text-zinc-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-400">{title}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  count,
  accentClass,
  pulseDot,
}: {
  icon: React.ElementType;
  title: string;
  count: number;
  accentClass: string;
  pulseDot?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      {pulseDot && (
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
      )}
      <Icon className={`w-4 h-4 ${accentClass}`} />
      <h2 className={`text-sm font-bold uppercase tracking-widest ${accentClass}`}>{title}</h2>
      {count > 0 && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          pulseDot
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
            : accentClass.includes("blue")
            ? "bg-blue-500/15 text-blue-400 border-blue-500/25"
            : "bg-zinc-700/50 text-zinc-500 border-zinc-600/25"
        }`}>
          {count}
        </span>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL = 30_000; // 30s — matches scheduler

export default function AuctionHome() {
  const [auctions, setAuctions] = useState<AuctionPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auctions`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load auctions");
      setAuctions(data.auctions ?? []);
      setError(null);
      setLastRefresh(Date.now());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { load(); }, [load]);

  // Auto-refresh when there are live auctions
  useEffect(() => {
    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);

    const hasLive = auctions.some((a) => a.status === "live");
    if (hasLive) {
      refreshTimerRef.current = setInterval(() => load(true), REFRESH_INTERVAL);
    }
    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [auctions, load]);

  const live     = auctions.filter((a) => a.status === "live");
  const upcoming = auctions.filter((a) => a.status === "upcoming");
  const ended    = auctions.filter((a) => a.status === "ended");

  // ── Error state ──────────────────────────────────────────────────────────
  if (!loading && error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{error}</p>
          <p className="text-zinc-500 text-xs mt-1">Check your connection and try again.</p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/25 text-sm hover:bg-amber-600/30 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try Again
        </button>
      </div>
    );
  }

  // ── Full-page empty state (no auctions at all) ────────────────────────────
  if (!loading && auctions.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20 flex items-center justify-center">
            <Gavel className="w-10 h-10 text-amber-500/50" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">No Auctions Yet</h3>
          <p className="text-zinc-500 text-sm mt-1 max-w-xs">
            Exciting prizes are coming soon. Check back shortly — new auctions are added regularly.
          </p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-400 border border-white/[0.06] text-sm hover:text-white transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>
    );
  }

  // ── Grid skeletons ────────────────────────────────────────────────────────
  const SkeletonGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => <AuctionCardSkeleton key={i} />)}
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Refresh indicator */}
      {!loading && live.length > 0 && (
        <div className="px-4 md:px-6 pt-3 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">
            Auto-refreshes every 30s · Last updated {new Date(lastRefresh).toLocaleTimeString()}
          </p>
          <button
            onClick={() => load(true)}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh now
          </button>
        </div>
      )}

      <div className="p-4 md:p-6 space-y-10">

        {/* ── Live Auctions ─────────────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={Radio}
            title="Live Auctions"
            count={live.length}
            accentClass="text-emerald-400"
            pulseDot={live.length > 0}
          />

          {loading ? (
            <SkeletonGrid />
          ) : live.length === 0 ? (
            <div className="border border-dashed border-white/[0.06] rounded-2xl">
              <SectionEmpty
                icon={Radio}
                title="No Live Auctions"
                sub="Live auctions will appear here as soon as one goes live."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {live.map((a) => <AuctionCard key={a.id} auction={a} />)}
            </div>
          )}
        </section>

        {/* ── Upcoming Auctions ─────────────────────────────────────────── */}
        <section>
          <SectionHeader
            icon={CalendarClock}
            title="Upcoming Auctions"
            count={upcoming.length}
            accentClass="text-blue-400"
          />

          {loading ? (
            <SkeletonGrid />
          ) : upcoming.length === 0 ? (
            <div className="border border-dashed border-white/[0.06] rounded-2xl">
              <SectionEmpty
                icon={Clock}
                title="No Upcoming Auctions"
                sub="Upcoming auctions will be listed here before they go live."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {upcoming.map((a) => <AuctionCard key={a.id} auction={a} />)}
            </div>
          )}
        </section>

        {/* ── Recently Ended ────────────────────────────────────────────── */}
        {(!loading && ended.length > 0) && (
          <section>
            <SectionHeader
              icon={History}
              title="Recently Ended"
              count={ended.length}
              accentClass="text-zinc-500"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {ended.map((a) => <AuctionCard key={a.id} auction={a} />)}
            </div>
          </section>
        )}

        {/* Bottom padding for mobile nav */}
        <div className="h-4" />
      </div>
    </div>
  );
}
