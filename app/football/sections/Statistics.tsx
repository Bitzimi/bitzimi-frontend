/**
 * Statistics — Phase 16
 *
 * Overall accuracy stats and recent settled results.
 */

import { useEffect, useState } from "react";
import { BarChart2, RefreshCw, TrendingUp, CheckCircle, XCircle, MinusCircle } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface RecentResult {
  id: string;
  outcome: string;
  isCorrect: boolean;
  settledAt: string;
  prediction: {
    market: string;
    prediction: string;
    confidence: number;
    match: { homeTeam: string; awayTeam: string; league: { name: string } };
  };
}
interface Stats {
  total: number; wins: number; losses: number; voids: number; accuracy: number;
  recentResults: RecentResult[];
}

const STAT_CARDS = [
  { key: "total",    label: "Total Tips",  color: "text-white" },
  { key: "wins",     label: "Wins",        color: "text-green-400" },
  { key: "losses",   label: "Losses",      color: "text-red-400" },
  { key: "voids",    label: "Void",        color: "text-zinc-400" },
];

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "short" }); }

export default function Statistics() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    apiFetch<Stats>("/api/v1/football/statistics")
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Statistics</h1>
            <p className="text-xs text-zinc-500">Overall prediction performance</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>}
      {!loading && error && <div className="text-center py-12 text-zinc-500 text-sm">Failed to load statistics. <button onClick={load} className="text-purple-400 hover:text-purple-300 underline">Retry</button></div>}

      {!loading && !error && stats && (
        <>
          {/* Accuracy hero */}
          <div className="bg-gradient-to-br from-purple-900/30 to-purple-950/20 border border-purple-500/20 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
              <TrendingUp className="w-7 h-7 text-purple-400" />
            </div>
            <p className="text-4xl font-bold text-white mb-1">{stats.accuracy}%</p>
            <p className="text-sm text-zinc-400">Prediction Accuracy</p>
            <p className="text-xs text-zinc-500 mt-1">{stats.wins} wins from {stats.wins + stats.losses} decided tips</p>
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STAT_CARDS.map(c => (
              <div key={c.key} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${c.color}`}>{stats[c.key as keyof Stats] as number}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Win bar */}
          {stats.total > 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-xs text-zinc-400 mb-2">Win / Loss / Void distribution</p>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                <div className="bg-green-500 transition-all" style={{ width: `${(stats.wins / stats.total) * 100}%` }} />
                <div className="bg-red-500 transition-all" style={{ width: `${(stats.losses / stats.total) * 100}%` }} />
                <div className="bg-zinc-600 transition-all" style={{ width: `${(stats.voids / stats.total) * 100}%` }} />
              </div>
              <div className="flex gap-4 mt-2 text-[10px] text-zinc-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Win</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Loss</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-600 inline-block" />Void</span>
              </div>
            </div>
          )}

          {/* Recent results */}
          {stats.recentResults.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-white mb-3">Recent Results</h2>
              <div className="space-y-2">
                {stats.recentResults.map(r => {
                  const Icon = r.outcome === "win" ? CheckCircle : r.outcome === "loss" ? XCircle : MinusCircle;
                  const color = r.outcome === "win" ? "text-green-400" : r.outcome === "loss" ? "text-red-400" : "text-zinc-400";
                  return (
                    <div key={r.id} className="bg-white/[0.03] border border-white/[0.04] rounded-xl p-3 flex items-center gap-3">
                      <Icon className={`w-4 h-4 flex-shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium">
                          {r.prediction.match.homeTeam} vs {r.prediction.match.awayTeam}
                        </p>
                        <p className="text-[10px] text-zinc-500 capitalize">
                          {r.prediction.market}: {r.prediction.prediction.replace(/_/g, " ")} · {r.prediction.confidence}%
                        </p>
                      </div>
                      <p className="text-[10px] text-zinc-500 flex-shrink-0">{fmtDate(r.settledAt)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {!loading && !error && !stats && (
        <div className="text-center py-12 text-zinc-500 text-sm">No statistics available yet.</div>
      )}
    </div>
  );
}
