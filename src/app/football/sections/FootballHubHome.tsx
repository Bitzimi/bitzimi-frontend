/**
 * Football Hub — Home Section
 *
 * Overview: today's match count, accuracy banner, quick-access cards.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { TrendingUp, Star, BarChart2, Clock, ChevronRight, Trophy, Lock } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface Stats { total: number; wins: number; losses: number; voids: number; accuracy: number }
interface TodayData { predictions: unknown[]; lockedCount: number; isVip: boolean }

const QUICK_LINKS = [
  { label: "Today's Predictions", sub: "Matches kicking off today", path: "today", icon: TrendingUp, color: "from-green-600/20 to-emerald-700/10 border-green-500/20" },
  { label: "Elite Picks",         sub: "VIP high-confidence tips",  path: "elite", icon: Star,       color: "from-yellow-600/20 to-amber-700/10 border-yellow-500/20" },
  { label: "Prediction History",  sub: "Past settled predictions",  path: "history", icon: Clock,    color: "from-blue-600/20 to-blue-700/10 border-blue-500/20" },
  { label: "Statistics",          sub: "Win rates and performance", path: "statistics", icon: BarChart2, color: "from-purple-600/20 to-purple-700/10 border-purple-500/20" },
];

export default function FootballHubHome() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [today, setToday] = useState<TodayData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      apiFetch<Stats>("/api/v1/football/statistics"),
      apiFetch<TodayData>("/api/v1/football/today"),
    ]).then(([s, t]) => {
      setStats(s);
      setToday(t);
    }).catch(() => setError(true));
  }, []);

  if (error) return (
    <div className="text-center py-16 text-zinc-500 text-sm">
      <p>Unable to load Football AI Hub data.</p>
      <button onClick={() => { setError(false); }} className="mt-3 text-green-400 hover:text-green-300 text-xs underline">Retry</button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-900/40 to-emerald-950/30 border border-green-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Football AI Hub</h1>
            <p className="text-sm text-zinc-400">Expert-curated match predictions</p>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-black/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{stats.accuracy}%</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Accuracy</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.wins}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Wins</p>
            </div>
            <div className="bg-black/20 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Total Tips</p>
            </div>
          </div>
        )}
      </div>

      {/* Today's summary */}
      {today && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-white">Today</h2>
            <button
              onClick={() => navigate("today")}
              className="text-xs text-green-400 flex items-center gap-1 hover:text-green-300 transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span>{today.predictions.length} prediction{today.predictions.length !== 1 ? "s" : ""} available</span>
            {today.lockedCount > 0 && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Lock className="w-3 h-3" />
                {today.lockedCount} VIP
              </span>
            )}
          </div>
          {!today.isVip && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
              Upgrade to VIP for unlimited daily predictions + Elite Picks
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUICK_LINKS.map(link => (
          <button
            key={link.path}
            onClick={() => navigate(link.path)}
            className={`bg-gradient-to-br ${link.color} border rounded-2xl p-4 text-left hover:opacity-90 transition-all`}
          >
            <link.icon className="w-5 h-5 text-white mb-3" />
            <p className="text-sm font-semibold text-white">{link.label}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{link.sub}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
