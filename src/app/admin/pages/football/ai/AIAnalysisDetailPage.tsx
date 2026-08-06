/**
 * AI Analysis Detail — Phase 17.2
 *
 * Full analysis view for a single match: features, per-market confidence bars,
 * reasoning text, suggested pick, and full markdown analysis report.
 *
 * All data comes from the backend. Nothing is calculated in this component.
 */

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Brain, RefreshCw, AlertCircle, CheckCircle,
  Clock, BarChart2, FileText, TrendingUp, RotateCcw, Zap,
} from "lucide-react";

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function tok() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization:  `Bearer ${tok()}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketOutcome { prediction: string; confidence: number }
interface ConfidenceData {
  overall: number;
  suggestedMarket: string; suggestedPrediction: string;
  suggestedConfidence: number; suggestedRiskLevel: string; suggestedIsVip: boolean;
  dataQuality: string;
  markets: {
    "1X2":           { home: MarketOutcome; draw: MarketOutcome; away: MarketOutcome };
    "btts":          { yes: MarketOutcome; no: MarketOutcome };
    "over_under":    { over: MarketOutcome; under: MarketOutcome };
    "double_chance": { "1X": MarketOutcome; "12": MarketOutcome; "X2": MarketOutcome };
  };
}
interface TeamForm {
  wins: number; draws: number; losses: number; winRate: number;
  avgGoalsScored: number; avgGoalsConceded: number; goalDifference: number;
  bttsRate: number; cleanSheets: number; bttsMatches: number;
  formString: string; matches: unknown[];
}
interface H2H { totalMatches: number; homeWins: number; draws: number; awayWins: number; avgGoals: number; bttsRate: number }
interface Features {
  homeTeam: string; awayTeam: string; leagueName: string;
  homeVenueForm: TeamForm; awayVenueForm: TeamForm;
  homeOverallForm: TeamForm; awayOverallForm: TeamForm;
  h2h: H2H; dataQuality: string; totalDataPoints: number;
}
interface Analysis {
  id: string; matchId: string; status: string;
  features: Features | null; confidenceData: ConfidenceData | null;
  reasoning: string | null; analysis: string | null;
  suggestedMarket: string | null; suggestedPrediction: string | null;
  suggestedConfidence: number | null; suggestedRiskLevel: string | null;
  suggestedIsVip: boolean; modelVersion: string | null;
  processingMs: number | null; error: string | null;
  createdAt: string; updatedAt: string;
  match: { homeTeam: string; awayTeam: string; kickoffAt: string; status: string; league: { name: string } };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfBar({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "bg-green-500" : value >= 55 ? "bg-amber-500" : "bg-zinc-500";
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-zinc-400 w-32 shrink-0 text-right">{label}</span>
      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-[11px] text-zinc-300 w-9 tabular-nums text-right">{value}%</span>
    </div>
  );
}

function FormChips({ form }: { form: string }) {
  return (
    <div className="flex gap-1">
      {form.split("").slice(0, 5).map((c, i) => (
        <span key={i} className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center ${
          c === "W" ? "bg-green-500/20 text-green-400" :
          c === "D" ? "bg-amber-500/20 text-amber-400" :
                      "bg-red-500/20 text-red-400"
        }`}>{c}</span>
      ))}
    </div>
  );
}

