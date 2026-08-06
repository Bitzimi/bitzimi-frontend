/**
 * Prediction History — Phase 16
 *
 * Settled predictions with outcomes and cursor-based pagination.
 */

import { useState, useEffect, useCallback } from "react";
import { Clock, ChevronDown, RefreshCw, CheckCircle, XCircle, MinusCircle } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface League { name: string; country: string }
interface Match  { homeTeam: string; awayTeam: string; kickoffAt: string; league: League }
interface Result { outcome: string; isCorrect: boolean }
interface Prediction { id: string; market: string; prediction: string; confidence: number; riskLevel: string; match: Match; result: Result | null; updatedAt: string }
interface HistoryData { items: Prediction[]; nextCursor: string | null; hasMore: boolean }

const OUTCOME_ICONS = {
  win:  { icon: CheckCircle,  color: "text-green-400",  bg: "bg-green-500/10" },
  loss: { icon: XCircle,     color: "text-red-400",    bg: "bg-red-500/10"   },
  void: { icon: MinusCircle, color: "text-zinc-400",   bg: "bg-zinc-500/10"  },
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "medium" }); }

export default function PredictionHistory() {
  const [items, setItems]     = useState<Prediction[]>([]);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [outcome, setOutcome] = useState("");

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    if (!append) setError(false);
    const p = new URLSearchParams({ limit: "20" });
    if (outcome) p.set("outcome", outcome);
    if (cur) p.set("cursor", cur);
    apiFetch<HistoryData>(`/api/v1/football/history?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [outcome]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Prediction History</h1>
            <p className="text-xs text-zinc-500">All settled predictions with outcomes</p>
          </div>
        </div>
        <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["", "win", "loss", "void"].map(o => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              outcome === o
                ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.07]"
            }`}
          >
            {o === "" ? "All" : o.charAt(0).toUpperCase() + o.slice(1)}
          </button>
        ))}
        <div className="ml-auto relative">
          <select className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-7 text-xs text-white focus:outline-none">
            <option>Newest first</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {loading && items.length === 0 && <div className="text-center py-12 text-zinc-500 text-sm">Loading…</div>}
      {!loading && error && <div className="text-center py-12 text-zinc-500 text-sm">Failed to load history. <button onClick={() => load()} className="text-blue-400 hover:text-blue-300 underline">Retry</button></div>}
      {!loading && !error && items.length === 0 && <div className="text-center py-12 text-zinc-500 text-sm">No settled predictions yet.</div>}

      <div className="space-y-2">
        {items.map(item => {
          const o = item.result?.outcome ?? "";
          const meta = OUTCOME_ICONS[o as keyof typeof OUTCOME_ICONS];
          return (
            <div key={item.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
              {meta && (
                <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                  <meta.icon className={`w-5 h-5 ${meta.color}`} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-zinc-500">{item.match.league.name}</p>
                <p className="text-sm text-white font-medium">{item.match.homeTeam} vs {item.match.awayTeam}</p>
                <p className="text-xs text-zinc-400 mt-0.5 capitalize">{item.market}: <span className="font-semibold text-white">{item.prediction.replace(/_/g, " ")}</span></p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-white">{item.confidence}%</p>
                <p className="text-[10px] text-zinc-500">{fmtDate(item.updatedAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => load(cursor, true)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 text-sm hover:bg-white/[0.05] transition-all"
        >
          Load more
        </button>
      )}
    </div>
  );
}
