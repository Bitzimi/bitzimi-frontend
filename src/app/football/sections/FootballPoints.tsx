/**
 * Football AI Daily Points — Phase 20.3
 *
 * Tier-based daily point claims and conversion to game wallet credit.
 * All data sourced from backend — no frontend business logic.
 *
 * Tiers (from backend):
 *   vip      → 25 pts/day  (VIP subscription active)
 *   verified → 15 pts/day  (KYC approved)
 *   normal   → 10 pts/day  (everyone else)
 *
 * Conversion: 1000 pts → $2.00 game wallet credit
 */
import { useEffect, useState, useCallback } from "react";
import { Zap, Gift, RefreshCw, TrendingUp, Lock, CheckCircle2, Coins } from "lucide-react";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json() as { data?: T; error?: { message: string; code?: string } };
  if (!res.ok) {
    const err = Object.assign(new Error(json.error?.message ?? "Request failed"), { code: json.error?.code });
    throw err;
  }
  return json.data as T;
}

async function apiPost<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json() as { data?: T; error?: { message: string; code?: string } };
  if (!res.ok) {
    const err = Object.assign(new Error(json.error?.message ?? "Request failed"), { code: json.error?.code });
    throw err;
  }
  return json.data as T;
}

interface PointsBalance {
  totalPoints:    number;
  currentPoints:  number;
  totalConverted: number;
  dailyPoints:    number;
  tier:           string;
}

interface ClaimResult {
  alreadyClaimed: boolean;
  points:         number;
  tier:           string;
  currentBalance: number;
}

const CONVERSION_THRESHOLD = 1000;
const USD_PER_CONVERSION   = 2;

const TIER_META = {
  vip:      { label: "VIP",      pts: 25, color: "text-yellow-400", pill: "bg-yellow-500/10 border-yellow-500/30", bar: "bg-yellow-400" },
  verified: { label: "Verified", pts: 15, color: "text-blue-400",   pill: "bg-blue-500/10 border-blue-500/30",     bar: "bg-blue-400"   },
  normal:   { label: "Normal",   pts: 10, color: "text-zinc-400",   pill: "bg-zinc-800/60 border-zinc-700/50",     bar: "bg-zinc-400"   },
};

function getTier(tier: string) {
  return TIER_META[tier as keyof typeof TIER_META] ?? TIER_META.normal;
}

