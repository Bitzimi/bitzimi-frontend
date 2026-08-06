/**
 * Today's Predictions — Phase 16
 *
 * Shows today's published predictions.
 * Free users see up to 2 free predictions; VIP items are shown locked.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { TrendingUp, Lock, Star, ChevronRight, RefreshCw } from "lucide-react";

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
interface Prediction {
  id: string; market: string; prediction: string; confidence: number;
  riskLevel: string; isVip: boolean; reasoning: string | null;
  match: Match; result: Result | null; status: string;
}
interface TodayData { predictions: Prediction[]; lockedCount: number; isVip: boolean }

const RISK_COLOR = { low: "text-green-400", medium: "text-amber-400", high: "text-red-400" };
const OUTCOME_COLOR = { win: "bg-green-500/15 text-green-400", loss: "bg-red-500/15 text-red-400", void: "bg-zinc-500/15 text-zinc-400" };

function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); }

function PredCard({ p }: { p: Prediction }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] text-zinc-500">{p.match.league.name} · {p.match.league.country}</p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {p.match.homeTeam} <span className="text-zinc-500 font-normal">vs</span> {p.match.awayTeam}
          </p>
          <p className="text-[11px] text-zinc-500 mt-0.5">KO {fmtTime(p.match.kickoffAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {p.isVip && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 text-[10px] font-semibold"><Star className="w-2.5 h-2.5" />VIP</span>}
          {p.result && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${OUTCOME_COLOR[p.result.outcome as keyof typeof OUTCOME_COLOR]}`}>
              {p.result.outcome.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 bg-black/30 rounded-xl px-3 py-2">
          <p className="text-[10px] text-zinc-500">{p.market}</p>
          <p className="text-base font-bold text-white capitalize">{p.prediction.replace(/_/g, " ")}</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-white">{p.confidence}%</p>
          <p className={`text-[10px] font-medium capitalize ${RISK_COLOR[p.riskLevel as keyof typeof RISK_COLOR]}`}>{p.riskLevel} risk</p>
        </div>
      </div>

      {p.reasoning && (
        <p className="text-xs text-zinc-400 border-t border-white/[0.04] pt-2">{p.reasoning}</p>
      )}
    </div>
  );
}

export default function TodaysPredictions() {
  const navigate = useNavigate();
  const [data, setData] = useState<TodayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    apiFetch<TodayData>("/api/v1/football/today")
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-green-500/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Today's Predictions</h1>
            <p className="text-xs text-zinc-500">{new Date().toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading predictions…</div>}
      {!loading && error && <div className="text-center py-12 text-zinc-500 text-sm">Failed to load predictions. <button onClick={load} className="text-green-400 hover:text-green-300 underline">Retry</button></div>}

      {!loading && !error && data && (
        <>
          {data.predictions.length === 0 && data.lockedCount === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">No predictions published for today yet.</div>
          )}

          {data.predictions.map(p => <PredCard key={p.id} p={p} />)}

          {data.lockedCount > 0 && (
            <div className="bg-gradient-to-br from-yellow-900/30 to-amber-950/20 border border-yellow-500/20 rounded-2xl p-5 text-center">
              <Lock className="w-8 h-8 text-yellow-500 mx-auto mb-3" />
              <p className="text-sm font-semibold text-white mb-1">{data.lockedCount} more prediction{data.lockedCount !== 1 ? "s" : ""} locked</p>
              <p className="text-xs text-zinc-400 mb-4">Upgrade to VIP to unlock all daily tips and Elite Picks</p>
              <button onClick={() => navigate("/settings")} className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm font-medium transition-all border border-yellow-500/30">
                <Star className="w-4 h-4" /> Upgrade to VIP <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
