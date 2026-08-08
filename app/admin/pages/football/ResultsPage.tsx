/**
 * Admin Football — Results Page
 *
 * View all settled results and settle pending published predictions.
 */

import { useState, useEffect, useCallback } from "react";
import { Trophy, CheckCircle, XCircle, MinusCircle, RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const json = (await res.json()) as { data?: T };
  if (!res.ok) throw new Error((json as { error?: { message?: string } }).error?.message ?? "Request failed");
  return json.data as T;
}

interface League { name: string }
interface Match  { homeTeam: string; awayTeam: string; league: League }
interface PredictionInResult { id: string; market: string; prediction: string; confidence: number; match: Match }
interface Result { id: string; outcome: string; isCorrect: boolean; settledAt: string; prediction: PredictionInResult }
interface ResultList { items: Result[]; nextCursor: string | null; hasMore: boolean }

interface PendingPrediction { id: string; market: string; prediction: string; confidence: number; publishedAt: string | null; match: Match }
interface PendingList { items: PendingPrediction[]; nextCursor: string | null; hasMore: boolean }

const OUTCOME_ICONS = {
  win:  { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10" },
  loss: { icon: XCircle,    color: "text-red-400",   bg: "bg-red-500/10"  },
  void: { icon: MinusCircle, color: "text-zinc-400", bg: "bg-zinc-500/10" },
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" }); }

export default function ResultsPage() {
  const [results, setResults]   = useState<Result[]>([]);
  const [pending, setPending]   = useState<PendingPrediction[]>([]);
  const [cursor, setCursor]     = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [settling, setSettling] = useState<string | null>(null);
  const [tab, setTab]           = useState<"pending" | "settled">("pending");

  const loadResults = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    apiFetch<ResultList>(`/api/v1/admin/football/results?limit=50${cur ? `&cursor=${cur}` : ""}`)
      .then(d => {
        setResults(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => toast.error("Failed to load results"))
      .finally(() => setLoading(false));
  }, []);

  const loadPending = useCallback(() => {
    setLoading(true);
    apiFetch<PendingList>("/api/v1/admin/football/predictions?status=published&limit=100")
      .then(d => {
        setPending(d.items);
      })
      .catch(() => toast.error("Failed to load pending"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPending(); loadResults(); }, [loadPending, loadResults]);

  const settle = async (predictionId: string, outcome: "win" | "loss" | "void") => {
    setSettling(predictionId);
    try {
      await apiFetch(`/api/v1/admin/football/predictions/${predictionId}/settle`, { method: "POST", body: JSON.stringify({ outcome }) });
      setPending(prev => prev.filter(p => p.id !== predictionId));
      loadResults();
      toast.success(`Settled as ${outcome}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to settle");
    } finally {
      setSettling(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Results</h1>
            <p className="text-xs text-zinc-500">Settle published predictions and view history</p>
          </div>
        </div>
        <button onClick={() => { loadPending(); loadResults(); }} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["pending", "settled"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === t ? "bg-yellow-600/20 text-yellow-300 border border-yellow-500/30" : "bg-white/[0.04] text-zinc-400 border border-white/[0.06]"}`}>
            {t === "pending" ? `Pending Settlement (${pending.length})` : "Settled Results"}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-2">
          {loading && pending.length === 0 && <div className="text-center py-8 text-zinc-500 text-sm">Loading…</div>}
          {!loading && pending.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">No published predictions awaiting settlement.</div>
          )}
          {pending.map(p => (
            <div key={p.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-500">{p.match.league.name}</p>
                <p className="text-sm text-white font-medium">{p.match.homeTeam} vs {p.match.awayTeam}</p>
                <p className="text-xs text-zinc-400 mt-0.5 capitalize">{p.market}: <strong className="text-white">{p.prediction.replace(/_/g, " ")}</strong> · {p.confidence}% confidence</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => settle(p.id, "win")} disabled={settling === p.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-medium transition-all">
                  <CheckCircle className="w-3.5 h-3.5" />Win
                </button>
                <button onClick={() => settle(p.id, "loss")} disabled={settling === p.id} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-all">
                  <XCircle className="w-3.5 h-3.5" />Loss
                </button>
                <div className="relative">
                  <select onChange={e => { if (e.target.value === "void") settle(p.id, "void"); e.target.value = ""; }} defaultValue="" className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 pr-6 text-zinc-400 text-xs focus:outline-none cursor-pointer">
                    <option value="" disabled>More</option>
                    <option value="void">Mark Void</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 pointer-events-none" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "settled" && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.06]">
              <tr>{["Result", "Match", "Market", "Prediction", "Settled"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading && results.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
              )}
              {!loading && results.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">No results yet.</td></tr>
              )}
              {results.map(r => {
                const meta = OUTCOME_ICONS[r.outcome as keyof typeof OUTCOME_ICONS];
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      {meta && (
                        <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center`}>
                          <meta.icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-white">{r.prediction.match.homeTeam} vs {r.prediction.match.awayTeam}</p>
                      <p className="text-[10px] text-zinc-500">{r.prediction.match.league.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{r.prediction.market}</td>
                    <td className="px-4 py-3 text-xs text-white capitalize">{r.prediction.prediction.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{fmtDate(r.settledAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {hasMore && (
            <div className="px-4 py-3 border-t border-white/[0.06]">
              <button onClick={() => loadResults(cursor, true)} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all">Load more</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