export default function FootballPoints() {
  const [balance,    setBalance]    = useState<PointsBalance | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [featureOff, setFeatureOff] = useState(false);
  const [claiming,   setClaiming]   = useState(false);
  const [converting, setConverting] = useState(false);

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<PointsBalance>("/api/v1/football/points");
      setBalance(data);
      setFeatureOff(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "FEATURE_DISABLED" || e.message?.includes("not enabled") || e.message?.includes("disabled")) {
        setFeatureOff(true);
      } else {
        toast.error("Failed to load points data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBalance(); }, [fetchBalance]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const result = await apiPost<ClaimResult>("/api/v1/football/daily-claim");
      if (result.alreadyClaimed) {
        toast.info("Already claimed today — come back tomorrow!");
      } else {
        toast.success(`+${result.points} points claimed!`);
        void fetchBalance();
      }
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "ALREADY_CLAIMED") {
        toast.info("Already claimed today — come back tomorrow!");
      } else {
        toast.error(e.message ?? "Claim failed");
      }
    } finally {
      setClaiming(false);
    }
  };

  const handleConvert = async () => {
    if (!balance || balance.currentPoints < CONVERSION_THRESHOLD) return;
    setConverting(true);
    try {
      await apiPost("/api/v1/football/convert-points");
      const batches = Math.floor((balance?.currentPoints ?? 0) / CONVERSION_THRESHOLD);
      toast.success(`$${(batches * USD_PER_CONVERSION).toFixed(2)} credited to your Game Wallet!`);
      void fetchBalance();
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? "Conversion failed");
    } finally {
      setConverting(false);
    }
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-44 rounded-2xl bg-zinc-800/60" />
        <div className="h-20 rounded-2xl bg-zinc-800/60" />
        <div className="h-36 rounded-2xl bg-zinc-800/60" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-20 rounded-xl bg-zinc-800/60" />
          <div className="h-20 rounded-xl bg-zinc-800/60" />
        </div>
      </div>
    );
  }

  // ── Feature disabled ──────────────────────────────────────────────────────────
  if (featureOff) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-zinc-600" />
          </div>
          <p className="text-base font-semibold text-white mb-2">Daily Points Rewards</p>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto">
            The daily points reward system is coming soon. Check back later to start earning!
          </p>
        </div>
      </div>
    );
  }

  if (!balance) return null;

  const tier        = getTier(balance.tier);
  const progress    = Math.min((balance.currentPoints / CONVERSION_THRESHOLD) * 100, 100);
  const canConvert  = balance.currentPoints >= CONVERSION_THRESHOLD;
  const batchCount  = Math.floor(balance.currentPoints / CONVERSION_THRESHOLD);

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* ── Tier + balance card ─────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-green-900/30 to-emerald-950/20 border border-green-500/20 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Your Tier</p>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold ${tier.pill} ${tier.color}`}>
              <span className={`w-2 h-2 rounded-full ${tier.bar}`} />
              {tier.label}
            </div>
            <p className="text-zinc-400 text-sm mt-2.5">
              Earning <span className="text-white font-semibold">{balance.dailyPoints} pts</span> per day
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Balance</p>
            <p className="text-3xl font-bold text-white tabular-nums leading-none">{balance.currentPoints.toLocaleString()}</p>
            <p className="text-xs text-zinc-500 mt-1">points</p>
          </div>
        </div>

        {/* Tier comparison */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(["normal", "verified", "vip"] as const).map(t => {
            const m = TIER_META[t];
            const active = balance.tier === t;
            return (
              <div
                key={t}
                className={`rounded-xl p-2.5 border text-center transition-all ${
                  active ? `${m.pill} ${m.color}` : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <p className={`text-xs font-semibold ${active ? "" : "text-zinc-600"}`}>{m.label}</p>
                <p className={`text-[11px] mt-0.5 font-medium ${active ? "text-white" : "text-zinc-700"}`}>{m.pts} pts/day</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Daily claim ────────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center flex-shrink-0">
            <Gift className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Daily Claim</p>
            <p className="text-xs text-zinc-500">One claim per day — resets at midnight UTC</p>
          </div>
        </div>
        <button
          onClick={handleClaim}
          disabled={claiming}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
        >
          {claiming
            ? <><RefreshCw className="w-4 h-4 animate-spin" /> Claiming…</>
            : <><Zap className="w-4 h-4" /> Claim {balance.dailyPoints} Points</>}
        </button>
      </div>

      {/* ── Conversion ─────────────────────────────────────────────────────────── */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
            <Coins className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Convert to Cash</p>
            <p className="text-xs text-zinc-500">1,000 points = $2.00 game wallet credit</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center text-xs text-zinc-500 mb-1.5">
            <span>{balance.currentPoints.toLocaleString()} / {CONVERSION_THRESHOLD.toLocaleString()} pts</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-600 to-violet-400 transition-all duration-700"
              style={{ width: `${Math.max(progress, balance.currentPoints > 0 ? 2 : 0)}%` }}
            />
          </div>
          {!canConvert && (
            <p className="text-xs text-zinc-600 mt-1.5">
              {(CONVERSION_THRESHOLD - balance.currentPoints).toLocaleString()} more points needed
            </p>
          )}
        </div>

        {canConvert ? (
          <button
            onClick={handleConvert}
            disabled={converting}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] disabled:bg-zinc-800 disabled:text-zinc-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
          >
            {converting
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Converting…</>
              : <><TrendingUp className="w-4 h-4" /> Convert{batchCount > 1 ? ` ${batchCount}×` : ""} → ${(batchCount * USD_PER_CONVERSION).toFixed(2)}</>}
          </button>
        ) : (
          <button disabled className="w-full py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/40 text-zinc-600 font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed">
            <Lock className="w-4 h-4" /> Reach 1,000 pts to convert
          </button>
        )}
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <p className="text-xs text-zinc-500">Total Earned</p>
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{balance.totalPoints.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">lifetime pts</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-xs text-zinc-500">Total Converted</p>
          </div>
          <p className="text-xl font-bold text-white tabular-nums">{balance.totalConverted.toLocaleString()}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">pts redeemed</p>
        </div>
      </div>

    </div>
  );
}
