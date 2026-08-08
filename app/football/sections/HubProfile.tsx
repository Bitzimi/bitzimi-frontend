/**
 * Hub Profile — Phase 16
 *
 * Shows user's VIP status and prediction viewing history summary.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { User, Star, TrendingUp, ChevronRight, RefreshCw } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface Stats { total: number; wins: number; accuracy: number }
interface TodayData { isVip: boolean; predictions: unknown[]; lockedCount: number }

export default function HubProfile() {
  const navigate = useNavigate();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [today, setToday]   = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      apiFetch<Stats>("/api/v1/football/statistics"),
      apiFetch<TodayData>("/api/v1/football/today"),
    ]).then(([s, t]) => {
      setStats(s);
      setToday(t);
    }).catch(() => setError(true)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const isVip = today?.isVip ?? false;

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <User className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">My Profile</h1>
            <p className="text-xs text-zinc-500">Football AI Hub membership</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>}
      {!loading && error && <div className="text-center py-12 text-zinc-500 text-sm">Failed to load profile. <button onClick={load} className="text-indigo-400 hover:text-indigo-300 underline">Retry</button></div>}

      {!loading && !error && (
        <>
          {/* Membership status */}
          <div className={`rounded-2xl p-5 border ${isVip ? "bg-gradient-to-br from-yellow-900/30 to-amber-950/20 border-yellow-500/20" : "bg-white/[0.03] border-white/[0.06]"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isVip ? "bg-yellow-500/20" : "bg-zinc-700/40"}`}>
                <Star className={`w-6 h-6 ${isVip ? "text-yellow-400" : "text-zinc-500"}`} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{isVip ? "VIP Member" : "Free Member"}</p>
                <p className="text-xs text-zinc-400">
                  {isVip
                    ? "Unlimited predictions + Elite Picks access"
                    : "2 free predictions per day"}
                </p>
              </div>
            </div>

            {!isVip && (
              <button onClick={() => navigate("/settings")} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm font-semibold transition-all border border-yellow-500/30">
                <Star className="w-4 h-4" /> Upgrade to VIP <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stats snapshot */}
          {stats && stats.total > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <p className="text-sm font-semibold text-white">Platform Performance</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black/20 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-green-400">{stats.accuracy}%</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Accuracy</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{stats.wins}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Wins</p>
                </div>
                <div className="bg-black/20 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-white">{stats.total}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Tips</p>
                </div>
              </div>
            </div>
          )}

          {stats && stats.total === 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 text-center text-zinc-500 text-sm">
              No prediction history available yet. Check back soon!
            </div>
          )}
        </>
      )}
    </div>
  );
}
