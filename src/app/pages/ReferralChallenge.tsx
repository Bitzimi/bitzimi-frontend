/**
 * Monthly Referral Challenge — Phase 20.3 (Leaderboard-isolated)
 *
 * User-facing page at /challenge.
 * Shows ONLY the leaderboard for the authenticated user's own program level.
 * The backend auto-determines the level from the JWT — no client-side selection.
 *
 * API: GET /api/v1/challenges/leaderboard
 * Response: { enabled, level, challenge: { id, title, period, endAt, pool, topN, status }, leaderboard[] }
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Trophy, ChevronLeft, Lock, RefreshCw, Star, Shield, Award, Calendar, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveLayout } from "../components/ResponsiveLayout";
import { useFeature } from "../contexts/FeatureContext";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json() as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

interface LeaderboardEntry {
  rank:      number;
  userId:    string;
  username:  string;
  referrals: number;
}

interface ChallengePayload {
  enabled: boolean;
  level:   "referral" | "affiliate" | "ambassador";
  challenge: {
    id:     string;
    title:  string;
    period: string;
    endAt:  string;
    pool:   number;
    topN:   number;
    status: string;
  } | null;
  leaderboard: LeaderboardEntry[];
}

const LEVEL_META: Record<string, { label: string; icon: typeof Star; color: string; pillCls: string; gradientCls: string }> = {
  referral:   { label: "Referral",   icon: Star,   color: "text-zinc-300",   pillCls: "bg-zinc-700/60 border-zinc-600",        gradientCls: "from-zinc-900/40 to-zinc-950/20 border-zinc-700/30"   },
  affiliate:  { label: "Affiliate",  icon: Shield, color: "text-purple-400", pillCls: "bg-purple-500/10 border-purple-500/30", gradientCls: "from-purple-900/30 to-indigo-950/20 border-purple-500/20" },
  ambassador: { label: "Ambassador", icon: Award,  color: "text-yellow-400", pillCls: "bg-yellow-500/10 border-yellow-500/30", gradientCls: "from-yellow-900/20 to-zinc-950/20 border-yellow-500/20"  },
};

function daysLeft(endAt: string) {
  const ms = new Date(endAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const d = Math.floor(ms / 86_400_000);
  if (d === 0) return "Ends today";
  return `${d} day${d === 1 ? "" : "s"} left`;
}

const MEDAL = ["🥇", "🥈", "🥉"];

function EntryRow({ entry, color }: { entry: LeaderboardEntry; color: string }) {
  const isTop3 = entry.rank <= 3;
  return (
    <li className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-800/60 last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
        isTop3 ? "border border-yellow-500/30 bg-yellow-500/10" : "border border-zinc-800 text-zinc-600"
      }`}>
        {isTop3 ? MEDAL[entry.rank - 1] : entry.rank}
      </div>
      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm font-semibold text-zinc-300 flex-shrink-0">
        {(entry.username || "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">@{entry.username}</p>
        <p className="text-xs text-zinc-600">{entry.referrals} referral{entry.referrals !== 1 ? "s" : ""}</p>
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color} border-current bg-current/10`}>
        Prize
      </span>
    </li>
  );
}

export default function ReferralChallenge() {
  const navigate = useNavigate();
  const { hasFlag } = useFeature();
  const [data,    setData]    = useState<ChallengePayload | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    // Short-circuit: if the flag is off, synthesize a disabled payload
    if (!hasFlag("monthly_challenge")) {
      setData({ enabled: false, level: "referral", challenge: null, leaderboard: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await apiGet<ChallengePayload>("/api/v1/challenges/leaderboard");
      setData(result);
    } catch {
      toast.error("Failed to load challenge data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const level    = data?.level ?? "referral";
  const meta     = LEVEL_META[level] ?? LEVEL_META.referral;
  const LevelIcon = meta.icon;
  const board    = data?.leaderboard ?? [];

  return (
    <ResponsiveLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all -ml-2 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white">Monthly Challenge</h1>
            <p className="text-sm text-zinc-500">Refer more, earn more</p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-36 rounded-2xl bg-zinc-800/60" />
            <div className="h-60 rounded-2xl bg-zinc-800/60" />
          </div>
        )}

        {/* Feature disabled */}
        {!loading && data && !data.enabled && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-base font-semibold text-white mb-2">Challenge Not Active</p>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              The Monthly Referral Challenge is not currently running. Check back soon!
            </p>
          </div>
        )}

        {/* No active challenge */}
        {!loading && data?.enabled && !data.challenge && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-base font-semibold text-white mb-2">No Active Challenge</p>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              There is no active challenge right now. A new challenge starts at the beginning of each month.
            </p>
          </div>
        )}

        {/* Challenge content */}
        {!loading && data?.enabled && data.challenge && (
          <>
            {/* Challenge header card */}
            <div className={`bg-gradient-to-br ${meta.gradientCls} border rounded-2xl p-5`}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold text-white truncate">{data.challenge.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{data.challenge.period}</p>
                  <div className="flex items-center gap-1.5 mt-1.5 text-xs text-zinc-500">
                    <Clock className="w-3 h-3" />
                    {daysLeft(data.challenge.endAt)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-xs text-green-400 font-medium flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Active
                </span>
              </div>

              {/* Pool summary — single level, no tab switching */}
              <div className="mt-4 flex items-center gap-3 bg-black/20 rounded-xl p-3.5 border border-white/[0.05]">
                <div className={`w-9 h-9 rounded-lg border ${meta.pillCls} flex items-center justify-center flex-shrink-0`}>
                  <LevelIcon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${meta.color}`}>{meta.label} Pool</p>
                  <p className="text-xs text-zinc-500">Top {data.challenge.topN} referrers share the prize</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-white">${data.challenge.pool.toFixed(0)}</p>
                  <p className="text-[10px] text-zinc-500">prize pool</p>
                </div>
              </div>
            </div>

            {/* Leaderboard for user's own level */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <p className={`text-sm font-bold ${meta.color}`}>{meta.label} Leaderboard</p>
                  <p className="text-xs text-zinc-600 mt-0.5">
                    ${data.challenge.pool.toFixed(0)} split equally among top {data.challenge.topN} qualifiers
                  </p>
                </div>
                <LevelIcon className={`w-5 h-5 ${meta.color}`} />
              </div>

              {board.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Trophy className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">No entries yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Refer new VIP subscribers to earn your spot</p>
                </div>
              ) : (
                <ul>
                  {board.map(entry => (
                    <EntryRow key={entry.userId} entry={entry} color={meta.color} />
                  ))}
                </ul>
              )}
            </div>

            {/* VIP bonus callout */}
            <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-yellow-400/90 mb-0.5">VIP Bonus Rewards</p>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Top 3 referrers <span className="text-zinc-400">across all levels</span> also receive bonus VIP time:
                {" "}1st place = 30 days · 2nd = 20 days · 3rd = 10 days.
              </p>
            </div>
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}
