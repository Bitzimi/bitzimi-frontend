/**
 * Elite Picks — Phase 16
 *
 * VIP-only high-confidence picks.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Star, Lock, ChevronRight, RefreshCw } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface League { name: string; country: string }
interface Match  { homeTeam: string; awayTeam: string; kickoffAt: string; league: League }
interface Result { outcome: string }
interface Pick {
  id: string; market: string; prediction: string; confidence: number;
  riskLevel: string; analysis: string | null; reasoning: string | null;
  match: Match; result: Result | null; publishedAt: string | null;
}
interface EliteData { locked: boolean; message?: string; picks?: Pick[] }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default function ElitePicks() {
  const navigate = useNavigate();
  const [data, setData] = useState<EliteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(false);
    apiFetch<EliteData>("/api/v1/football/elite")
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-yellow-500/15 flex items-center justify-center">
            <Star className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Elite Picks</h1>
            <p className="text-xs text-zinc-500">High-confidence VIP-exclusive tips</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>}
      {!loading && error && <div className="text-center py-12 text-zinc-500 text-sm">Failed to load elite picks. <button onClick={load} className="text-yellow-400 hover:text-yellow-300 underline">Retry</button></div>}

      {!loading && !error && data?.locked && (
        <div className="bg-gradient-to-br from-yellow-900/30 to-amber-950/20 border border-yellow-500/20 rounded-2xl p-8 text-center">
          <Lock className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
          <p className="text-base font-semibold text-white mb-2">VIP Access Required</p>
          <p className="text-sm text-zinc-400 mb-5">{data.message}</p>
          <button onClick={() => navigate("/settings")} className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm font-semibold transition-all border border-yellow-500/30">
            <Star className="w-4 h-4" /> Upgrade to VIP <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {!loading && !error && !data?.locked && data?.picks && (
        <>
          {data.picks.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">No elite picks available right now.</div>
          )}
          {data.picks.map(pick => (
            <div key={pick.id} className="bg-gradient-to-br from-yellow-900/20 to-amber-950/10 border border-yellow-500/20 rounded-2xl overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-[11px] text-zinc-500">{pick.match.league.name} · {pick.match.league.country}</p>
                    <p className="text-sm font-semibold text-white mt-0.5">
                      {pick.match.homeTeam} <span className="text-zinc-500 font-normal">vs</span> {pick.match.awayTeam}
                    </p>
                    {pick.publishedAt && <p className="text-[11px] text-zinc-500 mt-0.5">{fmtDate(pick.publishedAt)}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-[10px] font-bold">{pick.confidence}% confidence</span>
                    {pick.result && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${pick.result.outcome === "win" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                        {pick.result.outcome.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-black/20 rounded-xl px-3 py-2">
                  <p className="text-[10px] text-zinc-500">{pick.market}</p>
                  <p className="text-base font-bold text-white capitalize">{pick.prediction.replace(/_/g, " ")}</p>
                </div>

                {pick.reasoning && (
                  <p className="text-xs text-zinc-400 mt-3">{pick.reasoning}</p>
                )}

                {pick.analysis && (
                  <button
                    onClick={() => setExpanded(expanded === pick.id ? null : pick.id)}
                    className="mt-3 text-xs text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    {expanded === pick.id ? "Hide" : "Read"} full analysis
                  </button>
                )}
              </div>

              {pick.analysis && expanded === pick.id && (
                <div className="px-4 pb-4 pt-0 border-t border-yellow-500/10">
                  <p className="text-xs text-zinc-300 whitespace-pre-wrap">{pick.analysis}</p>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
