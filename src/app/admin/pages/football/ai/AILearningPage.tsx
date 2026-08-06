/**
 * AI Learning Metrics — Phase 17.1
 *
 * Displays monthly learning metrics: accuracy, confidence calibration, market breakdown.
 * Admins can trigger recomputation for any period.
 */

import { useEffect, useState } from "react";
import { BarChart2, RefreshCw, Play, TrendingUp, Target } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...opts?.headers },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error((json as { error?: { message: string } }).error?.message ?? "Request failed");
  return json.data as T;
}

interface MarketStat { total: number; correct: number; accuracy: number }
interface CalibrationBucket { bucket: string; predictions: number; correct: number; accuracy: number }
interface LearningMetric {
  id: string; period: string;
  totalPredictions: number; correctPredictions: number;
  accuracy: number; avgConfidence: number;
  marketBreakdown: Record<string, MarketStat> | null;
  calibrationData: CalibrationBucket[] | null;
  computedAt: string;
}

function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function AILearningPage() {
  const [metrics, setMetrics]   = useState<LearningMetric[]>([]);
  const [selected, setSelected] = useState<LearningMetric | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [computing, setComp]    = useState(false);

  const load = () => {
    setLoading(true); setError("");
    apiFetch<LearningMetric[]>("/api/v1/admin/ai/learning")
      .then(all => { setMetrics(all); if (all.length > 0) setSelected(all[0]); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const compute = async (period?: string) => {
    setComp(true); setError("");
    try {
      const m = await apiFetch<LearningMetric>("/api/v1/admin/ai/learning/compute", {
        method: "POST",
        body: period ? JSON.stringify({ period }) : "{}",
      });
      setMetrics(prev => {
        const idx = prev.findIndex(x => x.period === m.period);
        if (idx >= 0) { const n = [...prev]; n[idx] = m; return n; }
        return [m, ...prev];
      });
      setSelected(m);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setComp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <BarChart2 className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Learning Metrics</h1>
            <p className="text-xs text-zinc-500">Monthly AI performance and calibration data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => compute(currentPeriod())}
            disabled={computing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium transition-all disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            {computing ? "Computing…" : "Compute Now"}
          </button>
          <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>}
      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading learning metrics…</div>}

      {!loading && metrics.length === 0 && (
        <div className="text-center py-12">
          <BarChart2 className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No learning metrics yet.</p>
          <p className="text-zinc-600 text-xs mt-1">Metrics are computed from settled predictions.</p>
          <button onClick={() => compute()} disabled={computing} className="mt-4 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-300 text-sm hover:bg-blue-600/30 transition-all">
            Compute current period
          </button>
        </div>
      )}

      {!loading && metrics.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Period list */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Periods</p>
            {metrics.map(m => (
              <button
                key={m.period}
                onClick={() => setSelected(m)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-left ${
                  selected?.period === m.period
                    ? "bg-blue-600/15 border-blue-500/30 text-blue-300"
                    : "bg-white/[0.03] border-white/[0.06] text-zinc-400 hover:bg-white/[0.05]"
                }`}
              >
                <span className="text-sm font-medium">{m.period}</span>
                <span className="text-xs font-mono">{pct(m.accuracy)}</span>
              </button>
            ))}
          </div>

          {/* Selected period detail */}
          {selected && (
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{selected.period}</p>
                <button
                  onClick={() => compute(selected.period)}
                  disabled={computing}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-[11px] transition-all"
                >
                  <RefreshCw className="w-3 h-3" /> Recompute
                </button>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total",      val: selected.totalPredictions,   color: "text-white",   icon: Target      },
                  { label: "Correct",    val: selected.correctPredictions,  color: "text-green-400", icon: TrendingUp  },
                  { label: "Accuracy",   val: pct(selected.accuracy),      color: "text-blue-400",  icon: BarChart2   },
                  { label: "Avg Conf",   val: `${selected.avgConfidence.toFixed(1)}%`, color: "text-violet-400", icon: Target },
                ].map(c => (
                  <div key={c.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                    <c.icon className={`w-4 h-4 ${c.color} mb-1`} />
                    <p className={`text-base font-bold ${c.color}`}>{c.val}</p>
                    <p className="text-[10px] text-zinc-500">{c.label}</p>
                  </div>
                ))}
              </div>

              {/* Market breakdown */}
              {selected.marketBreakdown && Object.keys(selected.marketBreakdown).length > 0 && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                  <p className="text-xs font-semibold text-zinc-500 px-4 pt-3 pb-2">Market Breakdown</p>
                  <div className="divide-y divide-white/[0.04]">
                    {Object.entries(selected.marketBreakdown).map(([mkt, stat]) => (
                      <div key={mkt} className="flex items-center gap-3 px-4 py-2">
                        <p className="text-xs text-zinc-400 w-28 flex-shrink-0">{mkt}</p>
                        <div className="flex-1 bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(stat.accuracy * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <p className="text-xs font-mono text-white w-12 text-right">{pct(stat.accuracy)}</p>
                        <p className="text-[10px] text-zinc-600 w-16 text-right">{stat.correct}/{stat.total}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calibration */}
              {selected.calibrationData && selected.calibrationData.some(b => b.predictions > 0) && (
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
                  <p className="text-xs font-semibold text-zinc-500 px-4 pt-3 pb-2">Confidence Calibration</p>
                  <div className="divide-y divide-white/[0.04]">
                    {selected.calibrationData.filter(b => b.predictions > 0).map(b => (
                      <div key={b.bucket} className="flex items-center gap-3 px-4 py-2">
                        <p className="text-xs text-zinc-400 w-16 flex-shrink-0">{b.bucket}%</p>
                        <div className="flex-1 bg-white/[0.05] rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${(b.accuracy * 100).toFixed(0)}%` }}
                          />
                        </div>
                        <p className="text-xs font-mono text-white w-12 text-right">{pct(b.accuracy)}</p>
                        <p className="text-[10px] text-zinc-600 w-16 text-right">{b.correct}/{b.predictions}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-zinc-600">Computed: {new Date(selected.computedAt).toLocaleString("en-GB")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