const STATUS_CLR: Record<string, string> = {
  completed: "text-green-400", failed: "text-red-400",
  analyzing: "text-amber-400", pending: "text-blue-400",
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AIAnalysisDetailPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [triggering, setTrig]   = useState(false);
  const [generating, setGen]    = useState(false);
  const [genError,   setGenErr] = useState("");

  const load = () => {
    if (!matchId) return;
    setLoading(true); setError("");
    apiFetch<Analysis>(`/api/v1/admin/ai/analyses/${matchId}`)
      .then(setAnalysis)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [matchId]);

  const trigger = async () => {
    if (!matchId) return;
    setTrig(true);
    try {
      await apiFetch(`/api/v1/admin/ai/analyses/${matchId}/trigger`, { method: "POST" });
      setTimeout(load, 1000); // brief delay then reload
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setTrig(false); }
  };

  const generate = async () => {
    if (!matchId) return;
    setGen(true); setGenErr("");
    try {
      await apiFetch(`/api/v1/admin/ai/predictions/${matchId}/generate`, { method: "POST" });
      navigate("/admin/football/ai/predictions");
    } catch (e: unknown) { setGenErr((e as Error).message); }
    finally { setGen(false); }
  };

  const f  = analysis?.features;
  const cd = analysis?.confidenceData;

  if (loading && !analysis) {
    return <div className="text-center py-20 text-zinc-500 text-sm">Loading analysis…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Brain className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">
            {analysis?.match.homeTeam ?? "…"} vs {analysis?.match.awayTeam ?? "…"}
          </h1>
          <p className="text-xs text-zinc-500">{analysis?.match.league.name ?? ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {analysis && (
            <span className={`text-xs font-medium ${STATUS_CLR[analysis.status] ?? "text-zinc-400"}`}>
              {analysis.status}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* No analysis / pending state */}
      {(!analysis || analysis.status === "pending") && (
        <div className="text-center py-14 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 mb-4">No analysis results yet.</p>
          <button
            onClick={trigger}
            disabled={triggering}
            className="px-4 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-sm transition-all disabled:opacity-50"
          >
            {triggering ? "Queuing…" : "Trigger Analysis"}
          </button>
        </div>
      )}

      {/* Failed state */}
      {analysis?.status === "failed" && (
        <div className="px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm font-medium text-red-300">Analysis failed</span>
          </div>
          {analysis.error && (
            <p className="text-xs text-red-400 font-mono break-all">{analysis.error}</p>
          )}
          <button
            onClick={trigger}
            disabled={triggering}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-all disabled:opacity-50"
          >
            <RotateCcw className={`w-3 h-3 ${triggering ? "animate-spin" : ""}`} />
            {triggering ? "Re-queuing…" : "Retry Analysis"}
          </button>
        </div>
      )}

      {/* Analyzing state */}
      {analysis?.status === "analyzing" && (
        <div className="text-center py-10 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <RefreshCw className="w-6 h-6 text-amber-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-amber-300">Analysis in progress…</p>
        </div>
      )}

      {/* Completed analysis */}
      {analysis?.status === "completed" && (
        <>
          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: CheckCircle, label: "Status",        value: "Completed",                                     clr: "text-green-400"  },
              { icon: Clock,       label: "Duration",       value: analysis.processingMs ? `${analysis.processingMs}ms` : "—", clr: "text-zinc-300" },
              { icon: Brain,       label: "Model",          value: analysis.modelVersion ?? "1.0.0",               clr: "text-violet-400" },
              { icon: BarChart2,   label: "Data points",    value: String(f?.totalDataPoints ?? 0),                clr: "text-blue-400"   },
            ].map(({ icon: Icon, label, value, clr }) => (
              <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${clr}`} />
                  <span className="text-[10px] text-zinc-500">{label}</span>
                </div>
                <p className={`text-sm font-semibold ${clr}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Suggested pick */}
          {cd && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Suggested Pick
              </h2>
              <div className="flex flex-wrap gap-4 items-center mb-3">
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Market</p>
                  <p className="text-sm font-bold text-white">{cd.suggestedMarket}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Prediction</p>
                  <p className="text-sm font-bold text-violet-300">{cd.suggestedPrediction}</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Confidence</p>
                  <p className="text-sm font-bold text-white">{cd.suggestedConfidence}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500 mb-0.5">Risk</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    cd.suggestedRiskLevel === "low"    ? "bg-green-500/15 text-green-400" :
                    cd.suggestedRiskLevel === "medium" ? "bg-amber-500/15 text-amber-400" :
                                                         "bg-red-500/15 text-red-400"
                  }`}>{cd.suggestedRiskLevel}</span>
                </div>
                {cd.suggestedIsVip && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">VIP</span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  cd.dataQuality === "high"   ? "bg-green-500/10 text-green-500" :
                  cd.dataQuality === "medium" ? "bg-amber-500/10 text-amber-500" :
                  cd.dataQuality === "low"    ? "bg-orange-500/10 text-orange-400" :
                                               "bg-zinc-500/10 text-zinc-500"
                }`}>Data: {cd.dataQuality}</span>
              </div>
              {analysis.reasoning && (
                <p className="text-xs text-zinc-300 italic border-t border-white/[0.06] pt-3">
                  {analysis.reasoning}
                </p>
              )}
            </div>
          )}

          {/* Market confidence bars */}
          {cd && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5" /> Confidence by Market
              </h2>
              <div className="space-y-2.5">
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider pt-1">1X2</p>
                <ConfBar label="Home win"        value={cd.markets["1X2"].home.confidence} />
                <ConfBar label="Draw"            value={cd.markets["1X2"].draw.confidence} />
                <ConfBar label="Away win"        value={cd.markets["1X2"].away.confidence} />
                <div className="h-px bg-white/[0.04] my-1" />
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">BTTS</p>
                <ConfBar label="Yes"             value={cd.markets["btts"].yes.confidence} />
                <ConfBar label="No"              value={cd.markets["btts"].no.confidence} />
                <div className="h-px bg-white/[0.04] my-1" />
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Over / Under</p>
                <ConfBar label="Over 2.5"        value={cd.markets["over_under"].over.confidence} />
                <ConfBar label="Under 2.5"       value={cd.markets["over_under"].under.confidence} />
                <div className="h-px bg-white/[0.04] my-1" />
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Double Chance</p>
                <ConfBar label="1X (Home/Draw)"  value={cd.markets["double_chance"]["1X"].confidence} />
                <ConfBar label="12 (Home/Away)"  value={cd.markets["double_chance"]["12"].confidence} />
                <ConfBar label="X2 (Draw/Away)"  value={cd.markets["double_chance"]["X2"].confidence} />
              </div>
            </div>
          )}

          {/* Feature extraction summary */}
          {f && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5" /> Extracted Features
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Home */}
                <div>
                  <p className="text-xs font-semibold text-white mb-2">{f.homeTeam} (Home)</p>
                  {f.homeVenueForm.matches.length > 0 ? (
                    <div className="space-y-1.5">
                      {[
                        ["Record (home)", `${f.homeVenueForm.wins}W ${f.homeVenueForm.draws}D ${f.homeVenueForm.losses}L`],
                        ["Win rate",      `${(f.homeVenueForm.winRate * 100).toFixed(0)}%`],
                        ["Avg scored",    f.homeVenueForm.avgGoalsScored.toFixed(2)],
                        ["Avg conceded",  f.homeVenueForm.avgGoalsConceded.toFixed(2)],
                        ["Goal diff",     `${f.homeVenueForm.goalDifference >= 0 ? "+" : ""}${f.homeVenueForm.goalDifference}`],
                        ["BTTS rate",     `${(f.homeVenueForm.bttsRate * 100).toFixed(0)}%`],
                        ["Clean sheets",  String(f.homeVenueForm.cleanSheets)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-[10px] text-zinc-500 w-24 shrink-0">{k}</span>
                          <span className="text-[10px] text-zinc-300">{v}</span>
                        </div>
                      ))}
                      {f.homeVenueForm.formString && (
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-[10px] text-zinc-500 w-24 shrink-0">Recent form</span>
                          <FormChips form={f.homeVenueForm.formString} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic">No home venue history</p>
                  )}
                </div>
                {/* Away */}
                <div>
                  <p className="text-xs font-semibold text-white mb-2">{f.awayTeam} (Away)</p>
                  {f.awayVenueForm.matches.length > 0 ? (
                    <div className="space-y-1.5">
                      {[
                        ["Record (away)", `${f.awayVenueForm.wins}W ${f.awayVenueForm.draws}D ${f.awayVenueForm.losses}L`],
                        ["Win rate",      `${(f.awayVenueForm.winRate * 100).toFixed(0)}%`],
                        ["Avg scored",    f.awayVenueForm.avgGoalsScored.toFixed(2)],
                        ["Avg conceded",  f.awayVenueForm.avgGoalsConceded.toFixed(2)],
                        ["Goal diff",     `${f.awayVenueForm.goalDifference >= 0 ? "+" : ""}${f.awayVenueForm.goalDifference}`],
                        ["BTTS rate",     `${(f.awayVenueForm.bttsRate * 100).toFixed(0)}%`],
                        ["Clean sheets",  String(f.awayVenueForm.cleanSheets)],
                      ].map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <span className="text-[10px] text-zinc-500 w-24 shrink-0">{k}</span>
                          <span className="text-[10px] text-zinc-300">{v}</span>
                        </div>
                      ))}
                      {f.awayVenueForm.formString && (
                        <div className="flex gap-2 items-center mt-1">
                          <span className="text-[10px] text-zinc-500 w-24 shrink-0">Recent form</span>
                          <FormChips form={f.awayVenueForm.formString} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-600 italic">No away venue history</p>
                  )}
                </div>
              </div>

              {/* H2H */}
              {f.h2h.totalMatches > 0 && (
                <div className="mt-4 pt-4 border-t border-white/[0.05]">
                  <p className="text-xs font-semibold text-white mb-2">Head to Head ({f.h2h.totalMatches} matches)</p>
                  <div className="flex flex-wrap gap-6">
                    {[
                      ["Record", `${f.h2h.homeWins}W ${f.h2h.draws}D ${f.h2h.awayWins}L`],
                      ["Avg goals/game", f.h2h.avgGoals.toFixed(2)],
                      ["BTTS rate", `${(f.h2h.bttsRate * 100).toFixed(0)}%`],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[10px] text-zinc-500">{k}</p>
                        <p className="text-[11px] text-zinc-200 font-medium">{v}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Full analysis markdown */}
          {analysis.analysis && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Full Analysis Report
              </h2>
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-5">
                {analysis.analysis}
              </pre>
            </div>
          )}

          {/* Generate prediction + re-trigger */}
          {genError && (
            <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">{genError}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs font-medium transition-all disabled:opacity-50"
            >
              <Zap className={`w-3.5 h-3.5 ${generating ? "animate-pulse" : ""}`} />
              {generating ? "Generating…" : "Generate Prediction"}
            </button>
            <button
              onClick={trigger}
              disabled={triggering}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 text-xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${triggering ? "animate-spin" : ""}`} />
              {triggering ? "Re-queuing…" : "Re-analyse"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
